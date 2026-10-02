# Data Model: Timesheets

Status: provisional under D-004/D-005. D-005 approved 2026-10-02: daily submission units, weekly two-stage review, working-window policy fields. UUIDs, protected historical FKs, explicit organization/employee invariants, timezone-aware timestamps.

| Model | Fields | Constraints/defaults |
| --- | --- | --- |
| Timesheet | organization FK; employee FK Profile; period_start/end Date; timezone Char(64); status choice (COLLECTING/PENDING_MANAGER/PENDING_HR/APPROVED/RETURNED/REJECTED); cycle PositiveInteger; version PositiveInteger; submitted_at nullable DateTime | Unique employee/period_start; server-derived approved weekly bounds; timezone snapshot; COLLECTING/cycle=0/version=1 defaults; no ordinary employee/org/period/status writes |
| WorkDay | organization FK; employee FK Profile; timesheet FK; work_date Date; status choice (DRAFT/SUBMITTED/RETURNED/APPROVED); submitted_at nullable DateTime; version PositiveInteger | Unique employee/work_date; belongs to exactly one weekly sheet; submitting locks its entries; RETURNED unlocks under a returned week; APPROVED set by sheet decision |
| TimeEntry | organization FK; employee FK Profile; workday FK; start_at/end_at DateTime; work_date Date; break_minutes Integer; duration_minutes Integer; description Char(1000); window_flag Boolean; window_reason Char(500); voided_at nullable DateTime | end>start; minute precision; break>=0 and break<elapsed; duration>0 and server-calculated; break default0; voided_at default null; employee/org/day consistent with parent; no reparenting; window_flag requires window_reason |
| TimesheetEvent | sheet FK; actor FK; event_type Char(40); previous_state/new_state; cycle; version; reason Text; snapshot JSON; occurred_at DateTime | Unique sheet/version; immutable allowlisted submitted interval/totals/timezone snapshot; reasons required return/reject/reopen; bounded snapshot under approved entry limits |
| (org settings extension) | work_earliest_start Time; work_latest_end Time; work_max_daily_minutes PositiveInteger | On Organization settings; nullable = unrestricted; additive migration |

## Calculation rules

Elapsed minutes derive from UTC instants, less approved unpaid break minutes. Local date/period membership derives from the sheet timezone snapshot, not browser timezone. Split overnight work at local midnight/period boundaries; require explicit per-segment break allocation where a total break cannot be allocated without guessing. Sum active (not voided) entry integer minutes. Never trust submitted client totals. Reject nonexistent local times; require offset disambiguation for repeated times.

## Database versus service invariants

Database: UUID/FK/unique/local end/break/duration constraints. Service: timezone/period derivation, same-org/profile relationship consistency, all-employee overlap exclusion, editable state, current reviewer, and future-time rules. Acquire profile then sheet locks consistently for all entry/transition operations; overlap tests use separate database connections. No bulk/admin write path may bypass invariants.

## State and history

WorkDay: DRAFT -> SUBMITTED (locks entries) -> RETURNED (week returned; editable) -> APPROVED (sheet final). Timesheet: COLLECTING -> PENDING_MANAGER -> PENDING_HR -> APPROVED | RETURNED | REJECTED (D-005: always two stages; HR fallback deciding the manager stage completes review per D-004). RETURNED -> resubmission with new cycle. HR-only reopen APPROVED/REJECTED -> RETURNED, reason required; reopen unlocks the whole week. Day submit requires nonempty valid entries; week submit requires at least one submitted day and no draft days holding entries. Child add/edit/void only while the containing day is DRAFT/RETURNED and the sheet is COLLECTING/RETURNED. Preserve submission snapshots and prior approval events. Current approved reports exclude reopened/non-approved sheets.

## Indexes and lifecycle

Unique employee/period_start; organization/status/period_start for scoped review; employee/start_at/end_at for overlap lookup; sheet/event timestamp. Confirm query plans. Initial schema additive; no destructive reset or retroactive timezone reinterpretation. Draft removal is a recorded void; retention/hard deletion needs separate approval.
