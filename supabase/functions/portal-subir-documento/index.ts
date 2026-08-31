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

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// Clasifica el tipo de documento con IA de visión (Groq). Solo se llama para
// imágenes -- un PDF/Word requeriría renderizar la primera página a imagen
// primero, que hoy solo sabe hacer el navegador (pdfjs+canvas), no Deno.
// Si algo falla (sin API key, Groq caído, respuesta rara, imagen muy pesada),
// se traga el error y devuelve null: el caller cae al tipo genérico de
// siempre, la subida nunca se rompe por esto.
async function classifyDocumentType(bytes: Uint8Array, mimeType: string): Promise<string | null> {
  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) return null

    const base64 = uint8ToBase64(bytes)
    const prompt = `Eres un clasificador de documentos para una agencia de trámites migratorios en Brasil.
Mira la imagen y decide qué tipo de documento es, usando EXACTAMENTE uno de estos valores (ni uno más):
${TIPOS_DOCUMENTO_VALIDOS.join(', ')}

Guía rápida: pasaporte -> PASAPORTE. CPF (Brasil) -> CPF. Carnet/cédula de identidad de Cuba u otro país de origen -> CARNET DE IDENTIDAD. RNM (Registro Nacional Migratório de Brasil) -> RNM. Cuenta de luz/agua/gas o contrato a nombre del cliente (comprobante de domicilio) -> COMPROBANTE DE RESIDENCIA. Recibo del sistema Sisconare (solicitud de refugio) -> RECIBO SISCONARE. Foto tipo carnet 3x4 -> FOTO 3X4. Cualquier otro comprobante/recibo -> COMPROBANTE. Formulario en blanco o completado a mano -> FORMULARIO. Selfie o foto que no encaja en nada de lo anterior -> FOTO. Si no estás seguro -> OTRO.

Devuelve ÚNICAMENTE un objeto JSON puro, sin markdown: {"tipo_documento": "VALOR"}`

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
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      console.warn('[portal-subir-documento] Groq clasificación HTTP', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content || '').trim()
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    const tipo = String(parsed.tipo_documento || '').toUpperCase().trim()

    return TIPOS_DOCUMENTO_VALIDOS.includes(tipo) ? tipo : null
  } catch (err) {
    console.warn('[portal-subir-documento] Clasificación IA falló, usando tipo genérico:', err.message)
    return null
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

    const tipoClasificado = file.type.startsWith('image/')
      ? await classifyDocumentType(fileBytes, file.type)
      : null

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
