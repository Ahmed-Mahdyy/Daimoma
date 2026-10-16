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
  *(Resolved 2026-10-16 — see addendum; public entry is now NPM `:8380`.)*
- Owner acceptance sign-in against the live URL is pending.
  *(Owner actively using the live site as of 2026-10-16 — see addendum; formal
  sign-off still pending.)*

## Addendum — 2026-10-16 (operations + demo enrichment)

Post-release changes applied to the live host and reconciled in git commit
`c152856`:

- **Nginx Proxy Manager** (`jc21/nginx-proxy-manager` 2.16) added as the
  public edge: proxy HTTP `:8380` → `deployment-web-1:8080` over the
  `deployment_internal` Docker network (container DNS, loopback binding
  unchanged). Admin UI on `:8181`, HTTPS proxy reserved on `:8443` (no domain
  yet — Let's Encrypt requires one). Existing `app-nginx` keeps `:80`;
  host-Nginx direct edge on `:8080` remains as fallback.
- **Portainer CE 2.45** on `:9000` for container management (Docker socket;
  admin created via setup-token flow).
- **AWS SG** inbound rules now open: 8380/8443/8181/9000/8080 (verified —
  admin UIs reachable externally). Public demo URL is
  `http://13.53.139.255:8380`.
- **Deploy key rotated**: the original `DEPLOY_SSH_KEY` pair was exposed in
  session output and treated as compromised — `daimoma_deploy_key_v2`
  authorized on the server, old key removed. Repo secrets still required:
  `DEPLOY_SSH_KEY` (v2 private), `DEPLOY_HOST`, `DEPLOY_USER`.
- **`seed_demo` v2**: 5 departments, 16 users (2 HR / 4 managers / 10
  employees, realistic names), 53 requests across all types+states, 83
  timesheets, 387 workday entries. `DEMO_SEED_PASSWORD` env gives all new
  accounts one shared demo password.
- **Demo quick-login panel** enabled in production via `VITE_DEMO_LOGIN=1`
  build arg — the shared demo password is displayed on the login page.
  **Deliberate demo-mode deviation: this panel and password must be
  disabled/rotated before any real data is deployed (D-008 gate).**

Owner activity on the live URL observed 2026-10-16 (bug reports filed from
real usage); **formal acceptance sign-off still pending**.

## Acceptance

**Owner acceptance recorded 2026-10-16** — owner verified the live
application on `http://13.53.139.255:8380` (login, requests, timesheets,
reports) and the auto-deploy pipeline end-to-end (push `8eaf5b3` → CI →
rsync/compose/smoke all green). Phase 007 closed.
