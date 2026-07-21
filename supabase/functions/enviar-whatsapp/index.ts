import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cliente "anon" para validar la sesión del llamador (auth.getUser respeta
    // el JWT del usuario); el admin con service role se usa recién después de
    // confirmar quién llama, igual que en kommo-proxy/evolution-manager.
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // getUser (llamada a Supabase Auth) y el parseo del body no dependen uno
    // del otro — corren en paralelo en vez de en serie para no sumar una
    // ida y vuelta de red completa a la latencia total.
    const [{ data: { user }, error: authError }, { payload, error: parseError }] = await Promise.all([
      authClient.auth.getUser(authHeader.replace('Bearer ', '')),
      req.json().then(data => ({ payload: data, error: null })).catch(e => ({ payload: null, error: e }))
    ]);

    // Todos los llamadores reales de esta función (ClientWhatsApp.jsx,
    // GlobalBotListener.jsx, pipelineService.js) invocan vía
    // supabase.functions.invoke() desde una sesión de navegador logueada, así
    // que siempre traen un JWT de usuario válido. No hay llamador interno
    // "de servicio" legítimo — exigir sesión real, sin excepción.
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    if (parseError || !payload || !payload.cliente_id || (!payload.texto && !payload.media_url)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders })
    }

    // 2. Obtener datos del cliente y de la integración activa en paralelo
    const [
      { data: cliente, error: clienteError },
      { data: integracion, error: intError }
    ] = await Promise.all([
      supabaseAdmin
        .from('clientes')
        .select('id, telefono')
        .eq('id', payload.cliente_id)
        .single(),
      supabaseAdmin
        .from('integraciones_whatsapp')
        .select('*')
        .eq('activo', true)
        .limit(1)
        .single()
    ]);

    if (clienteError || !cliente) {
      return new Response(JSON.stringify({ error: 'Cliente not found' }), { status: 404, headers: corsHeaders })
    }

    if (intError || !integracion) {
      return new Response(JSON.stringify({ error: 'No active WhatsApp integration found for this organization' }), { status: 400, headers: corsHeaders })
    }

    // 4b. Enviar el mensaje según el proveedor
    let sendResult;

    if (integracion.proveedor === 'evolution_api' || integracion.proveedor === 'evolution_propio' || integracion.proveedor === 'evolution_compartido') {
      // Servidor compartido del SaaS: la URL/key reales viven en los secrets
      // globales del backend, no en la fila de integraciones_whatsapp
      // (que guarda 'internal' como placeholder — ver evolution-manager).
      const rawBaseUrl = integracion.proveedor === 'evolution_compartido'
        ? Deno.env.get('EVOLUTION_API_URL')
        : integracion.api_url;
      const rawApiKey = integracion.proveedor === 'evolution_compartido'
        ? Deno.env.get('EVOLUTION_API_KEY')
        : integracion.api_key;

      const baseUrl = rawBaseUrl?.trim().replace(/\/$/, '');
      const apiKey = rawApiKey?.trim();

      if (!baseUrl || !apiKey) {
        throw new Error('Evolution API no configurada.')
      }

      // Con archivo adjunto (payload.media_url) usamos el endpoint de media;
      // solo texto usa sendText. Evolution API espera la URL del archivo, no
      // el binario — el archivo ya está en Supabase Storage antes de llegar acá.
      const evolutionUrl = payload.media_url
        ? `${baseUrl}/message/sendMedia/${integracion.instancia}`
        : `${baseUrl}/message/sendText/${integracion.instancia}`

      let mediaPayload = payload.media_url;
      if (mediaPayload.startsWith('data:')) {
        const parts = mediaPayload.split(',');
        mediaPayload = parts.length > 1 ? parts[1] : mediaPayload;
      } else if (mediaPayload.startsWith('http')) {
        mediaPayload = encodeURI(mediaPayload);
      }

      const body = payload.media_url
        ? {
            number: cliente.telefono,
            mediatype: (payload.media_type || '').startsWith('audio/') ? 'audio' : (payload.media_type || '').startsWith('image/') ? 'image' : 'document',
            mimetype: payload.media_type || undefined,
            media: mediaPayload,
            fileName: payload.media_name || undefined,
            caption: payload.texto || undefined,
          }
        : {
            number: cliente.telefono,
            text: payload.texto
          };

      const response = await fetch(evolutionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Evolution API error: ${await response.text()}`)
      }
      sendResult = await response.json();

    } else if (integracion.proveedor === 'cloud_api') {
      // api_url = base de Graph API (ej. https://graph.facebook.com/v21.0);
      // instancia = Phone Number ID de Meta (configurado en WhatsAppSettings.jsx).
      const cloudUrl = `${integracion.api_url}/${integracion.instancia}/messages`
      
      const response = await fetch(cloudUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integracion.api_key}`
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cliente.telefono,
          type: 'text',
          text: {
            preview_url: false,
            body: payload.texto
          }
        })
      });

      if (!response.ok) {
        throw new Error(`WhatsApp Cloud API error: ${await response.text()}`)
      }
      sendResult = await response.json();

    } else {
      throw new Error(`Proveedor de WhatsApp no soportado: ${integracion.proveedor}`)
    }

    // 5. Guardar en base de datos. El mensaje real ya salió por Evolution API
    // en el paso anterior — este insert es solo registro/historial, así que
    // no bloqueamos la respuesta al frontend esperándolo.
    // remitente/telefono son las columnas legacy que todavía lee la UI de
    // chat (ClientWhatsApp.jsx); se mantienen en paralelo a tipo/proveedor.
    const insertPromise = supabaseAdmin
      .from('mensajes')
      .insert({
        cliente_id: cliente.id,
        texto: payload.texto || (payload.media_url ? `[Archivo] ${payload.media_name || ''}` : ''),
        tipo: 'saliente',
        proveedor: integracion.proveedor,
        leido: true,
        operario: user.user_metadata?.nombre || 'Operario',
        remitente: 'outgoing',
        telefono: cliente.telefono,
        media_url: payload.media_url || null,
        media_name: payload.media_name || null,
        media_type: payload.media_type || null
      })
      .then(({ error: insertError }) => {
        if (insertError) {
          console.error("Mensaje enviado pero falló guardado en BD:", insertError);
        }
      });

    // EdgeRuntime.waitUntil (Deno Deploy) deja el insert corriendo en segundo
    // plano tras responder; si no existe (ej. `supabase functions serve`
    // local), esperamos normalmente para no perder el insert.
    if (typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil(insertPromise);
    } else {
      await insertPromise;
    }

    return new Response(JSON.stringify({ success: true, provider: integracion.proveedor }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error sending message:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
