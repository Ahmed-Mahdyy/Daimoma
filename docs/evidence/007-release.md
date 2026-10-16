# Phase 007 — Production Release Evidence

Date: 2026-10-16 · Operator: Devin (authorized by owner in-session)
Server: AWS EC2 `ubuntu@13.53.139.255` (Ubuntu 26.04 LTS, Docker 29.9.1, Compose v5.6.0)

## Release authorization

Owner approved production promotion in-session 2026-10-16 with three explicit
decisions: keep the pre-existing unrelated `app/*` stack running on port 80;
expose Daimoma over plain HTTP on a separate port; commit & push all pending
changes to `origin/main`.

## Deployed artifacts

| Artifact | Identity |
|---|---|
| Source | git `main` @ `de0ab98` (working tree rsynced → `~/daimoma`) |
| Backend image | `deployment-backend` sha256:9219c31f5e69ae26da12a7793e791d07deb0ea2480089acac27f293a2df6f3ea |
| Web image | `deployment-web:latest` id ca4dfb9abaf3 |
| DB | `postgres:17` on private Docker network `deployment_internal` (no host port) |
| Migrations | one-shot `migrate` service, **45 migrations applied** before backend start |

## Topology (deviation from D-007 recorded)

Contract targets host-Nginx HTTPS on 443. Actual deployment: **plain HTTP** —
no domain/TLS certificate is available for a bare IP. Host Nginx listens on
public `:8080` and proxies to the Docker web container bound to
`127.0.0.1:8090` (loopback only, per contract). Port 80 remains owned by the
pre-existing unrelated `app` stack (untouched, running).

Consequences of HTTP-only, all env-gated with secure defaults retained:
- `DJANGO_SECURE_SSL_REDIRECT=0` (same flag used by the local staging smoke).
- `DJANGO_SESSION_COOKIE_SECURE=0`, `DJANGO_CSRF_COOKIE_SECURE=0` — required:
  browsers drop `Secure` cookies over http; `SessionAuthentication` login
  would otherwise be impossible. Production defaults in
  `backend/config/settings/production.py` remain `True`.
- HSTS headers are emitted but ignored by browsers over HTTP.

## Smoke outcomes (executed 2026-10-16, via host Nginx on loopback)

| Check | Result |
|---|---|
| `GET /health/` | `{"status":"ok"}` |
| `GET /readyz/` | `{"status":"ready"}` (DB SELECT 1) |
| `GET /` (SPA) | HTTP 200 |
| CSRF bootstrap | `csrftoken` cookie set, SameSite=Lax |
| Login `hr-1@acme.test` | HTTP 200, `sessionid` cookie set |
| `GET /api/v1/me/` (session) | returns HR profile `DEMO-HR1` |
| Migrate failure stop | `depends_on: service_completed_successfully` verified in compose |

## Demo seed

`seed_demo` run with `ALLOW_DEMO_SEED=1` (exec-scoped env, not persisted):
created org "Acme Corporation" — 2 departments, 2 HR, 2 managers, 4 employees —
and printed generated credentials once (delivered to owner; not stored here).

## Auto-deployment pipeline

`.github/workflows/deploy.yml` triggers on `workflow_run` of **CI & Production
Build Gate** completing successfully on `main` (manual `workflow_dispatch`
also allowed). Steps: rsync source → `docker compose -f
deployment/compose.prod.yml --env-file deployment/.env.prod up -d --build` →
smoke check `/health/` + `/`. Server keeps `deployment/.env.prod` locally
only; secrets are never in GitHub Actions env beyond the SSH key.

Required GitHub repo secrets (added by owner — no gh CLI available):
`DEPLOY_SSH_KEY` (private ed25519 key; public key installed in
`~ubuntu/.ssh/authorized_keys` on the server), `DEPLOY_HOST=13.53.139.255`,
`DEPLOY_USER=ubuntu`.

## Outstanding

- **AWS security group**: inbound TCP 8080 is not open — external access
  currently blocked (loopback verified). Owner action in EC2 console required.
- Owner acceptance sign-in against the live URL is pending.
