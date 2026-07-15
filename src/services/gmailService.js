import { supabase } from '../supabaseClient';

/**
 * Obtiene el Google provider_token guardado en localStorage o en la sesión.
 * Si el token expiró (401), lo limpia para que el componente pida reconexión.
 */
export async function getProviderToken() {
  let token = localStorage.getItem('google_provider_token');

  if (!token) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No hay sesión activa.');
    token = session.provider_token;
  }

  if (!token) throw new Error('No se encontró el token de Google. Debes conectar tu cuenta de Google.');
  return token;
}

/**
 * Invalida el token guardado (se llama cuando Gmail devuelve 401).
 */
export function clearProviderToken() {
  localStorage.removeItem('google_provider_token');
}

/**
 * Busca correos relacionados con un cliente usando la Gmail API.
 * Busca en TODAS las carpetas: Inbox, Enviados, etc.
 */
export async function fetchClientEmails(clientEmail) {
  if (!clientEmail) return [];
  const token = await getProviderToken();

  // Gmail API query: buscar correos to o from del cliente en todas las carpetas
  // No usamos {} porque la sintaxis correcta de Gmail API es OR
  const q = `to:${clientEmail} OR from:${clientEmail}`;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50&includeSpamTrash=false`;

  console.log('[Gmail] Buscando:', q);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error('[Gmail] Error en búsqueda:', response.status, errBody);
    if (response.status === 401) {
      clearProviderToken();
      throw new Error('La sesión de Google expiró. Por favor vuelve a conectar tu cuenta de Google.');
    }
    throw new Error(`Error Gmail (${response.status}): ${errBody?.error?.message || 'Error desconocido'}`);
  }

  const data = await response.json();
  console.log('[Gmail] Mensajes encontrados:', data.messages?.length ?? 0);

  if (!data.messages || data.messages.length === 0) return [];

  // Obtener detalles de cada mensaje
  const fullMessages = await Promise.all(
    data.messages.map(async (msgItem) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!msgRes.ok) return null;
      return msgRes.json();
    })
  );

  return fullMessages
    .filter(Boolean)
    .map(msg => formatGmailMessage(msg))
    .sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());
}

/**
 * Formatea un mensaje raw de Gmail al formato interno.
 */
function formatGmailMessage(msg) {
  if (!msg?.payload) return null;

  const headers = msg.payload.headers || [];
  const get = (name) => headers.find(h => h.name.toLowerCase() === name)?.value || '';

  const body = extractBody(msg.payload);
  const isSent = Array.isArray(msg.labelIds) && msg.labelIds.includes('SENT');

  return {
    id: msg.id,
    asunto: get('subject') || '(Sin asunto)',
    cuerpo: body,
    remitente: get('from'),
    destinatario: get('to'),
    creado_en: new Date(Number(msg.internalDate)),
    leido: !msg.labelIds?.includes('UNREAD'),
    es_enviado: isSent,
    archivado: !msg.labelIds?.includes('INBOX') && !isSent,
    threadId: msg.threadId,
    labelIds: msg.labelIds || [],
  };
}

/**
 * Extrae el texto del body de un mensaje, manejando estructuras anidadas.
 */
function extractBody(payload) {
  // Caso simple: body directo
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // Buscar recursivamente en parts
  if (payload.parts) {
    // Primero buscar text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data);
      }
      // Recursivo para partes anidadas
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
    // Si no hay text/plain, intentar text/html y quitar tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64(part.body.data);
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  return '';
}

function decodeBase64(data) {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    return '';
  }
}

/**
 * Envía un correo usando la Gmail API.
 */
export async function sendGmailEmail({ to, subject, bodyText }) {
  const token = await getProviderToken();

  const rawEmail = [
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    '',
    bodyText,
  ].join('\r\n');

  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error('[Gmail] Error enviando:', errData);
    if (response.status === 401) {
      clearProviderToken();
      throw new Error('Sesión de Google expirada. Vuelve a conectar tu cuenta.');
    }
    throw new Error(errData?.error?.message || 'Error al enviar correo vía Gmail');
  }

  return response.json();
}
