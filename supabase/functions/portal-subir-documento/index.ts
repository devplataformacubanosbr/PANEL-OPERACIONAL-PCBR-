import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'documentos_operacionales'
const MAX_SIZE_MB = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

// Debe coincidir EXACTAMENTE con DOCUMENT_TYPE_OPTIONS en
// src/components/clientView.constants.js -- es el vocabulario que usa el
// checklist de "PDF Único" (tramites_requisitos.tipo_documento) para hacer
// match automático. Si un cliente sube su CPF por el Portal y esto lo
// etiqueta como "FOTO" genérico en vez de "CPF", el checklist nunca lo
// reconoce y el PDF Único jamás se arma solo -- por eso el Portal necesita
// esta clasificación (antes solo el dashboard, vía elección manual del
// staff, dejaba el tipo bien puesto).
const TIPOS_DOCUMENTO_VALIDOS = [
  'FOTO', 'FOTO 3X4', 'COMPROBANTE', 'COMPROBANTE DE RESIDENCIA',
  'RNM', 'CARNET DE IDENTIDAD', 'DOCUMENTO IDENTIDAD', 'PASAPORTE',
  'CPF', 'RECIBO SISCONARE', 'FORMULARIO', 'OTRO',
]

// Claves de datos que la IA puede intentar extraer de un documento, y que
// mapean 1:1 a columnas de `clientes`. Mantener esta lista sincronizada con
// las columnas reales de `database/standalone/001_schema.sql` -- cualquier
// clave que la IA devuelva fuera de esta lista se descarta sin más (ver
// sanitizeDatosExtraidos), nunca se hace `UPDATE ... SET <col dinámica>`.
const CAMPOS_EXTRAIBLES_CLIENTE = [
  'nombre', 'nacionalidad', 'fecha_nacimiento', 'lugar_nacimiento',
  'numero_pasaporte', 'fecha_emision_pasaporte', 'fecha_vencimiento_pasaporte',
  'cpf', 'carnet_identidad', 'rnm', 'numero_refugio', 'nombre_padre',
  'nombre_madre', 'direccion',
]

