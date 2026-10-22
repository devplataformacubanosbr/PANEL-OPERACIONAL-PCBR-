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
    // 1. Verificación de autorización: requiere cabecera de autenticación o apikey del proyecto
    const authHeader = req.headers.get('Authorization');
    const apikey = req.headers.get('apikey');

    if (!authHeader && !apikey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization or apikey header' }), { status: 401, headers: corsHeaders });
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

      const systemPrompt = `Eres un perito oficial y asistente de inteligencia artificial experto en procesamiento de documentos de identidad, migración y extranjería en Brasil (Policía Federal, Cartórios, CONARE).
Analiza CUIDADOSAMENTE esta imagen de documento y extrae todos los datos disponibles con máxima precisión.

REGLAS DE ORO (VERACIDAD Y RIGOR):
1. CLASIFICACIÓN DEL DOCUMENTO:
   - "TIPO_DOCUMENTO": "PASAPORTE", "CARNET_IDENTIDAD", "PROTOCOLO_REFUGIO", "RNM", "CPF", "COMPROBANTE_RESIDENCIA", "COMPROBANTE_PIX", "CERTIDAO_CASAMENTO", "CERTIDAO_NASCIMENTO", "CNH" u "OTRO".
2. PASAPORTES (ESPECIALMENTE CUBANO):
   - Lee con extrema precisión las 2 líneas MRZ al final de la página (P<CUB...):
     * Línea 1: P<CUB[APELLIDOS]<<[NOMBRES]... Extrae APELLIDOS y NOMBRES con total exactitud.
     * Línea 2: [NUMERO_DOCUMENTO]<[CHECK][CUB][FECHA_NACIMIENTO_AAMMDD][CHECK][SEXO][FECHA_VENCIMIENTO_AAMMDD][CHECK][CARNET_IDENTIDAD_11_DIGITOS]...
     * En pasaportes cubanos, los 11 dígitos del carnet de identidad están en la línea 2 del MRZ.
   - NOMBRE_COMPLETO: Transcribe siempre en orden natural hispano: "[NOMBRES] [APELLIDOS]".
   - Extrae también: FECHA_EMISION_PASAPORTE, FECHA_VENCIMIENTO_PASAPORTE, LUGAR_NACIMIENTO, NACIONALIDAD ("CUBANA").
   - FIRMA DEL TITULAR: Localiza el recuadro donde firma el titular (habitualmente bajo la foto biométrica en la parte inferior izquierda). Devuelve "FIRMA_BBOX": { "found": true, "x": ..., "y": ..., "width": ..., "height": ... } en porcentajes del 0 al 100.
3. CARNET DE IDENTIDAD (CUBA):
   - "CARNET_IDENTIDAD": Número de Identidad (NI) de 11 dígitos (AAMMDDXXXXX).
   - "FECHA_NACIMIENTO": DD/MM/AAAA calculado a partir de los primeros 6 dígitos del NI o del texto.
   - "SEXO": M si el décimo dígito es par, F si es impar.
   - "FIRMA_BBOX": Recuadro de firma si está visible.
4. PROTOCOLO DE REFÚGIO / DPRNM (BRASIL):
   - "NUMERO_REFUGIO": Número del proceso / protocolo (ej: 08018.079458/2026-51).
   - "FECHA_VENCIMIENTO_REFUGIO": Fecha de validez del protocolo en DD/MM/AAAA.
   - "NOMBRE_MADRE" (Filiação 1 / Mãe) y "NOMBRE_PADRE" (Filiação 2 / Pai).
5. RNM / CRNM (REGISTRO NACIONAL MIGRATÓRIO - BRASIL):
   - "RNM": Código alfanumérico (ej: V123456-A).
   - "CPF": Si aparece en la tarjeta.
   - "NOMBRE_MADRE" y "NOMBRE_PADRE".
   - "FIRMA_BBOX": Recuadro de la firma manuscrita.
6. COMPROBANTE DE RESIDENCIA (CUENTA DE LUZ, AGUA, GAS, INTERNET):
   - "DIRECCION": Objeto JSON con:
     {
       "endereco": "Nombre de la calle/avenida/logradouro",
       "numero": "Número de casa/edificio",
       "complemento": "Apto/Bloque o vacío",
       "bairro": "Barrio",
       "cidade": "Ciudad / Municipio",
       "estado": "Sigla del estado UF (ej: SP, RJ, SC, PR, RS, etc.)",
       "cep": "00000-000"
     }
   - "NOMBRE_COMPLETO": Titular que figura en la factura.
7. FORMATO DE FECHAS: Siempre estrictamente DD/MM/AAAA.
8. CALIDAD DE IMAGEN (ANTI-FALSO REVISIÓN):
   - "DOCUMENTO_BORROSO": true y "ILEGIBLE": true ÚNICAMENTE si no se puede leer ningún dato esencial de identificación. Si se lee el nombre, número de documento o dirección, pon false.
${knownFieldsBlock}
Devuelve ÚNICAMENTE un objeto JSON puro (sin markdown, sin bloques <think>) con:
{
  "TIPO_DOCUMENTO": null,
  "NOMBRE_COMPLETO": null,
  "APELLIDOS": null,
  "NOMBRES": null,
  "NOMBRE_MADRE": null,
  "NOMBRE_PADRE": null,
  "CPF": null,
  "RNM": null,
  "CARNET_IDENTIDAD": null,
  "NUMERO_DOCUMENTO": null,
  "NUMERO_REFUGIO": null,
  "FECHA_NACIMIENTO": null,
  "FECHA_EMISION_PASAPORTE": null,
  "FECHA_VENCIMIENTO_PASAPORTE": null,
  "FECHA_VENCIMIENTO_REFUGIO": null,
  "SEXO": null,
  "NACIONALIDAD": null,
  "LUGAR_NACIMIENTO": null,
  "DIRECCION": null,
  "MRZ_LINEA_1": null,
  "MRZ_LINEA_2": null,
  "FIRMA_BBOX": { "found": false, "x": null, "y": null, "width": null, "height": null },
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
      const signaturePrompt = `Eres un perito forense en caligrafía y documentos de identidad oficiales.
Analiza esta imagen y localiza con precisión matemática las coordenadas del recuadro o zona donde se encuentra la FIRMA MANUSCRITA del titular.

REGLAS DE LOCALIZACIÓN:
1. PASAPORTE CUBANO:
   - La firma manuscrita está situada en la página biográfica (página 2), en el recuadro "Firma del titular" directamente DEBAJO de la foto biométrica y POR ENCIMA de las líneas MRZ.
   - Si la foto muestra ambas páginas del pasaporte abiertas (spread de 2 páginas), localiza la firma en la mitad o página donde está la foto del titular.
2. CARNET DE IDENTIDAD CUBANO / CRNM / RNM BRASIL:
   - Localiza el recuadro de firma manuscrita en el frente del documento.
3. HOJA EN BLANCO O DOCUMENTO CON FIRMA SUELTA:
   - Localiza el rectángulo que encierra los trazos de la firma con 5% de margen.

Devuelve ÚNICAMENTE un JSON:
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
