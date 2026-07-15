import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const redirectUri = Deno.env.get('GMAIL_REDIRECT_URI'); // e.g. https://<project>.supabase.co/functions/v1/gmail-callback
    const { returnUrl } = await req.json().catch(() => ({ returnUrl: 'http://localhost:5173' }));

    if (!clientId || !redirectUri) {
      throw new Error("Gmail credentials (GMAIL_CLIENT_ID, GMAIL_REDIRECT_URI) not configured in edge function environment.");
    }

    const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.send');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(returnUrl)}`;

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
