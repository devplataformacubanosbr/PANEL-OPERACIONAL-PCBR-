import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'documentos_operacionales'
const MAX_SIZE_MB = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

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

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false })

    if (uploadError) throw uploadError

    const { data: docRecord, error: dbError } = await supabaseAdmin
      .from('documentos_operacionales')
      .insert({
        id_cliente: clienteId,
        tipo_documento: file.type.startsWith('image/') ? 'FOTO' : 'COMPROBANTE',
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
