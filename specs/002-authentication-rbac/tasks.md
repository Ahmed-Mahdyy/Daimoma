# Tasks: Authentication and RBAC

**Status**: Not implemented. Tests mandatory. IDs are local to 002; preserve them when amending.

## Setup and Foundational

- [ ] T001 Resolve D-003/D-004/D-007/D-008/D-009 affecting this phase in `AGENTS.md`; approve `contracts/api.md` and reviewer gates (FR-001, FR-002, FR-012).
- [ ] T002 Pin compatible backend/frontend runtimes and dependencies in `backend/pyproject.toml`, lockfiles, and `frontend/package.json`; configure lint/type/test commands (FR-011).
- [ ] T003 Establish Django environment settings, PostgreSQL test setup, safe logging, and production checks in `backend/config/` and `backend/tests/conftest.py` (FR-006, FR-010, FR-011).
- [ ] T004 Create custom User before first auth migration, Organization/Department/Profile and constraints in `backend/apps/accounts/models.py` and `backend/apps/organizations/models.py`: normalized unique email, unique organization/employee-code, protected historical FKs, no self-manager/cycles; add migration tests (FR-004, FR-005, FR-011).
- [ ] T005 Define explicit scoped selectors/permissions and safe API error envelope in `backend/apps/accounts/permissions.py`, `selectors.py`, and `backend/config/exceptions.py` (FR-002, FR-009).
- [ ] T006 Add audit/notification foundation and constraints in `backend/apps/audit/models.py` and `backend/apps/notifications/models.py`: recipient/event-key uniqueness, safe target types, no ordinary event edits; add migrations (FR-006, FR-007).
- [ ] T007 Establish OpenAPI generation and typed frontend transport in `backend/config/urls.py` and `frontend/src/api/`; document CSRF/header/error contracts (FR-009, FR-011).

## US1 - Secure personal access

Goal: invited employee accesses only their own workspace. Independent test: onboarding/login/profile/recovery/logout, including failure and replay.

- [ ] T008 [US1] Write failing login/CSRF/expiry/replay/inactive/session/abuse-limit tests in `backend/apps/accounts/tests/test_auth.py` using enforce_csrf_checks for relevant clients (FR-001, FR-010).
- [ ] T009 [US1] Implement invitation, login/logout, recovery, session invalidation, and bounded delivery handling in `backend/apps/accounts/services.py` and `views.py` (FR-001).
- [ ] T010 [US1] Write profile mass-assignment and protected-field tests in `backend/apps/accounts/tests/test_profile.py`; implement explicit read/write serializers (FR-003, FR-010).
- [ ] T011 [US1] Write form/expired-session/cache-clear tests in `frontend/src/features/auth/` before building login/invitation/recovery/profile screens there (FR-001, FR-003, FR-008).
- [ ] T012 [US1] Implement typed credentialed transport/CSRF integration and account-change cache clearing in `frontend/src/api/client.ts` and `frontend/src/app/providers.tsx` (FR-001, FR-008).

## US2 - Employee administration

Goal: HR manages directory and reporting lines without privilege/data corruption. Independent test: two teams, role change, invalid relationships, deactivation.

- [ ] T013 [US2] Write failing role/team/org/last-HR/cycle/concurrent-assignment tests in `backend/apps/organizations/tests/test_administration.py` (FR-002, FR-004, FR-005, FR-010).
- [ ] T014 [US2] Implement provision/deactivate/role/reporting-line/settings services and safe serializer allowlists in `backend/apps/organizations/`; add atomic audit and domain-reassignment extension points (FR-004, FR-005, FR-006).
- [ ] T015 [US2] Implement scoped directory/related choices and bounded filters/ordering in `backend/apps/organizations/selectors.py` and `views.py`; test query counts (FR-002, FR-009).
- [ ] T016 [US2] Build tested directory/detail/invitation/role/manager/settings UI in `frontend/src/features/employees/` and `frontend/src/features/settings/` with confirmation and accessible errors (FR-004, FR-008, FR-009).

## US3 - Scoped workspace and shared foundations

Goal: role-aware shell and durable, safe supporting infrastructure. Independent test: direct URL/API attempts across roles and teams.

- [ ] T017 [US3] Write audit redaction/immutability and recipient-isolation/deduplication tests in `backend/apps/audit/tests/` and `backend/apps/notifications/tests/` (FR-006, FR-007, FR-010).
- [ ] T018 [US3] Implement explicit audit/notification creation and recipient selectors in `backend/apps/audit/services.py` and `backend/apps/notifications/services.py` (FR-006, FR-007).
- [ ] T019 [US3] Implement approved tokens/shared components and authenticated role navigation in `frontend/src/components/ui/` and `frontend/src/app/`, with keyboard/responsive/state tests (FR-008).
- [ ] T020 [US3] Add cross-role browser tests in `tests/e2e/auth-rbac.spec.ts` covering protected routes, empty/error states, and direct unauthorized requests (FR-002, FR-008, FR-010).

## Polish, Quality, and Early Staging

- [ ] T021 Configure lint/types/backend/component/build/schema-drift/secret/dependency checks in `.github/workflows/ci.yml` after repository hosting is approved (FR-010, FR-011).
- [ ] T022 Test fresh/populated migrations, query budgets, safe settings, and privilege boundaries; record actual results in `docs/evidence/002-foundation.md` (FR-005, FR-010, FR-011).
- [ ] T023 Specify and implement vetted privileged MFA before any real employee data in `backend/apps/accounts/` and corresponding frontend account security flow; retain synthetic-only gate until verified (FR-001, FR-012).
- [ ] T024 Deploy the approved synthetic staging access slice using `deployment/` only after human authorization; record real smoke results in `docs/evidence/002-staging.md` (FR-012).

## Deferred Phase 001 Brand Approval (D-010)

- [ ] T025 [US3] During React UI implementation, revisit the candidate logo in `assets/brand/` and palette in `assets/brand/tokens.json` with the owner; record explicit final logo/color approval (or revisions) in `docs/evidence/002-foundation.md`, verify contrast and EN/AR variants, then implement the approved tokens/assets in `frontend/src/`. Do not treat the Phase 001 SVGs/colors as final or mark this complete without the owner's decision (FR-008).

## Dependencies and Execution Strategy

T001 -> T002-T007 -> US1 -> US2 -> US3 -> quality/staging. T025 follows Phase 001 handoff and must be completed with explicit owner logo/palette approval before T011, T016 or T019 finalizes branded React UI; backend/auth policy work can proceed independently once its own approvals are satisfied. US2 depends on custom auth and shared permissions; US3 shell integration waits on authentication. Independent tests in different domains may be authored after contracts stabilize; no parallel writers/subagents are implicitly authorized. Foundation completion is required before request/time workflows. Open provider/MFA decisions cannot be hidden behind mocked success.
