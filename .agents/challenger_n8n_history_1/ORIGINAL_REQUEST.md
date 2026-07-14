## 2026-06-25T15:07:43Z

You are the Challenger subagent. Your task is to update the test suite to define the new test assertions for the n8n Workflow Data Mapping (R1) and AI Assistant History Persistence (R2) requirements.
Please perform the following:
1. Add new E2E/static test cases in `c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\test\e2e.test.js` under two new features:
   - Feature 8: n8n Workflow Data Mapping (R1)
     - Test that `n8n-kommo-workflow.json` does not use `.data[0]` to access properties in the fields updated by 'Actualizar Cliente'.
     - Test that `n8n-kommo-workflow.json` does not hardcode CPF to "1" (must map it from lead/contact data).
     - Test that `n8n-kommo-workflow.json` maps/passes the 'estado' field (from lead data to the 'entradas' insertion node).
     - Test that `n8n-kommo-workflow.json` does not map spelling-mismatched keys.
   - Feature 9: AI Assistant History Persistence (R2)
     - Test that `src/App.jsx` passes `selectedClientId` (or similar active client state) as a prop to the `GlobalAiChatProvider` node.
     - Test that `src/context/GlobalAiChatContext.jsx` imports `supabase` and contains `.from('ai_chats')` and inserts user/assistant messages under the active client.
     - Test that `src/context/GlobalAiChatContext.jsx` triggers history loading from `ai_chats` when `selectedClientId` changes.
2. Update `c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\test\run-tests.js` to include features 8 and 9 in the breakdown printout loop: `const features = [1, 2, 3, 4, 5, 6, 7, 8, 9];`.
3. Run the tests using `node test/run-tests.js` (you can run commands) to establish the baseline of failures.
4. Write your handoff report to `c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\.agents\challenger_n8n_history_1\handoff.md` and notify the orchestrator (conversation ID: eb1ed698-c66d-400c-a168-2ea75e95763c) when complete.
