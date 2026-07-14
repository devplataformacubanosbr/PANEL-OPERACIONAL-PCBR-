# Plan: n8n Workflow Mapping & AI Chats History Persistence

This plan outlines the execution steps to complete requirements R1 and R2.

## Milestones
1. **Exploration**: Spawn an Explorer subagent to analyze the codebase:
   - Identify details about `n8n-kommo-workflow.json` mapping.
   - Investigate how `ai_chats` table is used in React.
   - Discover how the Global AI Assistant chat state can access/resolve the "corresponding `cliente_id`" (e.g., if a client is active in the UI, or if the Global AI Assistant history should persist to `ai_chats` when chatting in a client context).
   - Check standard linting rules and test scripts.
2. **E2E Testing Track**: Spawn a Challenger subagent to write test cases verifying:
   - n8n workflow mappings (validation of nodes).
   - AI history persistence in Supabase `ai_chats` table for all user-assistant interactions under the correct `cliente_id`.
3. **Implementation Track**: Spawn a Worker subagent to:
   - Refactor `n8n-kommo-workflow.json`.
   - Update `aiService.js` and/or the Global AI Context / components to persist message history to `ai_chats` under the corresponding `cliente_id`.
   - Run linter and tests to ensure no regressions.
4. **Review & Audit**:
   - Spawn a Reviewer to verify correctness.
   - Spawn an Auditor to run the integrity audit.
