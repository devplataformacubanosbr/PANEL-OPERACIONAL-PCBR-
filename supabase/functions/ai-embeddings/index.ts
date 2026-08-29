import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
// Dos mensajes del mismo cliente separados por más de esto se tratan como
// conversaciones distintas ("sesiones") en vez de un solo bloque gigante.
const SESSION_GAP_HOURS = 3
const MAX_CHUNK_CHARS = 6000

async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: texts }),
  })
  if (!res.ok) {
    throw new Error(`OpenAI embeddings error (${res.status}): ${await res.text()}`)
  }
  const data = await res.json()
  return data.data.map((d: any) => d.embedding)
}

function agruparPorSesion(mensajes: any[]): any[][] {
  const sesiones: any[][] = []
  let actual: any[] = []
  let ultimaFecha: number | null = null

  for (const m of mensajes) {
    const t = new Date(m.fecha_recepcion).getTime()
    if (ultimaFecha !== null && (t - ultimaFecha) > SESSION_GAP_HOURS * 3600 * 1000) {
      if (actual.length > 0) sesiones.push(actual)
      actual = []
    }
    actual.push(m)
    ultimaFecha = t
  }
  if (actual.length > 0) sesiones.push(actual)
  return sesiones
}

function formatearSesion(mensajes: any[]): string {
  return mensajes
    .map((m) => {
      const quien = (!m.remitente || m.remitente === 'incoming') ? 'Cliente' : 'Agente'
      return `[${new Date(m.fecha_recepcion).toLocaleString('es-AR')}] ${quien}: ${m.texto || ''}`
    })
    .join('\n')
    .slice(0, MAX_CHUNK_CHARS)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY no configurada en los secrets de Supabase.' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const payload = await req.json().catch(() => ({}))
    const action = payload.action

    // ────────────────────────────────────────────────────────────────
    // Procesa en lote los mensajes que todavía no se embebieron: los
    // agrupa por cliente y por "sesión" de conversación, genera un
    // embedding por sesión y lo guarda en conversaciones_embeddings.
    // Pensada para llamarse periódicamente (cron) — ver el SQL comentado
    // en database/standalone/010_vector_conversaciones.sql.
    // ────────────────────────────────────────────────────────────────
    if (action === 'procesar_pendientes') {
      const cronSecret = Deno.env.get('CRON_SECRET')
      if (cronSecret && payload.secret !== cronSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }

      const { data: pendientes, error: pendErr } = await supabaseAdmin
        .from('mensajes')
        .select('cliente_id')
        .eq('embedding_procesado', false)
        .not('cliente_id', 'is', null)

      if (pendErr) throw pendErr

      const clienteIds = [...new Set((pendientes || []).map((p: any) => p.cliente_id))]
      let sesionesEmbebidas = 0

      for (const clienteId of clienteIds) {
        const { data: mensajesCliente, error: msgErr } = await supabaseAdmin
          .from('mensajes')
          .select('id, texto, remitente, fecha_recepcion')
          .eq('cliente_id', clienteId)
          .eq('embedding_procesado', false)
          .order('fecha_recepcion', { ascending: true })

        if (msgErr || !mensajesCliente || mensajesCliente.length === 0) continue

        const idsProcesados = mensajesCliente.map((m: any) => m.id)
        const sesiones = agruparPorSesion(mensajesCliente)
        const textos = sesiones.map(formatearSesion)

        // Sesiones con muy poco contenido (ej. un solo "ok") no aportan nada
        // como caso de referencia — se descartan pero igual se marcan como
        // procesadas para no reintentarlas en cada corrida.
        const validos = sesiones
          .map((sesion, i) => ({ sesion, texto: textos[i] }))
          .filter((x) => x.texto.trim().length > 15)

        if (validos.length > 0) {
          const { data: cliente } = await supabaseAdmin
            .from('clientes')
            .select('tramite')
            .eq('id', clienteId)
            .maybeSingle()

          const embeddings = await embedTexts(validos.map((v) => v.texto), openaiKey)

          for (let i = 0; i < validos.length; i++) {
            const { sesion, texto } = validos[i]
            const { error: insErr } = await supabaseAdmin.rpc('insertar_embedding_conversacion', {
              p_cliente_id: clienteId,
              p_contenido: texto,
              p_embedding: embeddings[i],
              p_fecha_inicio: sesion[0].fecha_recepcion,
              p_fecha_fin: sesion[sesion.length - 1].fecha_recepcion,
              p_servicio: cliente?.tramite || null,
            })
            if (insErr) {
              console.error('Error insertando embedding:', insErr)
            } else {
              sesionesEmbebidas++
            }
          }
        }

        await supabaseAdmin.from('mensajes').update({ embedding_procesado: true }).in('id', idsProcesados)
      }

      return new Response(
        JSON.stringify({ success: true, clientesProcesados: clienteIds.length, sesionesEmbebidas }),
        { headers: corsHeaders }
      )
    }

    // ────────────────────────────────────────────────────────────────
    // Dado un texto (la pregunta del agente, o el mensaje del cliente),
    // devuelve las sesiones de conversación más parecidas de OTROS
    // clientes — para que el asistente pueda citar cómo se resolvió un
    // caso similar antes.
    // ────────────────────────────────────────────────────────────────
    if (action === 'buscar_similares') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      )
      const { data: { user }, error: authError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }

      const texto = payload.texto
      if (!texto || !texto.trim()) {
        return new Response(JSON.stringify({ error: 'Falta "texto"' }), { status: 400, headers: corsHeaders })
      }

      const [embedding] = await embedTexts([texto], openaiKey)

      const { data, error } = await supabaseAdmin.rpc('buscar_casos_similares', {
        query_embedding: embedding,
        match_count: payload.limite || 5,
        cliente_excluir: payload.cliente_id_excluir || null,
      })
      if (error) throw error

      return new Response(JSON.stringify({ success: true, casos: data || [] }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Action not supported' }), { status: 400, headers: corsHeaders })
  } catch (error) {
    console.error('AI Embeddings Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
