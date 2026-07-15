## Challenge Summary

**Overall risk assessment**: HIGH

While the Gmail integration passes all basic E2E verification tests (6/6 tests passing for Feature 10), severe vulnerabilities exist under load or with atypical/malformed API responses. These can result in API rate-limiting, component crashes (Visual Whitescreen), and silent data loss.

---

## Challenges

### [High] Challenge 1: Gmail API Rate-Limiting & Memory Exhaustion under Large Email Histories

- **Assumption challenged**: Assumes the number of historical emails associated with a client's address is small enough to load all details concurrently in a single batch.
- **Attack scenario**: A client has a large historical interaction history (e.g., 200+ emails). The pagination loop (`pageToken`) collects all message IDs. It then triggers `Promise.all` across the entire array, launching hundreds of concurrent HTTP requests to `gmail.googleapis.com` to fetch individual details.
- **Blast radius**: 
  1. The Gmail API will reject requests with `429 Too Many Requests` or `503 Service Unavailable` due to strict per-second quota units limits.
  2. The browser connection pool (max 6 active sockets per domain) will clog, delaying other network operations.
  3. Excessive memory consumption (OOM) on low-end client machines.
- **Mitigation**: 
  1. Limit pagination to a max threshold (e.g., 50 messages total) or implement user-triggered pagination ("Load more").
  2. Control concurrency when fetching message details (e.g., batching in groups of 5, or fetching sequentially).

---

### [High] Challenge 2: React Component Crash on Malformed/Failed Email Payloads

- **Assumption challenged**: Assumes that `formatGmailMessage(msg)` never returns `null` or that the returned array contains only valid, non-null message objects.
- **Attack scenario**: 
  - If a message fetch details call fails (e.g., `msgRes.ok` is false), it returns `null`.
  - If a message payload is missing (`!msg?.payload`), `formatGmailMessage` returns `null`.
  - In `gmailService.js` (lines 86-88), the `filter(Boolean)` is applied *before* the `map(formatGmailMessage)`:
    ```javascript
    return fullMessages
      .filter(Boolean)
      .map(msg => formatGmailMessage(msg))
      .sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());
    ```
    This means if `formatGmailMessage` returns `null`, the final array has `null` values.
  - In `ClientEmail.jsx` (line 329), `filteredMessages` calls `msg.asunto` directly on each element:
    ```javascript
    const matchesSearch = (msg.asunto || '').toLowerCase().includes(q) ...
    ```
- **Blast radius**: The component will throw `TypeError: Cannot read properties of null (reading 'asunto')` and trigger an uncaught runtime error, crashing the React view rendering (Whitescreen).
- **Mitigation**: Move `.filter(Boolean)` to be *after* the `.map()` step in `gmailService.js`:
  ```javascript
  return fullMessages
    .map(msg => formatGmailMessage(msg))
    .filter(Boolean)
    .sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());
  ```

---

### [Medium] Challenge 3: Silent Discarding of Email Attachments on Send

- **Assumption challenged**: Assumes that files added to the `adjuntos` state list are processed and sent to the recipient when the operator triggers `handleSendEmail`.
- **Attack scenario**: The operator composes a new message, drags files or clicks the paperclip icon to upload them. The files appear in the `adjuntos` list. When the user clicks "Enviar", the UI displays "Correo enviado correctamente" and clears the compose box.
- **Blast radius**: The `sendGmailEmail` function only takes `{ to, subject, bodyText }` and ignores the `adjuntos` state array entirely. The recipient receives the email but without the documents attached, causing silent workflow failures (operators assuming documents are sent when they are not).
- **Mitigation**: 
  1. Extend `sendGmailEmail` to build a multipart MIME body containing file attachments encoded in base64.
  2. Or disable the attachment UI and display a warning indicating that attachment uploads are not supported in this version.

---

### [Low] Challenge 4: Sort Corruption on Invalid/Missing Date Formats

- **Assumption challenged**: Assumes that `msg.internalDate` is always a valid timestamp.
- **Attack scenario**: If `msg.internalDate` is null or missing, `new Date(Number(msg.internalDate))` produces an `Invalid Date` object. Calling `getTime()` on it returns `NaN`.
- **Blast radius**: Sorting threads (`b.creado_en.getTime() - a.creado_en.getTime()`) will fail, sorting them erratically or in unpredictable order. Additionally, rendering the date on the UI will display "Invalid Date".
- **Mitigation**: Default `msg.internalDate` to the current date/time if missing: `new Date(Number(msg.internalDate || Date.now()))`.

---

## Stress Test Results

- **Scenario 1**: 0 emails match query
  - Expected: Return `[]` safely, UI shows "No se encontraron conversaciones".
  - Actual: Pass.
- **Scenario 2**: Empty/null parameters to `fetchClientEmails`
  - Expected: Return `[]` immediately without API calls.
  - Actual: Pass.
- **Scenario 3**: 100+ concurrent messages detail retrieval
  - Expected: Rate limited / HTTP 429 or lag.
  - Predicted: Fail (exceeds Google API rates and browser connection limits).
- **Scenario 4**: Malformed/Failed single message details in mapping
  - Expected: Handled gracefully without crash.
  - Actual: Fail (returns `null` in array causing `TypeError` on render).

---

## Unchallenged Areas

- **OAuth token expiration auto-refresh** — Not fully challenged. We checked that the token gets cleared on `401 Unauthorized`, but testing auto-refresh/refresh-token exchange was out of scope due to lack of mock server support for oauth code flow.
