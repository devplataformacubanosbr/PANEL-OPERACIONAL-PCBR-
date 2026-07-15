# Summary of Changes

## 1. React Whitescreen Crash (Null Pointer Exception)
- **File**: `src/services/gmailService.js`
- **Location**: `fetchClientEmails` function
- **Fix**: Added a second `.filter(Boolean)` step after calling `.map(msg => formatGmailMessage(msg))` to discard any messages that format to `null` due to missing payloads, preventing runtime crashes on UI lists and sorting (`b.creado_en.getTime()`).

## 2. Gmail API Rate-Limiting & Quota Exhaustion
- **File**: `src/services/gmailService.js`
- **Location**: `fetchClientEmails` function
- **Fix**: Capped the list of messages fetched for details to the latest 100 entries using `allMessages = allMessages.slice(0, 100);` before running the `Promise.all` detail fetches.

## 3. Silent Attachment Loss Warning
- **File**: `src/components/ClientEmail.jsx`
- **Location**: File input `onChange` and drag-and-drop `handleDrop` handlers.
- **Fix**: Show a `toast.error('El envío de archivos adjuntos no está soportado en esta versión. Se enviará solo el texto del correo.');` warning when files are selected via input or dropped, ensuring the user is notified that outbound attachments are not supported.

## 4. Responsive UI Layout
- **File**: `src/components/ClientEmail.jsx`
- **Location**: Layout and inline styling properties.
- **Fix**: 
  - Added an `isMobile` state variable (`window.innerWidth < 768`) and window resize listener.
  - Adjusted the main split-pane container to stack vertically (`flexDirection: 'column'`) on mobile viewports.
  - Show/hide panes dynamically on mobile based on whether a thread is selected (single-pane navigation model).
  - Stacked the left sidebar items horizontally in a scrollable header bar and adjusted button paddings/widths.
  - Extended the Compose overlay window to take 100% width and 90% height on mobile screens to mimic natural mobile email apps.
