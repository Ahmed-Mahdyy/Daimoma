# Tasks: Authentication and RBAC

**Status**: Not implemented. Tests mandatory. IDs are local to 002; preserve them when amending.

## Setup and Foundational

- [x] T001 Resolve D-003/D-004/D-007/D-008/D-009 affecting this phase in `AGENTS.md`; approve `contracts/api.md` and reviewer gates — owner approved spec, plan, contract and reviewer checklist 2026-09-25 (FR-001, FR-002, FR-012).
- [x] T002 Pin compatible backend/frontend runtimes and dependencies in `backend/pyproject.toml`, lockfiles, and `frontend/package.json`; configure lint/type/test commands — dockerized: `python:3.12-slim`, `node:22-bookworm-slim`, `postgres:17`; ruff/eslint/typecheck/vitest/build verified in containers, npm audit clean (FR-011).
- [x] T003 Establish Django environment settings, PostgreSQL test setup, safe logging, and production checks in `backend/config/` and `backend/tests/conftest.py` — split settings (base/development/test/production), D-009 session/token env policy, console mail sink, `manage.py check`/`check --deploy` and pytest smoke pass in the backend container (FR-006, FR-010, FR-011).
- [x] T004 Create custom User before first auth migration, Organization/Department/Profile and constraints in `backend/apps/accounts/models.py` and `backend/apps/organizations/models.py`: normalized unique email, unique organization/employee-code, protected historical FKs, no self-manager/cycles; add migration tests (FR-004, FR-005, FR-011).
- [x] T005 Define explicit scoped selectors/permissions and safe API error envelope in `backend/apps/accounts/permissions.py`, `selectors.py`, and `backend/config/exceptions.py` — role helpers, IsHR/IsManagerOrHR/IsActiveAuthenticated, org-scoped `visible_profiles`/`get_visible_profile`, `{code, detail, field_errors?, request_id}` envelope with authentication_required/csrf_failed/permission_denied/validation_error/state_conflict/rate_limited/not_found codes (FR-002, FR-009).
- [x] T006 Add audit/notification foundation and constraints in `backend/apps/audit/models.py` and `backend/apps/notifications/models.py` — append-only AuditEvent (save/delete raise), Notification with recipient+event_key uniqueness and unread/read indexes; migrations applied (FR-006, FR-007).
- [x] T007 Establish OpenAPI generation and typed frontend transport in `backend/config/urls.py` and `frontend/src/api/` — `/api/v1/schema/` + docs, CSRF bootstrap endpoint live, `apiFetch` client with error-envelope/CSRF handling, `openapi-typescript` gen:types wired (FR-009, FR-011).

## US1 - Secure personal access

Goal: invited employee accesses only their own workspace. Independent test: onboarding/login/profile/recovery/logout, including failure and replay.

- [x] T008 [US1] Write failing login/CSRF/expiry/replay/inactive/session/abuse-limit tests in `backend/apps/accounts/tests/test_auth.py` using enforce_csrf_checks for relevant clients — include password-policy (12 chars, upper/lower/digit), password-change (current-password check, other-session invalidation), invitation re-issue invalidation, and concurrent-session cases (FR-001, FR-010).
- [x] T009 [US1] Implement invitation/re-issue, login/logout, recovery, password change, session invalidation, and bounded delivery handling in `backend/apps/accounts/services.py` and `views.py` (FR-001).
- [x] T010 [US1] Write profile mass-assignment and protected-field tests in `backend/apps/accounts/tests/test_profile.py`; implement explicit read/write serializers (display name, phone, language preference editable; all other fields rejected) (FR-003, FR-010).
- [x] T011 [US1] Write form/expired-session/cache-clear tests in `frontend/src/features/auth/` before building login/invitation/recovery/profile/password-change screens there (FR-001, FR-003, FR-008).
- [x] T012 [US1] Implement typed credentialed transport/CSRF integration and account-change cache clearing in `frontend/src/api/client.ts` and `frontend/src/app/providers.tsx` (FR-001, FR-008).

## US2 - Employee administration

Goal: HR manages directory and reporting lines without privilege/data corruption. Independent test: two teams, role change, invalid relationships, deactivation.

