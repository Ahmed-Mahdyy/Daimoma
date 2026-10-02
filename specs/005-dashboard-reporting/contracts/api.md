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

Report dates are inclusive local work dates; time totals consider active entries whose sheets currently satisfy the selected status. **Approved 2026-10-02:** request reports filter by `submitted_at` and exclude drafts entirely; hour reports filter entries by local `work_date`; grouping uses **current** department/manager assignment (labeled "current" in output — not historical). Report date range is capped at 366 days. Empty results are valid; failed queries must not be represented as successful zeros.

**Approved 2026-10-02 export policy:** CSV only; maximum 10,000 rows per export — beyond that the request fails with a validation/limit error, never silent truncation. Neutralize dangerous spreadsheet prefixes including leading whitespace/control-character variants; quote cells and test realistic readers. No public object-storage export link or sensitive payload in logs.

**Approved 2026-10-02 notification limits:** unread badge polls every 60 seconds and pauses while the tab is hidden; inbox pages at 50; retention stays indefinite until a D-008 retention decision. Following a target always invokes its current authorization. Cache invalidation includes request/time transitions, reopen, admin changes, and logout. UI includes accessible cards/text equivalents, mobile reports, persistent filter URLs, clear period/timezone labels, and all applicable async states.
