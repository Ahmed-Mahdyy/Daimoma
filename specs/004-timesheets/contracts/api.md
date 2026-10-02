# Timesheet API and UI Contract

Approved under D-005 (2026-10-02): daily submission, weekly two-stage review (manager then HR), whole-week return, HR-only reopening, HR-configured working window with flag-and-reason exceptions. Shared session/CSRF/error/pagination contract from phase 002. All paths under `/api/v1/`. Sheet/day/entry identifiers cannot widen user scope.

| Endpoint | Input | Result and permission |
| --- | --- | --- |
| GET timesheets/ | period/status/employee/ordering/page filters | Scoped sheets and authoritative integer-minute totals |
| POST timesheets/ | Approved period_start only | Server-owned COLLECTING sheet with timezone/bounds; duplicate period conflict |
| GET timesheets/{id}/ | None | Scoped period/status/cycle/version, per-day status, totals, and bounded entries grouped by day |
| POST timesheets/{id}/entries/ | work_date, start/end with explicit offsets, break_minutes, description, window_reason, expected_version | Own day in DRAFT/RETURNED while sheet editable; validate/split with explicit break allocation; out-of-window requires window_reason (sets window_flag); atomic entries/totals/version |
| PATCH timesheets/{id}/entries/{entry_id}/ | Approved time/break/description/window_reason fields, expected_version | Own editable day; cannot reparent or supply employee/org/totals/window_flag |
| POST timesheets/{id}/entries/{entry_id}/void/ | expected_version | Own editable day; recorded removal, no silent physical deletion |
| POST timesheets/{id}/days/{work_date}/submit/ | None | Own DRAFT day with at least one valid entry; locks the day's entries |
| POST timesheets/{id}/submit/ | expected_version | >=1 SUBMITTED day and no DRAFT day holding entries; eligible non-self manager reviewer; snapshot/notification; locks sheet and children → PENDING_MANAGER |
| POST timesheets/{id}/approve/ | expected_version | Current eligible non-self reviewer; manager stage advances to PENDING_HR, HR stage finalizes APPROVED |
| POST timesheets/{id}/reject/ | expected_version, reason | Current reviewer; final locked rejection |
| POST timesheets/{id}/return/ | expected_version, reason | Current reviewer; whole week returns — all its submitted days become editable |
| POST timesheets/{id}/reopen/ | expected_version, reason | Authorized HR only for APPROVED/REJECTED; retain past decisions |
| GET timesheets/{id}/history/ | None | Scoped immutable `{events, days, entries}` timeline |
| PATCH settings/organization/ | work_earliest_start, work_latest_end, work_max_daily_minutes (existing org-settings endpoint) | HR only; affects new/updated entries' window flags, not historical submissions |

No generic status/reviewer/owner updates or unrestricted bulk endpoints. Invalid interval/reason/nonempty prerequisite is 400; out-of-scope 404; unauthorized operation 403; stale/conflicting transition 409. All mutations including entry creation and void recheck parent state under shared locking (employee profile before sheet/day). API types identify readonly totals/cycle/reviewer/period fields.

## Time representation

Dates use ISO local dates in the sheet timezone; datetimes carry explicit UTC offsets. Organization timezone/week policy and working window are snapshotted at sheet creation. API never infers an ambiguous DST offset. Midnight splits and per-segment breaks must be reviewed/confirmed by the user before saving; duration-only input is not part of this release.

## Working window

`work_earliest_start`/`work_latest_end`/`work_max_daily_minutes` come from organization settings. An entry starting before earliest or ending after latest, or pushing a day past max daily minutes, sets `window_flag` and requires `window_reason`. Flag and reason are visible to reviewers; unset/null window fields mean that bound is unrestricted.

## UI contract

Week navigator, per-day entry rows/mobile cards with submit-day action, accessible time/break forms, daily/week minutes formatted as hours/minutes, out-of-window flag/reason input, explicit timezone label, submit validation summary, locked states, review queue/dialogs, correction reason, and immutable activity timeline. Do not optimistically approve/reopen. Preserve recoverable draft input after errors; 409 requires reload/reconciliation. Reopening invalidates current approved summaries and shows prior approval as history, not current status.
