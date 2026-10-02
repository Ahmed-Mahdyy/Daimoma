# Feature Specification: Dashboards, Reporting, and Notifications

**Feature**: 005-dashboard-reporting
**Created**: 2026-09-20
**Status**: Approved basis — D-009 reporting limits approved 2026-10-02 (owner): request reports use submitted date and exclude drafts; grouping by current team assignment; report range ≤ 366 days; CSV-only exports ≤ 10,000 rows; notification badge polls every 60s (paused when tab hidden); inbox 50/page; retention indefinite pending a D-008 retention decision; dashboard scopes per D-003.
**Source**: Brief sections 4-6, 9-12, 15; phase 002 scope and phase 003/004 events.

## User Scenarios & Testing

### User Story 1 - Understand relevant work (Priority: P1)

Employees understand their own requests/time; managers understand their current direct team; HR understands organization operations.

**Independent Test**: Compare known synthetic records with role-specific dashboard totals.

**Acceptance Scenarios**:
1. Given records across two teams, when a manager opens a dashboard, then only permitted direct-team records contribute to totals and review queues.
2. Given draft/submitted/approved/returned/rejected sheets, when viewing hours, then categories are explicit and only currently approved sheets contribute to approved hours.
3. Given an approved sheet reopened by HR, when summaries refresh, then current approved totals exclude it while historical decisions remain intact.
4. Given an empty or failed summary, when opening the dashboard, then a clear empty/error state replaces misleading zero or fabricated data.

### User Story 2 - Find and export permitted reports (Priority: P1)

Managers and HR can filter request/hour summaries and export bounded operational data.

**Independent Test**: Reconcile filtered reports and exports against the same authorized records.

**Acceptance Scenarios**:
1. Given date/team/employee/type/status filters, when reporting, then filter choices and results cannot expand the user's scope.
2. Given a date range crossing a week boundary, when reporting approved hours, then approved active entries are included by their local work dates under documented timezone semantics, not by the whole sheet's start date alone.
3. Given spreadsheet formula-like text, when exporting, then the exported cells cannot execute it as a formula.
4. Given an excessive range or result size, when exporting, then the request fails with a documented limit rather than exhausting server memory.

### User Story 3 - Follow durable notifications (Priority: P2)

A user can inspect notifications, mark them read, and follow only currently accessible targets.

**Independent Test**: Submit/review work, reload the browser, inspect unread count, and change target permissions.

**Acceptance Scenarios**:
1. Given a submission/approval/rejection/return event, when opening notifications after reload, then the recipient sees one durable safe summary.
2. Given an old notification for a now-inaccessible target, when following it, then current access is rechecked and no confidential target content is revealed.
3. Given repeated mark-read operations, when processed, then unread counts remain correct and another recipient's data remains untouched.

### Edge Cases

Empty reports, daylight-saving/local-date boundaries, current versus historical department assignment, long names, zero hours, changed reporting lines, stale cache after reopening/logout, duplicate events, notification target disappearance, export limits, CSV formula injection, network errors, and notification polling while a tab is hidden.

## Requirements

### Functional Requirements

- **FR-001**: Provide personal, current direct-team, and organization dashboards with clearly labeled scope, period, and status categories.
- **FR-002**: Reconcile hour/request summaries with authorized source records; distinguish current approval from historical approval and exclude voided entries.
- **FR-003**: Provide scoped search/filter/sort/pagination and bounded date-based request/hour reports with explicit timezone and grouping semantics.
- **FR-004**: Permit authorized managers/HR to export bounded reports without unauthorized rows, sensitive unnecessary fields, or executable spreadsheet formulas.
- **FR-005**: Provide persistent recipient-only notifications, unread count, idempotent mark-read, and safe current-authorized target navigation.
- **FR-006**: Reflect relevant transitions, reopening, reporting-line changes, and account changes without stale cross-user or cross-team cached data.
- **FR-007**: Provide responsive accessible dashboards, report filters/tables, and notification views with all applicable six async states.
- **FR-008**: Verify reconciliation, scope isolation, boundaries, export safety, cache behavior, bounded queries, and real cross-role browser flows with automated tests.

### Key Entities

Scoped dashboard/report projections, report filters/export rows, and phase 002 Notification. No separate stored source of workflow truth is introduced.

## Success Criteria

- **SC-001**: All tested dashboards/reports/exports reconcile exactly with authorized source records and integer-minute totals.
- **SC-002**: Cross-user/team/organization tests reveal no unauthorized rows, counts, options, notifications, or export bytes.
- **SC-003**: Reopening and account changes invalidate affected visible results; no prior user's cached data survives logout.
- **SC-004**: Approved D-009 report/summary limits and measured performance budgets are satisfied under documented load.

## Assumptions and Approval Gates

Requires verified 002-004. D-003 visibility, D-005 time semantics, D-006 confidentiality, D-009 report limits/grouping and performance need approval. Proposed reporting uses current team/department membership and explicitly labels that fact; historical organization charts are out of scope. Tests are mandatory.
