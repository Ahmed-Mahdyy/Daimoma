# Feature Specification: Authentication, RBAC, and Employee Administration

**Feature**: 002-authentication-rbac
**Created**: 2026-09-20
**Status**: Draft; implementation gated by approved scope, account/security policy, and platform decisions.
**Source**: Brief sections 2, 4-6, 9-16; foundation design and master authorization/security sections.
**Scope**: Accounts, employee directory/reporting lines, organization settings, shared authorization/history/notifications, authenticated navigation, and executable delivery foundations.

## Clarifications

### Session 2026-09-25

- Q: For the first release, how should accounts be created and who should be able to see an employee’s draft requests and timesheets? → A: Option B — one organization per deployment; HR provisions accounts (no self-signup); each employee alone sees their drafts. Managers see non-draft work of their current direct reports; HR sees non-draft organization work. Managers and HR retain access to their own employee workspace (D-003 approved by owner 2026-09-25).
- Q: If an employee has no eligible manager to review submitted work—for example, the manager is inactive or would be reviewing their own work—what should happen? → A: HR is the responsible reviewer in that case; route to an eligible HR reviewer, never the submitter. If no eligible HR exists, block submission rather than leave unowned work (D-004 fallback decision, owner 2026-09-25).
- Q: When an eligible manager does approve a request, should HR also review it before it becomes final? → A: Option A — an additional HR stage is required only for request types explicitly configured to need it; otherwise manager approval is final. HR-as-manager fallback remains separate from this second stage (D-004 request-type routing decision, owner 2026-09-25).
- Q: If a request type requires HR review, but HR is already reviewing it instead of an unavailable manager, should that HR decision complete the review or should a different HR person review it again? → A: Option A — the eligible non-self HR fallback's single decision completes the request; no duplicate HR stage follows (D-004 fallback-stage decision, owner 2026-09-25).
- Q: If HR changes an employee’s manager while a request or timesheet is still waiting for the old manager’s review, who should own that pending review? → A: Option A — atomically reassign pending steps to the new eligible manager, or to eligible non-self HR if the new manager cannot review; revoke the former manager's access immediately and preserve completed decisions. A manager change that cannot leave pending work assigned to an eligible reviewer must be blocked with an actionable explanation (D-004 reassignment decision, owner 2026-09-25).

## User Scenarios & Testing

### User Story 1 - Secure personal access (Priority: P1)

As an employee I can accept an invitation, sign in/out, recover access, and maintain permitted profile fields.

**Independent Test**: Complete onboarding/login/profile/logout and invalid/expired/inactive-account cases without requests or timesheets being implemented.

**Acceptance Scenarios**:
1. Given an active invited account, when accepting a valid unused invitation and signing in, then personal navigation and permitted profile details appear.
2. Given invalid credentials or an inactive account, when signing in, then access is denied without disclosing unnecessary account information.
3. Given an expired/reused recovery token, when attempting recovery, then it fails safely; a valid recovery invalidates access according to approved session policy.
4. Given logout, when attempting another protected operation with the old session, then access fails and stale user data is cleared from the client.

### User Story 2 - HR manages employees and reporting lines (Priority: P1)

As HR I can provision/deactivate employees and maintain eligible roles, departments, and reporting lines without damaging history.

**Independent Test**: Build a synthetic two-team directory, change one reporting line, and verify protected relationships and access immediately.

**Acceptance Scenarios**:
1. Given HR scope in the single-organization deployment, when creating an employee, then an account/profile are created consistently and onboarding delivery is observable/retryable; self-signup is unavailable.
2. Given an employee or manager, when attempting role/manager/account-status changes, then unauthorized changes fail without modifying data.
3. Given a self-manager, reporting cycle, or foreign-organization relationship, when saving, then the invalid change is rejected.
4. Given an account with historical work, when deactivating, then history remains and the account loses access. Given a manager change with pending requests or timesheets, reassign those steps atomically to the new eligible manager or eligible non-self HR; revoke former-manager access while preserving completed decisions. Reject the change if no eligible reviewer remains.
5. Given the last eligible HR administrator, when trying to remove its privileges, then the operation is blocked under the approved policy.

### User Story 3 - Predictable scoped workspace (Priority: P2)

As any role I see only permitted navigation and information, with consistent session, error, and notification behavior.

**Independent Test**: Compare Employee/Manager/HR sessions across two teams and a second-organization negative fixture, including direct resource access.

