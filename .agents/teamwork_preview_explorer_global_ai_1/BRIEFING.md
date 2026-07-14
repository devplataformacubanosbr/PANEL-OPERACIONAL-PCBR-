# BRIEFING — 2026-06-25T00:15:15Z

## Mission
Codebase discovery and analysis for the "Global AI Assistant" feature implementation.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Read-only investigator, analyzer, synthesizer
- Working directory: c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\.agents\teamwork_preview_explorer_global_ai_1
- Original parent: 02348b1e-b620-4994-9108-d155e2ba31e0
- Milestone: Discovery and Strategy

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- CODE_ONLY network mode: no external requests, no curl/wget/etc. targeting external URLs.
- Only write within our directory: c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\.agents\teamwork_preview_explorer_global_ai_1

## Current Parent
- Conversation ID: 02348b1e-b620-4994-9108-d155e2ba31e0
- Updated: 2026-06-25T00:15:15Z

## Investigation State
- **Explored paths**:
  - `src/App.jsx` — Views, layouts, theme toggle
  - `src/components/ClientView.jsx` — Client view details, right column RAG chat, tabs and sections
  - `src/components/ClientListView.jsx` — Table list of clients, search query handling
  - `src/components/HomeView.jsx` — Table list of pending procedures (entradas)
  - `src/services/aiService.js` — Groq calls via fetch, OCR/vision analysis, client context chat
  - `src/services/groqService.js` — Duplicate vision analysis function
  - `src/services/crmBridgeService.js` — WhatsApp chat history from n8n webhook
  - `src/supabaseClient.js` — Supabase client creation
  - `src/index.css` — Global CSS variables and styles
  - `package.json` — Dependency declarations (React 19, Supabase, Lucide Icons, Oxlint)
- **Key findings**:
  - Routing is local-state driven inside `App.jsx`, which makes adding a global context wrapping `App.jsx` layout very straightforward.
  - The existing AI chat in `ClientView.jsx` is rendered as a persistent right-hand column rather than an overlaid drawer, and its messages are scoped to the specific active client.
  - The CRM data retrieval works via a POST webhook in `crmBridgeService.js` querying n8n with the client's CRM/Kommo ID.
  - Safe database tools can be implemented in `aiService.js` using Supabase queries matching table schemas.
- **Unexplored areas**: None. Codebase layout has been fully mapped.

## Key Decisions Made
- Define a complete React Context structure (`GlobalAiChatContext`) to persist state across view toggling.
- Formulate the Groq tool calling mechanism recursive loop.
- Draft clear definitions for safe DB functions: `searchClientsByName`, `countPendingProcedures`, `getOverallStats`.

## Artifact Index
- ORIGINAL_REQUEST.md — Original request instructions
- BRIEFING.md — This briefing/memory file
- progress.md — Real-time progress updates
- analysis.md — Synthesized strategy report