function sanitizeDatosExtraidos(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const key of CAMPOS_EXTRAIBLES_CLIENTE) {
    const val = (raw as Record<string, unknown>)[key]
    if (typeof val === 'string' && val.trim().length > 0) {
      out[key] = val.trim()
    }
  }
  return out
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// Clasifica el tipo de documento Y extrae los datos del cliente que sean
// claramente legibles en la imagen (nombre, CPF, fecha de nacimiento, etc.),
// con IA de visión (Groq), en una sola llamada. Solo se llama para imágenes
// -- un PDF/Word requeriría renderizar la primera página a imagen primero,
// que hoy solo sabe hacer el navegador (pdfjs+canvas), no Deno.
// Si algo falla (sin API key, Groq caído, respuesta rara, imagen muy pesada),
// se traga el error y devuelve tipo null y datos vacíos: el caller cae al
// tipo genérico de siempre y no actualiza al cliente, la subida nunca se
// rompe por esto.
async function classifyAndExtract(bytes: Uint8Array, mimeType: string): Promise<{ tipo: string | null; datos: Record<string, string> }> {
  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) return { tipo: null, datos: {} }

    const base64 = uint8ToBase64(bytes)
    // Reglas de dominio (orden de nombre en pasaportes, MRZ, Filiação de RNM,
    // etc.) portadas de la extracción probada del dashboard -- ver
    // analyzeDocumentImage en src/services/aiService.js. Mantener ambas en
    // sync si se ajusta una: acá no se puede importar ese archivo (corre en
    // el navegador, usa canvas/DOM que no existen en Deno).
    const prompt = `Eres un asistente que lee documentos de identidad e inmigración para una agencia de trámites migratorios en Brasil. Vas a hacer DOS cosas con esta imagen:

1) Clasifica el tipo de documento usando EXACTAMENTE uno de estos valores (ni uno más):
${TIPOS_DOCUMENTO_VALIDOS.join(', ')}

Guía rápida: pasaporte -> PASAPORTE. CPF (Brasil) -> CPF. Carnet/cédula de identidad de Cuba u otro país de origen -> CARNET DE IDENTIDAD. RNM (Registro Nacional Migratório de Brasil) -> RNM. Cuenta de luz/agua/gas o contrato a nombre del cliente (comprobante de domicilio) -> COMPROBANTE DE RESIDENCIA. Recibo del sistema Sisconare (solicitud de refugio) -> RECIBO SISCONARE. Foto tipo carnet 3x4 -> FOTO 3X4. Cualquier otro comprobante/recibo -> COMPROBANTE. Formulario en blanco o completado a mano -> FORMULARIO. Selfie o foto que no encaja en nada de lo anterior -> FOTO. Si no estás seguro -> OTRO.

2) Extrae los datos del cliente que estén CLARAMENTE visibles y legibles en esta imagen, usando exclusivamente estas claves cuando apliquen: ${CAMPOS_EXTRAIBLES_CLIENTE.join(', ')}.

REGLAS DE EXTRACCIÓN:
- Todas las fechas en formato ISO YYYY-MM-DD.
- El campo cpf solo con dígitos.
- Pasaportes: cuidado con el orden del nombre. "APELLIDOS/SURNAMES" suele ir arriba y "NOMBRES/GIVEN NAMES" debajo -- concatena siempre como "NOMBRE(S) APELLIDO(S)" (ej. Apellidos: GUIBERT GONZALEZ, Nombres: GEORGINA -> nombre: "GEORGINA GUIBERT GONZALEZ").
- "Nº DE PASAPORTE/PASSPORT Nº" (letras+números, ej. L302474) va en numero_pasaporte. "Nº DE IDENTIDAD/ID Nº" (solo dígitos, ej. 11 dígitos) va en carnet_identidad, NUNCA en numero_pasaporte.
- Si la parte principal del pasaporte está borrosa, usa el código MRZ (las dos líneas de letras/números abajo) para nombre, número de pasaporte y carnet de identidad.
- RNM: el código alfanumérico bajo "RNM" (ej. F744334-H) va en rnm. Concatena "NOME"+"SOBRENOME" para nombre. Bajo "FILIAÇÃO" aparecen los padres -- asigna nombre_madre/nombre_padre por sentido común según los nombres (no asumas que el primero siempre es la madre).
- Recibo Sisconare: el número bajo "Protocolo de Solicitação de Refúgio" va en numero_refugio; "Validade" en fecha_vencimiento_refugio.
- NUNCA inventes, adivines ni completes un dato que no se vea con certeza en la imagen -- omite la clave por completo si no estás seguro.

Devuelve ÚNICAMENTE un objeto JSON puro, sin markdown, con esta forma exacta:
{"tipo_documento": "VALOR", "datos_extraidos": {"clave": "valor", ...}}`

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        }],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      console.warn('[portal-subir-documento] Groq clasificación HTTP', res.status, await res.text().catch(() => ''))
      return { tipo: null, datos: {} }
    }

    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content || '').trim()
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    const tipoRaw = String(parsed.tipo_documento || '').toUpperCase().trim()
    const tipo = TIPOS_DOCUMENTO_VALIDOS.includes(tipoRaw) ? tipoRaw : null
    const datos = sanitizeDatosExtraidos(parsed.datos_extraidos)

    return { tipo, datos }
  } catch (err) {
    console.warn('[portal-subir-documento] Clasificación/extracción IA falló, usando tipo genérico:', err.message)
    return { tipo: null, datos: {} }
  }
}

