# Tasks: Brand and Product Foundation

**Status**: Phase 001 prototype/design handoff approved by owner 2026-09-25 under D-010; final logo/colors explicitly deferred to 002:T025. This is not production or accessibility acceptance. IDs are local to feature 001.

## Setup and Foundational

- [x] T001 Reconcile all 25 brief sections and final deliverables with `AGENTS.md` coverage; recorded in `docs/product/product-definition.md` — no gaps found (FR-001, FR-007).
- [x] T002 Review `checklists/review.md` — owner confirmed CHK001–CHK007 pass on 2026-09-25 (FR-008). Approved: D-000 constitution v1.0.0; D-001 name is Daimoma (ديمومة); D-002 bilingual English + Arabic/RTL; D-009 phase-001 UX acceptance (WCAG 2.2 AA, 360/768/1440 + 320px reflow, 200% text, keyboard/contrast/states).

## US1 - Product identity and scope

Goal: stakeholder can explain the product, required modules, users, and brand. Independent review: all FR-001/FR-002 outputs trace to the brief.

- [x] T003 [US1] Personas, problem, objectives, success criteria, exclusions in `docs/product/product-definition.md` (FR-001).
- [x] T004 [US1] Daimoma identity in `docs/brand/identity.md`: meaning, rationale, tagline options, actual conflict findings (Daimoma Express TR; ديمومة consultancy JO — owner accepted risk), all candidates with rejection reasons (FR-002, FR-008).
- [x] T005 [US1] Original SVG logos produced: `assets/brand/logo-primary.svg`, `logo-dark.svg`, `logo-light.svg`, `icon.svg` (FR-002).
- [x] T006 [US1] Palette/type/spacing/radius/personality in `docs/brand/usage.md` + structured `assets/brand/tokens.json`; contrast values measured (FR-002, FR-004).

## US2 - Employee journeys

Goal: understand submission and correction without training. Independent review: request/time prototype walkthrough across mobile/desktop and failure states.

- [x] T007 [US2] Walkthrough acceptance cases in `docs/design/employee-acceptance.md` covering loading/empty/error/validation/disabled/success (FR-006).
- [x] T008 [US2] Request creation/submission/history/return and weekly time journey diagrams in `docs/design/employee-flows.md` (FR-003).
- [x] T009 [US2] Shared component interactions and accessibility contract in `docs/design/component-system.md` (FR-004, FR-006).
- [x] T010 [US2] Coded interactive HTML/CSS/JS prototypes in `docs/design/prototypes/` — employee journeys, EN + AR/RTL toggle, 360/768/1440 width switcher, labeled mockup ribbon (FR-005, FR-008).

## US3 - Manager and HR journeys

Goal: shared navigation with explicit review/admin scope. Independent review: review-return and HR administration/reporting journeys.

- [x] T011 [US3] Role-specific review/admin acceptance cases in `docs/design/reviewer-acceptance.md` (FR-003, FR-006).
- [x] T012 [US3] Team review queues and org administration/reporting in `docs/design/reviewer-flows.md` (FR-003, FR-005).
- [x] T013 [US3] `docs/design/prototypes/` extended with manager/HR screens (queue, review item, team time, employees, types, reports), session-expired/forbidden/stale states, RTL variants (FR-005, FR-006).

## Polish and Handoff

- [x] T014 Recorded findings in `docs/evidence/001-design-review.md` — agent-verified items (contrast, structure, bidi/focus code) vs pending human/browser checks listed honestly (FR-005, FR-006).
- [x] T015 Requirement→artifact→evidence map in `docs/evidence/001-traceability.md`; prototype vs production evidence distinguished (FR-007).
- [x] T016 Reconciled `spec.md`, `plan.md`, `contracts/ui.md`, and `AGENTS.md` after owner approval of the Phase 001 prototype/design direction on 2026-09-25 (D-010). Final logo/colors explicitly deferred to 002:T025; accessibility/browser verification and tagline/licensing remain separate open gates (FR-001, FR-008).

## Dependencies and Execution Strategy

T001 -> T002 -> US1 -> US2 -> US3 -> handoff. Owner approved the prototype/interaction direction under D-010. Before finalizing branded React UI in phase 002: obtain explicit logo/palette approval in 002:T025, choose tagline if used, verify font licenses and complete real browser/keyboard/RTL/zoom accessibility checks. Phase 001 handoff approval does not authorize production branding, claim WCAG compliance, or approve remaining phase-002 security policies.
