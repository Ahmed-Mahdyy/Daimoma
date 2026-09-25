# Reporting and Inbox Contract

Provisional; inherits phase 002 session/CSRF/errors/pagination. Root `/api/v1/`. Current scope is server-derived; a requested employee/team cannot widen it.

| Endpoint | Input | Output/scope |
| --- | --- | --- |
| GET dashboards/personal/ | from/to dates | Own labeled request/time summaries |
| GET dashboards/team/ | from/to dates | Manager current direct team; exclude nonvisible drafts |
| GET dashboards/organization/ | from/to dates | HR organization summaries |
| GET reports/working-hours/ | approved bounded dates, employee/status/current department, ordering/page | Scoped paginated integer-minute rows and clearly defined totals; employee own, manager team, HR organization |
| GET reports/requests/ | dates/type/status/employee/ordering/page | Scoped request counts/rows; same scope as source request views |
| GET reports/working-hours/export/ | Same approved filters | Manager/HR bounded sanitized CSV; no unrestricted export mode |
| GET reports/requests/export/ | Same approved filters | Manager/HR bounded sanitized CSV |
| GET notifications/ | unread/kind/page | Recipient-only inbox with safe target references |
| GET notifications/unread-count/ | None | Recipient-only count |
| POST notifications/{id}/read/ | Empty body | Idempotent recipient-only read timestamp |

Report dates are inclusive local work dates; time totals consider active entries whose sheets currently satisfy the selected status. Request date filters use a documented created/submitted date basis, chosen during D-009 approval and named explicitly in the contract before coding. Current versus historical hierarchy grouping is not interchangeable. Empty results are valid; failed queries must not be represented as successful zeros.

Export limits fail safely with validation/limit feedback, never silently truncate without an explicit bounded-export policy. Neutralize dangerous spreadsheet prefixes including leading whitespace/control-character variants; quote cells and test realistic readers. No public object-storage export link or sensitive payload in logs.

Notification polling interval/range/row limits remain D-009 gates. Following a target always invokes its current authorization. Cache invalidation includes request/time transitions, reopen, admin changes, and logout. UI includes accessible cards/text equivalents, mobile reports, persistent filter URLs, clear period/timezone labels, and all applicable async states.
