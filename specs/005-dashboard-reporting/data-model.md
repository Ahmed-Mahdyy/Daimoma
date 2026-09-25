# Read Models: Reporting and Notifications

No new workflow tables are planned. Reuse Notification from phase 002, requests from 003, and sheets/entries from 004.

| Projection | Fields | Invariants |
| --- | --- | --- |
| DashboardSummary | scope, from_date, to_date, timezone, generated_at, request counts by status/type, minutes by sheet status, pending review count | Scope before aggregation; current state only; integer minutes; no hidden-row counts |
| WorkingHoursRow | employee ID/name, current department/team label, work_date, sheet status, working_minutes | Active non-voided entries; APPROVED only when reporting approved hours; approved date/timezone interpretation |
| RequestSummaryRow | type, current status, date bucket, count | Count distinct current requests, not approval-step/history rows |
| ReportFilter | bounded date interval, permitted employee/type/status selectors, ordering, page/page_size | Invalid or out-of-scope selectors cannot broaden scope; row/range bounds approved under D-009 |
| NotificationDTO | id, kind, safe summary, target type/ID, created_at, read_at | Recipient-only; no secret/free-text payload; target access checked at use time |

Current department/team grouping is labeled; historical hierarchy reporting is excluded until separately modeled. Notification recipient/event-key uniqueness and allowed target types are inherited rather than duplicated. Add indexes only via reviewed additive migrations after measuring query plans. Caches, if later justified, must isolate identity/organization/scope and invalidate after transitions.
