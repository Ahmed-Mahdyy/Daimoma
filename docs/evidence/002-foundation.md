# Phase 002 Foundation — Evidence

Date: 2026-09-29. Reviewer: Devin (agent-run verification). Scope: T020–T024 verification of the authentication/RBAC/employee-administration foundation. All people and records below are synthetic; no real or de-identified employee data was used anywhere (D-008).

## Environment

- Local dockerized stack only (D-007): `postgres:17`, `python:3.12` backend, Node 22 frontend via `compose.yml`.
- Dev server on `localhost:8000`/`localhost:5173`; production-like smoke via gunicorn+TLS on `:8001` (in-container only, self-signed cert, not published).
- Backend `DJANGO_SETTINGS_MODULE=config.settings.production` for the smoke run, with `DJANGO_SECURE_SSL_REDIRECT=0` unset to its `True` default for the TLS run — the env flag exists only to permit a plain-HTTP pass during debugging and defaults to secure.

## T020 — Cross-role browser tests (Playwright)

Runner: `tests/e2e/run.sh` → seeds synthetic E2E org via `seed_e2e` (`hr-e2e`/`manager-e2e`/`employee-e2e@acme.test`, password `E2ePassw0rd1`), then `npx playwright test` (Chromium, headless).

Result: **7/7 passed (8.2s)** — real headless Chromium against the running stack:

1. Unauthenticated visitors redirected to login on protected routes.
2. Bad credentials → generic error, no account-existence leak.
3. HR sees admin navigation + org-wide directory (both HR and employee rows present).
4. Employee sees self-only directory; Departments/Audit nav links absent.
5. Manager sees only direct reports; Audit visible, Departments absent.
6. Direct unauthenticated API request → rejected.
7. Directory filter producing zero rows → empty state rendered.

Browser runtime is baked into `frontend/Dockerfile` (Chromium deps + `PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers`); the browsers directory is gitignored.

## T022 — Migrations, query budgets, settings, privilege boundaries

- **Fresh migrations**: `pytest` builds a new Postgres test DB from zero on every run — **134 tests passed**; `manage.py makemigrations --check` reports no drift.
- **Populated migrations**: `showmigrations` on the populated dev DB — all `[X]` applied (after smoke finding below).
- **Query budgets**: directory tests bound `employees/` at ≤10 queries regardless of page size via `django_assert_max_num_queries`. A real N+1 was caught and fixed during T015 (`values_list()` on `user.groups` bypassed the `prefetch_related` cache → switched to prefetched `.all()`; 21→9 queries for a 30-row page).
- **Safe settings** (`check --deploy`, production settings): 2 warnings, both environment artifacts, not code — `security.W008` (SSL redirect intentionally off during the plain-HTTP debug pass; `True` in the TLS run) and `security.W009` (dev-only short `SECRET_KEY` in `.env`; production deployments supply a real key). Zero warnings otherwise.
- **Privilege boundaries**: `test_profile.py` sweeps 12 protected fields (`is_staff`, `is_superuser`, `email`, `organization`, `is_active`, `password`, …) through PATCH `/api/v1/me/` — all 400-rejected. `EmployeeUpdateSerializer` rejects privilege fields in admin edits; `Employee`/`Manager` roles get 403/404 on HR endpoints; manager and employee scope tests pass; cross-org assignments rejected.
- **Session policy** (D-009): 2h idle / 24h absolute enforced by `SessionExpiryMiddleware` (tested); login throttle = 5 attempts/5min per email+IP → 429 (re-verified live in the smoke below); invitation tokens 48h single-use, recovery 30min single-use, both hashed SHA-256 at rest.

## T023 — MFA deferral and synthetic-only policy

- **MFA deferral (D-008, owner-approved 2026-09-25)**: privileged MFA selection/implementation is deferred to a later stage. Phase 002 ships **no MFA flow and no placeholder MFA** — search the codebase and no MFA endpoints/flags exist. The real-data gate is carried to **006:T015**: no real employee data until MFA + privacy/retention/operational policy are approved, implemented, and verified.
- **Synthetic-only**: all fixtures, the e2e org (`E2E Corp`), and the demo account (`demo@acme.test`) are synthetic. `seed_e2e` is idempotent and marked synthetic. No real or de-identified employee records exist in development, tests, or staging per D-008.

