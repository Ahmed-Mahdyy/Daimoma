# Data Model: Employee Requests

Status: provisional under D-004/D-006. UUID identifiers; timezone-aware timestamps; explicit organization/employee consistency checks. No schema has been applied.

| Model | Fields | Constraints/defaults |
| --- | --- | --- |
| RequestType | organization FK; code Char(40); name Char(120); category choice; help_text Text; requires_hr Boolean; is_active Boolean | Unique organization/code; categories leave/equipment/hr_service/work_from_home/general; booleans proposed false/true; settings versioned for new submissions |
| EmployeeRequest | organization FK; employee FK Profile; type FK; title Char(200); description Text; start_date/end_date nullable Date; equipment_item nullable Char(120); quantity nullable PositiveInteger; status choice; cycle PositiveInteger; version PositiveInteger; route_snapshot JSON; submitted_at nullable DateTime | Default DRAFT/cycle=0/version=1; required title; description bound proposed 5000 chars; date categories require ordered dates; equipment requires nonblank item and quantity>=1; unused category fields rejected; owner/scope/type history PROTECT |
| RequestAttachment | organization FK; request FK; uploader FK; storage_key Char(512); original_name Char(255); mime_type Char(100); size_bytes PositiveBigInteger; scan_status choice; available_at nullable DateTime | QUARANTINED default; ACCEPTED/REJECTED/FAILED outcomes; server-generated key; proposed 5 MB/file and 3 active/request; count/editability checked under parent lock |
| RequestApprovalStep | request FK; cycle PositiveInteger; sequence PositiveSmallInteger; reviewer nullable FK User; required_role choice; status choice; reason Text; decided_at nullable DateTime | Unique request/cycle/sequence; WAITING/PENDING/APPROVED/REJECTED/RETURNED; one current pending step; reason required return/reject; named manager or eligible HR assignment; no self reviewer |
| RequestEvent | request FK; actor FK; event_type Char(40); previous_state/new_state; cycle; version; reason Text; snapshot JSON; occurred_at | Unique request/version; immutable event; bounded allowlisted domain snapshot on submission retains submitted fields/attachment references and route; protected under request scope |

## State and revision rules

DRAFT -> PENDING_MANAGER; manager-only approval -> APPROVED; HR-required manager approval -> PENDING_HR -> APPROVED. Either pending stage may RETURN or REJECT. RETURNED allows owner edits; resubmit increments cycle, snapshots content, and recreates every required review step. Final states have no ordinary edit transition. No generic status/owner/reviewer PATCH. Every mutation advances version; events distinguish draft edits from transitions as needed without logging credentials.

## Relationships, concurrency, and history

Profile -> requests -> steps/events/attachments. Shared notifications reference an allowlisted target type and request ID with event-key deduplication. Lock profile then request for submission/review/reassignment; check reviewer eligibility after locking. HR administration acquires compatible locks. Prior cycles and submission snapshots are immutable. Files referenced by history are not automatically unlinked when work is returned; retention requires separate approval.

## Index and migration design

Index organization/employee/status/created_at for scoped lists and reviewer/status for pending steps; validate query plans. Additive schema only. HR request-type changes affect new cycles, never reinterpret existing route snapshots. Proposed field lengths/counts and confidentiality need D-006 acceptance before migrations are finalized.
