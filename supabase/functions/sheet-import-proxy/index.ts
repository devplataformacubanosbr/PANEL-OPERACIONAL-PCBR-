import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// El ID de spreadsheet de Google es alfanumérico + '-'/'_'. Validar el
// formato antes de interpolarlo en la URL evita SSRF: sin esto, un valor
// como "x#@evil.com" podría truncar/redirigir el host real al construir la
// URL de fetch (mismo riesgo que el subdominio de Kommo en kommo-proxy).
const SHEET_URL_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/.*)?$/;
const GID_RE = /^[0-9]+$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    const payload = await req.json();
    const rawUrl = String(payload.url || '').trim();

    const match = rawUrl.match(SHEET_URL_RE);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Link de Google Sheets inválido. Debe ser un link de docs.google.com/spreadsheets/d/...' }), { status: 400, headers: corsHeaders })
    }

    const spreadsheetId = match[1];

    let gid = '0';
    const gidMatch = rawUrl.match(/[?&#]gid=([0-9]+)/);
    if (gidMatch && GID_RE.test(gidMatch[1])) {
      gid = gidMatch[1];
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    const res = await fetch(exportUrl, { redirect: 'follow' });
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok || contentType.includes('text/html')) {
      return new Response(JSON.stringify({
        error: "No se pudo leer la hoja. Verificá que el link tenga acceso 'Cualquier persona con el enlace puede ver'."
      }), { status: 400, headers: corsHeaders });
    }

    const csvText = await res.text();

    return new Response(JSON.stringify({ success: true, csv: csvText }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Sheet Import Proxy Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
