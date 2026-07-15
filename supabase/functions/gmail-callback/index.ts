import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // The frontend redirect URL
    
    if (!code) {
      return new Response("Missing code", { status: 400 });
    }

    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GMAIL_REDIRECT_URI');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri || '',
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get token: ${JSON.stringify(tokenData)}`);
    }

    const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const profileData = await profileResponse.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Limpiamos integraciones previas de Gmail y guardamos la nueva (single-tenant)
    await supabaseAdmin.from('integraciones_email').delete().eq('proveedor', 'gmail');
    
    await supabaseAdmin
      .from('integraciones_email')
      .insert({
        proveedor: 'gmail',
        email_remitente: profileData.emailAddress,
        refresh_token: tokenData.refresh_token, // Si prompt=consent, Google manda refresh_token
        access_token: tokenData.access_token,
        activo: true
      });

    const redirectBack = state || 'http://localhost:5173/settings';
    return Response.redirect(redirectBack, 302);
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
})
