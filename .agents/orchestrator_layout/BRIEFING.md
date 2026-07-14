# BRIEFING — 2026-06-25T09:31:10-03:00

## Mission
Coordinate the layout changes to ClientView.jsx to maximize horizontal space and make the AI Chat toggleable.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\.agents\orchestrator_layout
- Original parent: main agent
- Original parent conversation ID: f9abb809-5caa-4bb7-9ead-7a48a450a557

## 🔒 My Workflow
- **Pattern**: Project Pattern
- **Scope document**: c:\Users\Micro\Documents\FLUJO-CENTRO-DE-TRABAJO-main\CUBANOS_BR_MARCOS\DASHBOARDOperacional\.agents\orchestrator_layout\PROJECT.md
1. **Decompose**: Identify current status of ClientView.jsx, map changes, decompose into milestones.
2. **Dispatch & Execute** (pick ONE):
   - **Direct (iteration loop)**: Spawn Explorer -> Worker -> Reviewer -> Challenger -> Auditor for layout change.
   - **Delegate (sub-orchestrator)**: [TBD]
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Spawn successor after spawn count >= 16 and all subagents are complete.
- **Work items**:
  1. Explore ClientView.jsx and layout architecture [pending]
  2. Plan layout changes and document in PROJECT.md [pending]
  3. Implement layout changes via Worker [pending]
  4. Verify changes via Reviewers, Challenger, and Forensic Auditor [pending]
- **Current phase**: 1
- **Current focus**: Explore ClientView.jsx and layout architecture

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- Never run build/test commands yourself — require workers to do so.
- A Forensic Auditor will independently verify all work (ZERO TOLERANCE for cheating).
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: f9abb809-5caa-4bb7-9ead-7a48a450a557
- Updated: not yet

## Key Decisions Made
- Use Project Pattern to drive layout refactoring.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_layout | teamwork_preview_explorer | Explore layout and test suite | completed | 69201268-280d-40d0-99b9-40927a2fdbc0 |
| worker_layout | teamwork_preview_worker | Implement layout drawer changes | completed | 3caa5a51-cc1b-45e5-9d5f-417ab50c0e3e |
| reviewer_layout_1 | teamwork_preview_reviewer | Review drawer layout implementation | completed | 29ee456e-997a-46b4-bfde-70e427b56b08 |
| reviewer_layout_2 | teamwork_preview_reviewer | Review drawer layout robustness | completed | f61be3c7-182a-472b-9c23-155e5be50617 |
| challenger_layout_1 | teamwork_preview_challenger | Stress test layout drawer | completed | 8fef1647-7f85-4fe7-99df-809c67c2cead |
| challenger_layout_2 | teamwork_preview_challenger | Runtime validation layout drawer | completed | 60907f32-fa4a-4eb8-b5b3-f4d27190c80c |
| auditor_layout | teamwork_preview_auditor | Integrity forensics validation | completed | a6650beb-1bd7-43aa-9412-4f854cab78e9 |

## Succession Status
- Succession required: no
- Spawn count: 7 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 161e1e26-76a6-4f55-a377-707d54f139a4/task-13
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run manage_task(Action="list") — re-create if missing

## Artifact Index
- ORIGINAL_REQUEST.md — Verbatim user request history
- BRIEFING.md — This briefing document
