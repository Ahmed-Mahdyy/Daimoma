# Research and Decisions: Reporting

| Decision | Rationale | Alternative rejected |
| --- | --- | --- |
| Live scoped projections | Preserve one source of workflow truth | Independently editable summary tables |
| Current approved entries by local work_date | Partial-week reports must not count whole sheets incorrectly | Filtering only the sheet period_start |
| Shared selectors for screens/export | Prevent security and totals drift | Separate unrestricted export queries |
| Current hierarchy labels | Historical reporting lines were not modeled | Pretending current manager/department is historically accurate |
| Durable inbox plus modest visible-tab polling | Meets required notifications with low operational complexity | WebSockets and a new broker without a requirement |

Pending D-003 scope, D-005 date semantics, D-006 confidential categories, D-009 range/row/polling limits and workload. Query plans and measured response times decide optimizations; no benchmark has run yet.
