# Deployment and Operations Contract

Status: provisional; provider credentials, budget, infrastructure mutation, and production release require separate approval.

## Boundaries

Public HTTPS application serves React assets and `/api/v1/`; private PostgreSQL, private media storage, authorized downloads, approved scanner/email. No runserver, public database port, public media bucket, secrets in Vite/browser variables, or SPA fallback on API/private paths. Local/CI/staging/production have separate secrets and data.

## Configuration interface

Runtime settings must document required secret/environment names for Django secret key, database connection, allowed hosts/trusted origins, secure proxy/TLS handling, private storage, scanner, email, logging, and environment identity. Values come from approved secret management. `.env.example` may contain names and harmless examples only. Production fails closed on missing mandatory secrets/configuration; no insecure fallback key or DEBUG=true default.

## Promotion and recovery

Lint/types/tests/schema/security -> immutable image -> staging migrations/real E2E -> phase 006 acceptance -> human authorization -> controlled production migration/deploy -> health/external role smoke -> monitoring. Any failed prerequisite stops promotion. Database migrations run once through the reviewed release process. Compatible prior application image and forward-fix procedures are retained; rollback never assumes data-destructive schema reversal is safe.

## Availability and observability

Liveness indicates process availability without secret/data output; readiness reflects required service availability under a bounded check. PII-safe correlation/logs/latency/error alerts identify operators and failure actions. Scanning/email/storage failures must be visible without failing open or undoing committed business decisions.

## Backups and demo

Approve retention/RPO/RTO before release; back up database plus private files and rehearse restoration in isolation. Demo seeding uses synthetic data/real services, explicit demo-environment guard, idempotent skip/report on existing records, and securely generated credentials. It cannot silently run on production or overwrite passwords/data.

## Handover and evidence

Live URL, repository access, secure demo credentials, README, architecture/ERD/OpenAPI, brand/product/design, Spec Kit/source/tests, AI disclosure and live presentation must be available. Record real stage feedback and respect Oct 4 freeze / Oct 5 judging from the brief without inventing prior progress. No remote publication occurs without authorization.
