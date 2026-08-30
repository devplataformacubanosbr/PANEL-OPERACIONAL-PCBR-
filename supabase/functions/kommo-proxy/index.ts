import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Los subdominios de Kommo son alfanuméricos + guiones, sin puntos ni otros
// caracteres. Validar el formato antes de interpolarlo en la URL evita SSRF:
// sin esto, un subdominio con '#' (ej. "evil.com#") trunca el host real al
// parsear la URL y el servidor termina haciendo fetch a un host arbitrario.
const KOMMO_SUBDOMAIN_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

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
    const action = payload.action;
    const providedSubdomain = payload.subdominio;
    const providedToken = payload.token;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Obtener credenciales (si no se pasaron en el body, buscarlas en la DB;
    // empresa única, `integraciones_kommo` tiene una sola fila).
    let subdominio = providedSubdomain;
    let token = providedToken;

    if (!subdominio || !token) {
        const { data: creds } = await supabaseAdmin
            .from('integraciones_kommo')
            .select('*')
            .limit(1)
            .single();

        if (creds) {
            subdominio = creds.subdominio;
            token = creds.token;
        } else {
            return new Response(JSON.stringify({ error: 'Credenciales de Kommo no encontradas' }), { status: 400, headers: corsHeaders })
        }
    }

    if (!KOMMO_SUBDOMAIN_RE.test(subdominio || '')) {
        return new Response(JSON.stringify({ error: 'Subdominio de Kommo inválido' }), { status: 400, headers: corsHeaders })
    }

    const baseUrl = `https://${subdominio}.kommo.com/api/v4`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    if (action === 'test_connection') {
        const res = await fetch(`${baseUrl}/account`, { headers });
        if (res.ok) {
            const data = await res.json();
            return new Response(JSON.stringify({ success: true, account: data }), { status: 200, headers: corsHeaders });
        } else {
            return new Response(JSON.stringify({ error: 'Error al conectar con Kommo', status: res.status }), { status: 400, headers: corsHeaders });
        }
    }

    if (action === 'get_fields') {
        // Obtener campos de contactos
        const resContacts = await fetch(`${baseUrl}/contacts/custom_fields`, { headers });
        let contactsFields = [];
        if (resContacts.ok) {
            const data = await resContacts.json();
            contactsFields = data._embedded?.custom_fields || [];
        }

        // Obtener campos de leads
        const resLeads = await fetch(`${baseUrl}/leads/custom_fields`, { headers });
        let leadsFields = [];
        if (resLeads.ok) {
            const data = await resLeads.json();
            leadsFields = data._embedded?.custom_fields || [];
        }

        return new Response(JSON.stringify({
            success: true,
            contacts: contactsFields,
            leads: leadsFields
        }), { status: 200, headers: corsHeaders });
    }

    if (action === 'get_pipelines') {
        // Cada pipeline de Kommo trae sus propias etapas embebidas (_embedded.statuses);
        // se usan para armar el mapeo etapa → trámite en KommoSettings.jsx.
        const res = await fetch(`${baseUrl}/leads/pipelines`, { headers });
        if (!res.ok) {
            return new Response(JSON.stringify({ error: 'Error al obtener pipelines de Kommo', status: res.status }), { status: 400, headers: corsHeaders });
        }
        const data = await res.json();
        const pipelines = (data._embedded?.pipelines || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            stages: (p._embedded?.statuses || []).map((s: any) => ({ id: s.id, name: s.name })),
        }));

        return new Response(JSON.stringify({ success: true, pipelines }), { status: 200, headers: corsHeaders });
    }

    // Para clientes que nunca llegaron por un webhook de Kommo (ej. se crearon
    // por WhatsApp directo o a mano) y por eso no tienen id_kommo: busca en
    // Kommo un contacto por teléfono y, si hay una única coincidencia, la
    // vincula. Si hay 0 o más de una coincidencia, no adivina — lo reporta.
    if (action === 'vincular_ids_faltantes') {
        const { data: clientesSinId, error: clientesErr } = await supabaseAdmin
            .from('clientes')
            .select('id, telefono, nombre')
            .is('id_kommo', null)
            .not('telefono', 'is', null);

        if (clientesErr) throw clientesErr;

        let vinculados = 0;
        let sinCoincidencia = 0;
        let ambiguos = 0;
        const detalles: any[] = [];

        for (const cliente of (clientesSinId || [])) {
            const telefonoLimpio = (cliente.telefono || '').replace(/\D/g, '');
            if (!telefonoLimpio) {
                sinCoincidencia++;
                detalles.push({ cliente_id: cliente.id, nombre: cliente.nombre, estado: 'sin_telefono' });
                continue;
            }

            try {
                const res = await fetch(`${baseUrl}/contacts?query=${encodeURIComponent(telefonoLimpio)}`, { headers });
                if (!res.ok) {
                    sinCoincidencia++;
                    detalles.push({ cliente_id: cliente.id, nombre: cliente.nombre, estado: 'error_busqueda' });
                    continue;
                }
                const data = await res.json();
                const contactos = data._embedded?.contacts || [];

                if (contactos.length === 1) {
                    await supabaseAdmin.from('clientes').update({ id_kommo: contactos[0].id.toString() }).eq('id', cliente.id);
                    vinculados++;
                    detalles.push({ cliente_id: cliente.id, nombre: cliente.nombre, id_kommo: contactos[0].id, estado: 'vinculado' });
                } else if (contactos.length === 0) {
                    sinCoincidencia++;
                    detalles.push({ cliente_id: cliente.id, nombre: cliente.nombre, estado: 'sin_coincidencia' });
                } else {
                    ambiguos++;
                    detalles.push({ cliente_id: cliente.id, nombre: cliente.nombre, estado: 'ambiguo', opciones: contactos.map((c: any) => c.id) });
                }
            } catch (err) {
                console.error(`Error buscando contacto de Kommo para cliente ${cliente.id}:`, err);
                sinCoincidencia++;
                detalles.push({ cliente_id: cliente.id, nombre: cliente.nombre, estado: 'error_busqueda' });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            total: (clientesSinId || []).length,
            vinculados,
            sinCoincidencia,
            ambiguos,
            detalles
        }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Action not supported' }), { status: 400, headers: corsHeaders })

  } catch (error) {
    console.error("Kommo Proxy Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
