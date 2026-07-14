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
    // 1. Verificar Autenticación (Sólo usuarios logueados pueden solicitar QRs)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401, headers: corsHeaders })
    }

    // 2. Cargar Secretos Globales del SaaS (Configurados por el dueño del SaaS)
    const EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      return new Response(JSON.stringify({ error: 'Evolution API NO configurada en el backend por el administrador del sistema.' }), { status: 500, headers: corsHeaders })
    }

    // 3. Procesar Solicitud
    const payload = await req.json();
    const action = payload.action; // 'get_qr', 'logout', 'status'

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Empresa única: una sola instancia de WhatsApp, nombre fijo (antes era
    // `org_${orgId.substring(0,8)}` por tenant).
    const instanciaNombre = 'empresa_principal';
    
    if (action === 'get_qr') {
      // a) Crear instancia en Evolution. Si ya existe, Evolution suele responder
      // 403/409 — eso es esperado y no debe cortar el flujo. Cualquier otro
      // fallo (auth, servidor caído) sí queda registrado para diagnóstico.
      const createResponse = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
        body: JSON.stringify({
          instanceName: instanciaNombre,
          qrcode: true,
          // Requerido por Evolution API v2 (NestJS); sin esto, /instance/create
          // responde 400 y la instancia nunca llega a existir para el paso b).
          integration: 'WHATSAPP-BAILEYS'
        })
      });
      let createErrorDetail = null;
      if (!createResponse.ok) {
        createErrorDetail = await createResponse.text();
        console.warn(`instance/create respondió ${createResponse.status}: ${createErrorDetail}`);
      }

      // b) Obtener QR (Base64)
      const connectResponse = await fetch(`${EVOLUTION_URL}/instance/connect/${instanciaNombre}`, {
        method: 'GET',
        headers: { 'apikey': EVOLUTION_KEY }
      });

      if (!connectResponse.ok) {
        const errorText = await connectResponse.text();
        console.error(`instance/connect falló (${connectResponse.status}): ${errorText}`);
        const createDetail = createErrorDetail ? ` | instance/create también había fallado (${createResponse.status}): ${createErrorDetail}` : '';
        throw new Error(`Evolution API no respondió al conectar la instancia (${connectResponse.status}). ${errorText}${createDetail}`);
      }

      const connectData = await connectResponse.json();

      // La forma de la respuesta varía entre versiones de Evolution API:
      // algunas devuelven { base64 } plano, otras { qrcode: { base64 } } o
      // { qrcode: "data:image/..." } como string directo.
      const base64 = connectData?.base64
        || (typeof connectData?.qrcode === 'string' ? connectData.qrcode : connectData?.qrcode?.base64);
      const instanceStatus = connectData?.instance?.state || connectData?.state || 'pending';

      if (!base64 && instanceStatus !== 'open') {
        console.error('Respuesta de Evolution API sin QR reconocible:', JSON.stringify(connectData));
        throw new Error('Evolution API no devolvió un código QR. Puede que la instancia ya esté conectada o en un estado inesperado — revisa el estado o intenta de nuevo.');
      }

      // c) Configurar Webhook para esta instancia
      // Un secreto por organización viaja como query param en la URL del webhook:
      // así webhook-whatsapp-in puede resolver la organización dueña del mensaje
      // sin depender únicamente del nombre de instancia (que es adivinable).
      const webhookSecret = crypto.randomUUID();
      const webhookUrlStr = `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-whatsapp-in?secret=${webhookSecret}`;
      const webhookResponse = await fetch(`${EVOLUTION_URL}/webhook/set/${instanciaNombre}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrlStr,
          events: ["MESSAGES_UPSERT"]
        })
      });
      if (!webhookResponse.ok) {
        console.warn(`webhook/set respondió ${webhookResponse.status}: ${await webhookResponse.text()}`);
      }

      // Guardar en tabla integraciones_whatsapp (una sola fila, empresa única)
      const { data: existing } = await supabaseAdmin
        .from('integraciones_whatsapp')
        .select('id')
        .limit(1)
        .maybeSingle();

      await supabaseAdmin
        .from('integraciones_whatsapp')
        .upsert({
          ...(existing?.id ? { id: existing.id } : {}),
          proveedor: 'evolution_compartido',
          api_url: 'internal',
          api_key: 'internal',
          instancia: instanciaNombre,
          webhook_secret: webhookSecret,
          activo: true
        });

      return new Response(JSON.stringify({
        success: true,
        base64,
        instanceStatus
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'status') {
       const statusResponse = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanciaNombre}`, {
        method: 'GET',
        headers: { 'apikey': EVOLUTION_KEY }
      });
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error(`instance/connectionState falló (${statusResponse.status}): ${errorText}`);
        throw new Error(`Evolution API no respondió al consultar el estado (${statusResponse.status}).`);
      }
      const statusData = await statusResponse.json();
      return new Response(JSON.stringify({ status: statusData?.instance?.state || statusData?.state || 'unknown' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'logout') {
      // Cierra la sesión de WhatsApp en Evolution (el teléfono queda
      // desvinculado). No es fatal si falla (p. ej. ya estaba desconectada)
      // — igual quitamos el registro de nuestro lado.
      const logoutResponse = await fetch(`${EVOLUTION_URL}/instance/logout/${instanciaNombre}`, {
        method: 'DELETE',
        headers: { 'apikey': EVOLUTION_KEY }
      });
      if (!logoutResponse.ok) {
        console.warn(`instance/logout respondió ${logoutResponse.status}: ${await logoutResponse.text()}`);
      }

      await supabaseAdmin
        .from('integraciones_whatsapp')
        .delete()
        .eq('instancia', instanciaNombre);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Action not supported' }), { status: 400, headers: corsHeaders })

  } catch (error) {
    console.error("Evolution Manager Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
