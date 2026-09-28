# Implementation Plan: Authentication and RBAC

**Feature**: 002-authentication-rbac | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)
**Status**: Plan and API contract approved by owner 2026-09-25. D-003/D-004 approved; D-007 revised to local development without new paid services with self-hosted staging deferred until a server exists and deployment is approved (Phase 002 ends with a local smoke check); D-008 synthetic-only data and D-009 session/abuse limits approved on 2026-09-25. Future staging server/mail transport, retention/real-data policy, and performance limits still block affected later-phase work and any deployment.

## Summary and Technical Context

Create the first integrated vertical slice with Django 5.2 LTS/compatible DRF, PostgreSQL, React 19/strict TypeScript/Vite, same-origin sessions, and a reviewed accessible design system. Phase 001 tokens and logo are candidates under D-010: revisit both and obtain owner approval in 002:T025 before branding the React UI. Local development is fully dockerized (owner-approved 2026-09-25): `python:3.12` backend, Node LTS frontend, PostgreSQL container — Python 3.12 replaces the proposed 3.13 baseline for this toolchain; nothing is installed on the host beyond Docker.

Use Django's custom auth model before the first migration, groups for business roles, explicit services/selectors/serializers, drf-spectacular OpenAPI, generated frontend types, TanStack Query, React Router, and form validation. Package choices and their versions need compatibility/security review. Use vetted recovery/abuse-protection components rather than custom cryptography. D-008 defers privileged MFA beyond Phase 002; do not add an unapproved MFA dependency or collect real employee data. Later real-data use requires an approved, tested MFA implementation and privacy/retention gates.

## Constitution Check

I: role scope mapped; II: every read/create/action surface scoped; III-IV: PostgreSQL negative/concurrency tests first; VI: no real credentials/PII in fixtures; VII: shared accessible shell; VIII: bounded contracts; IX: early CI/staging; X: approval gates unresolved. No security principle is waived. Human checklist approval remains outstanding.

## Project Structure

`backend/config/`; `backend/apps/accounts/`; `backend/apps/organizations/`; `backend/apps/audit/`; `backend/apps/notifications/`; `frontend/src/app/`; `frontend/src/features/auth/`; `frontend/src/features/employees/`; `frontend/src/features/settings/`; `frontend/src/api/`; `tests/e2e/`; later `.github/workflows/ci.yml` and `deployment/` application delivery configuration.

## Execution Design

1. Pin runtimes/dependencies and establish settings/tests/CI; test against PostgreSQL from the start.
2. Create custom User and organization/directory migrations; use protected FK relationships and normalized email policy. Resolve circular organization/fallback-reviewer migration references explicitly.
3. Implement session endpoints with explicit CSRF protection on anonymous login as well as authenticated mutations. Generic recovery responses; bounded token/session lifetimes and login limits are D-009 decisions.
4. Implement organization/role/ownership policy and scoped related-field querysets. Never expose `is_staff`, `is_superuser`, arbitrary permissions, or client-assigned organization.
5. Serialize reporting/role changes using an organization lock, then employee locks in stable UUID order, then affected workflow records. Domain review services use compatible employee-before-target lock order and recheck eligibility. New domain integrations must participate in reassignment before release.
6. Add audit append and recipient-scoped notification foundation; no domain workflow is hidden in signals. Define a safe target type/ID, not arbitrary URLs supplied by users.
7. Before finalizing branded auth/profile/directory/settings UI, complete 002:T025: revisit logo and colors with the owner, record approval and verify contrast/EN-AR variants. Candidate assets are not final. Implement typed API client; clear caches on logout/account change; never store auth tokens in localStorage.
8. Establish CI checks and a local production-like smoke flow; remote self-hosted staging is deferred until a server exists and deployment is approved (D-007).

## Contracts, Failure Handling, and Security

[contracts/api.md](contracts/api.md) defines the provisional interface. DRF session failures need stable `authentication_required` versus `csrf_failed` codes; do not assume default 401. Return non-enumerating 404 for invisible resources. Invitation/recovery delivery failures are operationally observable and safely retryable; no passwords are returned to the browser or committed. Require approved and tested privileged MFA before any real employee use; Phase 002 is synthetic-only and defers MFA implementation under D-008 to a later real-data release gate (006:T015).

## Verification and Performance

Tests: PostgreSQL model/service/API checks, genuine CSRF checks, account-enumeration/replay/expiry cases, cross-role/team/org access, mass-assignment rejection, last-HR and concurrent manager cycle tests, frontend state/error tests, and Playwright role journeys. Query-count assertions prevent per-row employee/manager/department loads. Lists default 25/max 100; planned service p95 budget <400 ms under D-009 workload.

## Migrations and Rollout

Initial additive schema plus role data migrations without default credentials. Test fresh install and populated-database upgrade. No delete-user API; deactivate. Early deployment uses synthetic accounts only; production configuration/restore gates remain phase 007 responsibility. Incomplete provider approval is recorded, not replaced by a fake live URL.
