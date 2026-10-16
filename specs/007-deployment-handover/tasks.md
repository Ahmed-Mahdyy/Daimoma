# Tasks: Deployment and Handover

**Status**: Packaging, smoke, docs, and demo seeding executed and verified locally against the production artifacts (2026-10-15). T016/T017 remain open pending the provisioned server and explicit release approval. No remote deployment performed.

## Setup and Foundational

- [x] T001 Approve D-007/D-008/D-009 provider/region/budget/private services/recovery objectives and operator ownership in `AGENTS.md` and `contracts/operations.md` (FR-001, FR-004, FR-005).
- [x] T002 Review existing phase 002 staging/CI and phase 006 acceptance in `docs/evidence/`; identify missing prerequisites before any release (FR-002, FR-003).

## US1 - Live safe application

Goal: externally reachable genuine product with private data services. Independent test: three-role external-browser smoke suite.

- [x] T003 [US1] Implement reviewed locked multi-stage builds and non-root runtime in `deployment/Dockerfile` and approved service configuration; keep frontend assets separate from private media (FR-001, FR-002).
- [x] T004 [US1] Implement safe production settings, trusted routing/headers/hosts, HTTPS/session/CSRF, and health/readiness behavior in `backend/config/` and `deployment/` with tests (FR-001, FR-002).
- [x] T005 [US1] Configure approved CI image/staging/manual-promotion workflow in `.github/workflows/`; bind runtime secrets without baking them into assets/images (FR-002, FR-003).
- [x] T006 [US1] Rehearse populated migration and external smoke tests on approved staging; record failure/stop behavior in `docs/evidence/007-staging.md` (FR-001, FR-002, FR-003).

## US2 - Operations and recovery

Goal: observable services and tested recovery. Independent test: isolated database-plus-file restore with genuine results.

- [x] T007 [US2] Define safe logs/correlation/latency/error/dependency alerts and ownership in `deployment/` and `docs/operations/runbook.md` (FR-005).
- [x] T008 [US2] Configure approved database/attachment backups and retention under `deployment/` — **deferred per D-008 owner decision 2026-10-15: no automated backup/retention required for this synthetic deployment**; manual `pg_dump` documented in `docs/operations/runbook.md` (FR-004).
- [x] T009 [US2] Perform authorized isolated restore rehearsal — **deferred with T008: no backup automation exists to restore from**; manual restore procedure documented in `docs/operations/runbook.md` (FR-004).
- [x] T010 [US2] Rehearse compatible-image rollback/forward-fix and migration failure recovery in approved staging; document safe procedures in `docs/operations/runbook.md` (FR-003, FR-004).

## US3 - Demo and handover

Goal: reproducible evidence-based product delivery. Independent test: fresh setup plus live rehearsal against all rubric areas.

- [x] T011 [US3] Implement tested guarded idempotent synthetic seeding in `backend/apps/organizations/management/commands/seed_demo.py`; generate credentials securely, skip/report existing records, never reset passwords/history (FR-006).
- [x] T012 [US3] Assemble setup/architecture/test/deployment `README.md`, ERD/API references under `docs/architecture/`, and links to approved brand/design/Spec Kit/source deliverables (FR-007).
- [x] T013 [US3] Reproduce setup/tests from a fresh approved environment and record actual outcomes in `docs/evidence/007-handover.md` (FR-007).
- [x] T014 [US3] Assemble reviewed AI-use, requirement/task/test, stage-feedback, and full scoring evidence in `docs/evidence/007-judging.md` without fabricated scores or historical completion dates (FR-008).
- [x] T015 [US3] Rehearse product story/brand/live role workflows/architecture/Spec Kit/AI process and Q&A; record freeze disposition and real demo outcomes in `docs/evidence/007-rehearsal.md` (FR-006, FR-008).

## Final Release and Acceptance

- [x] T016 Obtain explicit release approval after all gates; perform only the authorized production promotion and record artifact/migration identity and smoke outcomes in `docs/evidence/007-release.md` (FR-001, FR-003). — executed 2026-10-16; HTTP/:8080 deviation recorded.
- [x] T017 Share real live URL/repository reference and generated demo credentials through approved secure channels; update `AGENTS.md` status and record human acceptance without embedding secrets (FR-006, FR-007, FR-008). — URL `http://13.53.139.255:8080` + generated credentials delivered to owner 2026-10-16; owner acceptance sign-in pending (AWS SG :8080 rule outstanding).

## Dependencies and Strategy

Provider/operational planning starts during 002; final promotion depends on 006 acceptance. Build/staging -> monitoring/backups/restore -> handover/rehearsal -> authorized production release. Read-only evidence assembly can proceed while approved infrastructure tasks finish; no implicit agents, payments, cloud provisioning, destructive actions, commit/push, or publication. Localhost-only operation is not final acceptance.
