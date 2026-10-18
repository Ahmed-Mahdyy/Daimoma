# Validation Guide: Authentication/RBAC

## Available now

`python3 .devin/scripts/specs.py check` validates artifacts only. Application commands below become runnable after phase 002 tasks create the runtime and scripts.

## Preconditions

Approved decisions, local supported Python/Node/PostgreSQL, locked dependencies, safe environment configuration, synthetic two-team and second-organization fixtures, and no real employee information. Use a client with CSRF enforcement for CSRF tests.

## Planned verification commands

From backend with its future environment active: `ruff check .`, `ruff format --check .`, `pytest apps/accounts apps/organizations apps/audit apps/notifications`, `python manage.py makemigrations --check --dry-run`. Run PostgreSQL-backed fresh/install/upgrade checks and production `check --deploy` against production settings, not development settings.

From frontend after scripts exist: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`. Run the auth/RBAC Playwright suite against the real API.

## Happy Path

HR provisions synthetic employee -> invitation acceptance -> login -> own profile edit -> password change -> logout. HR updates department/manager and sees safe audit history; audit is HR-only per the 2026-10-17 amendment. Manager sees only current direct team. Verify the local production-like smoke flow; remote self-hosted staging awaits a server and explicit deployment approval (D-007).

## Edge Cases

Invalid/expired/replayed tokens, duplicate email casing, inactive account, missing manager/profile, self/cyclic reporting, concurrent assignments, last-HR removal, failed email delivery, expired editing session, empty directory, network failures, and pagination limits.

## Permission Tests

Employee role escalation/protected-field injection; manager other-team access; cross-org ID/related choices; HR superuser injection; direct protected routes; CSRF missing/invalid token on login and mutations; recipient notification access; audit modification attempts. Check database values remain unchanged after rejected mutations.

## Evidence and gate

Store actual commands/environment/results plus manual viewport/keyboard findings under `docs/evidence/002-*`. Redact identities/tokens/passwords. No real-data release before tested privileged MFA and D-008 approval. No passing test or working staging URL is claimed by this scaffold.
