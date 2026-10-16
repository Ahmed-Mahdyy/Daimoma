# Daimoma (ديمومة)

A secure, bilingual (English/Arabic RTL), role-based employee-operations platform. Employees submit and track internal requests and working time; managers review their direct team; HR administers employees, types, and allocations.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, strict TypeScript, Vite, TanStack Query/Table, Tailwind, shadcn-style components |
| Backend | Django 5.2 LTS, Django REST Framework, drf-spectacular |
| Database | PostgreSQL 17 |
| Tests | pytest, Vitest, Playwright + axe-core |
| Deploy | Docker Compose on Ubuntu host + host Nginx (TLS) |

## Quick start (development)

Requirements: Docker only — nothing installs on the host.

```bash
cp .env.example .env
docker compose up -d --wait
docker compose exec backend python manage.py seed_e2e
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1/ (`/api/v1/schema/docs/` for OpenAPI UI)
- Synthetic accounts (all password `E2ePassw0rd1`): `employee-e2e@acme.test`, `manager-e2e@acme.test`, `hr-e2e@acme.test`

## Testing

```bash
# Backend — full pytest suite + lint + migration drift check
docker compose exec backend pytest
docker compose exec backend ruff check .
docker compose exec backend python manage.py makemigrations --check --dry-run

# Frontend — types, lint, unit tests, production build
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx eslint .
docker compose exec frontend npx vitest run

# E2E — seeds synthetic users, then runs all Playwright specs
bash tests/e2e/run.sh
```

## Project layout

```text
backend/            Django project (config/, apps/, tests/)
  apps/accounts/        users, auth, profiles, sessions, throttling
  apps/organizations/   org, departments, HR admin, settings, seed_demo
  apps/employee_requests/ request types, requests, allocations, approvals
  apps/timesheets/      sheets, entries, punch, weekly review
  apps/notifications/   durable inbox notifications
  apps/audit/           append-only audit events
  apps/reporting/       role-scoped dashboards and CSV reports
frontend/           React SPA (src/features/* per domain)
deployment/         Production Dockerfile, compose.prod.yml, Nginx configs
specs/              Spec Kit feature packages 001–008
docs/               product, brand, design, evidence, operations, architecture
tests/e2e/          Playwright browser suite
```

## Production deployment (Ubuntu + host Nginx)

Full runbook: [`docs/operations/runbook.md`](docs/operations/runbook.md).

```bash
cp deployment/.env.prod.example deployment/.env.prod   # fill real values
docker compose -f deployment/compose.prod.yml --env-file deployment/.env.prod up -d --build
ALLOW_DEMO_SEED=1 docker compose -f deployment/compose.prod.yml --env-file deployment/.env.prod \
  exec backend python manage.py seed_demo
```

Architecture/ERD/API references: [`docs/architecture/`](docs/architecture/). Spec Kit master reference: [`AGENTS.md`](AGENTS.md). All data is synthetic until the real-data gate (D-008) is approved.
