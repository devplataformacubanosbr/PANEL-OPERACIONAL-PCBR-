## 2026-06-24T21:19:56Z
Objective:
Implement the "Global AI Assistant" feature in the React application, ensuring all requirements are met and all 87 tests in the E2E test suite pass.

Requirements:
1. React Context State Provider:
   - Create `src/context/GlobalAiChatContext.jsx` implementing the context and custom hook `useGlobalAiChat`.
   - Maintain the open/close state (`isOpen`), chat history messages, loading state (`isLoading`), and textarea input value (`input`).
   - Implement `sendMessage(text)` which appends the user message, calls the AI service `chatWithTools`, and appends the assistant reply.
   - Implement `clearChat()`.
2. Global AI UI Component:
   - Create `src/components/GlobalAiChat.jsx` rendering:
     - A Floating Action Button (FAB) at the bottom-right of the viewport (fixed, bottom: 24px, right: 24px, zIndex: 1000 or higher).
     - A Chat Drawer overlay (fixed, bottom: 96px, right: 24px, zIndex: 1000 or higher, width 400px or 350px, height constrained to fit viewport, e.g. 600px or calc(100vh - 120px)), which toggles when clicking the FAB.
     - Scrollable message container showing message history with styling class glass-panel and standard scrollbars.
     - Textarea and send button in the footer. Disable inputs/buttons when isLoading === true or when input is empty. Include a close button in the header.
3. Integrate into App.jsx:
   - Wrap the main application inside `src/App.jsx` with `<GlobalAiChatProvider>`.
   - Mount `<GlobalAiChat />` inside the root layout so it is available globally on all screens (Dashboard, Client View, Client List View).
   - Ensure the chat history persists when toggling views.
4. AI Service Refactoring:
   - Modify `src/services/aiService.js` to implement:
     - Safe JavaScript database tools that query Supabase:
       - `searchClientsByName(name)`: Searches clients by name using partial match (`.ilike('nombre', ...)`) on the `clientes` table.
       - `countPendingProcedures()`: Counts entries in the `entradas` table with `estado_tramite === 'pendiente'`.
       - `getOverallStats()`: Queries total clients, total procedures, and breakdown of procedures by status.
     - Function/Tool Calling Integration:
       - Implement `chatWithTools(chatHistory)` which passes the tool definitions (for the three functions above) to the Groq completion endpoint (`https://api.groq.com/openai/v1/chat/completions`).
       - If Groq returns `tool_calls`, invoke the corresponding JS function, append the results as role `tool` messages, and recursively call `chatWithTools` to get the final assistant response.
       - Fallback to standard chat response if tool calling is not supported or if the Groq call fails.
5. Verification:
   - Run the linter (`npm run lint` or `npx oxlint`) and fix any syntax or import errors.
   - Run the E2E tests (`node test/run-tests.js`) and ensure all 87 tests pass successfully.
