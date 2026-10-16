# Daimoma — Entity-Relationship Overview (007:T012)

One `Organization` per deployment (D-003). Users authenticate by email and hold roles via Django groups (`HR`, `Manager`); every account has an `EmployeeProfile` carrying `employee_code`, `display_name`, department, and reporting-line `manager`.

```text
Organization 1───* Department ──*── EmployeeProfile ──1──1 User ──*── Group (roles)
                    ▲                   │                     │
                    └────── manager ────┘                     └──* EmailToken

EmployeeProfile ──1──* EmployeeRequest ──1──* RequestApprovalStep (manager → HR stages)
                        │  └──* RequestEvent (history, append-only)
RequestType  ────* EmployeeRequest        EmployeeRequest ──1──1 RequestAllocationCommitment
    │                                                        │
    └──1──* EmployeeAllocationGrant ──*── AllocationAdjustment / AllocationGrantChange

EmployeeProfile ──1──* Timesheet ──1──* WorkDay ──1──* TimeEntry
                        │  └──* TimesheetEvent (history)
EmployeeProfile ──1──1 OpenCheckIn (punch widget)

User ──1──* Notification          AuditEvent (org-scoped, append-only)
```

## Integrity invariants

- Requests: `type`/`employee`/organization are PROTECTed; version counter guards concurrent edits; submissions snapshot route + content.
- Allocations: no overlapping active grants per (employee, type); adjustments are a signed delta ledger; removal (`voided`) preserves history and is blocked while reserved+used > 0.
- Timesheets: one sheet per (employee, weekly period); entries validated against org working window; two-stage review (manager → HR); HR-only reopen with reason.
- Audit/notifications are append-only; notification `event_key` deduplicates.

Migrations live per app under `backend/apps/*/migrations/` and are verified populated-fixture migrations in `backend/tests/test_migrations.py`.
