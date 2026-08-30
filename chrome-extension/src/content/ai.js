export async function callAI(prompt, systemMessage = "Eres un asistente experto en autocompletado de formularios. Responde únicamente con el valor solicitado, sin explicaciones ni markdown.") {
  const res = await chrome.storage.local.get('groqKey');
  const groqKey = res.groqKey;
  
  if (!groqKey) {
    throw new Error('No se ha configurado la API Key de Groq. Por favor, añádela en la configuración de la extensión.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      // llama3-70b-8192 fue decomisionado por Groq — mismo modelo de texto
      // que usan los paneles PCBR/SaaS (aiService.js MODEL_TEXT).
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en la llamada a Groq');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

export function getElementContext(el) {
  const name = el.name || '';
  const id = el.id || '';
  let labelText = '';
  
  if (el.labels && el.labels.length > 0) {
    labelText = el.labels[0].textContent.trim();
  } else if (el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL') {
    labelText = el.previousElementSibling.textContent.trim();
  } else {
    const parentLabel = el.closest('label');
    if (parentLabel) labelText = parentLabel.textContent.trim();
  }

  let type = el.tagName.toLowerCase();
  if (type === 'input') type = el.type;

  let options = [];
  if (el.tagName === 'SELECT') {
    options = Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value);
  }

  return { name, id, label: labelText, type, options };
}

// Groq limita tokens por request (ver callAI) — JSON con indentación (null, 2)
// gasta ~30-40% más tokens en espacios en blanco que uno compacto, y los selects
// de formularios reales (países, estados, profesiones) pueden traer cientos de
// opciones. Compactamos el JSON y recortamos ambas cosas para no pasarnos.
const MAX_OPTIONS = 40;

/** Sólo los datos del cliente con valor real — no tiene sentido gastar tokens en null/"" */
const compactClientData = (clientData) => Object.fromEntries(
  Object.entries(clientData || {}).filter(([, v]) => v !== null && v !== undefined && v !== '')
);

const capOptions = (options) => options.length > MAX_OPTIONS ? options.slice(0, MAX_OPTIONS) : options;

export async function predictFieldWithAI(input, clientData) {
  const context = getElementContext(input);

  let optionsPrompt = '';
  if (context.options.length > 0) {
    optionsPrompt = `\nEs un campo de selección. Estas son las opciones válidas: \n${capOptions(context.options).map(o => `- ${o.text} (valor interno: ${o.value})`).join('\n')}\nIMPORTANTE: Si es un campo de selección, debes responder EXACTAMENTE con el texto de la opción correcta, no con el valor interno.`;
  }

  const prompt = `Datos del cliente (JSON):\n${JSON.stringify(compactClientData(clientData))}

  Analiza el siguiente campo de un formulario web:
  Etiqueta (Label): "${context.label}"
  Name: "${context.name}"
  ID: "${context.id}"
  Tipo: "${context.type}"${optionsPrompt}

  Tu tarea es encontrar el mejor valor para este campo basándote en los datos del cliente.
  - Si es una dirección y pide solo el número, extrae solo el número de la dirección.
  - Si es el nombre de la madre/padre, búscalo.
  - Si no encuentras ningún dato aplicable, responde exactamente con la palabra "NONE".
  - Solo responde con el valor final, nada más.`;

  return await callAI(prompt);
}

export async function predictFormWithAI(clientData) {
  const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'));
  const fieldsContext = inputs.map((input, index) => {
    const ctx = getElementContext(input);
    if (ctx.options.length > 0) ctx.options = capOptions(ctx.options);
    return { index, ...ctx };
  })
    .filter(f => !f.id.includes('searchInput')) // Filtrar inputs propios de la extension
    // Un campo sin label/name/id no le da a la IA nada con qué adivinar — solo
    // suma tokens al pedido sin aportar nada útil.
    .filter(f => f.label || f.name || f.id);

  const prompt = `Datos del cliente (JSON):\n${JSON.stringify(compactClientData(clientData))}

  A continuación tienes una lista de campos de un formulario web. Cada campo tiene un "index", "label", "name", "id", y "options" (si es un select).

  Campos:
  ${JSON.stringify(fieldsContext)}

  Tu tarea es analizar los datos del cliente y determinar el valor correcto para cada campo.
  Devuelve ÚNICAMENTE un objeto JSON donde las claves sean el "index" del campo y el valor sea el texto exacto a insertar.
  - Si es un campo de selección (select), devuelve el texto exacto de la opción.
  - Si es un checkbox/radio y debe marcarse, devuelve "RADIO_CHECK".
  - Si no encuentras un valor para un campo, omítelo del JSON.

  Devuelve SOLO un JSON válido, sin markdown ni explicaciones.`;

  const systemMsg = "Eres un asistente experto. Debes devolver estrictamente un JSON válido. No uses markdown de código (```json).";
  
  const response = await callAI(prompt, systemMsg);
  
  try {
    let cleanResponse = response;
    if (cleanResponse.startsWith('```json')) cleanResponse = cleanResponse.replace(/```json/g, '').replace(/```/g, '');
    else if (cleanResponse.startsWith('```')) cleanResponse = cleanResponse.replace(/```/g, '');
    
    return JSON.parse(cleanResponse.trim());
  } catch (e) {
    console.error("Error parseando respuesta de Groq:", response, e);
    throw new Error("La IA no devolvió un formato válido.");
  }
}
