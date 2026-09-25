# Timesheet API and UI Contract

Provisional; shared session/CSRF/error/pagination contract from phase 002. All paths under `/api/v1/`. Sheet/entry identifiers cannot widen user scope.

| Endpoint | Input | Result and permission |
| --- | --- | --- |
| GET timesheets/ | period/status/employee/ordering/page filters | Scoped sheets and authoritative integer-minute totals |
| POST timesheets/ | Approved period_start only | Server-owned DRAFT with timezone/bounds; duplicate period conflict |
| GET timesheets/{id}/ | None | Scoped period/status/reviewer/version/totals and paginated or bounded entries |
| POST timesheets/{id}/entries/ | start/end with explicit offsets, break_minutes, description, expected_version | Own editable sheet; validate/split with explicit break allocation; atomic entries/totals/version |
| PATCH timesheets/{id}/entries/{entry_id}/ | Approved time/break/description fields, expected_version | Own editable parent; cannot reparent or supply employee/org/totals |
| POST timesheets/{id}/entries/{entry_id}/void/ | expected_version | Own editable parent; recorded removal, no silent physical deletion |
| POST timesheets/{id}/submit/ | expected_version | Nonempty valid sheet, eligible non-self reviewer, snapshot/notification; locks parent and children |
| POST timesheets/{id}/approve/ | expected_version | Current eligible non-self reviewer of SUBMITTED |
| POST timesheets/{id}/reject/ | expected_version, reason | Current reviewer; final locked rejection |
| POST timesheets/{id}/return/ | expected_version, reason | Current reviewer; owner may correct |
| POST timesheets/{id}/reopen/ | expected_version, reason | Authorized HR only for APPROVED/REJECTED; retain past decisions |
| GET timesheets/{id}/events/ | Pagination | Scoped immutable status/content history |

No generic status/reviewer/owner updates or unrestricted bulk endpoints. Invalid interval/reason/nonempty prerequisite is 400; out-of-scope 404; unauthorized operation 403; stale/conflicting transition 409. All mutations including entry creation and void recheck parent state under shared locking. API types identify readonly totals/cycle/reviewer/period fields.

## Time representation

Dates use ISO local dates in the sheet timezone; datetimes carry explicit UTC offsets. Organization timezone/week policy comes from D-005 and is snapshotted at period creation. API never infers an ambiguous DST offset. Midnight splits and per-segment breaks must be reviewed/confirmed by the user before saving; duration-only input is not part of this release.

## UI contract

Week navigator, daily interval rows/mobile cards, accessible time/break forms, daily/week minutes formatted as hours/minutes, explicit timezone label, submit validation summary, locked states, review queue/dialogs, correction reason, and immutable activity timeline. Do not optimistically approve/reopen. Preserve recoverable draft input after errors; 409 requires reload/reconciliation. Reopening invalidates current approved summaries and shows prior approval as history, not current status.
