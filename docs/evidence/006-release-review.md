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

Full-UI Arabic sweep: every feature surface now routes user-visible text
through `t()` with literal-English keys and an English fallback — page
headings, buttons, filters, status badges, all table column headers,
dialog copy, form labels/validation, notification text, loading/empty
states, login demo strip, and the breadcrumb sr-only label. Dates and
durations localize via `lib/dates.ts` (locale synced from the provider)
and the dashboard calendar uses a date-fns Arabic locale. Brand work: the
login hero's decorative ring (read as an "O") became a D-mark watermark;
the D-mark family gained `logo-icon-dark`, `logo-en(-dark)` and
`logo-ar(-dark)` lockups — the login hero/mobile header swap per language,
and the sidebar/mobile wordmark localizes to "ديمومة". Sidebar brand and
topbar heights aligned at 5.5rem so their bottom borders form one line.
Rerun: **45/45 Vitest**, **60/60 Playwright** (all 13 axe scans),
tsc/ESLint/build clean, initial JS **212.35 KB gz** (under gate).

Brand revert + demo fixes: the D-mark logo family was an unapproved
redesign — reverted to the original asset set (`icon.svg` person-check
mark + `logo-primary`/`logo-light`/`logo-arabic` wordmarks; a new
`logo-arabic-dark` lockup covers AR-on-dark). The decorative "O" rings on
the login hero and profile banner (the actual complaint) are now D-letter
watermarks — decoration, separate from the logo. Hero indicators became a
real 3-slide carousel (6s autoplay, clickable dots, hover pause, reduced
motion honored — `motion-reduce:duration-0` after the a11y spec caught
the 0.7s crossfade). Demo-account buttons sign in directly with the seed
password. `seed_e2e` grows real departments (Engineering, People &
Culture, Finance & Accounting, Operations) with profile assignments and
renames the demo org to Acme Corporation (legacy "E2E Corp" rows migrate
in place). The "photo resets to red" report was the e2e photo spec's 1×1
red PNG overwriting shared demo accounts — it now saves and restores the
prior photo in a `finally` block. Two latent test defects surfaced and
fixed: the seed test asserted the old org name, and
`test_requests_report_is_bounded` used a hardcoded `to=2026-10-02` window
while fixtures submit at `now()` — a midnight time bomb, now
`localdate()`. Rerun: **427/427 backend pytest**, **45/45 Vitest**,
**60/60 Playwright** (13 axe scans), Ruff/ESLint/tsc/build clean,
initial JS **213.26 KB gz** (under gate).

Brand correction (owner feedback): the approved mark is the PNG family in
`assets/brand` — `logo-icon.png` (dashed continuity ring + gold check),
`logo-en.png` (stacked lockup), `logo-ar.png` (horizontal AR lockup) —
not the provisional SVG lockups. All runtime references now use the PNGs:
favicon + sidebar mark + hero brand tile + all background watermarks use
`logo-icon.png` (one motif at ~6–10% opacity on dark surfaces, replacing
three inconsistent decorative shapes: dashboard arc, hero ring, profile
ring); mobile login uses `logo-en.png`/`logo-ar.png` per language. The
unapproved `logo-arabic-dark.svg` lockup was removed. Rerun:
**45/45 Vitest**, **60/60 Playwright**, tsc/ESLint/build clean.

Dark-theme readability follow-up (006:FR-003/FR-006, D-009): Arabic request
field values on dark cards were measured at 1.27:1 contrast by an initially
failing axe regression; the detail card text/surfaces and a malformed
nested definition-list item were corrected. The dark workspace/background
and panels are lighter; the sidebar now has separate light and dark palettes,
including the brand tile, navigation, settings divider, and profile footer,
while retaining the approved `logo-icon.png`. Added browser checks for both
the Arabic dark detail and theme-aware sidebar. Rerun: **45/45 Vitest**,
**62/62 Playwright**, build (initial JS **213.08 KB gz**), ESLint, and
`git diff --check` passed. The build still warns about an uncompressed
chunk above 500 KB; the initial gzipped JS remains below the approved
500 KB gate. No manual screen-reader review or owner acceptance claimed.

Employee-information follow-up: with owner approval for the minimal field
set, HR-only editing, scoped employee/manager/HR viewing, and removal of
stored language preferences, added optional personal (birth date, address,
emergency contact), education (qualification, institution, field of study,
graduation year), and employment (start date, type, location) fields. Sensitive
fields are returned only from scoped employee detail endpoints, never directory
lists or audit metadata. The approved accounts.0006 migration added optional
fields and dropped `preferred_locale` on the local Docker database; this
permanently discarded stored profile language values there. EN/AR remains a
browser-level language toggle. Empty optional phone/job title provisioning
was also fixed after the new browser test exposed its 400 response. Generated
OpenAPI and TypeScript schemas were refreshed. Verification: **432/432 pytest**,
**45/45 Vitest**, **64/64 Playwright**, Ruff, ESLint, build, migration-drift
check, OpenAPI validation and `git diff --check` passed; initial JS
**214.04 KB gz** (below the approved 500 KB gz gate). Tests include
provisioning, invalid input, HR writes, self/manager/HR read scope and
denied cross-org reads, no personal fields in lists, Arabic headings,
manager read-only UI, self-service read-only link, and no personal values
in audit metadata.

Follow-up (same pending-acceptance window): contract fields
(`contract_start_date`/`contract_end_date`, end ≥ start enforced in the
serializer *and* the service for partial PATCHes; duration derived at
display time, no stored column). Employment/contract fields are now
**HR-only** — `EmployeeDetailSerializer` omits those keys entirely for
employees and managers (masked values would still leak presence); personal
and education fields stay scoped-visible. The employee's own record now
renders inline on the profile page (no separate detail view needed);
work-info is absent even from the employee's own response per the literal
HR-only rule. Migration `accounts.0007` applied. **435/435 pytest**,
**64/64 Playwright**, 45/45 Vitest, Ruff/ESLint/build clean — 214.83 KB gz.

Polish round (same window): phone and emergency-contact-phone fields now
require Egyptian numbers (`01x`/`+201x` mobile or `0x` landline; separators
normalized away on write) via `accounts/validators.py` — enforced on model
fields, both HR serializers, and `/api/v1/me/` (`accounts.0008`). Graduation
year is a bounded year dropdown, no free text. Employee detail/provision
sections moved into Radix `Tabs` (shared `ui/tabs.tsx`); title-case
capitalization applied to headings, nav/menu items, breadcrumbs, card and
table headers via one CSS rule (no-op for Arabic). **437/437 pytest**,
**64/64 Playwright**, 45/45 Vitest — 216.12 KB gz. No production
migration or real-data use is claimed.

These checks do not imply owner acceptance, a staging deployment, real-data
readiness, or manual screen-reader validation.
