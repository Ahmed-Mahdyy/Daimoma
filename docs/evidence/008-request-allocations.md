# Evidence: Request Allocations (Feature 008)

Measured 2026-10-05 on the docker-compose dev stack (`python:3.12` backend
image, Node frontend image, PostgreSQL container) — development-hardware
measurement, not a production SLA. All data synthetic.

**Amendment 2026-10-06 (owner-directed redesign):** the fixed `category`
model and its automatic calculations (weekday counting, early-leave billing
formula, equipment submission-date inference) were replaced by a visible
per-type `unit` (`none`/`unit`/`hour`); employees enter the charged amount
directly; `code` is auto-generated and hidden; grant creation moved to a
dedicated `/settings/allocations/new` page; `working_weekdays` no longer
consumed (retained non-destructively). All checks below were **re-run
2026-10-06 against the unit model**; results shown are the amended-model
results. The D-009 workload re-measurement was not re-executed (allocation
read-path query shape is unchanged — same dashboards and grants, different
amount source).

## Automated checks actually run (unit model, 2026-10-06)

| Check | Command / location | Result |
|---|---|---|
| Backend tests (full) | `pytest` | **458 passed** |
| Allocation unit/integration tests | `backend/apps/employee_requests/tests/test_allocations.py` | passed (rewritten for the unit model: quantity/hours entry, unit lock after use, hour adjustments) |
| Concurrency / no-over-allocate | `backend/apps/employee_requests/tests/test_concurrency.py` | passed |
| Dashboard privacy + bounded queries | `backend/apps/reporting/tests/test_dashboards.py`, `test_queries.py` | passed; populated personal dashboard capped at 15 queries incl. allocation cards; 5-grant case does not grow per grant |
| Populated-DB migration baseline | `backend/tests/test_migrations.py` | passed: migration 0005 remaps categories → units (allocated date types → `unit`, early leave → `hour`, unallocated → `none`); existing grants/commitments remapped, no retroactive commitments |
| Security scope matrix | `backend/tests/test_security_matrix.py` | passed |
| Migration drift | `makemigrations --check` | clean, no drift |
| Ruff | `ruff check` | clean |
| OpenAPI | `backend/schema.yml` regenerated via drf-spectacular | regenerated with `unit`/`hours` contract; `frontend/src/api/schema.d.ts` regenerated |
| TypeScript | `tsc --noEmit` (strict) | clean |
| ESLint | `npm run lint` | clean |
| Vitest | `vitest run` | **45 passed** (11 files) |
| Production build | `vite build` | passed; initial JS ≈ **222 KB gzipped** (~721 KB raw, advisory >500 KB warning only) |
| Playwright + axe e2e | `npx playwright test` | **68 passed** incl. allocation scenarios and axe WCAG2 AA scans; one contrast test updated to a non-allocating type |
| `git diff --check` | — | pass |

## D-009 workload re-measurement (post-feature, 2026-10-05 category model)

Synthetic PerfCorp dataset from Phase 006 still in place (500 employees, ~5k
requests, ~127k work days/entries, ~20k notifications). Same harness:
`tests/performance/load_scenario.mjs`, gunicorn 4 workers on :8001,
25 concurrent sessions, 4 measured rounds after warmup.

| Endpoint | Budget p95 | p50 | p95 | max | n | Result |
|---|---|---|---|---|---|---|
| GET /api/v1/me/ | 300ms | 84 | 132 | 162 | 100 | PASS |
| GET /api/v1/timesheets/ | 300ms | 149 | 188 | 232 | 100 | PASS |
| GET /api/v1/dashboards/personal/ | 300ms | 152 | 174 | 186 | 100 | PASS — includes allocation-card queries |
| GET /api/v1/reports/working-hours/ | 1000ms | 146 | 166 | 177 | 100 | PASS |
| GET /api/v1/reports/requests/ | 1000ms | 134 | 158 | 162 | 100 | PASS |
| GET /api/v1/notifications/ | 300ms | 101 | 122 | 179 | 100 | PASS |

Errors: 0/600. The allocation additions did not breach any approved read
budget. Write-path load remains indirectly covered (known limit carried
forward from 006-performance.md). Not re-executed on 2026-10-06: the unit
redesign changed only the amount source (entered vs calculated), not
dashboard grant queries or list pagination.

## E2E journeys verified (tests/e2e/allocations.spec.ts, serial; unit model)

1. HR creates a `unit`-measured request type and a dated grant on the
   dedicated `/settings/allocations/new` page; list, filters and table render.
2. Employee enters `quantity`, sees the server-backed preview (unit,
   required vs remaining) and submits — capacity reserved exactly once.
3. HR sees the reservation; remove-from-active-use is blocked while reserved.
4. Arabic RTL rendering of the allocations page; axe scans pass after
   contrast fixes (2026-10-05 muted-text fix; 2026-10-06 dark-mode badge
   overrides for `bg-gray-200`/blue badge classes).

## Verified behavior mapped to locked policies (unit model)

- No overlapping active grants per employee/type (adjacent allowed) — tested.
- Grant coverage by stated dates or org-local submission date — tested.
- Grant date edits blocked only when reserved/used falls outside new period;
  released history does not block — tested.
- `unit` type charges entered `quantity`; `hour` type charges entered
  `hours` (quarter-hour steps enforced) as whole minutes — tested.
- `none` types carry no allocation and reject amount fields — tested.
- One grant per request, no splitting — tested.
- Reserve at submit → used on final approval → released on return/rejection;
  manager stage leaves reservation unchanged — tested.
- Void (soft removal) only with no reserved/used; history retained — tested.
- Expired grant with pending reservation stays reserved and labeled — tested.
- Employee sees own balances; manager cannot read report balances;
  cross-org 404 non-enumerating — tested.
- Dashboard personal cards bounded queries; team/org responses carry no
  individual allocation values — tested.

## Deviations and notes

- Dashboard query-count budget raised 12 → 15 to include allocation cards;
  a dedicated boundedness test guards against per-grant growth.
- Allocations e2e is its own spec file (`tests/e2e/allocations.spec.ts`) —
  idempotent and re-runnable against existing seed data.
- Build emits a >500 KB uncompressed-chunk advisory; gzipped size is within
  the 500 KB gzipped budget.
- Owner redesign 2026-10-06: `category` → visible `unit`; `code` removed
  from all user-facing UI (auto-generated server-side, retained for DB
  uniqueness/audit); Add Allocation moved to its own page; dark-mode badge
  contrast fixed (`bg-gray-200` and `bg-blue-100`/`text-blue-800` lacked
  `.dark` overrides — the reported white-pill bug).
- `Organization.working_weekdays` retained in DB/API but no longer consumed
  by allocation logic; its org-settings UI control was removed as dead
  configuration.
- The RequestTypes list links to a dedicated edit page (owner request);
  shared request-type constants live in `requestTypeUnits.ts`.

## Not done / out of scope

- No production deployment, no real employee data, no destructive reset.
- Gunicorn helper process on :8001 started inside the dev container for
  measurement only.
- Reviewer sign-off on this evidence remains the owner's decision.
