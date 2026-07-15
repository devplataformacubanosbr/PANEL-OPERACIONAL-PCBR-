import { supabase } from '../supabaseClient';

/**
 * Helper to get the Google Provider Token from the current Supabase session.
 * Throws an error if the user is not logged in via Google with the required token.
 */
export async function getProviderToken() {
  // First try local storage (more reliable across reloads)
  let token = localStorage.getItem('google_provider_token');
  
  if (!token) {
    // Fallback to session if not in local storage
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No hay sesión activa.');
    token = session.provider_token;
  }
  
  if (!token) throw new Error('No se encontró el token de Google. Debes iniciar sesión con Google.');
  return token;
}

/**
 * Fetch email threads related to a specific client email address.
 * Uses Gmail API to search for messages sent to or from the client.
 */
export async function fetchClientEmails(clientEmail) {
  if (!clientEmail) return [];
  const token = await getProviderToken();
  
  // Build query to find emails to or from this client
  const query = encodeURIComponent(`to:${clientEmail} OR from:${clientEmail}`);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!response.ok) {
    if (response.status === 401) throw new Error('La sesión de Google expiró. Inicia sesión de nuevo.');
    throw new Error('Error al buscar correos en Gmail');
  }

  const data = await response.json();
  if (!data.messages) return [];

  // Fetch full message details for each ID
  const fullMessages = await Promise.all(
    data.messages.map(async (msgItem) => {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return msgRes.json();
    })
  );

  // Format into our standard format
  return fullMessages.map(msg => formatGmailMessage(msg)).sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());
}

/**
 * Format a raw Gmail message into our ClientEmail component format.
 */
function formatGmailMessage(msg) {
  const headers = msg.payload.headers;
  const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
  const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
  const toHeader = headers.find(h => h.name.toLowerCase() === 'to');
  const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');

  let body = '';
  if (msg.payload.parts) {
    const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart && textPart.body && textPart.body.data) {
      // Decode base64url
      let base64 = textPart.body.data.replace(/-/g, '+').replace(/_/g, '/');
      body = decodeURIComponent(escape(atob(base64)));
    } else if (msg.payload.parts[0].parts) {
      // Sometimes it's nested
      const nestedText = msg.payload.parts[0].parts.find(p => p.mimeType === 'text/plain');
      if (nestedText && nestedText.body.data) {
        let base64 = nestedText.body.data.replace(/-/g, '+').replace(/_/g, '/');
        body = decodeURIComponent(escape(atob(base64)));
      }
    }
  } else if (msg.payload.body && msg.payload.body.data) {
    let base64 = msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
    body = decodeURIComponent(escape(atob(base64)));
  }

  // Check labels
  const isSent = msg.labelIds && msg.labelIds.includes('SENT');

  return {
    id: msg.id,
    asunto: subjectHeader ? subjectHeader.value : '(Sin asunto)',
    cuerpo: body,
    remitente: fromHeader ? fromHeader.value : '',
    destinatario: toHeader ? toHeader.value : '',
    creado_en: new Date(Number(msg.internalDate)),
    leido: !(msg.labelIds && msg.labelIds.includes('UNREAD')),
    es_enviado: isSent,
    archivado: false, // Gmail API has 'archive' differently (lack of INBOX label), but we map it loosely
    threadId: msg.threadId,
  };
}

/**
 * Send an email via Gmail API
 */
export async function sendGmailEmail({ to, subject, bodyText }) {
  const token = await getProviderToken();

  const str = [
    'Content-Type: text/plain; charset="UTF-8"\n',
    'MIME-Version: 1.0\n',
    `To: ${to}\n`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\n\n`,
    bodyText,
  ].join('');

  // Encode to base64url
  const encodedEmail = btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: encodedEmail
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    console.error('Error sending via Gmail API:', errData);
    throw new Error('Error al enviar correo vía Gmail');
  }

  return response.json();
}
