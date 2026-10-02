# Feature Specification: Release Hardening

**Feature**: 006-release-hardening
**Created**: 2026-09-20
**Status**: Approved policies recorded (T001); executed 2026-10-02; owner release acceptance pending.
**Source**: Brief sections 9-15, 19-24. This phase verifies earlier quality work; it does not postpone security/testing until the end.

## User Scenarios & Testing

### User Story 1 - Trust security and data integrity (Priority: P1)

An owner/reviewer can inspect reproducible proof that critical permissions, state transitions, files, and migrations behave as specified.

**Independent Test**: Run the approved security/integrity matrix against a production-like synthetic environment.

**Acceptance Scenarios**:
1. Given employees/managers/HR across two teams and isolated organizations, when testing every protected surface, then no unauthorized read/write/count/export/file access succeeds.
2. Given concurrent review/time/role changes, when stress-tested, then no conflicting decisions, overlap, privilege escalation, or lost history occurs.
3. Given a populated previous schema, when upgrading, then records and invariants survive without destructive reset.
4. Given a discovered defect, when corrected, then a regression test proves intended behavior rather than weakening the acceptance rule.

### User Story 2 - Use a responsive reliable product (Priority: P1)

Users can complete core flows at approved device sizes and workload, including degraded network and accessibility needs.

**Independent Test**: Complete cross-role real-API journeys on representative viewports, keyboard-only interaction, and the approved load profile.

**Acceptance Scenarios**:
1. Given mobile/desktop and keyboard use, when submitting/correcting/reviewing work, then controls, labels, focus, errors, and status are usable.
2. Given slow/failed requests or expired sessions, when interacting, then input/recovery behavior follows the approved contract without fabricated success.
3. Given documented data volume and concurrency, when measuring, then approved latency/error/query budgets are satisfied or a release-blocking finding is recorded.

### User Story 3 - Make an evidence-based release decision (Priority: P2)

The owner can see actual checks, unresolved defects, AI review, and requirement coverage before approving release.

**Independent Test**: Trace every mandatory requirement to its test/review result and resolve all release blockers.

**Acceptance Scenarios**:
1. Given missing/skipped/failed checks, when reviewing the release report, then they are explicit and never counted as passed.
2. Given generated code/design, when inspecting evidence, then tool use, human corrections, and verification are disclosed.
3. Given a critical/high security or correctness issue, when requesting release, then acceptance is blocked until corrected and verified.

### Edge Cases

False-positive scanner findings, dependency advisories, flaky/racy tests, unexecuted checks, environment drift, slow queries, request cancellation, stale sessions, private attachment failures, migration rollback incompatibility, accessibility regressions, and mock data mistaken for evidence.

## Requirements

### Functional Requirements

- **FR-001**: Verify the full authentication/ownership/team/org/CSRF/privilege/attachment/report/inbox security matrix using server behavior, not hidden controls.
- **FR-002**: Verify concurrency, exact time calculations, state/child locks, immutable history, and populated-database migration integrity.
- **FR-003**: Run automated critical domain/API/component/browser checks and manual responsive/accessibility/failure reviews against the real integrated application.
- **FR-004**: Measure approved performance/query/bundle budgets with documented data, hardware, concurrency, methodology, and unexpected-error classification.
- **FR-005**: Review dependencies/secrets/settings/privacy; remediate release-blocking findings without weakening security controls or faking results.
- **FR-006**: Track defects with severity, reproduction, affected requirements, correction, regression test, and reviewer outcome.
- **FR-007**: Maintain requirement-to-task-to-implementation-to-test/evidence and reviewed AI-use traceability; explicitly report unrun checks.
- **FR-008**: Block release on unresolved critical/high security or correctness defects, mandatory failed/unrun checks, or missing owner acceptance. Synthetic-only release must be labeled as such; any release using real employee data additionally requires approved and tested privileged MFA plus privacy/retention policies before use (D-008, 006:T015).

### Key Entities

Test execution evidence, defect record, performance measurement, traceability record, and release acceptance. These are development/review artifacts, not new application business tables.

## Success Criteria

- **SC-001**: Every mandatory workflow and permission scenario has actual passing evidence or a visible release blocker.
- **SC-002**: No unresolved critical/high security or correctness finding remains at acceptance.
- **SC-003**: Approved performance budgets are measured under the documented workload, not asserted from architecture alone.
- **SC-004**: A reviewer can trace all mandatory requirements and distinguish automated evidence, manual review, and unrun checks.

## Assumptions and Approval Gates

Requires integrated 002-005 and approved D-009 workload/limits before relevant acceptance. D-008 permits synthetic-only testing; privileged MFA was deferred beyond Phase 002. A synthetic-only release may be reviewed with an explicit no-real-data restriction, but real-data acceptance additionally requires approved privacy/retention policy and a vetted, implemented and tested MFA flow (T015). Staging delivery foundations from 002 are prerequisites for production-like checks; 007 final deployment follows this acceptance, avoiding circular dependency. Tests are mandatory.
