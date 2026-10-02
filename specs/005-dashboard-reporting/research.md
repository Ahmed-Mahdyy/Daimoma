# Research and Decisions: Reporting

| Decision | Rationale | Alternative rejected |
| --- | --- | --- |
| Live scoped projections | Preserve one source of workflow truth | Independently editable summary tables |
| Current approved entries by local work_date | Partial-week reports must not count whole sheets incorrectly | Filtering only the sheet period_start |
| Shared selectors for screens/export | Prevent security and totals drift | Separate unrestricted export queries |
| Current hierarchy labels | Historical reporting lines were not modeled | Pretending current manager/department is historically accurate |
| Durable inbox plus modest visible-tab polling | Meets required notifications with low operational complexity | WebSockets and a new broker without a requirement |

D-003 scope, D-005 date semantics, and D-006 categories are approved. D-009 reporting limits approved 2026-10-02 (submitted-date basis, drafts excluded, current-team grouping, 366-day range, 10k-row CSV-only exports, 60s badge polling, 50/page inbox). Still pending: D-009 performance workload targets. Query plans and measured response times decide optimizations; no benchmark has run yet.
