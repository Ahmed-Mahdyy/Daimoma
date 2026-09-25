# Employee Flows (Design)

Status: phase-001 deliverable (T008). Routes and policies are provisional under D-003/D-004/D-005; this defines the *designed* journeys, not implemented behavior.

## Request lifecycle

```
Home → My requests → [New request]
                          │
                  ┌───────▼────────┐
                  │ Draft editor   │── autosave draft ──► My requests (Draft)
                  │ type + fields  │── unsaved-warning on leave
                  └───────┬────────┘
                          │ Submit (validate → confirm)
                          ▼
                  Pending — manager stage
                  ├── RETURNED ──► banner + reason + editable fields ──► Resubmit ──► Pending (new cycle)
                  ├── REJECTED ──► terminal, reason shown, action: new request
                  └── APPROVED ──► success, timeline updated, notification
```

Key moments: submit button shows progress → disabled (no double-submit); confirmation names the reviewer; history timeline shows every transition with actor + time.

## Timesheet lifecycle

```
My time → Current week view (grid: days × entries) / paginated previous weeks
   │        └─ Open older week → read-only day totals + full transition history → current week
   │
   ├─ Add entry → start/end or duration (per D-005) → overlap check inline
   ├─ Draft autosaves; running weekly total updates
   └─ Submit week → confirm dialog → SUBMITTED (locked, banner explains)
        ├── RETURNED → reason shown, editable again, resubmit
        ├── REJECTED → read-only + reason
        └── APPROVED → read-only + approved badge; only HR may reopen (reason required, D-005)
```

## Failure and edge branches

- Network failure on submit → error banner, retry preserves input.
- Session expired → modal, re-auth, unsaved input restored after return.
- Concurrent edit conflict → stale-state notice + "refresh to see latest" (no silent overwrite).
- Zero records → empty state with primary action.
- Mobile 360px → single column; table rows become stacked cards; filter row collapses into a "Filters" disclosure button with badge count.
