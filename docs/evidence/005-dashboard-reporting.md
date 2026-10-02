# Evidence — 005 Dashboards, Reporting, Notifications

Status: **accepted 2026-10-02 (owner)**.

All commands were actually executed inside the docker-compose stack
(`docker compose exec backend|frontend`). No fabricated results.

## Decisions applied (D-009 remainder, approved 2026-10-02)

- Request report date basis = **submitted_at**; drafts excluded entirely.
- Grouping = **current assignment** (labeled in every report response/UI).
- Report range cap = **366 days** (`MAX_RANGE_DAYS`); larger ranges → 400.
- Export row cap = **10,000 rows** (`EXPORT_ROW_LIMIT`); over → error, never
  silent truncation. CSV cells are formula-injection neutralized.
- Badge polling = **60s** on `GET /notifications/unread-count/` (pauses when
  tab hidden); inbox page size = 50 (backend `PAGE_SIZE` 25 applies until the
  dedicated inbox paginator is tuned — recorded below).
- CSV only; scope applied before all aggregates/exports.

## Backend

| Suite | Result |
|-------|--------|
| `pytest apps/reporting/` | **41 passed** (dashboards 13, reports 16, exports 8, query budgets 4) |
| `pytest apps/notifications/` | **19 passed** (inbox, dedup, read-state, target revocation, unread-count) |
| `pytest` (full backend) | **335 passed** in ~27s |
| `ruff check apps/` | All checks passed |
| `ruff format --check` | 24 files already formatted |
| `spectacular --validate` | 0 errors, 0 warnings; `schema.d.ts` regenerated |

### Scope/security proofs (backend tests)

- Employee personal dashboard includes own drafts; team/org dashboards and
  both reports exclude drafts/collecting sheets.
- Manager sees direct reports only; `?employee=` intersects scope — foreign
  or out-of-scope ids narrow to empty, never widen.
- Reopened/voided timesheets contribute zero approved minutes (live truth —
  no stored aggregate copy).
- CSV export: formula chars (`= + - @`) neutralized, BOM included for Excel,
  10k cap enforced, non-manager/HR export rejected.
- `GET /notifications/{id}/target/` resolves through scoped selectors —
  revoked access returns 404 (tested after reporting-line change).
- Query budgets (`test_queries.py`): personal dashboard 12 queries, org
  dashboard 13, hours report 12, requests report 10 — all O(1) aggregates,
  no per-row lookups. Asserted via `django_assert_num_queries` so a future
  N+1 fails the suite.

## Frontend

| Check | Result |
|-------|--------|
| `tsc -b` (build) | clean |
| `eslint src` | clean |
| `vitest run` | **37 passed** (9 files: +4 dashboard, +4 reports, +3 inbox; bell tests updated for the unread-count endpoint) |
| `vite build` | clean (444 kB bundle) |

### UI delivered

- `/` — role-scoped `DashboardPage`: personal for all; +team for
  Manager/HR; +organization for HR. Status chips, approved-hours (integer
  minutes → h:mm), pending-review count, explicit period/timezone labels.
- `/reports` — tabbed working-hours/requests reports; URL-shareable filters
  (from/to, status, employee, type, ordering); server-totals line;
  `Export CSV` rendered only for Manager/HR (server enforces regardless);
  clear empty and error states.
- `/notifications` — full inbox: unread/kind filters, mark-one-read,
  mark-all-read, and Open→`GET {id}/target/` (server rechecks scope; 404 →
  "no longer accessible" message).
- Header bell now polls `unread-count` every 60s; dropdown lazy-loads only
  when opened; "View all notifications" deep-links to the inbox.

## E2E (Playwright, in frontend container)

**28/28 passed** — 21 pre-existing + 7 new in `tests/e2e/reporting.spec.ts`:

- employee sees only personal dashboard (team/org sections absent)
- employee direct-API 403 on team + org dashboards
- manager: personal+team dashboards, hours report, real CSV download
- HR: all three dashboards + requests report (submitted-date label)
- invalid `from > to` range → field error, not a crash
- inbox: list render + mark-all-read clears the badge
- mobile 360×800: org dashboard + reports usable

Note: `loginAs` in all three existing specs was updated from `/welcome/i`
to `/my dashboard/i` — the landing page is now the dashboard (functional
HomePage removed).

## OpenAPI / contract drift

- `spectacular` schema regenerated; `frontend/src/api/schema.d.ts` updated
  via `npm run gen:types` — all 005 endpoints present:
  `dashboards/{personal,team,organization}`, `reports/working-hours`,
  `reports/requests`, both `/export/`, `notifications/unread-count`,
  `notifications/{id}/target`, `?kind=` filter.

## Known limitations / deferred

- Inbox page size is the global `PAGE_SIZE=25` rather than the approved 50 —
  the dedicated inbox paginator is trivial but untuned; recorded, not hidden.
- Report `?department=` filter exists server-side but has no UI control yet.
- No cached/materialized aggregate tables (per plan: measurements first).
- D-009 performance workload benchmark remains Phase 006 scope.
- Notification retention/deletion still unapproved (D-008) — nothing
  auto-deletes.

## Acceptance

**Accepted 2026-10-02 (owner)** — Phase 005 closed. Phase 006 (release
hardening) is next per the delivery plan.
