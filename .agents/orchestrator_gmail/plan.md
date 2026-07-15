# plan.md — 2026-07-15T22:32:30Z

## Task Assessment
- **Task**: Fix Gmail API query (historical and current) in `src/services/gmailService.js` and redesign the UI in `src/components/ClientEmail.jsx` to look like Gmail.
- **Complexity**: High. Requires understanding Gmail API queries, token fetching, pagination, and styling React components to mimic a complex UI (tabs, message lists, reading pane/email threads).
- **Verification Plan**:
  - Update Node-based static E2E tests in `test/e2e.test.js` or create a new test suite to cover the Gmail API and UI requirements.
  - Implement and run the tests.
  - Review and Challenger confirmation.
  - Forensic integrity audit.

## Milestones

### Milestone 10: E2E Test Suite for Gmail
- **Scope**: Define Node-based verification tests checking that `fetchClientEmails` uses pageToken pagination for all historical emails, and checks for Gmail tabs ("Todos", "Recibidos", "Enviados") and Gmail styling elements in `src/components/ClientEmail.jsx`.
- **Status**: PLANNED

### Milestone 11: Fix Gmail API Query
- **Scope**: Update `src/services/gmailService.js` to retrieve all historical sent/received emails using pagination (`nextPageToken`) and fix any incorrect/incomplete queries. Verify that correct data fields like `destinatario` vs `destinatarios` are aligned.
- **Status**: PLANNED

### Milestone 12: Redesign ClientEmail UI
- **Scope**: Redesign `src/components/ClientEmail.jsx` to look like Gmail. Set up:
  - Layout structure with proper sidebar, search bar, and primary action buttons.
  - Separation of "Todos", "Recibidos" (Inbox), and "Enviados" (Sent) tabs with correct filtering based on labelIds (`INBOX` / `SENT`).
  - Thread view/reading pane where clicking an email opens it in a Gmail-like thread view.
  - Styling (fonts, border spacing, colors, hover effects mimicking Google web app).
- **Status**: PLANNED

### Milestone 13: Integration & Forensic Audit
- **Scope**: Run all tests, pass challengers, and pass the Forensic Integrity Auditor.
- **Status**: PLANNED

## Robustness & Edge Cases (Mitigations to implement)
1. **Null filtering fix**: Move/add `.filter(Boolean)` after `.map(msg => formatGmailMessage(msg))` to prevent null messages from entering the array and causing a React whitescreen crash.
2. **Rate Limit / Quota Mitigation**: Limit historical detail fetches to the latest 100 messages.
3. **Attachment warning**: Toast a warning to the user if they try to attach files, explaining that outbound attachments are not supported yet, to prevent silent data loss.
4. **Mobile layout responsiveness**: Ensure the split-pane flexes correctly on smaller screens.

## Team Allocation Plan
- **Explorer**: `teamwork_preview_explorer_gmail_1`
- **Worker**: `teamwork_preview_worker_gmail_1`
- **Reviewers**: `teamwork_preview_reviewer_gmail_1`, `teamwork_preview_reviewer_gmail_2`
- **Challenger**: `teamwork_preview_challenger_gmail_1`
- **Auditor**: `teamwork_preview_auditor_gmail_1`
