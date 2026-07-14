# Project: UI/UX Refactoring (Modern Static Layout & Fixed AI Chat)

## Architecture
The application is a React-based single page dashboard. It uses custom CSS variables in `index.css` and inline React styles for layout. Key views are managed via state variables (`currentView === 'client'`).
- `src/App.jsx`: Global container. Contains the main wrapper and a routing mechanism.
- `src/components/ClientView.jsx`: Main view for individual client details, which currently uses horizontal tabs and a fixed-overlay slide-in AI chat drawer.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Test Suite | Design static/structural verification tests for the layout requirements | None | DONE |
| 2 | Global Layout & Fixed Chat | Lock viewport in `App.jsx`, embed AI Chat as persistent right panel in `ClientView.jsx` | M1 | DONE |
| 3 | Unified Scroll & Quick Nav | Stack data sections in a central scrollable div, add left navigation anchor menu | M2 | DONE |
| 4 | Optimization & Linting | Refactor spacing, fix misalignments, run oxlint, and resolve all review findings | M3 | DONE |
| 5 | Global AI E2E Test Suite | Design verification tests for Global AI FAB, Context, and Database functions | None | DONE |
| 6 | Global AI UI & Context | Implement FAB floating button, Chat Drawer, and Global Context for history persistence | M5 | DONE |
| 7 | AI Service Tools | Implement Groq function calling, searchClientsByName, countPendingProcedures, getOverallStats | M6 | DONE |
| 8 | Global AI Audit | Run E2E test suite, linter, and perform forensic integrity audit | M7 | DONE |
| 9 | ClientView Layout Drawer | Convert AI Chat to toggleable drawer, expand content area, adjust spacing | M8 | DONE |

## Interface Contracts
### `ClientView.jsx` Layout Interface
- **Left Column**: Quick Navigation sidebar. Anchors jump to specific sections using DOM scroll.
- **Center Column**: Unified vertically scrollable content container containing all client info sections, expanding to fill horizontal space.
- **Right Drawer**: Toggleable AI Chat drawer (hidden by default, opens as an overlay, does not occupy grid space when closed).
- **Global constraints**: Window does not scroll (`overflow: hidden` on main wrapper).
