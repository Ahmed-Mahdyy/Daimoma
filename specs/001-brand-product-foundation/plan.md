# Implementation Plan: Brand and Product Foundation

**Feature**: 001-brand-product-foundation | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)
**Status**: Planning refined after D-000/D-001/D-002 and the coded-prototype decision. Design acceptance remains gated by D-009 UX thresholds, brand clearance and reviewer sign-off. This is not application implementation.

## Summary

Turn the source brief into an approved bilingual product and design system for **Daimoma (ديمومة)**. Document Employee, Manager and HR journeys, brand identity, accessible component states, and interactive English/Arabic-RTL HTML/CSS prototypes at 360/768/1440 CSS px. Use synthetic data and visibly label prototypes; hand off tokens and contracts to the later React/DRF implementation rather than implying the prototypes are working business software.

## Technical Context

| Concern | Phase 001 decision |
| --- | --- |
| Language/version | Semantic HTML5, CSS and minimal plain JavaScript for interactive mock states; no frontend runtime dependency in this phase. Later production: React + strict TypeScript (phase 002). |
| Dependencies | Browser and Python 3's static file server for local preview; no new package. License-check candidate Arabic/Latin fonts and icon assets before use. Design tokens should be compatible with later Tailwind configuration without requiring Tailwind during static prototyping. |
| Storage | Versioned Markdown, SVG/logo sources and exports, JSON design tokens, static prototypes. No Django tables, migrations, authentication or real employee data. |
| Validation | Artifact validator plus reviewer walkthroughs in [quickstart.md](quickstart.md); test 360/768/1440 CSS px and 320 CSS px reflow/zoom in EN/LTR and AR/RTL, keyboard, focus, errors and contrast. Automated application/component tests belong to phase 002. |
| Target platform | Current desktop/mobile browsers with accessible HTML semantics; phase 002 integrates the accepted designs into the same-origin React web app. |
| Project type | Standalone product discovery, brand and interactive design prototype for a web application. |
| Performance/quality goals | WCAG 2.2 AA target for testable design states; prototype demonstrates responsive/reflow and interaction patterns. Production latency/Web Vitals targets in `AGENTS.md` remain provisional under D-009 and must not be reported as achieved by this static design. |
| Scale/scope | 3 roles; 10 mandatory modules inventoried; bilingual core employee, manager and HR journeys; required components and asynchronous states. No production data, API endpoints or business decisions for phases 002-005. |

**Open policy gate**: D-009 UX acceptance thresholds require owner approval before design acceptance; use WCAG 2.2 AA criteria as the ratified constitution's baseline, not as a claim that an audit already passed. Brand name choice is approved, but confusion/trademark/license clearance and tagline/artwork are not.

## Constitution Check

| Principle | Phase 001 gate and evidence |
| --- | --- |
| I: scope and traceability | Map all brief sections/modules/roles to FRs and the existing task IDs; no payroll/surveillance or silent scope expansion. D-000 ratified, D-001 name and D-002 bilingual scope recorded. |
| II, IV, VIII: server authority, data integrity and contracts | Mark review/authorization states as design-only; UI visibility is not security. No real database, API, schema or server authorization is delivered in this phase; contract explicitly hands these obligations to 002-005. |
| III, IX: tests and evidence | Write independent walkthrough acceptance cases before prototypes, retain actual review findings; no simulated production/test success. Reviewer checklist remains open until a human accepts it. |
| V: maintainability | Semantic tokens and reusable component contracts; no new framework, queue, service or production dependency. |
| VI: privacy | Synthetic names/records only; no secrets, credentials, actual employee data or unlicensed brand assets. |
| VII: accessible responsive UX | EN/LTR and AR/RTL across core journeys and states; keyboard, focus, contrast, reflow, translated errors/statuses and reduced motion reviewed against WCAG 2.2 AA. |
| X: AI and change control | No commit/deploy/subagent implementation claims; report provenance and review separately from proposed design. |

**Pre-research result**: No constitutional violation for planning. **Post-design result**: No violation introduced by this design. D-009, uncompleted design artifacts and reviewer-owned checklist gates **block final design acceptance and unrestricted implementation**, but do not block writing provisional planning artifacts. No production release is authorized.

## Project Structure

- `specs/001-brand-product-foundation/`: spec, this plan, [research.md](research.md), [data-model.md](data-model.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md), tasks and review checklists.
- `docs/product/product-definition.md`: future brief coverage, personas, goals, module and MVP inventory (T001/T003).
- `docs/brand/identity.md`, `docs/brand/usage.md`, `assets/brand/`: future naming rationale/clearance, tagline, font/license register, editable logos/variants and token JSON (T004-T006).
- `docs/design/employee-acceptance.md`, `docs/design/employee-flows.md`, `docs/design/reviewer-acceptance.md`, `docs/design/reviewer-flows.md`, `docs/design/component-system.md`: future test cases, flows and shared UI patterns (T007-T009, T011-T012).
- `docs/design/prototypes/`: future clearly marked static HTML/CSS mockups with minimal JS for demo interactions, bilingual content and RTL states (T010/T013). These paths are planned, not claimed to exist.
- `docs/evidence/`: future actual review, accessibility findings and traceability; `frontend/src/components/ui/`, `frontend/src/app/` become real runtime work in phase 002, not in this plan.

## Execution Design

1. **Coverage and approval** (T001-T003): reconcile 25 source sections and all ten modules; retain approved D-000/D-001/D-002. Propose measurable UX targets for D-009, obtain owner approval before final design acceptance. Record personas, exclusions and testable journeys.
2. **Identity and tokens** (T004-T006): document Daimoma meaning and considered alternatives, propose tagline and original logo system, perform actual conflict/trademark and font/icon license review before final-use claims; design light/dark logo variants, semantic colors and Arabic/Latin typography. The name is selected, not legally cleared.
3. **Acceptance-first interaction design** (T007-T009/T011-T012): map requests, weekly time and review/administration with happy, returned, forbidden and error states. Write accessibility/RTL component contract before interactive prototype construction.
4. **Bilingual prototypes** (T010/T013): build inspectable English/LTR and Arabic/RTL employee, manager and HR flows at 360/768/1440 CSS px; account for 320px reflow, zoom, mixed-direction IDs/dates and non-mirrored brand imagery; use minimal JS only to simulate navigation and states; never accept credentials or imply live approval.
5. **Review and handoff** (T014-T016): record actual keyboard/focus/contrast/reflow and owner findings, correct issues, trace requirements to artifacts and planned production tests, obtain independent human sign-off. Future React/DRF and security verification remain phases 002-005.

## Verification

Follow [quickstart.md](quickstart.md) against [contracts/ui.md](contracts/ui.md). Log browser, viewport, locale, reviewer/date, observed outcome, measured contrast and corrections. Verify every required state in each applicable screen and inspect RTL content and focus traversal; keep screenshots explicitly labelled mockups. `python3 .devin/scripts/specs.py check` validates only artifact structure, not design or implementation. Run the checker after any plan/contract update; keep reviewer checklist items unchecked until reviewed.

## Migration and Rollout

No schema/data changes. Treat approved tokens/assets and translated strings as versioned handoff to phase 002; audit each consuming screen on a later breaking token/component change. Separate owner design acceptance, legal/license review and application release acceptance.

## Risks and Complexity

Name collision/trademark availability for Daimoma is not verified; owner selection is not commercial clearance. Font coverage/licensing, translated copy quality, bidirectional mixing and responsive RTL may require revisions. Proposed operating/performance targets under D-009 remain unapproved. Do not introduce a Tailwind CDN/build chain solely for phase 001; production integration will resolve version compatibility in phase 002.
