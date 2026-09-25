# Implementation Plan: Deployment and Handover

**Feature**: 007-deployment-handover | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)
**Status**: Provisional; no provider resources or production release exist.

## Technical Context and Structure

Build a pinned containerized Django/React application with managed PostgreSQL/private storage/transactional email and the approved scanner. Use Gunicorn or an approved production server, never runserver. Serve hashed SPA assets and `/api/v1/` on one HTTPS origin; ensure frontend route fallback excludes APIs/private files/health paths. Configuration lives under `deployment/`, application settings under `backend/config/`, approved CI under `.github/workflows/`, and genuine operational evidence under `docs/evidence/`.

## Constitution Check

Public application does not mean public database. Separate environments/secrets, migration integrity, private files, verified restore, real role demos, explicit human release approval, truthful AI evidence, and no destructive reset are mandatory. Provider/data decisions remain unresolved; do not provision resources while drafting.

## Execution Design

1. Approve region/budget/service capabilities, private networking, TLS, storage/scanner/email, backups, RPO/RTO, operator and incident ownership.
2. Reuse phase 002 staging foundation; define multi-stage locked frontend/backend builds, non-root runtime, static/media separation, settings and health/readiness checks. No secrets in build arguments, images, or public frontend environment variables.
3. CI verifies lint/types/tests/schema/security, builds immutable image, and deploys staging under approved credentials. Record artifact identity and migration revision.
4. Rehearse populated migration and database/file backup restoration in isolation. Validate attachments, authorization, record counts/invariants, and elapsed recovery against approved objectives. Protect restored copies like original data.
5. Document compatible application rollback and forward-fix strategy; run migrations through a controlled release job, not racing every application worker. Readiness failures stop traffic/promotion.
6. After phase 006 acceptance and separate human approval, release production, check HTTPS/headers/private networking/real role flows, and monitor. No deployment step uses a destructive reset.
7. Generate demo records through real services with explicit nonproduction/demo guard, runtime secrets, and idempotent skip/report behavior on existing records; never overwrite existing passwords or histories.
8. Assemble all eight deliverable groups, reproducible setup instructions, ERD/OpenAPI, AI evidence, rubric mapping, and a live rehearsal. Maintain the brief's freeze policy and source dates without backdating work.

## Verification and Operations

Production-settings `check --deploy`, external role smoke tests, same-origin session/CSRF checks, missing SPA/API paths, private attachment authorization/scanning, database non-public reachability, log redaction, dependency alerts, and backup restoration. Document actual commands/outcomes and failures; approved host limitations are not a reason to expose private services.

## Rollout Gate

No final production action before D-007/D-008/D-009 resolution, passing phase 006 gates, working staged migrations/recovery, and owner authorization for the specific release. Preserve the previous compatible image. Unsupported reverse migrations are not an accepted default rollback.
