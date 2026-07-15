# Scope: Gmail Integration Fix and Redesign

## Architecture
- `src/services/gmailService.js`: Interacts with Google Gmail API (fetching messages, sending emails).
- `src/components/ClientEmail.jsx`: Component displaying Gmail UI for client email threads.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 10 | E2E Test Suite | Create/update tests in `test/e2e.test.js` (or a separate test file) to cover the Gmail integration requirements (pagination, UI tabs, styling). | None | PLANNED |
| 11 | Fix Gmail API Query | Update `src/services/gmailService.js` to fetch all historical emails recursively/paginated, mapping fields correctly (`destinatarios` bug). | M10 | PLANNED |
| 12 | Redesign ClientEmail UI | Redesign `src/components/ClientEmail.jsx` to look like Gmail (tabs: Todos, Recibidos, Enviados; thread/reading pane; Gmail styling). | M11 | PLANNED |
| 13 | Integration & Audit | Run all tests, pass challengers, and pass the Forensic Integrity Auditor. | M12 | PLANNED |

## Interface Contracts
### `src/services/gmailService.js` ↔ `src/components/ClientEmail.jsx`
- `fetchClientEmails(clientEmail)`: Returns an array of formatted message objects, including `destinatario` (or aligned with `destinatarios`), `labelIds`, `es_enviado`, `cuerpo`, `asunto`, `remitente`, etc.
- UI tabs:
  - "Todos": Shows all emails.
  - "Recibidos": Shows emails with label `INBOX`.
  - "Enviados": Shows emails with label `SENT`.
