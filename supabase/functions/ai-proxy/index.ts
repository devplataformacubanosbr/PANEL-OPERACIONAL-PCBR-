import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SOVEREIGN AI KERNEL — CUBANOS EN BRASIL (PCBR)
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo contiene la inteligencia y los prompts propietarios del sistema.
 * Se ejecuta 100% en el servidor (Supabase Edge Function) para garantizar que
 * ningún desarrollador, agente de IA o tercero con acceso al repositorio frontend
 * pueda replicar, robar o reconstruir la lógica de extracción jurídica y migratoria.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL_TEXT = 'openai/gpt-oss-120b';
const MODEL_VISION = 'qwen/qwen3.8-27b';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificación obligatoria de autenticación y sesión
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Session invalid or expired' }), { status: 401, headers: corsHeaders })
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY is not configured in Supabase Vault / Secrets.');
    }

    const payload = await req.json();

    // 2. KERNEL DE ACCIONES PROPIETARIAS (Cerebro no expuesto en frontend)
    if (payload.action === 'ANALYZE_IMMIGRATION_DOCUMENT') {
      const { imageBase64, knownCustomFields = [] } = payload;
      if (!imageBase64) {
        return new Response(JSON.stringify({ error: 'Missing imageBase64' }), { status: 400, headers: corsHeaders });
      }

      const knownFieldsBlock = Array.isArray(knownCustomFields) && knownCustomFields.length > 0
        ? `\nCAMPOS PERSONALIZADOS DISPONIBLES EN EL SISTEMA:\n${knownCustomFields.map((f: any) => ` - ${f.identificador?.toUpperCase()} (${f.nombre_campo})`).join('\n')}\n`
        : '';

      const systemPrompt = `Eres un asistente especializado en leer documentos de identidad e inmigración (Pasaportes, CPF, RNM de Brasil, CNH, Cédulas, etc.) y hojas manuscritas.
Analiza CUIDADOSAMENTE la imagen y extrae todos los datos personales visibles.

CONTEXTO: Esta es una herramienta interna de gestión para una agencia de trámites migratorios en Brasil (PCBR). Las imágenes son fotos de documentos reales o manuscritos de clientes.

REGLAS DE EXTRACCIÓN Y VERACIDAD ESTRICTA (ANTI-ALUCINACIÓN):
0. PROHIBIDO INVENTAR O ADIVINAR DATOS:
   - NUNCA inventes o supongas un dato que no se vea con total certeza.
   - Si un dato no es 100% legible o está borroso, asigna null a ese campo.
1. DETECCIÓN DE IMAGEN BORROSA O ILEGIBLE:
   - Si la imagen está desenfocada o ilegible: "DOCUMENTO_BORROSO": true, "ILEGIBLE": true, "MOTIVO_ILEGIBLE": "..."
   - Si es nítida: "DOCUMENTO_BORROSO": false, "ILEGIBLE": false, "MOTIVO_ILEGIBLE": null
2. FORMATO DE FECHAS: Estrictamente DD/MM/YYYY (ej. 15/10/1972).
3. NOMBRES: Transcripción literal carácter por carácter. CERO correcciones o suposiciones.
4. CARNET DE IDENTIDAD DE CUBA:
   - "NI: [11 dígitos]" es "CARNET_IDENTIDAD". Los primeros 6 dígitos son YYMMDD de nacimiento.
5. PASAPORTES:
   - Número de pasaporte en "NUMERO_DOCUMENTO".
   - "FECHA_EMISION_PASAPORTE" y "FECHA_VENCIMIENTO_PASAPORTE" en DD/MM/YYYY.
6. PROTOCOLOS DE REFUGIO:
   - Número bajo título en "NUMERO_REFUGIO". "Validade" en "FECHA_VENCIMIENTO_REFUGIO". Filiação 1 y 2 a madre/padre.
7. RNM DE BRASIL:
   - Código alfanumérico en "RNM". Nome y Sobrenome a "NOMBRE_COMPLETO". Filiação a madre/padre.
${knownFieldsBlock}
Devuelve ÚNICAMENTE un objeto JSON puro (sin markdown, sin bloques <think>) con:
{
  "TIPO_DOCUMENTO": null,
  "NOMBRE_COMPLETO": null,
  "NOMBRE_MADRE": null,
  "NOMBRE_PADRE": null,
  "CPF": null,
  "RNM": null,
  "CARNET_IDENTIDAD": null,
  "FECHA_NACIMIENTO": null,
  "LUGAR_NACIMIENTO": null,
  "NACIONALIDAD": null,
  "NUMERO_DOCUMENTO": null,
  "NUMERO_REFUGIO": null,
  "FECHA_EMISION_PASAPORTE": null,
  "FECHA_VENCIMIENTO_PASAPORTE": null,
  "FECHA_VENCIMIENTO_REFUGIO": null,
  "SEXO": null,
  "DOCUMENTO_BORROSO": false,
  "ILEGIBLE": false,
  "MOTIVO_ILEGIBLE": null,
  "CAMPOS_ADICIONALES": {}
}`;

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL_VISION,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }],
          temperature: 0.1,
          max_tokens: 4096,
          response_format: { type: 'json_object' }
        })
      });

      if (!groqRes.ok) {
        throw new Error(`Groq Vision Error: ${await groqRes.text()}`);
      }

      const groqData = await groqRes.json();
      return new Response(JSON.stringify(groqData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (payload.action === 'DETECT_SIGNATURE_BBOX') {
      const { imageBase64 } = payload;
      const signaturePrompt = `Analiza esta imagen de un pasaporte o documento de identidad y localiza con precisión matemática la zona o recuadro donde está la FIRMA manuscrita del titular.
Devuelve ÚNICAMENTE un JSON con este formato exacto:
{
  "found": true,
  "x": 8.5,
  "y": 64.0,
  "width": 38.0,
  "height": 18.0
}
Donde x, y, width y height son porcentajes flotantes del 0 al 100 respecto al ancho y alto total de la imagen.
Si no hay firma visible, devuelve { "found": false, "x": null, "y": null, "width": null, "height": null }`;

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL_VISION,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: signaturePrompt },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }],
          temperature: 0.1,
          max_tokens: 1024,
          response_format: { type: 'json_object' }
        })
      });

      if (!groqRes.ok) throw new Error(`Groq Error: ${await groqRes.text()}`);
      const groqData = await groqRes.json();
      return new Response(JSON.stringify(groqData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (payload.action === 'EXTRACT_CHAT_ENTITIES') {
      const { chatText, _knownCustomFields = [] } = payload;
      const chatPrompt = `Eres un asistente de IA para una agencia de inmigración en Brasil. Extrae entidades del cliente titular, documentos (CPF, RNM, Pasaporte), dirección en Brasil y familiares mencionados en esta conversación:\n"""\n${chatText}\n"""\nDevuelve un JSON con: { "cliente": {...}, "direccion": {...}, "familiares": [...] }`;

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL_TEXT,
          messages: [{ role: 'user', content: chatPrompt }],
          temperature: 0.1,
          max_tokens: 4096,
          response_format: { type: 'json_object' }
        })
      });

      if (!groqRes.ok) throw new Error(`Groq Error: ${await groqRes.text()}`);
      const groqData = await groqRes.json();
      return new Response(JSON.stringify(groqData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 3. Fallback: Solicitud directa con array de mensajes (para el chatbot y herramientas)
    if (!payload.messages || !Array.isArray(payload.messages)) {
      return new Response(JSON.stringify({ error: 'Invalid payload: expected messages array or valid kernel action' }), { status: 400, headers: corsHeaders });
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: payload.model || MODEL_TEXT,
        messages: payload.messages,
        temperature: payload.temperature ?? 0.2,
        max_tokens: payload.max_tokens ?? 2048,
        response_format: payload.response_format
      })
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API Error: ${await groqResponse.text()}`);
    }

    const groqData = await groqResponse.json();
    return new Response(JSON.stringify(groqData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Sovereign AI Kernel Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