// Aplica al cliente solo los campos extraídos que hoy están vacíos en su
// ficha -- nunca pisa un valor ya cargado (a mano o por una subida anterior),
// para que un documento borroso o mal leído jamás corrija silenciosamente un
// dato que el staff ya revisó. Si no hay nada nuevo que llenar, no hace UPDATE.
async function rellenarDatosFaltantesCliente(
  supabaseAdmin: ReturnType<typeof createClient>,
  clienteId: number,
  datosExtraidos: Record<string, string>
): Promise<void> {
  if (Object.keys(datosExtraidos).length === 0) return

  const { data: clienteActual, error: fetchError } = await supabaseAdmin
    .from('clientes')
    .select(CAMPOS_EXTRAIBLES_CLIENTE.join(','))
    .eq('id', clienteId)
    .single()

  if (fetchError || !clienteActual) {
    console.warn('[portal-subir-documento] No se pudo leer cliente para rellenar datos:', fetchError?.message)
    return
  }

  const actualizacion: Record<string, string> = {}
  for (const [key, value] of Object.entries(datosExtraidos)) {
    const valorActual = (clienteActual as Record<string, unknown>)[key]
    if (valorActual === null || valorActual === undefined || String(valorActual).trim() === '') {
      actualizacion[key] = value
    }
  }

  if (Object.keys(actualizacion).length === 0) return

  actualizacion.modificado_en = new Date().toISOString()

  const { error: updateError } = await supabaseAdmin
    .from('clientes')
    .update(actualizacion)
    .eq('id', clienteId)

  if (updateError) {
    console.warn('[portal-subir-documento] No se pudo actualizar cliente con datos extraídos:', updateError.message)
  }
}

// Permite que un cliente del Portal (PORTALClientes-PCBR) suba sus propios
// documentos. El portal corre siempre como rol `anon` (login propio por
// numero_cliente/clave_acceso vía login_cliente_portal, nunca crea sesión
// real de Supabase Auth), así que no hay JWT de usuario que verificar como
// en invite-team-member. En su lugar, re-validamos identificador+clave contra
// login_cliente_portal en cada subida, y el id_cliente que esa función
// devuelve es la única fuente de verdad — nunca se confía en un id mandado
// por el cliente, para que nadie pueda subir un documento "como si fuera"
// otro cliente.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const formData = await req.formData()
    const identificador = formData.get('identificador')
    const clave = formData.get('clave')
    const file = formData.get('file')

    if (!identificador || !clave || !file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Faltan datos requeridos.' }), { status: 400, headers: corsHeaders })
    }

    const { data: loginData, error: loginError } = await authClient.rpc('login_cliente_portal', {
      p_identificador: String(identificador).trim(),
      p_clave: String(clave).trim(),
    })

    if (loginError || !loginData?.success || !loginData?.cliente?.id) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401, headers: corsHeaders })
    }

    const clienteId = loginData.cliente.id

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return new Response(JSON.stringify({ error: `El archivo supera el límite de ${MAX_SIZE_MB}MB.` }), { status: 400, headers: corsHeaders })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: `Tipo de archivo no permitido: ${file.type}` }), { status: 400, headers: corsHeaders })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const storagePath = `${clienteId}/${uniqueName}`

    const fileBytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, fileBytes, { contentType: file.type, upsert: false })

    if (uploadError) throw uploadError

    const { tipo: tipoClasificado, datos: datosExtraidos } = file.type.startsWith('image/')
      ? await classifyAndExtract(fileBytes, file.type)
      : { tipo: null, datos: {} }

    const { data: docRecord, error: dbError } = await supabaseAdmin
      .from('documentos_operacionales')
      .insert({
        id_cliente: clienteId,
        tipo_documento: tipoClasificado || (file.type.startsWith('image/') ? 'FOTO' : 'COMPROBANTE'),
        nombre_archivo: file.name,
        url_archivo: storagePath,
        tamaño_bytes: file.size,
        tipo_contenido: file.type,
        subido_por: 'Cliente (App)',
        estado: 'pendiente',
      })
      .select()
      .single()

    if (dbError) throw dbError

    // Auto-completar la ficha del cliente con lo que la IA leyó del
    // documento, antes de que un operacional lo revise. Solo llena campos
    // vacíos (ver rellenarDatosFaltantesCliente) -- si esto falla, no rompe
    // la subida, el documento ya quedó guardado.
    await rellenarDatosFaltantesCliente(supabaseAdmin, clienteId, datosExtraidos)

    return new Response(JSON.stringify({ success: true, documento: docRecord }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error subiendo documento del portal:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