**Acceptance Scenarios**:
1. Given a manager, when requesting another team's records, any employee's drafts (except their own), or out-of-scope directory choices, then no out-of-scope detail or count is disclosed. HR likewise cannot view another employee's drafts; HR may view non-draft organization work.
2. Given a role/reporting-line change, when making the next request, then current eligibility applies rather than stale login-time permissions. If the assigned manager is ineligible at submission, an eligible non-self HR reviewer becomes responsible; submission is blocked if none exists.
3. Given failed or slow requests, when using the shell/profile/directory, then safe error/loading/empty/validation/disabled/success behavior is provided.
4. Given a security-relevant administrative action, when inspecting authorized history, then actor, target, action, and time are available without secrets.

### Edge Cases

Email casing/duplicates, concurrent role or manager changes, failed invitation delivery, expired/used links, inactive fallback reviewer, cross-organization references, missing profile, expired session during editing, malicious protected fields, invalid CSRF, brute-force attempts, and manager/HR users' own employee capability.

## Requirements

### Functional Requirements

- **FR-001**: Provide secure invitation/sign-in/sign-out/recovery and account deactivation behavior; reject invalid/expired/replayed access and apply approved session/abuse limits.
- **FR-002**: Enforce Employee/Manager/HR roles and organization/ownership/direct-team boundaries on every information and mutation surface in a single-organization deployment. Draft requests and timesheets are visible only to their owner; managers may view non-drafts of current direct reports and HR may view non-drafts across the organization. Manager and HR retain their own Employee capability. No self-approval or implicit superuser rights.
- **FR-003**: Allow users to view and edit only approved ordinary profile fields; HR-controlled roles/reporting lines/status remain protected.
- **FR-004**: Allow HR to provision and deactivate employees, assign departments/managers/business roles, and manage approved organization settings without deleting history; no public or employee self-signup.
- **FR-005**: Reject reporting cycles, self-manager relationships, ineligible reviewers, last-HR removal, and cross-organization references; serialize conflicting administrative changes. Where the ordinary manager is ineligible or missing at submission, assign an eligible non-self HR reviewer responsible for the item; if none exists, block submission. After an eligible manager approves a request, only types explicitly configured to require HR proceed to a second HR stage; otherwise manager approval is final. If the first-stage reviewer is an eligible HR fallback, that single HR decision is final even for an HR-required type; do not create a duplicate HR stage. On a reporting-line change, atomically reassign outstanding manager steps to the new eligible manager or eligible non-self HR fallback, revoke old-manager access, and preserve completed history; reject the administrative change if no eligible reviewer can own every pending step.
- **FR-006**: Record significant administrative/security actions in restricted non-editable history without credentials or sensitive free-text payloads.
- **FR-007**: Establish recipient-only durable notification records and safe target access; deduplicate events and separate transient feedback from history.
- **FR-008**: Provide the approved responsive authenticated shell, account/profile/directory/settings forms, accessible states, and safe session-expiry recovery.
- **FR-009**: Provide bounded search/filter/sort/pagination for permitted directory information with explicit editable fields and safe error messages.
- **FR-010**: Ensure every critical account, scope, CSRF, session, abuse, and administrative boundary has automated happy-path and negative tests.
- **FR-011**: Establish reproducible application/runtime configuration, versioned schema evolution, documented interface contracts, and automated verification before domain implementation.
- **FR-012**: Prove an early staging access flow once hosting is approved; privileged real-data use requires tested MFA and reviewed operational settings.

### Key Entities

Organization, department, account, employee profile, business role, audit event, and notification. The employee-facing product does not grant database or superuser administration.

## Success Criteria

- **SC-001**: All specified role/ownership/organization negative scenarios, including manager/HR access to others' drafts and self-signup, are denied without data changes or information leakage.
- **SC-002**: Onboarding, sign-in, profile, recovery, and deactivation each have passing positive and failure scenarios.
- **SC-003**: Administrative history identifies every tested significant role/reporting-line/status change while excluding secrets.
- **SC-004**: An operator can reproduce the foundation and verify the first deployed access flow from reviewed instructions.

## Assumptions and Approval Gates

Depends on 001 decisions. D-010 approves the prototype/interaction direction but defers final logo and color approval to 002:T025 during React implementation, before branded UI is finalized. D-003 account provisioning and role visibility were approved on 2026-09-25 as recorded above; the D-004 missing/ineligible-manager HR fallback was approved on 2026-09-25, while selected request types needing HR after manager were approved on 2026-09-25. An eligible HR fallback's single decision is final even for an HR-required type (owner-approved 2026-09-25). Pending-review reassignment after reporting-line changes was approved on 2026-09-25 (D-004). D-004 routing/reassignment is now approved as specified; which request types are configured HR-required remains a later request-type configuration decision. D-007 provider/email, D-008 real-data/MFA/retention and D-009 session/token/abuse limits remain proposed and unapproved. No real accounts, credentials, or application database exist in this scaffold. Automated tests are explicitly required.
