## 2026-06-25T00:13:06Z

Objective:
Perform codebase discovery and analysis for the "Global AI Assistant" feature implementation in the React application.

Context:
We need to implement a Global AI Assistant accessible from any screen (Dashboard, Client ListView, Client View, etc.) with the following requirements:
1. Floating Action Button (FAB) at the bottom-right that toggles a chat panel overlaid on any screen.
2. Chat history must persist using React Context or global state as the user navigates between routes/views.
3. Refactor AI service to support Groq tool calling/function calling.
4. Implement safe JS database functions (Supabase) that the AI can call as tools:
   - searchClientsByName(name)
   - countPendingProcedures()
   - getOverallStats()
   to prevent injecting the whole DB or raw SQL.

Analyze the following:
1. Existing routing / views structure (e.g. App.jsx, ClientView.jsx, ClientListView.jsx, HomeView.jsx).
2. Existing AI/Groq services (e.g. src/services/aiService.js, groqService.js, crmBridgeService.js) and Supabase client (supabaseClient.js).
3. The exact mechanisms for CRM queries and data schemas.
4. How the AI Chat is currently built and styled (especially in ClientView.jsx), and how we can reuse/refactor its visual components for a global overlay Chat Drawer.
5. React Context/State management structure in the app and how to add a Global AI Chat Context.
6. Provide a detailed technical strategy and list of code locations that need modifications or creation.

Write your report to c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\.agents\teamwork_preview_explorer_global_ai_1\analysis.md and reply with a handoff message.
