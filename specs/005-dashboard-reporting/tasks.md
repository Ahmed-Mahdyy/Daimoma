# Tasks: Dashboards, Reporting, Notifications

**Status**: Not implemented. Tests mandatory; IDs local to 005.

## Setup and Foundational

- [x] T001 Approve visibility, date/grouping, export and polling budgets in `AGENTS.md` and `contracts/api.md`; review all quality gates (FR-001, FR-003, FR-004). **Resolved 2026-10-02: D-009 reporting limits approved — submitted-date basis, drafts excluded, current-team grouping, 366-day range, 10k-row CSV exports, 60s badge polling, 50/page inbox.**
- [x] T002 Define exact expected metrics for synthetic status/team/date fixtures in `backend/apps/reporting/tests/conftest.py` before query implementation (FR-002, FR-008).

## US1 - Relevant dashboards

Goal: exact scoped summaries. Independent test: known totals across roles/statuses and reopening.

- [x] T003 [US1] Write failing scope/count/reopened/voided/concurrent-summary tests in `backend/apps/reporting/tests/test_dashboards.py` (FR-001, FR-002, FR-008).
- [x] T004 [US1] Implement scoped aggregate selectors and summary serializers/views in `backend/apps/reporting/` using integer-minute totals and current state (FR-001, FR-002).
- [x] T005 [US1] Build tested personal/team/HR dashboards in `frontend/src/features/dashboards/` with explicit labels, accessible summaries, and non-fabricated empty/error states (FR-001, FR-007).

## US2 - Reports and exports

Goal: filtered reports match safe exports. Independent test: date/role reconciliation and export attack/limit cases.

- [x] T006 [US2] Write failing date/timezone/grouping/filter/order/page/cross-team tests in `backend/apps/reporting/tests/test_reports.py` (FR-002, FR-003, FR-008).
- [x] T007 [US2] Implement bounded scoped request/hour reports in `backend/apps/reporting/selectors.py` and `views.py`; apply local work_date filtering to approved active entries (FR-002, FR-003).
- [x] T008 [US2] Write CSV formula/oversize/unauthorized-export tests and implement safe bounded exports in `backend/apps/reporting/exports.py` (FR-004, FR-008).
- [x] T009 [US2] Build tested responsive report/filter/export UI in `frontend/src/features/reports/` with URL filters, safe error recovery, and current-team grouping labels (FR-003, FR-004, FR-007).

## US3 - Durable notifications and freshness

Goal: safe notification history and no stale identity/scope data. Independent test: reload, mark read twice, revoke target access, then change account.

- [x] T010 [US3] Write recipient/dedup/read-count/target-revocation tests in `backend/apps/notifications/tests/test_inbox.py` (FR-005, FR-008).
- [x] T011 [US3] Implement paginated inbox/unread-count/idempotent-read endpoints in `backend/apps/notifications/views.py` and `selectors.py` (FR-005).
- [x] T012 [US3] Build tested inbox/badge/navigation in `frontend/src/features/notifications/` and shared invalidation/account-change handling in `frontend/src/api/` (FR-005, FR-006, FR-007).

## Polish and Acceptance

- [x] T013 Add OpenAPI/type drift and bounded-query tests in `backend/apps/reporting/tests/`; profile before adding indexes/caches (FR-003, FR-008).
- [x] T014 Add cross-role dashboard/report/inbox browser journeys in `tests/e2e/reporting.spec.ts` including filter errors, reopening, logout, and network failure (FR-001, FR-002, FR-005, FR-006, FR-007, FR-008).
- [ ] T015 Record actual reconciliation/export/query/viewport evidence in `docs/evidence/005-reporting.md`; reconcile contracts and obtain review (FR-002, FR-004, FR-008).

## Dependencies and Strategy

Verified 002-004 -> T001-T002 -> US1 -> US2 -> US3 -> acceptance. Notification UI and report UI can be drafted independently after contracts, without authorizing parallel agents or shared-file races. Do not add cached aggregate tables before measurements justify them.
