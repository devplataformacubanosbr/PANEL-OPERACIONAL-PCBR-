# Handoff Report: Global AI Assistant Explorer

This handoff contains the read-only codebase discovery and analysis for the "Global AI Assistant" feature implementation. The detailed technical strategy and code definitions have been written to `c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\.agents\teamwork_preview_explorer_global_ai_1\analysis.md`.

---

## 1. Observation

- **Routing and Views**: `src/App.jsx` handles state-driven view routing using local state `currentView` (line 9). Views are represented by `HomeView.jsx`, `ClientView.jsx`, and `ClientListView.jsx`.
- **Existing AI Services**: `src/services/aiService.js` makes direct HTTP POST requests to `https://api.groq.com/openai/v1/chat/completions` using the `llama-3.3-70b-versatile` text model (line 15) and `llama-3.2-11b-vision-preview` vision model (line 16).
- **Existing AI Chat UI**: Rendered inside `ClientView.jsx` (lines 964-1019) as a `400px` right column, storing/loading message history from the `ai_chats` table via Supabase client `src/supabaseClient.js`.
- **CRM Webhook Integration**: `src/services/crmBridgeService.js` (lines 6-42) connects to n8n via a webhook URL using POST to exchange the CRM/Kommo ID for client chat history.

---

## 2. Logic Chain

- **Context Preservation**: Because `currentView` in `App.jsx` toggles the active component, any local state in view components is destroyed on unmount. Storing the global chat history and drawer states requires a React Context Provider (`GlobalAiChatContext`) wrapping the layout of `App.jsx`.
- **Safe DB Integration**: Exposing direct SQL access or loading the database directly into the LLM prompt causes security risks and excessive token cost. Implementing JavaScript database wrappers (`searchClientsByName`, `countPendingProcedures`, `getOverallStats`) using Supabase client queries exposes only secure, parameter-validated APIs to the LLM.
- **Overlay Drawer Reuse**: Reusing the visual components and CSS variables of the existing `ClientView.jsx` chat inside a dedicated `GlobalAiChat.jsx` component ensures styling consistency while avoiding viewport layouts breaking the structural checks.

---

## 3. Caveats

- **Offline Mode**: Since we are in `CODE_ONLY` network mode, external Groq API requests are mock-dependent during local development.
- **Client Focus in Global Chat**: The global assistant can remain context-aware of the current client by having `GlobalAiChat` reference the `selectedClientId` prop from the global layout if the user is in the `client` view.

---

## 4. Conclusion

- We have designed a complete technical strategy, including concrete code implementations for:
  - `src/context/GlobalAiChatContext.jsx` (React Context state)
  - `src/components/GlobalAiChat.jsx` (FAB + Chat Drawer UI)
  - Safe DB tool handlers: `searchClientsByName(name)`, `countPendingProcedures()`, `getOverallStats()` inside `aiService.js`
  - Groq function calling handler: `chatWithTools(chatHistory)` recursive loop inside `aiService.js`.
- This ensures all requirements are met cleanly, modularly, and securely.

---

## 5. Verification Method

- Run the project's code linter to verify syntax correctness:
  ```bash
  npm run lint
  ```
- Use a mock Node test script (`test/toolCall.test.js`) to invoke `chatWithTools` and verify that Supabase calls execute correctly and prompt resolutions are received from Groq.
