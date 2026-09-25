# Tasks: Deployment and Handover

**Status**: Not executed. No cloud actions or publication authorized. IDs local to 007.

## Setup and Foundational

- [ ] T001 Approve D-007/D-008/D-009 provider/region/budget/private services/recovery objectives and operator ownership in `AGENTS.md` and `contracts/operations.md` (FR-001, FR-004, FR-005).
- [ ] T002 Review existing phase 002 staging/CI and phase 006 acceptance in `docs/evidence/`; identify missing prerequisites before any release (FR-002, FR-003).

## US1 - Live safe application

Goal: externally reachable genuine product with private data services. Independent test: three-role external-browser smoke suite.

- [ ] T003 [US1] Implement reviewed locked multi-stage builds and non-root runtime in `deployment/Dockerfile` and approved service configuration; keep frontend assets separate from private media (FR-001, FR-002).
- [ ] T004 [US1] Implement safe production settings, trusted routing/headers/hosts, HTTPS/session/CSRF, and health/readiness behavior in `backend/config/` and `deployment/` with tests (FR-001, FR-002).
- [ ] T005 [US1] Configure approved CI image/staging/manual-promotion workflow in `.github/workflows/`; bind runtime secrets without baking them into assets/images (FR-002, FR-003).
- [ ] T006 [US1] Rehearse populated migration and external smoke tests on approved staging; record failure/stop behavior in `docs/evidence/007-staging.md` (FR-001, FR-002, FR-003).

## US2 - Operations and recovery

Goal: observable services and tested recovery. Independent test: isolated database-plus-file restore with genuine results.

- [ ] T007 [US2] Define safe logs/correlation/latency/error/dependency alerts and ownership in `deployment/` and `docs/operations/runbook.md` (FR-005).
- [ ] T008 [US2] Configure approved database/attachment backups and retention under `deployment/`; do not execute deletions or production changes without specific authorization (FR-004).
- [ ] T009 [US2] Perform authorized isolated restore rehearsal; verify records/files/permissions/objectives and record actual evidence in `docs/evidence/007-restore.md` (FR-004).
- [ ] T010 [US2] Rehearse compatible-image rollback/forward-fix and migration failure recovery in approved staging; document safe procedures in `docs/operations/runbook.md` (FR-003, FR-004).

## US3 - Demo and handover

Goal: reproducible evidence-based product delivery. Independent test: fresh setup plus live rehearsal against all rubric areas.

- [ ] T011 [US3] Implement tested guarded idempotent synthetic seeding in `backend/apps/organizations/management/commands/seed_demo.py`; generate credentials securely, skip/report existing records, never reset passwords/history (FR-006).
- [ ] T012 [US3] Assemble setup/architecture/test/deployment `README.md`, ERD/API references under `docs/architecture/`, and links to approved brand/design/Spec Kit/source deliverables (FR-007).
- [ ] T013 [US3] Reproduce setup/tests from a fresh approved environment and record actual outcomes in `docs/evidence/007-handover.md` (FR-007).
- [ ] T014 [US3] Assemble reviewed AI-use, requirement/task/test, stage-feedback, and full scoring evidence in `docs/evidence/007-judging.md` without fabricated scores or historical completion dates (FR-008).
- [ ] T015 [US3] Rehearse product story/brand/live role workflows/architecture/Spec Kit/AI process and Q&A; record freeze disposition and real demo outcomes in `docs/evidence/007-rehearsal.md` (FR-006, FR-008).

## Final Release and Acceptance

- [ ] T016 Obtain explicit release approval after all gates; perform only the authorized production promotion and record artifact/migration identity and smoke outcomes in `docs/evidence/007-release.md` (FR-001, FR-003).
- [ ] T017 Share real live URL/repository reference and generated demo credentials through approved secure channels; update `AGENTS.md` status and record human acceptance without embedding secrets (FR-006, FR-007, FR-008).

## Dependencies and Strategy

Provider/operational planning starts during 002; final promotion depends on 006 acceptance. Build/staging -> monitoring/backups/restore -> handover/rehearsal -> authorized production release. Read-only evidence assembly can proceed while approved infrastructure tasks finish; no implicit agents, payments, cloud provisioning, destructive actions, commit/push, or publication. Localhost-only operation is not final acceptance.
