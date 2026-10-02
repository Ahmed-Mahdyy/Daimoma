# Evidence 006 — Release review (synthetic-only)

Date: 2026-10-02. Scope: release-readiness of the verified build.
**This review does not authorize production deployment or real employee data.**

## Gate results

| Gate | Status | Evidence |
|------|--------|----------|
| Backend tests | **PASS** — 372/372 | `pytest` full suite |
| Lint/format | **PASS** | ruff check + format clean |
| OpenAPI contract | **PASS** — 0 errors, 0 warnings | `spectacular --validate`; `schema.d.ts` regenerated |
| Frontend | **PASS** | tsc build, eslint, 37 Vitest, vite build |
| E2E journeys | **PASS** — 38/38 | auth, requests, timesheets, reporting, resilience, accessibility |
| Security matrix | **PASS** — 31 negative tests | `test_security_matrix.py` |
| Concurrency | **PASS** — 10 real multi-connection races | `test_concurrency.py` ×2 |
| Migration integrity | **PASS** — populated 0001→head | `test_migrations.py` |
| Dependency audit | **PASS w/ residuals** | Django 5.2.17/DRF 3.17.2 patched; npm 0 vulns; pip build-tool advisories noted in `006-security.md` |
| Performance budgets | **PASS** | all p95 under approved budgets at 25-concurrency / ~311k rows (`006-performance.md`) |
| Accessibility | **PASS** — 7/7 incl. WCAG 2.2 AA axe scans | `006-accessibility.md` |
| Defects | **4 found, all fixed with regression guards** | `006-defects.md` |

## Unresolved decisions — DO NOT claim these

- **T015 / D-008 gate: privileged MFA is NOT implemented.** This release is
  **synthetic-data only**. Loading real employee data requires an approved,
  implemented, tested MFA flow for privileged accounts plus privacy/retention
  approval — none of that exists yet.
- D-007: staging server, mail transport, production deployment unapproved.
- D-001: final logo/palette still provisional (D-010).

## Explicitly unrun checks

- Production-environment performance re-measurement (no staging server).
- Screen-reader manual session (automated axe only).
- Backup/restore rehearsal (Phase 007 scope).
- Dedicated write-path load scenario (concurrency tests cover correctness;
  latency measured via read mix — recorded limit).

## Defects resolved this phase

D6-01 vulnerable deps (HIGH) · D6-02 timesheet-list N+1 13.3s→0.2s (HIGH) ·
D6-03 dead-session stale UI (MED) · D6-04 360px nav overflow (MED).
No unresolved critical/high findings remain in measured scope.

## Recommendation

Meets the **synthetic-only release-review** bar: all executed gates pass, all
defects regression-guarded, all unrun checks and open gates named above.
Owner acceptance still required before closing Phase 006; Phase 007
deployment remains gated on D-007 hosting approval.

## Subsequent UX redesign re-verification (2026-10-02)

The owner requested a modern shadcn/ui redesign and HR workflow discoverability
while this phase is pending acceptance. Rechecked after changes: **373/373
backend**, **39/39 Vitest**, **48/48 Playwright** (including light/dark axe
scans on login, dashboard, reports, departments and request/timesheet lists,
calendar-to-request dates, HR department create/rename, breadcrumbs,
HR-only settings, account menu and mobile nav),
frontend build and lint, backend Ruff, `npm audit` (0 vulnerabilities).
Synthetic `seed_e2e` created example timesheets for Employee/Manager/HR and
five request types without overwriting existing demo accounts; a double-run
idempotence test passed. The after-change 25-concurrent load scenario passed
all read budgets (0/600 errors); updated initial JS **180.92 KB gz** under the
500 KB gate, with dashboard calendar lazy-loaded (~23.64 KB gz).

These checks do not imply owner acceptance, a staging deployment, real-data
readiness, or manual screen-reader validation.

## Post-006 feature enhancements re-verification (2026-10-02)

Owner-requested additions while Phase 006 acceptance is pending:

- `early_leave` request category (D-006 amended): same-day date + from/to
  `start_time`/`end_time` fields; backend validation requires times and
  rejects `end_date`; seeded demo type "Early leave".
- Quick check-in/out: separate `OpenCheckIn` model (migration
  `0004_opencheckin`), `GET/POST/DELETE /api/v1/timesheets/punch/` +
  `POST .../punch/checkout/`; check-out writes real entries through
  `create_entries` so overlap/midnight-split/lock/window rules apply;
  sub-minute check-outs are rejected with a friendly error and the punch
  stays open; one open punch per employee enforced under `select_for_update`.
- HR department record view `/departments/:id` — details + server-paginated
  current members via the existing `employees?department=` filter.
