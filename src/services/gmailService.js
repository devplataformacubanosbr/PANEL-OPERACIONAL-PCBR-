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
export async function fetchClientEmails(searchQuery = '') {
  const token = await getProviderToken();

  // Si hay búsqueda manual usamos la query, si no, traemos el inbox global
  const q = searchQuery ? searchQuery : '';
  let allMessages = [];
  let pageToken = '';
  let pageCount = 0;

  do {
    let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&includeSpamTrash=false`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    console.log('[Gmail] Buscando:', q || '(Todas las carpetas)', 'pageToken:', pageToken);

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
    if (data.messages && data.messages.length > 0) {
      allMessages = allMessages.concat(data.messages);
    }
    pageToken = data.nextPageToken || '';
    pageCount++;
  } while (pageToken && pageCount < 2); // Limitar a 2 páginas (100 correos) en la vista global

  console.log('[Gmail] Mensajes encontrados:', allMessages.length);

  if (allMessages.length === 0) return [];

  if (allMessages.length > 100) {
    console.log('[Gmail] Limiting detail fetch to latest 100 messages');
    allMessages = allMessages.slice(0, 100);
  }

  // Obtener detalles de cada mensaje en lotes (chunks) de 20 para evitar 429 Too Many Requests
  const fullMessages = [];
  const chunkSize = 20;
  for (let i = 0; i < allMessages.length; i += chunkSize) {
    const chunk = allMessages.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (msgItem) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}?format=full`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) return null;
        return msgRes.json();
      })
    );
    fullMessages.push(...chunkResults);
    // Pequeña pausa opcional entre lotes para aliviar la API
    await new Promise(r => setTimeout(r, 100));
  }

  return fullMessages
    .filter(Boolean)
    .map(msg => formatGmailMessage(msg))
    .filter(Boolean) // Filter out any null formatted messages!
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

  const toHeader = get('to') || '';
  const destinatarios = toHeader ? toHeader.split(',').map(s => s.trim()) : [];

  const adjuntos = [];
  function traversePartsForAttachments(parts, adjuntosList) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        adjuntosList.push({
          nombre: part.filename,
          attachmentId: part.body.attachmentId,
          mimeType: part.mimeType,
          size: part.body.size || 0
        });
      }
      if (part.parts) {
        traversePartsForAttachments(part.parts, adjuntosList);
      }
    }
  }

  if (msg.payload.filename && msg.payload.body?.attachmentId) {
    adjuntos.push({
      nombre: msg.payload.filename,
      attachmentId: msg.payload.body.attachmentId,
      mimeType: msg.payload.mimeType,
      size: msg.payload.body.size || 0
    });
  }
  if (msg.payload.parts) {
    traversePartsForAttachments(msg.payload.parts, adjuntos);
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    messageId: get('message-id'),
    references: get('references'),
    asunto: get('subject') || '(Sin asunto)',
    cuerpo: body,
    remitente: get('from'),
    destinatario: toHeader,
    destinatarios: destinatarios,
    creado_en: new Date(Number(msg.internalDate)),
    leido: !msg.labelIds?.includes('UNREAD'),
    es_enviado: isSent,
    archivado: !msg.labelIds?.includes('INBOX') && !isSent,
    labelIds: msg.labelIds || [],
    adjuntos: adjuntos
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
export async function sendGmailEmail({ to, subject, bodyText, adjuntos = [], threadId = null, inReplyTo = null, references = null }) {
  const token = await getProviderToken();

  let rawEmail = '';
  
  const threadHeaders = [];
  if (inReplyTo) threadHeaders.push(`In-Reply-To: ${inReplyTo}`);
  if (references) threadHeaders.push(`References: ${references}`);
  
  if (adjuntos && adjuntos.length > 0) {
    const boundary = 'foo_bar_baz_' + Date.now();
    
    let parts = [
      `To: ${to}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      ...threadHeaders,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      bodyText,
      ''
    ];
    
    for (const adjunto of adjuntos) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${adjunto.mimeType}; name="${adjunto.nombre}"`,
        `Content-Disposition: attachment; filename="${adjunto.nombre}"`,
        'Content-Transfer-Encoding: base64',
        '',
        adjunto.base64Data,
        ''
      );
    }
    parts.push(`--${boundary}--`);
    rawEmail = parts.join('\r\n');
  } else {
    rawEmail = [
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      ...threadHeaders,
      '',
      bodyText,
    ].join('\r\n');
  }

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
    body: JSON.stringify({ 
      raw: encodedEmail,
      ...(threadId ? { threadId } : {})
    }),
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

/**
 * Descarga el contenido binario (base64url) de un archivo adjunto
 */
export async function downloadAttachment(messageId, attachmentId) {
  const token = await getProviderToken();
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    throw new Error('Error downloading attachment');
  }
  
  const data = await res.json();
  return data.data; // data.data contains the base64url encoded attachment
}
