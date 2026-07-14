# Project Plan: ClientView Layout Optimization and Toggleable AI Chat

## Objectives
Implement the layout changes to `ClientView.jsx` as requested in the third part of `ORIGINAL_REQUEST.md` (dated 2026-06-25T12:30:27Z). Specifically:
1. Remove the fixed 400px AI Chat sidebar from the main grid of `ClientView.jsx` to maximize horizontal space for client data.
2. Convert the AI Chat panel into a hidden, toggleable overlay drawer that opens via a toggle button in the header/top layout.
3. Ensure the central data column expands fluidly to occupy the remaining screen width when the drawer is closed.
4. Verify the layout changes pass the build and tests (updating tests if they check the old static layout).

## Verification Strategy
1. **Tests Execution**: Run the existing test suite via `node test/run-tests.js`.
2. **Analysis of Test Conflicts**: Check if existing tests in `test/e2e.test.js` enforce the older, fixed 3-column layout. If so, they must be updated to align with the new acceptance criteria.
3. **Implementation Verification**:
   - Verify layout classes/styles are modern, using standard grid/flex.
   - Verify `ClientView.jsx` top-right has an "Asistente IA" button.
   - Verify AI Chat drawer renders as a sliding panel/overlay.
   - Verify build and tests pass.

## Spawning Strategy
- **Explorer**: Analyze the current codebase, run the test suite, identify the test requirements, check if any tests conflict with the new requirements, and suggest a strategy.
- **Worker**: Implement the layout changes in `ClientView.jsx` and, if necessary, update the tests in `test/e2e.test.js` to reflect the new drawer architecture.
- **Reviewer**: Verify the changes and ensure visual/functional constraints are met.
- **Challenger**: Verify responsiveness and edge cases of the new toggleable drawer.
- **Auditor**: Run integrity checks.

## Milestones
- **M1: Exploration & Planning**
  - Run initial test suite.
  - Confirm conflicts between existing tests and new layout requirements.
  - Define exact layout changes and test updates.
- **M2: Implementation**
  - Refactor `ClientView.jsx` layout grid.
  - Implement toggle button and overlay drawer.
  - Adjust internal card paddings and widths.
- **M3: Test Updates & Validation**
  - Update `test/e2e.test.js` if necessary to match the new toggleable/overlay drawer behavior.
  - Run build and test suite, achieving 100% pass rate.
- **M4: Final Review & Auditing**
  - Reviewer verification.
  - Auditor verification.
