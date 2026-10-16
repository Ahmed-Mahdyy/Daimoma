# Deployment and Operations Contract

Status: approved 2026-10-15 for self-hosted Ubuntu + host Nginx + Docker Compose packaging (D-007); automated backup/restore waived by owner for synthetic deployment (D-008); final branding approved (D-010). Actual remote server cutover remains an operator-executed step.

## Boundaries

Public HTTPS application is terminated by host Nginx on the external Ubuntu server (`deployment/nginx-host.conf.example`) and reverse-proxied over loopback (`127.0.0.1:${APP_PORT:-8080}`) to the Dockerized web/application stack (`deployment/compose.prod.yml` + `deployment/Dockerfile`), serving hashed React assets and `/api/v1/` on one origin; PostgreSQL (`postgres:17`) and media volumes stay private inside the Docker network with no public host port. No `runserver`, public database port, public media bucket, secrets in Vite/browser variables, or SPA fallback on `/api/`, `/health/`, `/readyz/`, `/static/`, or `/media/` paths. Local/CI/staging/production have separate secrets and data.

## Configuration interface

Runtime settings must document required secret/environment names for Django secret key, database connection, allowed hosts/trusted origins, secure proxy/TLS handling, private storage, scanner, email, logging, and environment identity. Values come from approved secret management. `.env.example` may contain names and harmless examples only. Production fails closed on missing mandatory secrets/configuration; no insecure fallback key or DEBUG=true default.

## Promotion and recovery

Lint/types/tests/schema/security -> immutable image -> staging migrations/real E2E -> phase 006 acceptance -> human authorization -> controlled production migration/deploy -> health/external role smoke -> monitoring. Any failed prerequisite stops promotion. Database migrations run once through the reviewed release process. Compatible prior application image and forward-fix procedures are retained; rollback never assumes data-destructive schema reversal is safe.

## Availability and observability

Liveness indicates process availability without secret/data output; readiness reflects required service availability under a bounded check. PII-safe correlation/logs/latency/error alerts identify operators and failure actions. Scanning/email/storage failures must be visible without failing open or undoing committed business decisions.

## Backups and demo

Per owner decision 2026-10-15 (D-008), automated backup/retention/restore infrastructure is waived for this synthetic deployment (`007:T008` and `007:T009` deferred); manual `pg_dump` commands are documented in the operations runbook for operator convenience. Demo seeding (`python manage.py seed_demo`) uses synthetic data/real services, an explicit demo-environment guard (`ALLOW_DEMO_SEED=1`), idempotent skip/report on existing records, and securely generated runtime credentials. It cannot silently run on production or overwrite existing passwords/data.

## Handover and evidence

Live URL, repository access, secure demo credentials, README, architecture/ERD/OpenAPI, brand/product/design, Spec Kit/source/tests, AI disclosure and live presentation must be available. Record real stage feedback and respect Oct 4 freeze / Oct 5 judging from the brief without inventing prior progress. No remote publication occurs without authorization.
