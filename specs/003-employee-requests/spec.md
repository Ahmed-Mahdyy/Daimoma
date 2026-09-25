# Feature Specification: Employee Requests and Approvals

**Feature**: 003-employee-requests
**Created**: 2026-09-20
**Status**: Draft; approval-routing, request-field, confidentiality, and attachment decisions pending.
**Source**: Brief sections 4-7, 9-15; phase 002 scope policy and shared services.
**Scope**: Internal requests, supporting files, controlled reviews, correction, history, notifications, and scoped discovery. No leave balances, payroll, arbitrary workflow builder, or cancellation policy is implied.

## User Scenarios & Testing

### User Story 1 - Draft and submit a request (Priority: P1)

As an employee I create a request of an available type, attach supporting information, and submit complete work to the right reviewer.

**Independent Test**: Create a request, correct validation errors, attach an accepted file, submit, and inspect locked fields/current status using a real account.

**Acceptance Scenarios**:
1. Given an active request type, when saving a valid draft, then I can reopen and edit my own draft without exposing it to another employee.
2. Given missing required fields, invalid dates, unavailable reviewer, or an unaccepted attachment, when submitting, then submission fails with an actionable reason and preserves draft input.
3. Given valid work and eligible routing, when submitting, then a review cycle is recorded, the request becomes read-only, and the reviewer receives durable notification.
4. Given someone else's request ID, when uploading/downloading supporting files, then access is denied without revealing private file contents.

### User Story 2 - Review and correct work (Priority: P1)

As a manager/HR reviewer I make one permitted decision and provide reasons for work that cannot be approved.

**Independent Test**: Exercise manager-only and manager-then-HR routes, return/resubmission, rejection, self-approval denial, and simultaneous review.

**Acceptance Scenarios**:
1. Given a manager-only route, when the eligible manager approves, then the request is final approved.
2. Given an HR-required route, when the manager approves, then the request awaits HR and is not final approved.
3. Given a return with reason, when the owner corrects and resubmits, then a new cycle starts and prior decisions/content remain inspectable.
4. Given duplicate or competing review actions, when processed concurrently, then only one valid transition and its corresponding notifications occur.
5. Given a reporting-line change, when an old manager tries to review, then obsolete access fails and the new eligible assignment is auditable.

### User Story 3 - Track and administer request operations (Priority: P2)

As an employee, manager, or HR user I find permitted requests, understand status/history, and manage request types only when authorized.

**Independent Test**: Search/filter/order/paginate across two teams, inspect activity/notifications, and change a request type without altering past decisions.

**Acceptance Scenarios**:
1. Given scoped records, when searching/filtering/sorting, then only permitted results and counts appear.
2. Given request-type configuration changes, when viewing previously submitted work, then its review route/history is unchanged.
3. Given notification delivery and a later role change, when following the notification, then current access is checked and no private content is leaked.

### Edge Cases

Inactive type during drafting, reviewer absence/deactivation, self-reviewing manager/HR, invalid date range, malicious file content/name, failed/unavailable scan, concurrent upload limit, duplicate submission, stale expected version, returned-file replacement, changed reporting line, slow/failed network, empty results, and confidentiality needs inconsistent with manager-first routing.

## Requirements

### Functional Requirements

- **FR-001**: Employees create/view/edit their own draft or returned requests with approved type-specific fields and server-assigned ownership.
- **FR-002**: Supporting files are private, bounded, validated, quarantined/scanned, and editable only while the parent is editable; unsafe/unscanned files cannot be downloaded.
- **FR-003**: Submission validates complete content, accepted files, and an eligible non-self reviewer; freezes content and records a route/content snapshot per cycle.
- **FR-004**: Only the current eligible reviewer may approve, reject, or return a pending step; HR-required work cannot skip HR; return/rejection require reasons.
- **FR-005**: Returned work supports correction/resubmission with a fresh cycle; final rejection/approval cannot be overwritten by ordinary edits.
- **FR-006**: Concurrent/duplicate/stale transitions cannot create conflicting decisions or duplicate notifications; reassignment preserves completed history and removes obsolete access.
- **FR-007**: Owners and authorized reviewers see clear current status, reviewer, reasons, and immutable activity history; submission/decision/return events produce persistent notifications.
- **FR-008**: Search, filters, sorting, pagination, related choices, counts, and files observe ownership/team/organization boundaries.
- **FR-009**: HR configures active request types and approved routing rules without reinterpreting historical submitted work.
- **FR-010**: Responsive request/editor/detail/review/type screens provide all applicable states, accessible interactions, and automated happy/edge/permission tests.

### Key Entities

Request type, employee request, supporting attachment, approval step/cycle, request event/content snapshot, and shared notification/audit event.

## Success Criteria

- **SC-001**: Both approved review routes reach their correct final states and every specified invalid transition fails without changing data.
- **SC-002**: All attachment and cross-team/organization negative cases expose zero unauthorized file bytes or record details.
- **SC-003**: Concurrent review/submission tests produce one valid recorded outcome per state/version.
- **SC-004**: An employee can identify current status, reviewer, and correction reason from the detail view on mobile and desktop.

## Assumptions and Approval Gates

Requires verified phase 002. D-004 routing/fallback/reassignment and D-006 fields/confidentiality/file policy must be approved before corresponding implementation. Default proposal is manager-first then optional HR, not confidential HR-only routing. If private HR services require a different visibility route, amend this spec and permission tests before accepting that information. Automated tests are mandatory.
