# Evidence 006 — Requirement ↔ task ↔ test ↔ evidence traceability

Date: 2026-10-02. All rows link to real artifacts; unrun items are listed at
the bottom, not hidden.

## Requirement coverage

| Req | Tasks | Proof (artifact → result) |
|-----|-------|---------------------------|
| FR-001 security matrix | T003 | `backend/tests/test_security_matrix.py` — 31 parametrized negative tests (403/404/CSRF/session/injection/export) — **pass** |
| FR-002 concurrency/migrations | T004, T005 | `test_concurrency.py` ×2 (10 real separate-connection races); `test_migrations.py` (populated 0001→head upgrade) — **pass** |
| FR-003 browser/failure/a11y checks | T007, T008 | `resilience.spec.ts` 3/3; `accessibility.spec.ts` 7/7; full e2e 38/38 — **pass** |
| FR-004 measured budgets | T009, T010 | `tests/performance/load_scenario.mjs` + `seed_perf` — all p95 budgets met; `006-performance.md` — **pass** |
| FR-005 dependency/secret review | T006 | `006-security.md` — Django/DRF patched, npm audit 0, secrets env-only — **pass w/ noted residuals** |
| FR-006 defect tracking | T011 | `006-defects.md` — 4 defects w/ severity+repro+fix+regression — **pass** |
| FR-007 traceability | T012 | this file + per-phase evidence docs — **pass** |
| FR-008 release gate | T013, T015 | `006-release-review.md`; synthetic-only label; MFA gate recorded as **unresolved** — **gate open, not bypassed** |

## Defect → regression mapping

| Defect | Regression guard |
|--------|------------------|
| D6-01 vulnerable deps | `pip-audit`/`npm audit` in review; pins locked |
| D6-02 timesheet-list N+1 | `test_list_bounded_queries` (12 sheets, ≤15q) + load re-measure |
| D6-03 dead-session UI | `resilience.spec.ts` expired-session test |
| D6-04 360px overflow | `accessibility.spec.ts` reflow assertions |

## Test totals at this measurement

| Layer | Count | Suite |
|-------|-------|-------|
| Backend pytest | **372** | full suite, 30.7s |
| Frontend Vitest | **37** | 9 files |
| Playwright e2e | **38** | auth 8 / requests / timesheets 8 / reporting 7 / resilience 3 / accessibility 7 (rough split) |
| Load scenario | 6 endpoints ×100 | all budgets PASS |

## Unrun / explicitly out of scope

- Production-environment load re-run (no staging server — D-007 pending).
- Screen-reader manual session (axe only; recorded gap).
- Privileged MFA implementation (T015 gate — synthetic-only release).
- Backup/restore rehearsal — Phase 007 scope.

## Subsequent UI and synthetic-fixture re-verification (2026-10-02)

After the shadcn redesign and role-aware UI, full reruns passed: 373 pytest,
39 Vitest, 48 Playwright (12 accessibility — light/dark axe scans cover
login, dashboard, reports, departments and request/timesheet lists; dark-mode
contrast defects found and fixed), npm audit 0 findings, frontend
build/lint and backend Ruff. `test_seed_e2e_creates_role_samples_without_overwriting_them`
proves three distinct role sheets, five request types, and repeat-run account
preservation. HR department and type forms reuse the existing server-scoped
APIs; timesheet editing stays self-only. Load scenario re-run: 600 requests,
all approved p95 read budgets met, no unexpected errors. The table above
records the earlier measurement, not the latest one.

## Post-006 enhancement batch re-verification (2026-10-02)

Owner-requested additions (early-leave category, check-in/out punch,
department record view, Settings submenu, dark-mode readability,
brand/avatar polish) plus follow-up polish (future-week sheet guard,
topbar punch widget with elapsed timer, clickable dashboard summary chips,
dark-mode notification bell, shared FilterBar redesign): full reruns passed
— **412 pytest, 39 Vitest, 58 Playwright** (13 accessibility incl. dark
timesheet-detail axe scan), npm audit 0, lint/build/Ruff clean, initial JS
184.57 KB gz. Punch checkout delegates to `create_entries` so all entry
invariants apply; sub-minute check-outs are rejected with the punch kept
open. Final rerun after the table/photo/punch-confirm batch:
**422 pytest, 43 Vitest, 59 Playwright** (13 accessibility), initial JS
201 KB gz. Final rerun after record-table standardization (shared
`DataTable` on every list; ordering allowlists extended for
employees/requests/timesheets/audit; photo endpoints typed as binary in
the regenerated warning-free OpenAPI schema): **427 pytest, 43 Vitest,
59 Playwright** (13 accessibility), initial JS 201.47 KB gz. Follow-up
round (portalled ConfirmDialog, client pagination on departments/request
types, report tab-switch param clearing, real API error surfacing,
styled timesheet entry actions): **427 pytest, 44 Vitest, 59 Playwright**
— one resilience flake passed on isolated re-run.
