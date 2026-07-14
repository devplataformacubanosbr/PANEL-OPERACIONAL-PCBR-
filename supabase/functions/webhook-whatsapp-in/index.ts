import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar CORS (preflight request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Handshake de verificación de Meta: al configurar el webhook en el
  // Developer Console, Meta hace un GET con hub.mode/hub.verify_token/
  // hub.challenge y espera recibir hub.challenge de vuelta como texto plano,
  // solo si el verify_token coincide con el que configuramos nosotros.
  // Reusamos webhook_secret como verify_token (el mismo valor que ya viaja
  // como ?secret= en la URL que le pasamos al usuario para pegar en Meta).
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const secret = url.searchParams.get('secret');

    if (mode !== 'subscribe' || !token || !challenge) {
      return new Response('Bad Request', { status: 400, headers: corsHeaders });
    }

    let tokenValido = secret && token === secret;
    if (!tokenValido) {
      const { data } = await supabaseClient
        .from('integraciones_whatsapp')
        .select('id')
        .eq('webhook_secret', token)
        .maybeSingle();
      tokenValido = !!data;
    }

    if (!tokenValido) {
      console.error('Verificación de webhook de Meta falló: verify_token no reconocido.');
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    return new Response(challenge, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }

  try {
    const payload = await req.json();
    console.log("Received webhook payload:", JSON.stringify(payload, null, 2));

    let processedMessage = null;

    // Detectar proveedor basado en el payload
    if (payload.object === 'whatsapp_business_account' && payload.entry) {
      // 1. Formato WhatsApp Cloud API (Meta)
      const entry = payload.entry[0];
      const changes = entry.changes[0];
      const value = changes.value;
      
      if (value.messages && value.messages.length > 0) {
        const message = value.messages[0];
        const contact = value.contacts?.[0];
        // phone_number_id es el identificador estable que configuramos como
        // `instancia` al conectar (WhatsAppSettings.jsx); display_phone_number
        // es el número formateado para mostrar, no sirve para matchear.
        const phoneNumberId = value.metadata?.phone_number_id;

        processedMessage = {
          proveedor: 'cloud_api',
          telefono_cliente: message.from,
          nombre_cliente: contact?.profile?.name || 'Cliente',
          texto: message.text?.body || '[Multimedia]',
          numero_instancia: phoneNumberId,
          timestamp: message.timestamp
        };
      }
    } else if (payload.event === 'messages.upsert' && payload.data) {
      // 2. Formato Evolution API
      const messageData = payload.data.message;
      const jid = messageData.key.remoteJid;
      
      if (jid && !jid.includes('@g.us')) { // Ignorar grupos
        const telefono = jid.split('@')[0];
        processedMessage = {
          proveedor: 'evolution_api',
          telefono_cliente: telefono,
          nombre_cliente: payload.data.pushName || 'Cliente',
          texto: messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '[Multimedia]',
          numero_instancia: payload.instance,
          timestamp: messageData.messageTimestamp
        };
      }
    }

    if (!processedMessage) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'Not a recognized message format' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    // Empresa única: no hace falta resolver organización, solo autenticar
    // que el request viene de nuestra integración de WhatsApp (secreto por
    // query param, ver evolution-manager). Si la integración no tiene
    // webhook_secret configurado todavía (legacy / Cloud API pegado a mano
    // sin el query param), se deja pasar sin autenticar el origen — no hay
    // riesgo de suplantar a otro tenant porque ya no existen tenants.
    const webhookSecret = new URL(req.url).searchParams.get('secret');

    const { data: integracion } = await supabaseClient
      .from('integraciones_whatsapp')
      .select('id, webhook_secret')
      .limit(1)
      .maybeSingle();

    if (integracion?.webhook_secret && integracion.webhook_secret !== webhookSecret) {
      console.error("Webhook secret inválido o no reconocido.");
      return new Response(JSON.stringify({ error: 'Invalid webhook secret' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    // Buscar o crear cliente
    let clienteId = null;
    const { data: cliente } = await supabaseClient
      .from('clientes')
      .select('id')
      .eq('telefono', processedMessage.telefono_cliente)
      .single();

    if (cliente) {
      clienteId = cliente.id;
    } else {
      const { data: newCliente, error: createError } = await supabaseClient
        .from('clientes')
        .insert({
          telefono: processedMessage.telefono_cliente,
          nombre: processedMessage.nombre_cliente
        })
        .select('id')
        .single();

      if (!createError && newCliente) clienteId = newCliente.id;
    }

    // Insertar en tabla mensajes
    // remitente/telefono son las columnas legacy que todavía lee la UI de
    // chat (ClientWhatsApp.jsx); se mantienen en paralelo a tipo/proveedor.
    if (clienteId) {
      await supabaseClient
        .from('mensajes')
        .insert({
          cliente_id: clienteId,
          texto: processedMessage.texto,
          tipo: 'entrante',
          proveedor: processedMessage.proveedor,
          leido: false,
          remitente: 'incoming',
          telefono: processedMessage.telefono_cliente
        });
    }

    return new Response(JSON.stringify({ success: true, message: 'Processed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
