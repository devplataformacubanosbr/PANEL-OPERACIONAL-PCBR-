# E2E Test Infra: UI/UX Refactoring (Modern Static Layout & Fixed AI Chat)

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Static structure validation, regex/parsing checks on code files to assert that elements, selectors, and style attributes conform to layout requirements.
- This is chosen because local environment constraints (CODE_ONLY mode with blocked internet) prevent browser automation downloads (e.g. Chromium for Playwright/Cypress).

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|---------------------|:------:|:------:|:------:|:------:|
| 1 | Global Static Layout | ORIGINAL_REQUEST §R1 | 5      | 5      | ✓      | ✓      |
| 2 | Fixed AI Chat Sidebar | ORIGINAL_REQUEST §R1 | 5      | 5      | ✓      | ✓      |
| 3 | Unified Central Scroll | ORIGINAL_REQUEST §R2 | 5      | 5      | ✓      | ✓      |
| 4 | Left-hand Quick Nav | ORIGINAL_REQUEST §R2 | 5      | 5      | ✓      | ✓      |

## Test Architecture
- Test runner: `node test/run-tests.js`
- Test suite file: `test/e2e.test.js`
- Assertions check properties in `src/App.jsx` and `src/components/ClientView.jsx`.
- Returns exit code 0 if all tests pass.

## Coverage Thresholds
- Tier 1: 20 tests (5 per feature checking happy-path style & element definitions)
- Tier 2: 20 tests (5 per feature checking boundaries, empty values, error modes, z-indexes)
- Tier 3: 4 tests (covering feature interaction pairs)
- Tier 4: 5 tests (real-world app layout flow validation)
- Total tests: 49
