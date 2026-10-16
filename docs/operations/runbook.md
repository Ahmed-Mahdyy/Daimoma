# Daimoma — Operations Runbook (007:T007, T010)

Environment: external Ubuntu server `ubuntu@13.53.139.255`. Public edge is Nginx Proxy Manager on `:8380` → `deployment-web-1:8080` over the `deployment_internal` Docker network; a direct host-Nginx edge on `:8080` remains as fallback (HTTP only — no domain/TLS yet). Docker Compose stack in `deployment/compose.prod.yml`; the `web` container binds loopback `127.0.0.1:8090` only. Owner: application operator (single deployment).

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
ALLOW_DEMO_SEED=1 DEMO_SEED_PASSWORD=<shared-demo-password> docker compose \
  -f deployment/compose.prod.yml --env-file deployment/.env.prod \
  exec backend python manage.py seed_demo
```

Creates the demo org (5 departments, 4 managers, 10 employees, 2 HR), request types, allocation grants, requests in every state, and ~5 weeks of timesheets per person via real services. Without `DEMO_SEED_PASSWORD`, per-account passwords are generated and printed **once**; with it, all new accounts share that password (needed for the login-page quick-login panel). Re-runs skip existing accounts without resetting anything.

The login quick-login panel ships only when the frontend is built with `VITE_DEMO_LOGIN=1` (compose build arg, set in `.env.prod`) — it always renders in dev builds.

## Health, logs, correlation

- `GET /health/` — process liveness (no dependencies).
- `GET /readyz/` — readiness; bounded `SELECT 1`; returns `503 {"status": "unavailable"}` on DB failure with no internals.
- `X-Request-ID` propagates host Nginx → container Nginx → Django and is echoed in every API error envelope (`request_id`).
- Logs: `docker compose -f deployment/compose.prod.yml logs -f backend|web|db`. Request bodies, passwords, and tokens are never logged (`django.request`/`django.security` at WARNING).

## Rollback / forward-fix

- Keep the previous image tag (e.g. `docker compose build` before `up`; tag `daimoma-web:<sha>`/`daimoma-backend:<sha>` to re-pull).
- Application rollback = redeploy the previous compatible image. **Schema rollback is not assumed safe** — prefer forward-fix migrations; expand/contract changes only.
- If `migrate` fails: inspect `docker compose logs migrate`, fix the migration or data issue, redeploy. Never `migrate --fake` or reset the DB.

## Edge and admin tooling (NPM + Portainer)

- **Nginx Proxy Manager** container `nginx-proxy-manager` (`--restart=always`, volumes `/data`, `/letsencrypt`): proxy HTTP `:8380`, HTTPS `:8443` (unused until a domain exists — Let's Encrypt cannot issue for a bare IP), admin UI `:8181`. Attached to `deployment_internal`; the Daimoma proxy host forwards to `deployment-web-1:8080` by container DNS — if the compose project is recreated under a different name, update the proxy host target. Admin login `admin@daimoma.local`; generated password in `~/.npm_admin_cred` (mode 600) on the server.
- **Portainer CE** container `portainer` (`--restart=always`, volume `portainer_data`, mounted `/var/run/docker.sock`): admin UI `:9000`, manages all containers on the host. First-run setup token rotates on restart — if the UI reports a lockout, `docker restart portainer` and re-open within ~5 minutes.
- Both admin UIs are currently on public SG rules at owner request; restrict `:8181`/`:9000` to owner IPs or VPN when possible — Portainer's Docker-socket access is root-equivalent.
- AWS SG inbound (current): `22`, `80` (other app), `8380`, `8443`, `8181`, `9000`, `8080`. New ports are opened only from the AWS account — `ufw` is inactive and iptables accepts on the VM, so nothing server-side blocks reachability.

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
