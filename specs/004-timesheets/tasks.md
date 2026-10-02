# Tasks: Timesheets

**Status**: Implemented and verified — pending owner acceptance (T019). Mandatory tests; IDs are local to 004.

## Setup and Foundational

- [x] T001 Approve D-004/D-005/D-009 period/timezone/overnight-break/review policies in `AGENTS.md` and `contracts/api.md`; review quality gates (FR-001, FR-002, FR-004, FR-006). **Resolved 2026-10-02: D-005 approved — daily submission, weekly two-stage review, whole-week return, working window (earliest/latest/max daily hours) with flag+reason.**
- [x] T002 Add reference interval/DST/week-boundary examples and failing minute-calculation tests in `backend/apps/timesheets/tests/test_time_rules.py` before domain logic (FR-001, FR-002, FR-010).
- [x] T003 Create models/migrations in `backend/apps/timesheets/models.py`: Timesheet, WorkDay (unique employee/work_date, daily submit state), TimeEntry (window_flag/window_reason), TimesheetEvent; plus `Organization` work-window fields (earliest/latest/max daily minutes); unique employee/period, end>start, break>=0 and break<elapsed, integer minutes, version>=1, unique sheet/version events, immutable snapshots (FR-001, FR-002, FR-008).
- [x] T004 Implement shared employee-before-sheet locking, scoped selectors, and allowlisted serializers in `backend/apps/timesheets/services.py`, `selectors.py`, and `serializers.py` (FR-007, FR-009).

## US1 - Accurate editable time

Goal: valid owned intervals and reliable totals. Independent test: reference week, invalid breaks, overlaps, overnight/DST cases.

- [x] T005 [US1] Write failing ownership/parent/overlap/future/void/window-flag and concurrent cross-sheet tests plus daily submission lock tests in `backend/apps/timesheets/tests/test_entries.py` (FR-001, FR-002, FR-009, FR-010).
- [x] T006 [US1] Implement create/update/void with parent-version checks, explicit boundary splitting/break allocation, global active-interval overlap checks, out-of-window flag+reason enforcement, and day submission in `backend/apps/timesheets/services.py` (FR-001, FR-002, FR-003, FR-007).
- [x] T007 [US1] Implement period/entry endpoints and authoritative totals in `backend/apps/timesheets/views.py`; prevent supplied owner/org/reparent/status fields (FR-001, FR-009).
- [x] T008 [US1] Build tested week editor/time-entry form in `frontend/src/features/timesheets/` with timezone/offset context, minute totals, accessible errors, and unsaved-input protection (FR-001, FR-002, FR-010).

## US2 - Submission, review, correction

Goal: immutable submitted work with controlled return/resubmit. Independent test: every child mutation denied while submitted and competing transitions stay consistent.

- [x] T009 [US2] Write failing submit/edit/add/void/reparent/bulk-bypass/race, unsubmitted-day guard, and self-review tests in `backend/apps/timesheets/tests/test_workflow.py` (FR-003, FR-004, FR-005, FR-007, FR-010).
- [x] T010 [US2] Implement weekly submission (>=1 submitted day, no draft days with entries), content snapshot/cycle/reviewer, event and notification atomically in `backend/apps/timesheets/services.py` (FR-003, FR-008).
- [x] T011 [US2] Implement two-stage approve (manager→HR)/reject/return/resubmit with reasons/current reviewer/expected-version rules and whole-week return unlock in `backend/apps/timesheets/services.py` and action views (FR-004, FR-005, FR-007).
- [x] T012 [US2] Integrate atomic pending-review reassignment and revoked-manager checks in `backend/apps/organizations/services.py` and `backend/apps/timesheets/tests/test_reassignment.py` (FR-007, FR-009).
- [x] T013 [US2] Build review queue/detail/decision dialogs and locked/returned week states in `frontend/src/features/timesheets/`; handle 409 through refresh, not optimistic approval (FR-003, FR-004, FR-005, FR-010).

## US3 - Reopening and history

Goal: exceptional correction retains history and current reporting truth. Independent test: approved -> HR reopen -> corrected/resubmitted -> approved.

- [x] T014 [US3] Write failing HR-only/reason/self-policy/reopen-history/approved-total tests in `backend/apps/timesheets/tests/test_reopen.py` (FR-006, FR-008, FR-009, FR-010).
- [x] T015 [US3] Implement authorized reopen and scoped history projections in `backend/apps/timesheets/services.py` and `selectors.py`; preserve old snapshots and exclude reopened sheets from current approved sums (FR-006, FR-008).
- [x] T016 [US3] Build history and explicit HR reopening UI in `frontend/src/features/timesheets/` with accessible reasons and current-versus-historical approval labels (FR-006, FR-008, FR-010).

## Polish and Acceptance

- [x] T017 Expand OpenAPI/generated types in `frontend/src/api/`; add sheet/entry contract drift, pagination, query-count, and populated migration tests (FR-009, FR-010).
- [x] T018 Add real API mobile/desktop cross-role journeys in `tests/e2e/timesheets.spec.ts` including network/session errors and read-only bypass attempts (FR-003, FR-004, FR-005, FR-006, FR-010). **8/8 pass; full suite 21/21.**
- [ ] T019 Record actual accuracy/race/permission/migration outcomes in `docs/evidence/004-timesheets.md`; reconcile `spec.md`, contracts, and policy decisions before acceptance (FR-001, FR-002, FR-007, FR-008, FR-010). **Evidence recorded 2026-10-02; awaiting owner acceptance.**

## Dependencies and Strategy

Verified 002 -> T001-T004 -> US1 -> US2 -> US3 -> acceptance. No dependency on request implementation, but shared locking/notification contracts must remain compatible. Time-rule tests and reviewed UI prototypes are independent after policy approval; no automatic parallel agents. First working slice is accurate owned entry editing; release still requires full locked review and correction flows.
