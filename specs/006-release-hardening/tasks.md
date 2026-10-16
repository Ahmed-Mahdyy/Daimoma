# Tasks: Release Hardening

**Status**: All tasks executed 2026-10-02 with evidence; **owner acceptance recorded 2026-10-16** (owner verified the live deployment and post-006 enhancement batch on the public URL). Tests/evidence mandatory; IDs local to 006.

## Setup and Foundational

- [x] T001 Approve test matrix, D-008/D-009 workload, severity gates, and environment in `AGENTS.md` and `contracts/quality-gates.md` (FR-001, FR-003, FR-004, FR-008). **Resolved 2026-10-02: workload/budget/environment approved — 500 emp / 52 wks / 25 concurrent; p95 reads <300ms, writes <500ms, reports <1s, export <10s, errors <0.1%; bundle <500KB gz; dev-stack measurement.**
- [x] T002 Inventory actual automated/manual coverage and missing cases in `docs/evidence/006-coverage.md`; do not treat scaffold checkboxes as test results (FR-003, FR-007). **Done 2026-10-02: original inventory 335 backend / 37 Vitest / 28 e2e; post-redesign rerun 373 backend / 39 Vitest / 48 e2e; post-enhancement rerun 388 backend / 39 Vitest / 54 e2e; final rerun 412 backend / 39 Vitest / 58 e2e; latest rerun 422 backend / 43 Vitest / 59 e2e; table-standardization rerun 427 backend / 43 Vitest / 59 e2e; dialog/pagination follow-up 427 backend / 44 Vitest / 59 e2e (one resilience flake, passes isolated); gaps mapped to T003-T015.**

## US1 - Security and integrity

Goal: reproducible server/data assurances. Independent test: full negative matrix, concurrency and upgrade suite.

- [x] T003 [US1] Add missing failing permission/CSRF/session/field-injection/file/export/inbox cases in `backend/tests/test_security_matrix.py` before fixes (FR-001, FR-005).
- [x] T004 [US1] Extend domain concurrency/locking/time/reassignment tests in `backend/apps/employee_requests/tests/` and `backend/apps/timesheets/tests/` using separate PostgreSQL connections (FR-002).
- [x] T005 [US1] Add fresh and populated upgrade/invariant checks in `backend/tests/test_migrations.py`; inspect migration lock/data impacts (FR-002).
- [x] T006 [US1] Run dependency/secret/configuration/privacy review through approved CI checks and record redacted findings in `docs/evidence/006-security.md` (FR-005).

## US2 - Usability and performance

Goal: reliable real-device-size journeys and measured limits. Independent test: real-API role flows plus approved workload.

- [x] T007 [US2] Extend real-API network/session/empty/error/correction journeys in `tests/e2e/` and frontend component tests without bypassing auth (FR-003). **Done 2026-10-02: `resilience.spec.ts` 3/3 — API failure, empty state, expired-session redirect; found+fixed dead-session SPA defect (auth 403 event clears cached `me`).**
- [x] T008 [US2] Perform keyboard/focus/contrast/zoom/reduced-motion and 360/768/1440 review; record actual browser findings in `docs/evidence/006-accessibility.md` (FR-003). **Done 2026-10-02: `accessibility.spec.ts` originally 7/7, now 12/12 with light/dark axe on login/dashboard/reports/departments/request+timesheet lists — WCAG2/22 AA, dark-mode contrast defects found+fixed, keyboard-only login, focus-visible, 360/768/1440 reflow, 200% zoom, reduced-motion; found+fixed 360px nav overflow.**
- [x] T009 [US2] Implement approved reproducible load scenarios and synthetic dataset generation under `tests/performance/` with nonproduction execution guards (FR-004). **Done 2026-10-02: `load_scenario.mjs` (25 concurrent sessions, warmup, p95 budgets) + `seed_perf` command (--confirm + DEBUG guard, dedicated synthetic org).**
- [x] T010 [US2] Measure API/query/browser/bundle budgets and profile bottlenecks; record hardware/method/results in `docs/evidence/006-performance.md` (FR-004). **Done 2026-10-02: all budgets pass under gunicorn 4w; found+fixed timesheet-list N+1 (p95 13,269→201ms); initial bundle 133KB gz, post-redesign 180.9KB gz vs 500KB budget; budgets rechecked.**

## US3 - Defects and release decision

Goal: truthful complete evidence and no unresolved release blockers. Independent test: trace a requirement through correction and re-verification.

- [x] T011 [US3] Track reproducible severity/requirement/fix/regression-review records in `docs/evidence/006-defects.md`; fix underlying domain/UI causes without weakening controls (FR-005, FR-006). **Done 2026-10-02: 4 defects — dep CVEs, timesheet-list N+1 (13.3s→0.2s), dead-session stale UI, 360px overflow — all fixed + regression-guarded.**
- [x] T012 [US3] Rerun affected and complete gates; build requirement/task/test and reviewed AI-use mapping in `docs/evidence/006-traceability.md` (FR-003, FR-006, FR-007). **Done 2026-10-02: original full re-run 372 pytest / 37 Vitest / 38 e2e; post-redesign 373 / 39 / 48; post-enhancement 388 / 39 / 54 (13 accessibility); original and post-redesign load budgets passed; updated initial JS 183.0 KB gz; FR→task→test map written.**
- [x] T013 [US3] Present explicit passed/failed/unrun checks and outstanding decisions in `docs/evidence/006-release-review.md`; obtain human acceptance only if gates pass (FR-007, FR-008). **Done 2026-10-02: review written with synthetic-only label, unrun checks, unresolved gates; owner acceptance pending.**

## Polish

- [x] T014 Reconcile all affected feature specifications/contracts/tasks and regression evidence after fixes; update `AGENTS.md` current status without fabricating approvals (FR-006, FR-007, FR-008). **Done 2026-10-02: tasks/evidence/AGENTS.md reconciled; no approval fabricated — owner acceptance still pending.**
- [x] T015 If real employee data is in scope for release, obtain approval of a vetted privileged MFA method and implement/test the HR account security flow in `backend/apps/accounts/` and `frontend/src/features/auth/`; verify privacy/retention policy and record evidence in `docs/evidence/006-security.md` before permitting real-data use. If release remains synthetic-only, record the unresolved MFA gate explicitly in `docs/evidence/006-release-review.md` and do not claim real-data readiness (FR-001, FR-005, FR-008). **Done 2026-10-02 via synthetic-only path: MFA gate recorded as unresolved in 006-release-review.md; real-data readiness explicitly not claimed.**

## Dependencies and Strategy

Integrated 002-005 and early staging -> setup -> US1/US2 -> fixes/rechecks -> US3 release review. Different read-only audits may be independently performed with human coordination; this file authorizes no subagents, production traffic, destructive operations, or policy bypass. Final 007 production rollout waits on this gate.
