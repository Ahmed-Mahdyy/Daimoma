# Evidence 007 — Staging/production packaging & smoke (T006)

Date: 2026-10-17. Scope: production packaging artifacts for the approved D-007 target (external Ubuntu server + host Nginx + Docker Compose). No remote server was provisioned; the rehearsal ran locally against the real production artifacts.

## Artifacts delivered

- `deployment/Dockerfile` — locked multi-stage build: `frontend-build` (`npm ci` → `vite build`), `web` (`nginx:1.27-alpine`, SPA + `/api`/`/health`/`/readyz` proxy, no media fallback), `backend` (`python:3.12-slim`, non-root `daimoma:10001`, prod deps only, baked `collectstatic`, Gunicorn).
- `deployment/compose.prod.yml` — `db` (private `postgres:17`, no published port), one-shot `migrate` service (`collectstatic --clear` + `migrate` before workers), `backend` (healthchecked via `/readyz/` with an `ALLOWED_HOSTS`-derived Host header), `web` bound to `127.0.0.1:${APP_PORT:-8080}` only.
- `deployment/nginx-container.conf` + `deployment/nginx-host.conf.example` — container gateway (Docker DNS resolver for upstream re-resolution; SPA fallback excludes API/health/static/media) and host-site TLS proxy template.
- `deployment/.env.prod.example` — all required env names; `.env.prod` gitignored (verified via `git check-ignore`), secrets never committed.
- `.github/workflows/ci.yml` — spec-kit check, backend Ruff + migrations + pytest, frontend `tsc -b` + ESLint + Vitest + build, multi-stage production image build gate.
- `backend/config/urls.py` — `GET /readyz/` (bounded `SELECT 1`, 503 with no internals).
- `backend/config/settings/production.py` — fails closed on missing/default `SECRET_KEY` or empty `ALLOWED_HOSTS`; `USE_X_FORWARDED_HOST`, `X_FRAME_OPTIONS=DENY`.
- `backend/tests/test_deployment.py` — liveness/readiness/fail-closed coverage (6 tests).
- `backend/apps/organizations/management/commands/seed_demo.py` + `test_seed_demo.py` — guarded (`ALLOW_DEMO_SEED=1`), idempotent, runtime-generated credentials.

## Production-compose smoke — actual observed results (2026-10-17)

Executed `docker compose -f deployment/compose.prod.yml --env-file deployment/.env.prod up -d --wait` with generated throwaway secrets:

| Check | Result |
|---|---|
| `db` container healthy; no published host port | PASS — `5432/tcp` internal only |
| `migrate` one-shot: `collectstatic --clear` + `migrate` | PASS — exited 0 before backend started |
| `backend` healthcheck (`/readyz/` via ALLOWED_HOSTS Host) | PASS — healthy, runs as `daimoma` (uid 10001) |
| `GET /health/` via web proxy | `200 {"status": "ok"}` |
| `GET /readyz/` via web proxy | `200 {"status": "ready"}` |
| `GET /` and deep SPA route `/requests` | PASS — `index.html`, `<title>Daimoma` |
| `GET /api/v1/nonexistent/` | PASS — 404, Django error page (not `index.html`) |
| `GET /media/x.png` | PASS — 404 (private, API-served only) |
| `GET /static/admin/css/base.css` | PASS — 200 from shared `static_prod` volume |
| `manage.py check --deploy` under production settings | PASS — 2 warnings only: drf-spectacular enum naming (cosmetic), SECURE_SSL_REDIRECT intentionally 0 for localhost smoke (defaults on) |
| `seed_demo` unguarded | PASS — refused with `CommandError` |
| `seed_demo` with `ALLOW_DEMO_SEED=1` | PASS — org + 8 accounts + types + grants + 5 request states + 3 sheet states; credentials printed once |
| `seed_demo` second run | PASS — all accounts skipped, passwords untouched |
| Login through production proxy (CSRF → session) | PASS — `hr-1@acme.test` signed in via `/api/v1/auth/login/` on `127.0.0.1:8080` |
| Stack teardown | `down -v` — all containers, volumes, network removed |

## Failure/stop behavior observed

- `migrate` failure gates `backend`/`web` (`service_completed_successfully`) — verified by compose ordering; runbook documents fix-forward, never `migrate --fake`.
- Type error caught by `tsc -b` during image build (test mock missing `employee_name`) — fixed; build gate works as designed. `tsc --noEmit` on the solution tsconfig was vacuous — typecheck script corrected to `tsc -b`.
- Initial backend healthcheck 400 (Host `localhost` rejected by `ALLOWED_HOSTS`) — fixed by deriving Host from `DJANGO_ALLOWED_HOSTS` inside the container.

## Explicitly not done

- No remote server was touched; the Ubuntu host + Nginx TLS cutover is an operator step (`nginx-host.conf.example` is a template). `npm audit` reports 7 high-severity advisories in the dev dependency tree — reviewed as build-time only, not shipped in the `web` runtime image.
- `007:T008`/`T009` automated backup/restore waived per owner (D-008, 2026-10-15); manual `pg_dump` documented in `docs/operations/runbook.md`.
- `007:T016`/`T017` production promotion + credential handover remain pending the actual server and explicit release authorization.
