# Phase 004 evidence — timesheets and review

Date: 2026-10-02. Scope: `specs/004-timesheets/`, backend
`apps/timesheets/` + `Organization` work-window fields, frontend
`src/features/timesheets/`, e2e `tests/e2e/timesheets.spec.ts`. All
figures are real recorded results.

## Policy decisions applied

D-005 approved 2026-10-02 (owner):

- Employees submit each day independently; the weekly sheet is the review
  unit; always two-stage review (manager → HR).
- Whole-week return unlocks; HR-only reopening with a recorded reason.
- HR-configured working window (earliest start, latest end, max daily
  minutes); out-of-window entries are flagged and require a reason.
- D-004 carries over: an HR fallback completing the manager stage
  finalizes the sheet (no forced second HR stage); manager changes
  atomically reassign pending manager-stage sheets.

## Backend test results

`docker compose exec backend pytest -q` — **286 passed** (83 timesheet
tests + 203 existing, ~16s).

Timesheet coverage:

- `test_time_rules.py` (20) — reference interval examples written before
  domain logic: elapsed minutes, break bounds, overnight split at local
  midnight, DST nonexistent/ambiguous handling, week boundaries, window
  flags.
- `test_entries.py` (20) — create/update/void, parent-version checks,
  same-day and cross-day overlap rejection, future-end rejection, date
  outside period, out-of-window reason enforcement, daily-max flag, day
  submission locks, foreign-sheet 404, manager cannot edit.
- `test_workflow.py` (17) — weekly submit routing (manager first, HR
  fallback, blocked when no eligible reviewer), no-submitted-days and
  draft-with-entries guards, child mutations locked after submit,
  two-stage approve, wrong-stage rejection, self-review prevention,
  return/resubmit new cycle, terminal reject, stale-version 409,
  double-decision conflict.
- `test_reassignment.py` (4) — reporting-line change atomically reassigns
  pending manager-stage sheets, `reviewer_reassigned` event recorded,
  completed stages preserved, blocked when no eligible reviewer.
- `test_reopen.py` (8) — HR-only reopen, reason required, history
  preserved, reopened sheets excluded from current approved totals.
- `test_queries.py` (8) — scoped lists (employee=self, manager=non-draft
  reports, HR=org non-draft), history scope, query budgets.
- `test_concurrency.py` (6) — true multi-connection races via threads +
  `transaction=True` (not rolled-back assertions): overlapping creates →
  single winner; stale-version concurrent edits → single winner; duplicate
  day/week submits → single outcome; concurrent approve-vs-return →
  single decision event; duplicate period creation → same sheet via
  unique constraint.

## Query budgets (T017)

`django_assert_max_num_queries` bounds on
`test_queries.py::TestQueryBudget` — all passed:

- `GET /api/v1/timesheets/` with 6 submitted sheets: ≤ 15 queries.
- `GET /api/v1/timesheets/{id}/`: ≤ 15.
- `GET /api/v1/timesheets/{id}/history/`: ≤ 15.

## API contract

- `python manage.py spectacular --validate` — **0 errors, 0 warnings**.
  Fixed during implementation: `SerializerMethodField` annotations and a
  `view.action = None` attribute collision that broke schema generation.
- `schema.d.ts` regenerated via `openapi-typescript` — includes
  `TimeEntry`, `TimeEntryWrite`, `Timesheet`, `TimesheetCreate`,
  `TimesheetEvent`, `TimesheetStatusEnum`, `WorkDay`, `WorkDayStatusEnum`.
  Frontend `api/timesheets.ts` consumes generated-shaped types.

## Frontend verification

- `tsc -b` (build-mode): clean.
- `eslint .`: clean.
- `vitest run`: **26 tests passed** — includes timesheet list/detail,
  entry dialog validation, reviewer-only action visibility (matched by
  reviewer email — `current_reviewer` is a user id while `/me/` exposes
  the profile id), week submission, reopen/history display.
- `vite build`: clean.

## Browser evidence (T018)

`tests/e2e/timesheets.spec.ts` — **8/8 passed** in headless Chromium
against the real API (seeded synthetic users only):

1. Employee opens an arbitrary past week, adds an entry, submits the day,
   submits the week → pending manager.
2. Employee cannot self-review (no decision buttons).
3. Manager approves → pending HR.
4. HR final-approves → approved.
5. HR reopens with a required reason → returned; reason visible in
   history.
6. Employee can edit the reopened (returned) week.
7. Mobile: page usable at 360px viewport.
8. Unknown sheet id exposes nothing.

Full suite including earlier specs: **21/21 passed** (7 auth-rbac +
6 requests + 8 timesheets).

## Bugs found during verification

- **`select_for_update` outside transactions** — read paths fetched the
  locked row for response payloads without `transaction.atomic()`;
  pytest's per-test transaction wrapper masked it and it 500'd in the
  running app. Fixed by fetching unlocked for responses. Real-app e2e
  caught what unit tests could not.
- **Lagging mutation callback closed the week-submit dialog** — a shared
  `onSuccess` cleared all dialog state; a late day-submit success wiped
  the freshly-opened week confirmation. Each mutation now closes only
  its own dialog.
- **Reassignment direction** — `reassign_pending_sheets` initially
  filtered sheets owned by the employee's reports instead of the employee
  whose manager changed; caught by the reassignment test.
- **HR fallback finalize** — an HR fallback approving at the manager
  stage tried to create a second HR stage to nobody; refactored
  `_eligible_hr(exclude=)` so the fallback decision finalizes (D-004).
- **Returned days could not resubmit** — `submit_day` only allowed
  DRAFT; extended to RETURNED.

## Race/concurrency controls (verified, not invented)

- Lock order everywhere: employee profile → sheet → day/entry rows.
- `select_for_update(of=("self",))` — the nullable-join `FOR UPDATE`
  limitation fixed during Phase 003 applies here too.
- Expected-version checks on every mutation; stale clients get 409.
- Overlap checks span all of the employee's active intervals; the
  profile lock serializes concurrent creates so a loser sees the
  committed winner (proven by `test_concurrency.py` on real connections).
- `Timesheet` unique (employee, period_start) — duplicate period races
  resolve to one row.

## Deferred / open

- Reporting/dashboard consumption of approved totals: Phase 005.
- Performance workload benchmark on a D-009-scale dataset: Phase 006.
- Duration-only input mode: deferred (start/end satisfies the brief).
- Week-boundary overnight entry (Sunday→Monday across sheets): rejected
  by design — a segment must land inside the sheet's period; employees
  split such shifts across two weeks manually. Recorded as a known edge.
- Owner acceptance pending.
