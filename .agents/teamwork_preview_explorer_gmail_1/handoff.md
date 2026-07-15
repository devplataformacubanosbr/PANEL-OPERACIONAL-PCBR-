# Handoff Report: Gmail Integration Exploration & Redesign Plan

## 1. Observation
We observed the following code segments and properties in the repository files:

### Gmail Service (`src/services/gmailService.js`)
* **Pagination & Max Results**: In lines 31-39, the email query only requests one page with a limit of 50:
  ```javascript
  const q = `to:${clientEmail} OR from:${clientEmail}`;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50&includeSpamTrash=false`;
  ```
  No paging loop (via `nextPageToken`) exists.
* **Recipient Field**: In line 96, only the singular field `destinatario` is formatted:
  ```javascript
  destinatario: get('to'),
  ```
  There is no `destinatarios` array.
* **Attachments Field**: Lines 82-104 contain the complete returned object of `formatGmailMessage(msg)` and show that `adjuntos` is missing from the mapped format.

### ClientEmail Component (`src/components/ClientEmail.jsx`)
* **Recipient Field Usage**: Lines 529 and 565 expect an array named `destinatarios`:
  * Line 529: `Para: {msg.destinatarios?.join(', ') || 'Cliente'}`
  * Line 565: `para {activeMessage.destinatarios?.join(', ')}`
* **Attachments Field Usage**: Lines 572-585 check and map over `activeMessage.adjuntos` to render attachments.
* **View Switching**: Line 464 switches the entire screen display layout conditionally between `view === 'list'` and `view === 'read'`, replacing the list screen entirely.

### Test Architecture (`test/run-tests.js` & `test/e2e.test.js`)
* `test/run-tests.js` loads and iterates over tests from `test/e2e.test.js` (lines 1-13) and prints Tier/Feature stats.
* `test/e2e.test.js` reads source code as text and checks style, function names, and structural elements using string matching or regular expressions.

---

## 2. Logic Chain
1. **Paging Mismatch**: Because the list url has `maxResults=50` and does not implement a request loop check on `nextPageToken` (Observation 1), `fetchClientEmails` fails to retrieve historical emails beyond the first 50 results.
2. **Recipient Array Mismatch**: Since `formatGmailMessage` output provides `destinatario` (string) but does not define `destinatarios` (Observation 1), and `ClientEmail.jsx` reads `msg.destinatarios` as an array (Observation 2), the array operations fail or return `undefined`, resulting in the list view showing the default text `'Cliente'` and the reading pane showing nothing.
3. **Attachments Mismatch**: Since `formatGmailMessage` output does not parse or return `adjuntos` (Observation 1), the check `activeMessage.adjuntos` in `ClientEmail.jsx` evaluates to undefined (Observation 2), and received attachments are never rendered in the client interface.
4. **Layout Mismatch**: The current component style swaps list and reading views (Observation 2), preventing users from navigating their list of emails and reading them simultaneously. Implementing a split-pane layout with thread grouping by `threadId` resolves this layout limitation.
5. **Static Assertions Verification**: Because the test runner performs static analysis checks on file content (Observation 3), we can verify both the pagination and UI redesign requirements by proposing test cases that scan the codebase for loop structures (`nextPageToken`), target UI classes/colors, label checks, and thread groupings.

---

## 3. Caveats
* **Gmail API Rate Limits**: While fetching all historical emails recursively is correct, if a client has thousands of messages, requesting details via `Promise.all` for all of them could hit rate limits (429) or cause high memory usage. Practical implementations might want to chunk these detail requests or limit historical fetch depth.
* **Authentication token refresh**: We assumed that the auth token in `google_provider_token` is refreshed properly by the parent application or Supabase functions, which was not investigated.

---

## 4. Conclusion
* **Gmail Service**: Fix the Gmail query to use an iterative loop that requests additional pages using `nextPageToken` until all matching historical records are retrieved. Resolve the field mismatches by splitting the `to` header into a `destinatarios` array and extracting attachment metadata (`filename`, `attachmentId`, etc.) from `payload.parts` to populate the `adjuntos` field.
* **UI Redesign**: Refactor `ClientEmail.jsx` to adopt a split-pane interface (list column on the left, reading pane on the right) with top tabs ("Todos", "Recibidos", "Enviados") filtering messages using native labels `INBOX` and `SENT`. When an email is clicked, load the full conversational thread grouped by `threadId` in stacked cards inside the reading pane.
* **Testing**: Add proposed static analysis tests to `test/e2e.test.js` to ensure the codebase retains paginated queries, thread groupings, label filters, and specific Google/Gmail UI hex colors.

---

## 5. Verification Method
To verify the implementation of the proposed plans:
1. **Run the Test Suite**: Run the project tests command to ensure no regressions are introduced:
   `node test/run-tests.js`
2. **Inspect the Code Structure**: Verify that the new code patterns exist:
   * Confirm the pagination loop by searching for `nextPageToken` in `src/services/gmailService.js`.
   * Confirm the split-pane thread layouts and Gmail hex colors in `src/components/ClientEmail.jsx`.
3. **Inspect Output Formats**: Check that `fetchClientEmails` returns objects with `destinatarios` as an array and `adjuntos` as an array.
