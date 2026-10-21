import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, tally-signature',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

// Función utilitaria para verificar firma HMAC de Tally
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
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const rawBody = await req.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("Invalid JSON payload");
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificación opcional de firma HMAC si está configurada en la BD
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
        return new Response(JSON.stringify({ error: 'Unauthorized - Missing Signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const isValid = await verifySignature(rawBody, tallySignature, tallySigningSecret);
        if (!isValid) {
          console.error("Invalid Tally Signature");
          return new Response(JSON.stringify({ error: 'Unauthorized - Invalid Signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        console.error("Error verifying signature:", e);
        return new Response(JSON.stringify({ error: 'Unauthorized - Error verifying signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const data = body?.data;
    if (!data || !data.fields) {
      console.error("Payload missing data.fields");
      return new Response(JSON.stringify({ error: 'Invalid payload format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const formName = data.formName || 'Formulario Nuevo Cliente';
    
    // Objeto con columnas dedicadas
    const clientData: Record<string, any> = {
      estado_cliente: 'nuevo',
      canal_adquisicion: 'Tally Form',
      fecha_entrada_cliente: new Date().toISOString()
    };
    
    const campos_personalizados: Record<string, any> = {};

    for (const field of data.fields) {
      const key = (field.key || '').toLowerCase().trim();
      const label = (field.label || field.key || '').trim();
      const value = field.value;

      if (value === null || value === undefined || value === '') continue;

      // Normalizar texto de label para comparaciones
      const normalizedLabel = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Mapeo directo a columnas de clientes
      if (key === 'nombre' || key === 'name' || key === 'nome' || normalizedLabel.includes('nombre') || normalizedLabel.includes('nome')) {
        clientData.nombre = String(value).trim();
      } else if (key === 'email' || normalizedLabel.includes('email') || normalizedLabel.includes('correo')) {
        clientData.email = String(value).trim();
      } else if (key === 'telefono' || key === 'phone' || key === 'celular' || key === 'whatsapp' || normalizedLabel.includes('telefono') || normalizedLabel.includes('celular') || normalizedLabel.includes('whatsapp')) {
        clientData.telefono = String(value).trim();
      } else if (key === 'cpf' || normalizedLabel.includes('cpf')) {
        clientData.cpf = String(value).trim();
      } else if (key === 'pais' || key === 'country' || normalizedLabel.includes('pais')) {
        clientData.pais = String(value).trim();
      } else if (key === 'ciudad' || key === 'cidade' || key === 'city' || normalizedLabel.includes('ciudad') || normalizedLabel.includes('cidade')) {
        clientData.ciudad = String(value).trim();
      } else if (key === 'estado' || key === 'state' || key === 'uf' || normalizedLabel.includes('estado')) {
        clientData.estado = String(value).trim();
      } else if (key === 'nacionalidad' || key === 'nacionalidade' || normalizedLabel.includes('nacionalidad') || normalizedLabel.includes('nacionalidade')) {
        clientData.nacionalidad = String(value).trim();
      } else if (key === 'direccion' || key === 'endereco' || normalizedLabel.includes('direccion') || normalizedLabel.includes('endereco')) {
        clientData.direccion = String(value).trim();
      } else if (key === 'fecha_nacimiento' || key === 'birth_date' || normalizedLabel.includes('nacimiento') || normalizedLabel.includes('nascimento')) {
        clientData.fecha_nacimiento = String(value).trim();
      } else if (key === 'sexo' || key === 'gender' || normalizedLabel.includes('sexo') || normalizedLabel.includes('genero')) {
        clientData.sexo = String(value).trim();
      } else if (key === 'estado_civil' || normalizedLabel.includes('estado civil')) {
        clientData.estado_civil = String(value).trim();
      } else if (key === 'lugar_nacimiento' || key === 'naturalidade' || normalizedLabel.includes('lugar de nacimiento') || normalizedLabel.includes('naturalidade')) {
        clientData.lugar_nacimiento = String(value).trim();
      } else {
        // Archivos o campos específicos
        if (field.type === 'FILE_UPLOAD' && Array.isArray(value)) {
          campos_personalizados[label] = value.map((f: any) => typeof f === 'object' ? f.url : f);
        } else {
          campos_personalizados[label] = value;
        }
      }
    }

    if (!clientData.nombre) {
      console.error("No 'nombre' found in Tally payload");
      return new Response(JSON.stringify({ error: 'Missing required field: nombre' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (Object.keys(campos_personalizados).length > 0) {
      clientData.campos_personalizados = campos_personalizados;
    }

    // Insertar el nuevo cliente
    const { data: newClient, error: insertError } = await supabaseClient
      .from('clientes')
      .insert(clientData)
      .select('id')
      .single();

    if (insertError || !newClient) {
      console.error("Error inserting client into Supabase:", insertError);
      return new Response(JSON.stringify({ error: 'Error creating client', details: insertError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Successfully created client ${clientData.nombre} with ID ${newClient.id}`);

    // Asignar número oficial de cliente si no lo tiene (PCBR-XXXX)
    let numeroCliente: string | null = null;
    try {
      const { data: numData, error: numError } = await supabaseClient
        .rpc('generar_numero_cliente', { p_cliente_id: newClient.id });
      if (!numError && numData) {
        numeroCliente = numData;
      }
    } catch (e) {
      console.warn("Could not generate numero_cliente:", e);
    }

    // Registrar la sumisión en formularios_clientes
    try {
      await supabaseClient
        .from('formularios_clientes')
        .insert({
          cliente_id: newClient.id,
          tipo_formulario: formName,
          estado: 'Completado',
          respuestas: {
            datos_principales: clientData,
            campos_personalizados: campos_personalizados
          }
        });
    } catch (fErr) {
      console.warn("Could not save to formularios_clientes:", fErr);
    }

    return new Response(JSON.stringify({
      success: true,
      cliente_id: newClient.id,
      numero_cliente: numeroCliente,
      message: 'Cliente creado exitosamente'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