- Settings submenu (HR): Request types and Audit nested under Settings;
  managers keep a top-level Audit link; Employees nav hidden from plain
  employees (route stays self-scoped server-side).
- Dark-mode readability pass + axe scan on the timesheet detail page;
  clickable logo, avatar hover/pointer, D-shaped dashboard hero mark.

Follow-up polish on the same batch: future-week sheet guard (server rejects
`period_start` beyond the current org week + picker `max`), topbar punch
widget with live elapsed timer, clickable dashboard status chips/stat tiles
linking to filtered lists, notification bell restyled on theme tokens
(dark-mode panel + outlined trigger), and a shared `FilterBar` redesign of
all list filters. Rechecked after all changes: **412/412 backend pytest**
(incl. 10 punch tests + early-leave validation + future-week guard),
**39/39 Vitest**, **58/58 Playwright** (9 enhancement tests + 13
accessibility incl. dark timesheet detail axe scan), frontend lint/build
clean (initial JS **184.57 KB gz**, under 500 KB gate), backend Ruff clean,
`npm audit` 0 vulnerabilities, OpenAPI schema regenerated with 0 warnings.

Latest batch (same pending-acceptance window): departments list replaced
by a shared `DataTable` on `@tanstack/react-table` with column sorting;
departments, add-employee, settings and employee-detail pages widened to
full workspace width; employee profile photos served via a scoped,
non-enumerating `GET /employees/{id}/photo/` endpoint (7 new tests);
profile page deduplicated into one hero card; punch cancel now requires a
confirm dialog on both the navbar widget and timesheet controls; the e2e
seed tolerates colliding workdays on already-used dev databases. Final
rerun: **422/422 backend pytest** (7 scoped-photo tests),
**43/43 Vitest** (new departments-sort + punch-confirm suites),
**59/59 Playwright** (13 accessibility incl. the dark departments table
scan), Ruff/ESLint/tsc/build clean, initial JS **201 KB gz** (under gate).

Record-table standardization round: every record list now renders through
the shared `DataTable` — paginated lists (employees, requests, timesheets,
audit, both report tables) drive server-side ordering through an
ordering↔sorting-state mapping (`lib/table-sorting.ts`), while
departments, request types and department members sort client-side.
Backend ordering allowlists extended (employees: department/is_active;
requests: type/employee; timesheets: employee; audit: `ordering` param —
unknown fields still 400). Photo endpoints switched to
`OpenApiTypes.BINARY` schema responses, clearing the last two drf-spectacular
warnings; `schema.yml` and `schema.d.ts` regenerated warning-free. Final
rerun: **427/427 backend pytest**, **43/43 Vitest**, **59/59 Playwright**
(13 accessibility scans), Ruff/ESLint/tsc/build clean, initial JS
**201.47 KB gz** (under gate).

Dialog/pagination follow-up: `ConfirmDialog` now portals to
`document.body` — the blurred topbar's `backdrop-filter` was trapping the
modal inside the header — and is restyled dark-aware with a danger icon.
`DataTable` gained client-side pagination (10/page); departments and
request types use it with a newest-first `created_at` default sort so
freshly added rows surface on page 1 (`DepartmentSerializer` now exposes
`created_at`; request-type lists fetch `page_size=100` so all rows load).
Report tab switches clear incompatible `status`/`type`/`ordering`/`page`
params — the source of the reported masked "Validation failed." — and
`AsyncState` now surfaces real API field errors. Timesheet entry Edit/Void
are styled buttons instead of underlined links. Rerun: **427/427 backend
pytest**, **44/44 Vitest**, **59/59 Playwright** (one resilience flake
passed on isolated re-run).

Language/logo/punch follow-up: a lightweight dependency-free EN/AR i18n
provider (`lib/i18n.ts` dictionaries + `LanguageProvider`) backs the D-002
bilingual requirement — a Languages toggle in the topbar and on the login
card persists the choice to localStorage and sets `<html lang>`/`dir`, so
Arabic renders the shell RTL (the workspace CSS already uses logical
properties). Shell navigation, breadcrumbs, account menu, login copy and
the punch widget are translated. The sidebar/login/favicon mark moved from
`logo-icon.png` to a new D-shaped `logo-icon.svg` matching the dashed-ring
+ gold-check brand. The timesheets list no longer carries a duplicate
punch panel (the topbar widget remains), and the profile photo is managed
solely through the camera badge on the avatar. `RequestTypeSerializer`
exposes `created_at` to match the table's Created column. Rerun:
**427/427 backend pytest**, **45/45 Vitest**, **60/60 Playwright**
(including a new RTL/persistence e2e; the keyboard-login spec's tab order
now asserts the language toggle), Ruff/ESLint/tsc/build clean.

These checks do not imply owner acceptance, a staging deployment, real-data
readiness, or manual screen-reader validation.
