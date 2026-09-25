# Implementation Plan: Timesheets

**Feature**: 004-timesheets | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)
**Status**: Provisional; D-004/D-005/D-009 approval required.

## Summary and Technical Context

Implement PostgreSQL-backed time records and explicit Django services with React/TypeScript week/review UI. Reuse phase 002 identity, notifications, audit, scoped selectors, OpenAPI, and form primitives. Do not implement payroll or elapsed-time calculations with float hours.

## Constitution Check

II authorization includes every child operation; III-IV mandatory accuracy/locking/race tests and migration safety; VI immutable history; VII accessible date/time interactions; VIII measured list/summary queries; X pending policies stay visible. No lock rule is weakened to accommodate a UI shortcut.

## Project Structure

`backend/apps/timesheets/`: models/migrations, time validation, services/selectors/serializers/views, tests. `frontend/src/features/timesheets/`: week editor, time-entry form, status/history, review queue/dialogs. `tests/e2e/timesheets.spec.ts`: real employee/reviewer journeys.

## Execution Design

1. Approve period start, IANA timezone, overnight split, future-time policy, reason/reopen rules, and interval limits.
2. Write exact UTC/local-time reference tests including spring-forward/fall-back and week boundaries. Reject nonexistent local instants; ambiguous local times require a selected offset. Minute precision makes integer-minute elapsed calculations deterministic.
3. Add unique employee/period sheet, time entries with end/break constraints, and immutable event snapshots. Derive totals from active intervals, not client arithmetic.
4. Lock employee/profile then sheet(s) in stable order for all entry creation/edit/void and submission/review/reopen. Overlap queries span all active employee intervals and exclude the current row on edits. Locking the same employee serializes cross-sheet writes even when ordinary check constraints cannot express that invariant.
5. Split overnight entries at approved local boundaries as one atomic operation; allocate breaks explicitly so splitting cannot subtract a break twice or invent its timing. If input cannot define allocation, require user confirmation of per-segment breaks before saving.
6. Validate editable parent and version for every child operation; server derives employee/organization/period and forbids reparenting. A draft removal is a recorded void, not an untracked hard delete.
7. Implement submit/review/return/reopen with snapshots/events/notifications in one transaction. Reporting-line reassignment uses compatible locks and current eligibility checks.
8. Build typed week/review/history UI; disable unavailable operations but rely on backend enforcement. Explain timezone, reasons, locks, and conflicts. Invalidate personal/team/report queries after transitions.

## Reports and History

Current approved hours filter Timesheet.status=APPROVED. Reopening removes current eligibility immediately; past approvals and submitted entry snapshots remain auditable. Historical snapshots are bounded by the approved period/entry limits and visible only under sheet scope. Do not overwrite old snapshots when editing returned work.

## Verification and Performance

PostgreSQL TransactionTestCase or equivalent separate-connection pytest concurrency tests, not a single rolled-back transaction that cannot prove races. Test concurrent edit/submit, cross-sheet overlaps, duplicate period creation, and reassignment/review. Query-count assertions on week/review lists; efficient database aggregate sums; scoped pagination. Benchmark D-009 dataset later in 006.

## Migration and Rollout

Additive models/indexes and invariant tests; no historical field-type changes/resets. Snapshot period timezone so organization settings cannot silently rewrite old weeks. A policy change affecting existing periods needs a separate approved migration. Deploy only after time-policy examples and all mandatory tests pass.
