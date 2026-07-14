import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Empresa única: no hay "organización" a la que unirse, así que en vez del
// flujo viejo (link con ?org=... + JoinAgency) el admin invita por email y
// Supabase Auth crea la cuenta directamente, mandando su propio email para
// que la persona invitada ponga contraseña. El trigger `handle_new_user`
// (ver database/standalone/001_schema.sql) crea la fila en `perfiles`
// automáticamente cuando el auth.users nuevo se confirma.
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

    if (parseError || !payload || !payload.email) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders })
    }

    // Solo admin/admin_plus pueden invitar. rol vive en `perfiles`, no hay
    // organization_id que resolver (empresa única).
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (profileError || !['admin', 'admin_plus'].includes(profile?.rol)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      payload.email,
      {
        data: {
          nombre: payload.email.split('@')[0],
          rol: 'miembro',
          invitado_por: payload.inviterNombre || null,
        },
        redirectTo: Deno.env.get('APP_URL') || undefined,
      }
    )

    if (inviteError) throw inviteError

    return new Response(JSON.stringify({ success: true, userId: data?.user?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error invitando miembro:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
