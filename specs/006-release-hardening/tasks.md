# Tasks: Release Hardening

**Status**: Not executed. Tests/evidence mandatory; IDs local to 006.

## Setup and Foundational

- [ ] T001 Approve test matrix, D-008/D-009 workload, severity gates, and environment in `AGENTS.md` and `contracts/quality-gates.md` (FR-001, FR-003, FR-004, FR-008).
- [ ] T002 Inventory actual automated/manual coverage and missing cases in `docs/evidence/006-coverage.md`; do not treat scaffold checkboxes as test results (FR-003, FR-007).

## US1 - Security and integrity

Goal: reproducible server/data assurances. Independent test: full negative matrix, concurrency and upgrade suite.

- [ ] T003 [US1] Add missing failing permission/CSRF/session/field-injection/file/export/inbox cases in `backend/tests/test_security_matrix.py` before fixes (FR-001, FR-005).
- [ ] T004 [US1] Extend domain concurrency/locking/time/reassignment tests in `backend/apps/employee_requests/tests/` and `backend/apps/timesheets/tests/` using separate PostgreSQL connections (FR-002).
- [ ] T005 [US1] Add fresh and populated upgrade/invariant checks in `backend/tests/test_migrations.py`; inspect migration lock/data impacts (FR-002).
- [ ] T006 [US1] Run dependency/secret/configuration/privacy review through approved CI checks and record redacted findings in `docs/evidence/006-security.md` (FR-005).

## US2 - Usability and performance

Goal: reliable real-device-size journeys and measured limits. Independent test: real-API role flows plus approved workload.

- [ ] T007 [US2] Extend real-API network/session/empty/error/correction journeys in `tests/e2e/` and frontend component tests without bypassing auth (FR-003).
- [ ] T008 [US2] Perform keyboard/focus/contrast/zoom/reduced-motion and 360/768/1440 review; record actual browser findings in `docs/evidence/006-accessibility.md` (FR-003).
- [ ] T009 [US2] Implement approved reproducible load scenarios and synthetic dataset generation under `tests/performance/` with nonproduction execution guards (FR-004).
- [ ] T010 [US2] Measure API/query/browser/bundle budgets and profile bottlenecks; record hardware/method/results in `docs/evidence/006-performance.md` (FR-004).

## US3 - Defects and release decision

Goal: truthful complete evidence and no unresolved release blockers. Independent test: trace a requirement through correction and re-verification.

- [ ] T011 [US3] Track reproducible severity/requirement/fix/regression-review records in `docs/evidence/006-defects.md`; fix underlying domain/UI causes without weakening controls (FR-005, FR-006).
- [ ] T012 [US3] Rerun affected and complete gates; build requirement/task/test and reviewed AI-use mapping in `docs/evidence/006-traceability.md` (FR-003, FR-006, FR-007).
- [ ] T013 [US3] Present explicit passed/failed/unrun checks and outstanding decisions in `docs/evidence/006-release-review.md`; obtain human acceptance only if gates pass (FR-007, FR-008).

## Polish

- [ ] T014 Reconcile all affected feature specifications/contracts/tasks and regression evidence after fixes; update `AGENTS.md` current status without fabricating approvals (FR-006, FR-007, FR-008).
- [ ] T015 If real employee data is in scope for release, obtain approval of a vetted privileged MFA method and implement/test the HR account security flow in `backend/apps/accounts/` and `frontend/src/features/auth/`; verify privacy/retention policy and record evidence in `docs/evidence/006-security.md` before permitting real-data use. If release remains synthetic-only, record the unresolved MFA gate explicitly in `docs/evidence/006-release-review.md` and do not claim real-data readiness (FR-001, FR-005, FR-008).

## Dependencies and Strategy

Integrated 002-005 and early staging -> setup -> US1/US2 -> fixes/rechecks -> US3 release review. Different read-only audits may be independently performed with human coordination; this file authorizes no subagents, production traffic, destructive operations, or policy bypass. Final 007 production rollout waits on this gate.
