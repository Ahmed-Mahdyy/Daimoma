# Feature Specification: Timesheets and Review

**Feature**: 004-timesheets
**Created**: 2026-09-20
**Status**: Approved policy basis — D-005 approved 2026-10-02 (owner): employees submit each day independently; the weekly sheet is the review unit; always two-stage review (manager then HR); return unlocks the whole week; HR-only reopening; HR-configured working window (earliest start, latest end, max daily hours) with flag-and-reason for out-of-window entries.
**Source**: Brief sections 4-7, 9-15; phase 002 identity/scope and shared events.
**Scope**: Actual working intervals, daily submission (each day locks when submitted) within a weekly review sheet, manager-then-HR review, corrections, HR reopening, history, notifications, and an HR-configured working-hours window. No live clock, shifts, billing, or payroll calculation.

## User Scenarios & Testing

### User Story 1 - Record accurate personal working time (Priority: P1)

As an employee I enter start/end times and unpaid breaks, correct editable entries, and see understandable personal totals.

**Independent Test**: Build a synthetic week with multiple daily intervals, validate time/break rules and totals, then submit without request functionality being required.

**Acceptance Scenarios**:
1. Given a valid working interval, when saving it to an editable week, then working minutes and daily/week totals are accurate.
2. Given overlapping intervals or an invalid break/end, when saving, then the entry is rejected and previous values remain unchanged.
3. Given overnight work or a timezone boundary, when entering it, then approved splitting/timezone rules are explicit and no duration is silently guessed.
4. Given a mistaken draft entry, when removing it through the permitted workflow, then the editable view excludes it while preserving required history.

### User Story 2 - Submit and review locked work (Priority: P1)

As an employee I submit each day as it is completed and then submit the week for review; as the manager I approve, reject, or return the week, and HR then completes the second review stage.

**Independent Test**: Submit a week, attempt every entry mutation, return it, correct/resubmit, and approve through both manager and HR stages as different eligible users.

**Acceptance Scenarios**:
1. Given a valid week with at least one submitted day and no draft days holding entries, when submitting, then the sheet and all entries become read-only and submission history/notification are recorded.
2. Given submitted/decided work, when attempting add/edit/remove/reparent operations through any interface, then changes fail until an authorized transition unlocks the sheet.
3. Given returned work with a reason, when the owner corrects/resubmits, then a new cycle records the correction and preserves the prior submitted snapshot.
4. Given competing review/submission/edit operations, when processed concurrently, then exactly one valid state/version outcome is recorded without overlap or duplicate decisions.
5. Given a manager/HR's own sheet, when attempting self-approval, then approval is denied.

### User Story 3 - Correct exceptional decisions and understand history (Priority: P2)

As authorized HR I can reopen a decided sheet with a reason; as an owner/reviewer I can see correct status/history/totals afterward.

**Independent Test**: Reopen an approved sheet, verify historical approval retention and exclusion from currently approved totals, then complete a new review cycle.

**Acceptance Scenarios**:
1. Given approved/rejected work, when authorized HR reopens with a reason, then it becomes returned/editable while earlier decisions remain visible.
2. Given a reopened sheet, when viewing approved-hour summaries, then its current hours are excluded until approved again.
3. Given an ordinary employee or manager, when attempting reopening, then the operation fails without changing data.
4. Given a reporting-line change, when the old manager attempts review, then only the new current eligible assignment can act.

### Edge Cases

Zero entries, zero/negative duration, break equal to elapsed time, future completed work, minute precision, overnight/day/week split, DST nonexistent/ambiguous local times, duplicate period creation, overlaps across sheets, concurrent edits/submission, inactive/missing reviewer, changed organization time settings, stale UI, network retry, attempted parent reassignment, unsubmitted days with entries at week submit, out-of-window entries without a reason, and a sole-HR fallback completing the manager stage (no second HR stage per D-004).

## Requirements

### Functional Requirements

- **FR-001**: Employees maintain their own daily start/end/break entries in one weekly sheet per approved period, submit each day independently (locking it), and view integer-minute daily/week totals.
- **FR-002**: Validate actual time, break bounds, minute precision, future intervals, approved timezone/day/week semantics, and non-overlap across all active employee entries including concurrent writes. Entries outside the HR-configured working window (earliest start, latest end, max daily hours) are flagged and require an employee-supplied reason to save.
- **FR-003**: Daily submission requires valid nonempty day content; weekly submission requires at least one submitted day, no draft days holding entries, and an eligible non-self manager reviewer; weekly submission records a snapshot/cycle and locks the sheet and all child mutations.
- **FR-004**: Every submitted week requires two stages: the eligible manager reviews first, then an eligible non-self HR reviewer. Only the current stage's eligible reviewer can approve, reject, or return; return/reject require reasons; decisions cannot be ordinary field edits. Return unlocks the whole week's days; reject locks the week terminally unless reopened.
- **FR-005**: Returned work supports correction and resubmission while preserving previous submitted content/decisions; rejected work stays locked unless explicitly reopened.
- **FR-006**: Authorized HR alone may reopen approved/rejected sheets with a reason; historical approvals remain but current approved totals exclude reopened work.
- **FR-007**: Conflicting edits/submission/review and reporting-line changes preserve one valid outcome, current eligibility, history, and deduplicated notifications.
- **FR-008**: Owners and scoped reviewers can inspect status, review reasons, period/timezone, working totals, and activity history, with submission/decision/return notifications.
- **FR-009**: All sheet/entry/filter/count/related-choice surfaces apply organization, ownership, and direct-team restrictions.
- **FR-010**: Responsive week/editor/detail/review screens define six async states and accessible input/recovery; automated accuracy, race, happy-path, edge, permission, and migration tests are mandatory.

### Key Entities

Timesheet (weekly review unit), work day (daily submission unit), time entry, immutable submission/review event, employee/reviewer, shared notification, and the organization working-window configuration. Approved hours are a scoped projection of current approved sheet state, not an independently mutable total.

## Success Criteria

- **SC-001**: Every approved reference interval yields the expected exact working minutes and day/week totals.
- **SC-002**: All submitted-child mutation attempts and unauthorized review/reopen attempts fail without stored changes.
- **SC-003**: Concurrent writes never produce overlapping active intervals or conflicting review outcomes.
- **SC-004**: Return/resubmit/reopen scenarios preserve historical decisions and reconcile current approved summaries.

## Assumptions and Approval Gates

Requires phase 002 services, not phase 003 implementation. D-004 reviewer/fallback policy approved (an HR fallback decision at the manager stage completes review — no forced second HR stage when no manager exists). D-005 approved 2026-10-02: daily employee submission, weekly two-stage (manager→HR) review, whole-week return, HR-only reopening, working window (earliest start/latest end/max daily hours) with flag-and-reason exceptions. D-009 limits apply. Start/end mode satisfies the source's 'from/to times or hours'; duration-only input is deferred. Organization timezone/week changes affect new periods only after impact review. Automated tests are mandatory.