- [x] T013 [US2] Write failing role/team/org/last-HR/cycle/concurrent-assignment tests in `backend/apps/organizations/tests/test_administration.py` (FR-002, FR-004, FR-005, FR-010).
- [x] T014 [US2] Implement provision/deactivate/reactivate, invitation re-issue, role/reporting-line, department management (add/rename/deactivate, never delete), and settings services plus safe serializer allowlists in `backend/apps/organizations/`; add atomic audit and domain-reassignment extension points (FR-004, FR-005, FR-006).
- [x] T015 [US2] Implement scoped directory/related choices and bounded filters/ordering in `backend/apps/organizations/selectors.py` and `views.py`; test query counts (FR-002, FR-009).
- [x] T016 [US2] Build tested directory/detail/invitation/role/manager/settings UI — including department management, reactivation confirmation, and scoped audit-history views for HR and managers — in `frontend/src/features/employees/` and `frontend/src/features/settings/` with confirmation and accessible errors (FR-004, FR-006, FR-008, FR-009).

## US3 - Scoped workspace and shared foundations

Goal: role-aware shell and durable, safe supporting infrastructure. Independent test: direct URL/API attempts across roles and teams.

- [x] T017 [US3] Write audit redaction/immutability and recipient-isolation/deduplication tests in `backend/apps/audit/tests/` and `backend/apps/notifications/tests/` (FR-006, FR-007, FR-010).
- [x] T018 [US3] Implement explicit audit/notification creation, recipient selectors, and scoped read endpoints in `backend/apps/audit/services.py`, `backend/apps/audit/views.py`, and `backend/apps/notifications/` — audit reads are HR-organization-wide or manager-current-direct-reports; notification reads are recipient-only (FR-006, FR-007).
- [x] T019 [US3] Implement approved tokens/shared components, authenticated role navigation, and the notification bell/dropdown/list with unread count and mark-read in `frontend/src/components/ui/`, `frontend/src/app/`, and `frontend/src/features/notifications/` per the approved prototype behavior, with keyboard/responsive/state tests (FR-007, FR-008).
- [x] T020 [US3] Add cross-role browser tests in `tests/e2e/auth-rbac.spec.ts` covering protected routes, empty/error states, and direct unauthorized requests (FR-002, FR-008, FR-010).

## Polish, Quality, and Local Verification

- [x] T021 Configure lint/types/backend/component/build/schema-drift/secret/dependency checks in `.github/workflows/ci.yml` after repository hosting is approved (FR-010, FR-011).
- [x] T022 Test fresh/populated migrations, query budgets, safe settings, and privilege boundaries; record actual results in `docs/evidence/002-foundation.md` (FR-005, FR-010, FR-011).
- [x] T023 Record the owner-approved Phase 002 MFA deferral and enforce/document synthetic-only use in `docs/evidence/002-foundation.md`; do not build a placeholder MFA flow or accept real/de-identified employee data. Carry the real-data MFA gate to 006:T015 (FR-001, FR-012).
- [x] T024 Run a local production-like smoke check of the synthetic access slice (DEBUG off, session/security settings, migrations, invitation/recovery via the local mail sink); record real results in `docs/evidence/002-foundation.md`. Remote self-hosted staging via `deployment/` is deferred under D-007 until a server exists and deployment is explicitly authorized; do not claim a live staging flow (FR-012).

## Deferred Phase 001 Brand Approval (D-010)

- [x] T025 [US3] During React UI implementation, revisit the candidate logo in `assets/brand/` and palette in `assets/brand/tokens.json` with the owner; record explicit final logo/color approval (or revisions) in `docs/evidence/002-foundation.md`, verify contrast and EN/AR variants, then implement the approved tokens/assets in `frontend/src/`. Do not treat the Phase 001 SVGs/colors as final or mark this complete without the owner's decision (FR-008).

## Dependencies and Execution Strategy

T001 -> T002-T007 -> US1 -> US2 -> US3 -> quality/local verification. T025 follows Phase 001 handoff and must be completed with explicit owner logo/palette approval before T011, T016 or T019 finalizes branded React UI; backend/auth policy work can proceed independently once its own approvals are satisfied. US2 depends on custom auth and shared permissions; US3 shell integration waits on authentication. Independent tests in different domains may be authored after contracts stabilize; no parallel writers/subagents are implicitly authorized. Foundation completion is required before request/time workflows. Open provider/MFA decisions cannot be hidden behind mocked success.