## T024 — Local production-like smoke check

Method: backend container ran `gunicorn config.wsgi:application --workers 2` on `:8001` under `config.settings.production`, first plain-HTTP then **TLS with a self-signed cert** (Secure cookies correctly refused over HTTP — itself a pass). Self-signed = local smoke only; no claim of live staging (D-007 defers self-hosted staging).

**Results — all observed, not inferred:**

| Check | Result |
| --- | --- |
| `GET /health/` | 200 |
| Security headers | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` |
| `GET /api/v1/me/` unauthenticated | 403 `authentication_required` |
| `GET /api/v1/auth/csrf/` | 200, `csrftoken` cookie `Secure` |
| Login over TLS, same-origin | 200; `sessionid` cookie `Secure`, `SameSite=Lax` |
| `GET /api/v1/me/` authenticated | 200, returns `demo@acme.test` + roles |
| Logout **without** CSRF token | 403 |
| Logout with CSRF token | 200; subsequent `/me/` → 403 (session invalidated) |
| Login with foreign `Origin: https://evil.example` | 403 `csrf_failed` |
| 7 bad logins | attempts 1–5 → 403 generic; attempts 6–7 → **429 throttled** |
| Password-reset request (existing account) | 200 `If the email is registered, a recovery link was sent.` |
| Password-reset request (unknown account) | 200 — **identical body** (no enumeration) |
| Recovery email via local console mail sink | Delivered to gunicorn stdout: `Subject: Daimoma password recovery` + `reset-password/confirm?token=…` link |

**Real bug the smoke caught:** `accounts.0004_emailtoken` (T009) was generated but never applied to the *dev* DB — pytest always builds a fresh test DB, so every unit test passed while the live schema lacked the table; the first real `password-reset` on the populated DB 500'd with `relation "accounts_emailtoken" does not exist`. Fixes: `manage.py migrate` applied it, and `backend/Dockerfile` CMD now runs `migrate --noinput` before `runserver` so a stale schema can never silently serve again.

Remote self-hosted staging remains **deferred** under D-007 until a server exists and deployment is explicitly authorized — this file does not claim a live staging flow.

## T025 — Final logo and palette approval

**Owner decision (2026-09-29):** owner supplied an external brand board (`odoo-17/logo.png`) containing the final Daimoma mark — a segmented teal ring with a gold check-swoosh — in three variants. Owner approved **all three variants** as final branding and chose the **Phase 001 palette** over the artwork-sampled values:

- Palette: teal `#0F6B63` (primary, hover `#0B5650`, subtle `#E0F2F0`, text `#0B4B45`) + gold accent `#C9A227`; semantic/neutral scales per `assets/brand/tokens.json` (status updated to `approved`, gold token added).
- Variants extracted to transparent PNGs: `assets/brand/logo-icon.png` (standalone mark), `logo-en.png` (stacked EN lockup), `logo-ar.png` (horizontal AR lockup) — sampled colors were `#175F57`/`#BE9C49`; owner kept the Phase 001 tokens.
- Applied: `@theme` tokens in `frontend/src/index.css` (`brand-*`, `gold-500`, Inter/IBM Plex Sans Arabic families), all `blue-*` utilities replaced with `brand-*`, logo on login page + app header, favicon + `theme-color` in `index.html`.
- Contrast: teal `#0F6B63` on white = **6.0:1** — passes WCAG AA for text/UI components (computed in 001 evidence).
- Verified: typecheck, lint, 13 Vitest tests, production build all pass; 7/7 Playwright e2e still pass.
- EN/AR variants both supplied; AR lockup reserved for the Arabic locale UI (RTL/i18n lands with D-002 scope in later phases).

## NOT yet verified / open items

- Cross-origin CSRF between separate frontend/API origins under real TLS (local smoke used same-origin requests; dev flow is verified over `localhost:5173`→`localhost:8000` via trusted origins).
- Performance workload limits (still pending in D-009).
