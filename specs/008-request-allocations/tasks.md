# Tasks: Request Allocations

**Status**: Planning queue only. All tasks are unchecked; no application code has been changed for this feature. Input: [spec](spec.md), [plan](plan.md), [model](data-model.md), [contract](contracts/api.md). Critical tests precede implementation where practical.

## Phase 1: Setup and review gates

- [ ] T001 Obtain owner/reviewer decisions for no-overlap, zero-day, schedule-edit and grant-correction rules; record them in `specs/008-request-allocations/spec.md` and `AGENTS.md` before implementing affected behavior (FR-001, FR-002, FR-003, FR-004).
- [ ] T002 Reconcile the approved 008 extension with 003/005 contracts and preserve completed task history in `specs/003-employee-requests/spec.md`, `specs/005-dashboard-reporting/spec.md`, and `specs/008-request-allocations/contracts/api.md` (FR-006, FR-007, FR-008).

## Phase 2: Foundational invariants

- [ ] T003 Specify and test one profile -> grant -> request/step lock order shared by existing request transitions and HR grant mutations in `backend/apps/employee_requests/services.py` and `backend/apps/employee_requests/tests/test_concurrency.py`; retain current request version/conflict semantics (FR-005, FR-006, FR-010).
- [ ] T004 Write populated-database migration and scope baseline tests in `backend/apps/employee_requests/tests/test_allocations.py` and `backend/tests/test_security_matrix.py` to ensure existing types default false and no old request gets a commitment (FR-007, FR-008, FR-010).

## Phase 3: User Story 1 — HR awards and audits grants (P1)

**Goal**: HR can set the company schedule/type flag, award dated allowances and adjust them without invalidating existing commitments.
**Independent test**: HR creates an allowance; employee sees their own grant, another employee and manager cannot administer it; overlap and invalid reduction are rejected.

- [ ] T005 [US1] Write failing grant/date/unit/HR permission and adjustment-history tests in `backend/apps/employee_requests/tests/test_allocations.py` and `backend/apps/organizations/tests/test_administration.py` (FR-001, FR-002, FR-007, FR-010).
- [ ] T006 [US1] Add company weekday setting, request-type Boolean default false, positive integer dated grant and append-only adjustment model with additive migrations in `backend/apps/organizations/models.py`, `backend/apps/employee_requests/models.py` and their `migrations/` directories (FR-001, FR-002, FR-008).
- [ ] T007 [US1] Implement HR-only company weekday configuration, eligible category/immutable-unit checks, same-org grant choice, no-overlap rules and reasoned adjustments with locking in `backend/apps/organizations/services.py` and `backend/apps/employee_requests/allocations.py` (FR-001, FR-002, FR-003, FR-007).
- [ ] T008 [US1] Add scoped paginated grant/adjustment endpoints and type flag to `backend/apps/employee_requests/serializers.py`, `backend/apps/employee_requests/views.py`, `backend/apps/employee_requests/urls.py` and org settings serializers (FR-001, FR-002, FR-007).
- [ ] T009 [US1] Build HR weekday/type control and allocation administration table and adjustment form with EN/AR states in `frontend/src/features/requests/RequestTypesPage.tsx`, `frontend/src/features/requests/AllocationsPage.tsx`, `frontend/src/lib/i18n.ts` (FR-001, FR-002, FR-009).

## Phase 4: User Story 2 — employee submits against one grant (P1)

**Goal**: Submission alone reserves the calculated amount; no grant/insufficient balance blocks the request without partial side effects.
**Independent test**: Date, time and item requests each reserve exactly their own units; competing submissions do not overspend.

- [ ] T010 [US2] Write failing positive/zero-day, date-boundary, quantity/minute, grant-expiry, race and cross-org request tests in `backend/apps/employee_requests/tests/test_allocations.py` and `backend/apps/employee_requests/tests/test_concurrency.py` (FR-003, FR-004, FR-005, FR-010).
- [ ] T011 [US2] Add positive-integer, one-grant-per-request-cycle commitment schema, unique `(request, cycle)` and frozen unit/weekday/date-basis snapshot in `backend/apps/employee_requests/models.py` and `backend/apps/employee_requests/migrations/` (FR-004, FR-005, FR-006, FR-008).
- [ ] T012 [US2] Calculate inclusive scheduled days (no holidays), same-day minutes or equipment quantity; select one dated grant, lock/recheck capacity and atomically reserve on submit in `backend/apps/employee_requests/allocations.py` and `backend/apps/employee_requests/services.py` (FR-003, FR-004, FR-005).
- [ ] T013 [US2] Document scoped advisory preview, regenerate OpenAPI/TypeScript contract and add form impact/error states in `backend/apps/employee_requests/views.py`, `backend/schema.yml`, `frontend/src/api/requests.ts` and `frontend/src/features/requests/RequestFormPage.tsx` (FR-003, FR-004, FR-009).

## Phase 5: User Story 3 — employee follows remaining allocation (P1)

**Goal**: Approval settles once, return/rejection releases once, and only the owner sees correct balances on the personal dashboard.
**Independent test**: Personal totals reconcile across all request states; reviewers cannot access another employee's grant details; expired pending remains reserved.

- [ ] T014 [US3] Write failing approval/return/reject/resubmit, pending-expiry, dashboard privacy/reconciliation and role-boundary tests in `backend/apps/employee_requests/tests/test_allocations.py` and `backend/apps/reporting/tests/test_dashboards.py` (FR-006, FR-007, FR-010).
- [ ] T015 [US3] Integrate exact-once reserved -> used/released decisions into existing request transitions and history, preserving multi-stage review behavior in `backend/apps/employee_requests/services.py` and `backend/apps/employee_requests/allocations.py` (FR-005, FR-006).
- [ ] T016 [US3] Add scoped self-balance projection and personal dashboard fields without granting team/org allocation reads in `backend/apps/reporting/selectors.py`, `backend/apps/reporting/views.py` and `backend/apps/employee_requests/views.py` (FR-007, FR-009).
- [ ] T017 [US3] Add responsive personal grant breakdown, no-grant/zero/expired-pending states, cache invalidation and Arabic copy in `frontend/src/features/dashboards/DashboardPage.tsx`, `frontend/src/api/reporting.ts` and `frontend/src/lib/i18n.ts` (FR-007, FR-009).

## Phase 6: Integrated verification and release gate

- [ ] T018 Add cross-role browser journeys and accessibility/RTL/responsive checks in `tests/e2e/requests.spec.ts`, `tests/e2e/accessibility.spec.ts` and `frontend/src/features/dashboards/dashboard.test.tsx` (FR-007, FR-009, FR-010).
- [ ] T019 Validate additive migration on a populated synthetic database, schema drift, Ruff, backend tests, TypeScript/lint/build, frontend tests, Playwright/axe and measured D-009 workload; record actual outcomes, open failures and reviewer approval in `docs/evidence/008-request-allocations.md` and `specs/008-request-allocations/quickstart.md` (FR-008, FR-010).

## Dependencies and safe parallelism

T001–T004 block implementation. US1 grant persistence must precede US2 reservation; US2 commitment and request integration must precede US3 dashboard/settlement acceptance. Independent test drafting for different stories can proceed in parallel after policy review, but changes sharing `services.py`, `models.py` or `i18n.ts` must be coordinated. No implementation, deployment, production migration or automatic commit/push is authorized by this plan. Suggested MVP is US1 + US2 + US3 together for a meaningful employee balance; HR grants alone do not satisfy the user-visible requirement.
