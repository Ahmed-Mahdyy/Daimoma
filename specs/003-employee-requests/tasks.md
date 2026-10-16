# Tasks: Employee Requests

**Status**: Not implemented. Mandatory tests; local task IDs under feature 003.

## Setup and Foundational

- [x] T001 Approve D-004/D-006/D-007/D-008, schema/route/confidentiality/file policy in `AGENTS.md` and `contracts/api.md`; review all checklist gates (FR-002, FR-003, FR-004). **Resolved 2026-09-29: D-006 approved — 5 categories, no attachments, no confidential routing.**
- [x] T002 Create reviewed request models/migrations in `backend/apps/employee_requests/models.py`: unique organization/type-code, request/cycle/sequence, request/version event; positive quantities; bounded strings; protected owner/type/history; route/content snapshots (FR-001, FR-003, FR-009).
- [x] T003 Implement scoped selectors/related choices and version-aware error contracts in `backend/apps/employee_requests/selectors.py` and `serializers.py` with explicit writable fields (FR-001, FR-008).

## US1 - Draft and submit

Goal: submit valid owned work with private supporting information. Independent test: create/correct/upload/submit/read-only cycle.

- [x] T004 [US1] Write failing draft/type/date/ownership/protected-field tests in `backend/apps/employee_requests/tests/test_drafts.py` (FR-001, FR-010).
- [x] T005 [US1] Implement validated create/update drafts and returned work in `backend/apps/employee_requests/services.py` and `views.py` (FR-001).
- [x] T006 [US1] Attachment validation/storage tests in `backend/apps/employee_requests/tests/` — **deferred per D-006 (2026-09-29): no file uploads in Phase 003** (FR-002).
- [x] T007 [US1] Private attachment storage/download implementation in `backend/apps/employee_requests/` — **deferred per D-006 (2026-09-29): no file uploads in Phase 003** (FR-002).
- [x] T008 [US1] Write missing/self/inactive-reviewer and duplicate-submit tests in `backend/apps/employee_requests/tests/test_submission.py` (FR-003, FR-006, FR-010).
- [x] T009 [US1] Implement atomic submission with route/content snapshots, cycle/steps, event, and durable notifications in `backend/apps/employee_requests/services.py` (FR-003, FR-007).
- [x] T010 [US1] Build tested draft/form/status UI in `frontend/src/features/requests/` using generated API types and explicit read-only/error states (FR-001, FR-010).

## US2 - Review and correction

Goal: permitted final or returned decisions without self-approval or races. Independent test: both routes and resubmission under concurrent reviewers.

- [x] T011 [US2] Write transition/self-review/wrong-stage/reason/race tests in `backend/apps/employee_requests/tests/test_reviews.py` (FR-004, FR-005, FR-006, FR-010).
- [x] T012 [US2] Implement approve/reject/return and new-cycle resubmission services with expected-version checks in `backend/apps/employee_requests/services.py` (FR-004, FR-005, FR-006).
- [x] T013 [US2] Integrate pending-review reassignment with phase 002 administration in `backend/apps/organizations/services.py` and request tests; retain completed steps and revoke old manager access (FR-006, FR-008).
- [x] T014 [US2] Build review queue/decision dialogs/reasons and returned-work editor in `frontend/src/features/requests/`, including stale-conflict recovery and no optimistic approvals (FR-004, FR-005, FR-010).

## US3 - Tracking and type administration

Goal: discover permitted work and understand genuine history. Independent test: two-team search/history/configuration without scope leaks.

- [x] T015 [US3] Test scoped search/filter/order/page/count and historical type changes in `backend/apps/employee_requests/tests/test_queries.py` (FR-008, FR-009, FR-010).
- [x] T016 [US3] Implement request/type/history endpoints and safe notification integration in `backend/apps/employee_requests/views.py` and `backend/apps/notifications/` (FR-007, FR-008, FR-009).
- [x] T017 [US3] Build list/filter/detail/timeline/type-settings screens in `frontend/src/features/requests/`; test six async states and accessible navigation (FR-007, FR-008, FR-009, FR-010).

## Polish and Acceptance

- [x] T018 Expand generated OpenAPI and frontend types under `frontend/src/api/`; add schema-drift and query-budget checks for request contracts (FR-008, FR-010).
- [x] T019 Implement real API cross-role mobile/desktop journeys in `tests/e2e/requests.spec.ts`; record actual security/scanning/race/migration evidence in `docs/evidence/003-requests.md` (FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-010).
- [x] T020 Reconcile `spec.md`, `plan.md`, `tasks.md`, contracts, and owner decisions after review; retain open defects and obtain explicit acceptance (FR-009, FR-010). **Accepted 2026-10-02 (owner).** Open defect retained: none. Deferred per D-006: attachments/file policy.

## Dependencies and Strategy

Phase 002 verified -> T001-T003 -> US1 -> US2 -> US3 -> acceptance. File scanning can be built independently of visual forms after contracts, but full submission waits on accepted-file enforcement. No general-purpose workflow engine. Separate test files can be prepared after contracts without authorizing parallel agents. First useful slice is owned draft/submission; release requires the complete mandated review and privacy flows.
