# Phase 003 evidence — employee requests and approvals

Date: 2026-09-29. Scope: `specs/003-employee-requests/`, backend
`apps/employee_requests/`, frontend `src/features/requests/`, e2e
`tests/e2e/requests.spec.ts`. All figures are real recorded results.

## Policy decisions applied

D-006 approved 2026-09-29 (owner):

- 5 fixed categories: `leave`, `equipment`, `hr_service`,
  `work_from_home`, `general`.
- Attachments deferred entirely — no upload/storage/scanning built.
- No confidential mode — every type routes manager-first per D-004.

`RequestAttachment` was removed from the data model; tasks T006/T007 marked
deferred in `tasks.md`.

## Backend test results

`docker compose exec backend python -m pytest` — **200 passed** (66 request
tests + 134 Phase 002 tests, ~8s).

Request coverage:

- `test_drafts.py` (19) — category-aware validation, date ranges,
  equipment item/quantity, ownership scoping, protected-field rejection
  (`status`, `cycle`, `version`, `employee` not writable), draft/returned
  edit only, employee isolation.
- `test_submission.py` (14) — route resolution (manager → HR fallback),
  self-review prevention, no-eligible-reviewer block, inactive reviewer
  block, duplicate-submit rejection, route/content snapshots, cycle/step
  creation, notification emission.
- `test_reviews.py` (17) — approve/reject/return on both routes, required
  reasons, wrong-stage rejection, self-review guard, expected-version
  conflicts (409), terminal states, returned resubmission new cycle.
- `test_reassignment.py` (5) — manager change atomically reassigns pending
  steps (D-004 option A), completed steps preserved, old-manager access
  revoked, block when no eligible reviewer exists.
- `test_queries.py` (11) — scoped list by role (employee=self,
  manager=non-draft reports, HR=org non-draft), search/filter/order/page
  allowlists, history endpoint scope (foreign org → 404), type config
  isolation (type changes never rewrite submitted route snapshots),
  HR-only type administration.

## Query budgets (T018)

`django_assert_max_num_queries` bounds on `test_queries.py::TestQueryBudget`:

- `GET /api/v1/requests/` with 30 rows: bounded at 15 queries — passed.
- `GET /api/v1/requests/{id}/`: bounded at 15 — passed.
- `GET /api/v1/requests/{id}/history/`: bounded at 15 — passed.

## API contract

- `python manage.py spectacular --validate` — **0 errors, 0 warnings**; the
  request, request-type, history, submit and review endpoints are
  documented.
- `schema.d.ts` regenerated via `openapi-typescript` — the frontend
  `api/requests.ts` module consumes generated-shaped types.

## Frontend verification

- `npx tsc --noEmit` / `tsc -b` (build): clean.
- `eslint .`: clean (0 warnings).
- `vitest run`: **19 tests passed** — includes request list filters,
  category-adaptive form fields (dates vs item+quantity), draft creation,
  owner submit, reviewer decision buttons, required reject reason,
  approve confirmation.
- `vite build`: clean.

## Browser evidence (T019)

`tests/e2e/requests.spec.ts` — **6/6 passed** in headless Chromium against
the real API (seeded synthetic users only):

1. Employee drafts + submits leave request → pending manager, reviewer
   shown.
2. Manager returns it with a required reason → returned + reason visible.
3. Employee revises dates, resubmits → new pending cycle.
4. Manager approves → final; employee sees approved + cycle-2 history.
5. Scope: HR sees the org's non-draft request.
6. Mobile: request form usable at 360px viewport.

Full suite including Phase 002 specs: **13/13 passed** (auth-rbac 7 +
requests 6).

## Race/concurrency controls (verified by tests, not invented)

- `select_for_update(of=("self",))` on transitions — the nullable-join
  `FOR UPDATE` failure was caught and fixed during implementation.
- Expected-version checks on every mutation; stale clients get 409.
- Duplicate transition submissions reject instead of double-recording.

## Bug found during verification

- **Sign-out never redirected**: `queryClient.clear()` left the `me`
  observer holding stale data, so the UI stayed authenticated after logout.
  Found by the new e2e spec; fixed with a hard navigation to `/login`
  after the logout call (guarantees no stale client state survives).

## Deferred / open

- Attachments and any file policy: deferred per D-006; revisit if files
  are introduced later (recorded preference: manual HR accept).
- Email notifications remain console-backend only per D-007.
- T020 owner acceptance pending.
