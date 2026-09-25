# Manager & HR Flows (Design)

Status: phase-001 deliverable (T012). Provisional under D-003/D-004; defines designed journeys only.

## Manager review flow

```
Reviews (queue: direct-team non-draft requests + submitted timesheets)
   │  sorted by oldest pending; filters: type/employee/status
   ▼
Item detail ── context: requester, history timeline, related time entries
   ├── Approve → confirm → done (queue updates, notification simulated)
   ├── Return  → reason required → back to employee
   └── Reject  → reason required + "final" confirm → terminal
```

Manager also has personal Employee flows (My requests/My time) — nav keeps "My work" and "Team" areas visually separated. If the manager is the requester, the item shows "handled by another reviewer" (no self-decision controls).

## HR administration flow

```
HR nav: Employees | Reports | Request types | Settings | Audit (per D-003)
   │
   ├─ Employees → paginated directory → Add employee / Edit employee
   │     └─ Name, email, department, role, manager, account status → confirm + simulated feedback
   │        └─ Manager change → warning: pending reviews reassign atomically in production
   ├─ Request types → list → edit form (typed fields per D-006)
   ├─ Reports → scoped summaries → month/employee/request-status filters → status chart
   │     └─ Paginated detail table → export affordance (no file in prototype)
   └─ Settings → org timezone/week policy (per D-005), branding
```

## Distinctions designed into the nav

| Concept | Treatment |
| --- | --- |
| Personal vs review work | Separate nav groups; "My requests" ≠ "Reviews" |
| Scope boundaries | Team picker absent for managers; HR sees org scope label |
| Self-review | Never shown; explains routing instead |
| History | Timelines read-only everywhere; no edit affordance on events |
| Conflicts | Simulated stale-state notice teaches expected behavior |
