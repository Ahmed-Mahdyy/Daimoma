# Evidence 007 — Handover deliverables (T012–T015)

Date: 2026-10-15. Scope: handover documentation and demo-prep completeness for the synthetic deployment.

## Deliverable map (FR-007/FR-008)

| Deliverable | Location |
|---|---|
| Setup / test / deploy README | `README.md` |
| Architecture — ERD + invariants | `docs/architecture/erd.md` |
| Architecture — API reference | `docs/architecture/api.md` + live `GET /api/v1/schema/` (OpenAPI) |
| Operations runbook (deploy/health/logs/rollback) | `docs/operations/runbook.md` |
| Production packaging | `deployment/` (Dockerfile, compose.prod.yml, Nginx configs, .env.prod.example) |
| CI gate | `.github/workflows/ci.yml` |
| Demo seed (guarded/idempotent) | `backend/apps/organizations/management/commands/seed_demo.py` |
| Product/brand/design assets | `docs/product/`, `docs/brand/`, `docs/design/` |
| Spec Kit artifacts | `specs/001`–`008`, `.specify/memory/constitution.md`, `AGENTS.md` |
| Phase evidence | `docs/evidence/001`–`008` |
| Core QA + manual scenarios | `docs/core-qa-checklist.md`, `docs/manual-qa-scenarios.md` |

## Demo rehearsal record (T015)

`seed_demo` produces one organization (Acme Corporation), Engineering + Operations + People & Culture departments, 2 managers, 4 employees, 2 HR users, all six request types, allocation grants, and draft/pending/returned/approved/rejected requests and collecting/pending/approved timesheets — all through real domain services. Credentials are generated at runtime and printed once; re-runs skip existing accounts.

## AI-use & judging evidence (T014)

AI assistance (Devin/SWE-2) is disclosed; requirement → task → test traceability lives in each `specs/0XX/` package and `docs/evidence/`; no scores are fabricated — rubric mapping is this file plus the per-phase evidence docs. Freeze discipline: only explicit owner-approved changes after 006 review.

## Open items

- `007:T016`/`T017` production promotion + secure credential delivery — pending the provisioned Ubuntu server and explicit release authorization. The local production-compose rehearsal (T013) passed end-to-end on 2026-10-15 (`docs/evidence/007-staging.md`); a fresh-checkout run on the real server remains the final operator step.
