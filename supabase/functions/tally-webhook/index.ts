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
  
  // Tally sends signature in base64, we need to convert it to ArrayBuffer to verify
  // But actually, crypto.subtle.verify with HMAC-SHA256 requires a signature ArrayBuffer.
  // We can decode base64:
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
    // Solo aceptamos POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Leemos el raw body como texto para verificar la firma
    const rawBody = await req.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Invalid JSON payload");
      return new Response('Invalid payload', { status: 400 });
    }

    // Opcional: Verificación de Firma HMAC
    // Obtenemos el secret guardado en configuraciones_app (si existe)
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

    // El payload de Tally viene dentro de "data"
    const data = body?.data;
    if (!data || !data.fields) {
      console.error("Payload missing data.fields");
      return new Response('Invalid payload format', { status: 400 });
    }

    const formName = data.formName || 'Formulario Externo';
    let cliente_id = null;
    const respuestas: Record<string, any> = {};

    // Mapeo de los campos (incluyendo el cliente_id oculto)
    for (const field of data.fields) {
      // Tally soporta HIDDEN_FIELDS o a veces lo envía como INPUT_TEXT pero nosotros lo conocemos
      if (field.key === 'cliente_id') {
         cliente_id = field.value;
      } else {
        // Campos normales (INPUT_TEXT, MULTIPLE_CHOICE, FILE_UPLOAD, etc)
        // Usamos el label como llave en el JSON de respuestas (más amigable) o key si label no existe
        const keyToUse = field.label || field.key;
        
        // Manejo especial para FILE_UPLOAD (Tally envía un array de URLs)
        if (field.type === 'FILE_UPLOAD' && Array.isArray(field.value)) {
           respuestas[keyToUse] = field.value.map((f: any) => typeof f === 'object' ? f.url : f);
        } 
        // Manejo para checkbox o múltiple
        else if (Array.isArray(field.value)) {
           respuestas[keyToUse] = field.value;
        }
        else {
           respuestas[keyToUse] = field.value;
        }
      }
    }

    if (!cliente_id) {
      console.error("No cliente_id found in Tally payload (hidden fields)");
      return new Response('Missing cliente_id in form', { status: 400 });
    }

    // Parseamos a entero si es necesario
    const parsedClientId = parseInt(cliente_id, 10);
    if (isNaN(parsedClientId)) {
       console.error("cliente_id is not a valid number:", cliente_id);
       return new Response('Invalid cliente_id format', { status: 400 });
    }

    // Insertar en la BD
    const { error: insertError } = await supabaseClient
      .from('formularios_clientes')
      .insert({
        cliente_id: parsedClientId,
        tipo_formulario: formName,
        estado: 'Completado',
        respuestas: respuestas
      });

    if (insertError) {
      console.error("Error inserting data into Supabase:", insertError);
      return new Response('Error saving form data', { status: 500 });
    }

    console.log(`Successfully saved form ${formName} for client ${parsedClientId}`);
    return new Response('Success', { status: 200 });

  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response('Internal Server Error', { status: 500 });
  }
})
