# Tasks: Brand and Product Foundation

**Status**: Not implemented. IDs are local to feature 001. Tests/review evidence are mandatory; owner gates are not pre-approved.

## Setup and Foundational

- [ ] T001 Reconcile all 25 brief sections and final deliverables with `AGENTS.md` coverage; record gaps before adding scope (FR-001, FR-007).
- [ ] T002 Review `checklists/review.md` before final design (FR-008). Approved 2026-09-25: D-000 constitution ratified v1.0.0; D-001 name is Daimoma (ديمومة); D-002 bilingual English + Arabic/RTL; D-009 phase-001 UX acceptance (WCAG 2.2 AA, 360/768/1440 + 320px reflow, 200% text, keyboard/contrast/states).

## US1 - Product identity and scope

Goal: stakeholder can explain the product, required modules, users, and brand. Independent review: all FR-001/FR-002 outputs trace to the brief.

- [ ] T003 [US1] Define personas, problem, objectives, success criteria, and exclusions in `docs/product/product-definition.md` (FR-001).
- [ ] T004 [US1] Write the approved product name identity in `docs/brand/identity.md`: meaning, rationale, tagline options, confusion and license checks; retain all candidates considered including rejected ones with reasons (FR-002, FR-008).
- [ ] T005 [US1] Produce approved primary/light/dark logos and product icon in `assets/brand/` after T004 owner acceptance (FR-002).
- [ ] T006 [US1] Specify palette/type/personality/spacing/imagery/radius/emphasis in `docs/brand/usage.md` and structured tokens in `assets/brand/tokens.json` (FR-002, FR-004).

## US2 - Employee journeys

Goal: understand submission and correction without training. Independent review: request/time prototype walkthrough across mobile/desktop and failure states.

- [ ] T007 [US2] Write walkthrough acceptance cases first in `docs/design/employee-acceptance.md` covering loading/empty/error/validation/disabled/success (FR-006).
- [ ] T008 [US2] Produce request creation/submission/history/return and weekly time journey diagrams in `docs/design/employee-flows.md` (FR-003).
- [ ] T009 [US2] Define all shared component interactions and accessibility requirements in `docs/design/component-system.md` (FR-004, FR-006).
- [ ] T010 [US2] Produce coded interactive HTML/CSS prototypes in `docs/design/prototypes/` for employee journeys at 360/768/1440 widths, English and Arabic RTL, clearly labeled as mockups (FR-005, FR-008).

## US3 - Manager and HR journeys

Goal: shared navigation with explicit review/admin scope. Independent review: review-return and HR administration/reporting journeys.

- [ ] T011 [US3] Define role-specific review/admin navigation acceptance cases in `docs/design/reviewer-acceptance.md` (FR-003, FR-006).
- [ ] T012 [US3] Design team review queues and organization administration/reporting in `docs/design/reviewer-flows.md` (FR-003, FR-005).
- [ ] T013 [US3] Extend the coded prototypes in `docs/design/prototypes/` with manager/HR states, unavailable/session-expired screens, long names, narrow layouts, and RTL variants (FR-005, FR-006).

## Polish and Handoff

- [ ] T014 Record keyboard/focus/contrast/reflow findings and owner feedback in `docs/evidence/001-design-review.md`; fix findings before acceptance (FR-005, FR-006).
- [ ] T015 Link requirements/scenarios to approved assets and planned component tests in `docs/evidence/001-traceability.md`; distinguish prototype evidence from production evidence (FR-007).
- [ ] T016 Reconcile `spec.md`, `plan.md`, `contracts/ui.md`, and `AGENTS.md` decisions; obtain reviewer approval without erasing outstanding tasks (FR-001, FR-008).

## Dependencies and Execution Strategy

T001 -> T002 -> US1 -> US2 -> US3 -> handoff. After token decisions, distinct flow diagrams may be drafted independently, but no parallel writer/subagent is authorized by this file. First useful increment is approved scope/identity; it is not a working application. Mark tasks complete only with their deliverables and actual review evidence.
