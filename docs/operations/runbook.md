# Daimoma — Operations Runbook (007:T007, T010)

Environment: external Ubuntu server, host Nginx (TLS termination), Docker Compose stack in `deployment/compose.prod.yml`. Owner: application operator (single deployment).

## Deploy / update

```bash
cd Daimoma
git pull                                  # or upload the reviewed tree
cp deployment/.env.prod.example deployment/.env.prod   # first deploy only
docker compose -f deployment/compose.prod.yml --env-file deployment/.env.prod up -d --build
docker compose -f deployment/compose.prod.yml --env-file deployment/.env.prod ps
curl -s https://<domain>/health/          # {"status": "ok"}
curl -s https://<domain>/readyz/          # {"status": "ready"} — 503 = DB unreachable
```

Release order: `migrate` (one-shot `manage.py migrate`) must exit 0 before `backend` starts; `web` waits on `backend` health. If migrations fail, the stack stops — fix forward; do **not** assume reversing a migration is safe.

## First-run demo data (synthetic only)

```bash
ALLOW_DEMO_SEED=1 docker compose -f deployment/compose.prod.yml --env-file deployment/.env.prod \
  exec backend python manage.py seed_demo
```

Creates the demo org (2 departments, 2 managers, 4 employees, 2 HR), request types, allocations, and draft→rejected requests/timesheets via real services. Prints generated passwords **once**; re-runs skip existing accounts without resetting anything.

## Health, logs, correlation

- `GET /health/` — process liveness (no dependencies).
- `GET /readyz/` — readiness; bounded `SELECT 1`; returns `503 {"status": "unavailable"}` on DB failure with no internals.
- `X-Request-ID` propagates host Nginx → container Nginx → Django and is echoed in every API error envelope (`request_id`).
- Logs: `docker compose -f deployment/compose.prod.yml logs -f backend|web|db`. Request bodies, passwords, and tokens are never logged (`django.request`/`django.security` at WARNING).

## Rollback / forward-fix

- Keep the previous image tag (e.g. `docker compose build` before `up`; tag `daimoma-web:<sha>`/`daimoma-backend:<sha>` to re-pull).
- Application rollback = redeploy the previous compatible image. **Schema rollback is not assumed safe** — prefer forward-fix migrations; expand/contract changes only.
- If `migrate` fails: inspect `docker compose logs migrate`, fix the migration or data issue, redeploy. Never `migrate --fake` or reset the DB.

## Backup

Per owner decision 2026-10-15 (D-008), no automated backup/retention infrastructure is required for this synthetic deployment. Manual dump if ever needed:

```bash
docker compose -f deployment/compose.prod.yml exec db \
  pg_dump -U daimoma daimoma > backup-$(date +%F).sql
```

## Failure triage

| Symptom | First checks |
|---|---|
| Site down | Host Nginx → `docker compose ps` → `logs web`/`backend`; `curl 127.0.0.1:8080/health/` |
| `/readyz/` 503 | `logs db`; `pg_isready` inside `db`; `DATABASE_URL` in `.env.prod` |
| Login works but API 403s | `DJANGO_CSRF_TRUSTED_ORIGINS` / `ALLOWED_HOSTS` match the public https origin |
| Emails not sending | `DJANGO_EMAIL_BACKEND`/SMTP vars; console backend writes to `logs backend` |
