import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { encodeBase64Url } from "https://deno.land/std@0.203.0/encoding/base64url.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const [{ data: { user }, error: authError }, { payload, error: parseError }] = await Promise.all([
      authClient.auth.getUser(authHeader.replace('Bearer ', '')),
      req.json().then(data => ({ payload: data, error: null })).catch(e => ({ payload: null, error: e }))
    ]);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    if (parseError || !payload || !payload.cliente_id || !payload.asunto || !payload.cuerpo || !payload.destinatario) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders })
    }

    const { data: integracion, error: intError } = await supabaseAdmin
      .from('integraciones_email')
      .select('*')
      .eq('activo', true)
      .single()

    if (intError || !integracion) {
      return new Response(JSON.stringify({ error: 'No active email integration found' }), { status: 400, headers: corsHeaders })
    }

    let accessToken = integracion.access_token;
    
    if (integracion.refresh_token) {
       const clientId = Deno.env.get('GMAIL_CLIENT_ID');
       const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
       const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
         method: 'POST',
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
         body: new URLSearchParams({
           client_id: clientId || '',
           client_secret: clientSecret || '',
           refresh_token: integracion.refresh_token,
           grant_type: 'refresh_token'
         })
       });
       
       if (refreshResponse.ok) {
         const refreshData = await refreshResponse.json();
         accessToken = refreshData.access_token;
         await supabaseAdmin.from('integraciones_email').update({ access_token: accessToken }).eq('id', integracion.id);
       } else {
         console.error('Failed to refresh token', await refreshResponse.text());
         return new Response(JSON.stringify({ error: 'Gmail token expired and refresh failed. Please reconnect Gmail.' }), { status: 401, headers: corsHeaders })
       }
    }

    const { cliente_id, asunto, cuerpo, destinatario, adjuntos } = payload;
    const boundary = "foo_bar_baz_boundary";
    let emailStr = `To: ${destinatario}\r\n`;
    emailStr += `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(asunto)))}?=\r\n`;
    emailStr += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    emailStr += `--${boundary}\r\n`;
    emailStr += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    emailStr += `${cuerpo.replace(/\n/g, '<br>')}\r\n\r\n`;

    const adjuntosArray = adjuntos || [];
    for (const adj of adjuntosArray) {
      if (adj.url) {
        try {
          let downloadUrl = adj.url;
          if (downloadUrl.includes('supabase.co') && !downloadUrl.includes('public')) {
            const urlParts = downloadUrl.split('/storage/v1/object/');
            if (urlParts.length > 1) {
              const pathParts = urlParts[1].split('/');
              const bucket = pathParts[0];
              const filePath = pathParts.slice(1).join('/');
              const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(filePath, 60);
              if (data) downloadUrl = data.signedUrl;
            }
          }
          
          const fileResp = await fetch(downloadUrl);
          if (fileResp.ok) {
            const arrayBuffer = await fileResp.arrayBuffer();
            const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            const mimeType = fileResp.headers.get('content-type') || 'application/pdf';
            const fileName = adj.nombre || 'documento.pdf';
            
            emailStr += `--${boundary}\r\n`;
            emailStr += `Content-Type: ${mimeType}; name="${fileName}"\r\n`;
            emailStr += `Content-Disposition: attachment; filename="${fileName}"\r\n`;
            emailStr += `Content-Transfer-Encoding: base64\r\n\r\n`;
            emailStr += `${base64Data}\r\n\r\n`;
          }
        } catch (err) {
          console.error("Error downloading attachment:", err);
        }
      }
    }
    
    emailStr += `--${boundary}--\r\n`;
    const rawMessage = encodeBase64Url(new TextEncoder().encode(emailStr));

    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawMessage })
    });

    if (!sendResponse.ok) {
      const errTxt = await sendResponse.text();
      throw new Error(`Gmail API Error: ${errTxt}`);
    }

    const insertPromise = supabaseAdmin
      .from('mensajes_email')
      .insert({
        cliente_id: cliente_id,
        asunto: asunto,
        cuerpo: cuerpo,
        destinatarios: [destinatario],
        adjuntos: adjuntosArray,
        remitente: integracion.email_remitente,
        estado: 'enviado',
        operario: user.user_metadata?.nombre || 'Operario'
      });

    if (typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil(insertPromise);
    } else {
      await insertPromise;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
