# Research and Decisions: Timesheets

| Decision | Rationale | Rejected alternative |
| --- | --- | --- |
| Start/end plus break input | Satisfies brief's either/or input requirement without dual-mode inconsistencies | Simultaneously implementing interval and arbitrary decimal-hour modes |
| UTC instants, IANA period timezone snapshot, integer minutes | Handles DST and prevents float drift/history reinterpretation | Naive local timestamps and floating-point totals |
| One employee lock shared by mutations/submission | Prevents cross-sheet races not covered by row-local checks | Check-then-save without serialization |
| Explicit submitted-child locking and version checks | API cannot bypass frontend read-only controls | Disabling only the parent edit button |
| Event snapshots and HR reopening | Retains what was reviewed and corrects current reporting eligibility | Overwriting approved rows without history |

Pending D-005: week start/timezone, future interval policy, overnight splitting and break allocation, period limits, and reopening authority; D-004 fallback/reassignment; D-009 operating budgets. DST examples and PostgreSQL race tests must prove the design. Do not select an exclusion-constraint extension without checking host support; the proposed baseline uses explicit serialized service writes plus ordinary local constraints.
