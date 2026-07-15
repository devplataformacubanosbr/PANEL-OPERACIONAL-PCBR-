# Gmail Integration & Redesign Analysis

This document provides a detailed analysis of the existing Gmail integration in the application and outlines a concrete plan for fixing the Gmail API query issues, resolving data discrepancies, redesigning the user interface to match Gmail's web version, and expanding the test suite to verify these changes.

---

## 1. Analysis of `src/services/gmailService.js`

### Current Implementation of `fetchClientEmails`
* **Query Syntax**: The function constructs a query searching for emails sent to or from the client:
  ```javascript
  const q = `to:${clientEmail} OR from:${clientEmail}`;
  ```
* **Endpoint Call**: It performs a GET request to the Gmail list messages endpoint:
  ```javascript
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50&includeSpamTrash=false`;
  ```
* **Limitation**: The current request is capped at `maxResults=50` and does **not** handle pagination. If a client has more than 50 historical emails, or if the emails we need fall outside the first page, they will not be returned.

### Proposed Fix: Pagination Loop using `nextPageToken`
The Gmail API returns a `nextPageToken` string if there are more matching messages. To query all historical emails, we must implement an iterative loop that requests subsequent pages using the `pageToken` query parameter until no `nextPageToken` is returned.

**Proposed Implementation**:
```javascript
export async function fetchClientEmails(clientEmail) {
  if (!clientEmail) return [];
  const token = await getProviderToken();

  const q = `to:${clientEmail} OR from:${clientEmail}`;
  let allMessages = [];
  let nextPageToken = null;

  do {
    let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=100&includeSpamTrash=false`;
    if (nextPageToken) {
      url += `&pageToken=${nextPageToken}`;
    }

    console.log('[Gmail] Buscando:', q, nextPageToken ? `con token ${nextPageToken}` : '');

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
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  console.log('[Gmail] Total de mensajes encontrados:', allMessages.length);

  if (allMessages.length === 0) return [];

  // Obtener detalles de cada mensaje (se puede optimizar con procesamiento por lotes si es necesario)
  const fullMessages = await Promise.all(
    allMessages.map(async (msgItem) => {
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
```

### Data Format Discrepancies between Service and Component
During inspection of `gmailService.js` and `ClientEmail.jsx`, the following critical format mismatches were found:

1. **`destinatario` vs `destinatarios`**:
   * **In Service**: `formatGmailMessage` returns a single string `destinatario` from the `to` header:
     ```javascript
     destinatario: get('to'),
     ```
   * **In UI Component**: `ClientEmail.jsx` tries to render `msg.destinatarios` as an array of recipients:
     * Line 529: `Para: {msg.destinatarios?.join(', ') || 'Cliente'}`
     * Line 565: `para {activeMessage.destinatarios?.join(', ')}`
   * **Impact**: Because `destinatarios` is `undefined` on the message object, the list view always defaults to `"Cliente"` instead of showing the recipient list, and the read view shows an empty recipient list.
   * **Fix**: Update `formatGmailMessage` in the service to parse and return both fields:
     ```javascript
     const toHeader = get('to');
     const destinatarios = toHeader ? toHeader.split(',').map(s => s.trim()) : [];
     // Return both fields:
     destinatario: toHeader,
     destinatarios: destinatarios,
     ```

2. **`adjuntos` (Attachments)**:
   * **In Service**: The service's `formatGmailMessage` does **not** extract, parse, or return any attachment details (`adjuntos` field is missing).
   * **In UI Component**: `ClientEmail.jsx` attempts to render attachments using `activeMessage.adjuntos` (lines 572–585):
     ```javascript
     {activeMessage.adjuntos && activeMessage.adjuntos.length > 0 && ( ... )}
     ```
   * **Impact**: Received attachments are never shown in the UI.
   * **Fix**: Traverse the `payload.parts` structure in the service to extract attachment details (such as `filename`, `mimeType`, and `body.attachmentId`) and include an `adjuntos` array in the formatted message object.

3. **`operario` (Sender Metadata)**:
   * **In UI Component**: Line 557 renders `activeMessage.operario || 'Agencia'`.
   * **In Service**: The service only parses `remitente` (the `From` header string). While this is safely guarded by the fallback, we can parse the display name from the `From` header and map it to `operario` (or keep the fallback).

---

## 2. Redesign Plan for `src/components/ClientEmail.jsx`

To give the integration a modern, authentic Gmail feel, we propose a complete UI restructure.

### Sidebar Redesign
* **Redactar (Compose) Button**: Styled as a prominent, floating-action pill button at the top-left of the sidebar:
  * White or light blue (`#c2e7ff`) background with a soft drop shadow (`box-shadow: 0 1px 3px 0 rgba(60,64,67,0.3)`).
  * Color accents matching the Google theme (`#001d35` or red icon).
  * Smooth transitions and hover scaling.
* **Navigation Links**:
  * Clean, list-style buttons with rounded-right pills.
  * Active states highlighted in light blue (`#eaf1fb` or `#e8f0fe`) with dark blue text (`#0b57d0` or `#1a73e8`) and bold fonts.
  * Hover effects using `#f1f3f4` or `#f5f5f5` background.

### Tabs & Label Filters
* **Visual Tabs**: Introduce top tabs over the email list ("Todos", "Recibidos", "Enviados"). This replicates the Gmail sub-inbox category feel.
  * Each tab will have an active underline indicator (e.g., `border-bottom: 3px solid #0b57d0`) and blue text.
* **Filter Logic Optimization**: Currently, filtering depends on a custom, internal `archivado` flag. We should align filters with actual Gmail labels retrieved from the API:
  * **Todos**: Lists all retrieved messages.
  * **Recibidos (Inbox)**: Filters for `msg.labelIds.includes('INBOX')`.
  * **Enviados (Sent)**: Filters for `msg.labelIds.includes('SENT')`.
  * This is clean, robust, and matches Gmail's backend logic.

### Split-Pane Layout & Conversational Thread View
Rather than replacing the entire screen when clicking an email, we propose a modern **Split-Pane Layout**:
1. **Left-Pane (40% width)**: A scrollable list of email threads. Each list item represents a *thread* showing the latest message snippet, date, sender, and count of messages in that thread (e.g. `(3)`).
2. **Right-Pane (60% width) - Reading Pane**: If no message/thread is selected, it displays a clean placeholder illustration (e.g., an envelope icon with "Selecciona una conversación para leerla").
3. **Conversational Thread View**: When a thread is clicked, the right pane loads all messages sharing that same `threadId` in chronological order:
   * **Header**: Large thread subject at the top.
   * **Message Cards**: Stacked vertically. Older messages are collapsed (showing only sender name, date, and body snippet), and the latest message is expanded.
   * **Interactivity**: Clicking any collapsed card header expands it smoothly.
   * **Actions**: A bottom quick-reply/forward form is embedded directly in the reading pane to allow continuous conversation without opening secondary modal windows.

---

## 3. Test Framework & Proposed Test Cases

### How the Node.js Test Runner Works
* **Test Runner (`test/run-tests.js`)**: Imports the tests definition from `e2e.test.js`. It runs each test inside a `try-catch` block, counts passing/failing tests, outputs a detailed color-coded report by Tier and Feature, and exits with `0` (success) or `1` (failure).
* **Test Suite (`test/e2e.test.js`)**: Reads the codebase files (e.g., `App.jsx`, `ClientView.jsx`, services, components) as text strings and performs static code analysis (regular expressions, string inclusion checks) to verify that target classes, variables, hooks, imports, and styling definitions exist.

### Proposed Test Cases
We propose adding the following static analysis tests to `test/e2e.test.js` to ensure the requirements are met:

#### Feature: Gmail Service Historical & Paginated Fetch
1. **Test: `fetchClientEmails` uses a loop to traverse pages**:
   * *Method*: Check that the service file imports or references `pageToken` and implements a loop constraint.
   * *Regex*: `/nextPageToken/i.test(allServicesContent) && /(?:do\s*\{|while\s*\()/i.test(allServicesContent)`
2. **Test: `fetchClientEmails` appends/concatenates messages across pages**:
   * *Method*: Verify that the messages array is combined using concatenation.
   * *Regex*: `allServicesContent.includes('.concat(') || allServicesContent.includes('.push(')`
3. **Test: Fetch endpoint incorporates the `pageToken` parameter when querying**:
   * *Method*: Check that the page token query parameter is appended dynamically to the URL.
   * *Regex*: `/&pageToken=/i.test(allServicesContent) || /pageToken=\$/i.test(allServicesContent)`

#### Feature: ClientEmail Layout & Thread View
4. **Test: UI renders "Todos", "Recibidos", and "Enviados" navigation filters**:
   * *Method*: Verify that tab filtering selectors are declared in the component.
   * *Regex*: `allComponentsContent.includes('todos') && allComponentsContent.includes('recibidos') && allComponentsContent.includes('enviados')`
5. **Test: Filtering logic correctly references Gmail native labels**:
   * *Method*: Ensure filters check Gmail labels (`INBOX` and `SENT`) instead of relying solely on artificial client-side flags.
   * *Regex*: `/['"]INBOX['"]/i.test(allComponentsContent) && /['"]SENT['"]/i.test(allComponentsContent)`
6. **Test: Component implements conversational thread grouping (reads `threadId`)**:
   * *Method*: Verify that the UI component parses/maps messages using `threadId` to compile threads.
   * *Regex*: `allComponentsContent.includes('threadId')`
7. **Test: Component applies custom Gmail theme style elements**:
   * *Method*: Check for specific Gmail UI color hexes like `#C2E7FF` (Compose pill), `#EAF1FB` or `#E8F0FE` (active highlight), and Gmail branding Red (`#D93025` or `#EA4335`).
   * *Regex*: `/#C2E7FF/i.test(allComponentsContent) && (/#EAF1FB/i.test(allComponentsContent) || /#E8F0FE/i.test(allComponentsContent))`
