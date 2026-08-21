import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

// Utility function to verify Tally Signature
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  const binarySig = atob(signature);
  const signatureBytes = new Uint8Array(binarySig.length);
  for (let i = 0; i < binarySig.length; i++) {
    signatureBytes[i] = binarySig.charCodeAt(i);
  }
  
  const payloadBytes = encoder.encode(payload);

  return await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    payloadBytes
  );
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const rawBody = await req.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Invalid JSON payload");
      return new Response('Invalid payload', { status: 400 });
    }

    // Optional Tally Signature Verification
    const { data: configData } = await supabaseClient
      .from('configuraciones_app')
      .select('valor')
      .eq('clave', 'tally_signing_secret')
      .single();
    
    const tallySigningSecret = configData?.valor;

    if (tallySigningSecret) {
      const tallySignature = req.headers.get('tally-signature');
      if (!tallySignature) {
        console.error("Missing Tally-Signature header");
        return new Response('Unauthorized - Missing Signature', { status: 401 });
      }

      try {
        const isValid = await verifySignature(rawBody, tallySignature, tallySigningSecret);
        if (!isValid) {
          console.error("Invalid Tally Signature");
          return new Response('Unauthorized - Invalid Signature', { status: 401 });
        }
      } catch (e) {
        console.error("Error verifying signature:", e);
        return new Response('Unauthorized - Error verifying signature', { status: 401 });
      }
    }

    const data = body?.data;
    if (!data || !data.fields) {
      console.error("Payload missing data.fields");
      return new Response('Invalid payload format', { status: 400 });
    }

    const formName = data.formName || 'Formulario Nuevo Cliente';
    
    let nombre = '';
    let email = '';
    let telefono = '';
    let cpf = '';
    const campos_personalizados: Record<string, any> = {};

    for (const field of data.fields) {
      const key = (field.key || '').toLowerCase();
      const value = field.value;

      if (key === 'nombre' || key === 'name') {
        nombre = String(value);
      } else if (key === 'email') {
        email = String(value);
      } else if (key === 'telefono' || key === 'phone') {
        telefono = String(value);
      } else if (key === 'cpf') {
        cpf = String(value);
      } else {
        // Any other field goes to campos_personalizados
        const label = field.label || field.key;
        if (field.type === 'FILE_UPLOAD' && Array.isArray(value)) {
           campos_personalizados[label] = value.map((f: any) => typeof f === 'object' ? f.url : f);
        } else {
           campos_personalizados[label] = value;
        }
      }
    }

    if (!nombre) {
      console.error("No 'nombre' found in Tally payload");
      return new Response('Missing nombre (Name) field', { status: 400 });
    }

    // Insert new client
    const { data: newClient, error: insertError } = await supabaseClient
      .from('clientes')
      .insert({
        nombre: nombre,
        email: email,
        telefono: telefono,
        cpf: cpf,
        estado_cliente: 'nuevo',
        campos_personalizados: Object.keys(campos_personalizados).length > 0 ? campos_personalizados : null
      })
      .select('id')
      .single();

    if (insertError || !newClient) {
      console.error("Error inserting client into Supabase:", insertError);
      return new Response('Error creating client', { status: 500 });
    }

    console.log(`Successfully created client ${nombre} with ID ${newClient.id}`);
    
    // Optionally insert the full form submission into formularios_clientes
    const { error: formError } = await supabaseClient
      .from('formularios_clientes')
      .insert({
        cliente_id: newClient.id,
        tipo_formulario: formName,
        estado: 'Completado',
        respuestas: campos_personalizados // Also store all the fields here for reference
      });
      
    if (formError) {
      console.error("Error saving form data copy:", formError);
    }

    return new Response('Success', { status: 200 });

  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response('Internal Server Error', { status: 500 });
  }
})
