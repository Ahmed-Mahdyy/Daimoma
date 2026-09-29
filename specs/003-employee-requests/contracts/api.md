# Request API and UI Contract

Provisional; inherits shared transport/errors from phase 002. All paths are under `/api/v1/`; authenticated, organization-scoped, CSRF-protected mutations. Invisible IDs return 404; visible but prohibited actions 403; invalid content/reason 400; stale/duplicate transition 409.

| Endpoint | Writable input | Result and scope |
| --- | --- | --- |
| GET request-types/ | active/category filters | Scoped type choices; employees see active usable types |
| POST/PATCH request-types/{id}/ as applicable | Approved name/category/help/requires_hr/is_active; create uses collection | HR only; organization assigned server-side; no historical route change |
| GET requests/ | search, status, type, employee, date range, ordering, page/page_size | Scoped `{count,next,previous,results}`; employee filter cannot widen authorization |
| POST requests/ | type_id, title, description, approved category fields | Own DRAFT; server owner/org/cycle/status/version |
| GET/PATCH requests/{id}/ | PATCH allowlisted content plus expected_version | Own draft/returned only; detail includes safe reviewer/status/activity |
| ~~POST requests/{id}/attachments/~~ | — | **Deferred per D-006 (2026-09-29):** no attachment endpoints exist in Phase 003 |
| POST requests/{id}/submit/ | expected_version | Atomic validation/snapshot/cycle/steps/event/notification; read-only pending state |
| POST requests/{id}/approve/ | expected_version | Current non-self eligible reviewer and required stage; next stage or final approved |
| POST requests/{id}/reject/ | expected_version, reason | Final rejection; reason required |
| POST requests/{id}/return/ | expected_version, reason | Returned editable work; preserve reviewed cycle |
| GET requests/{id}/history/ | None | Scoped immutable `{events, steps}` timeline; no credential/security-log payload |

Request fields explicitly exclude employee_id, organization_id, status, cycle, approval route, reviewer IDs, and decision timestamps from ordinary writes. Date inputs are ISO dates; unknown/irrelevant category fields rejected. No file handling exists in Phase 003 per D-006; if attachments are approved later they are a separately specified contract, never silently added.

## State contract

Approval in PENDING_MANAGER may finalize only manager-only routes. HR-required routes advance to PENDING_HR. Return/reject permitted only at the current pending step. Resubmit from RETURNED starts all required steps again. Self-approval fails even for HR. HR reassignment uses the approved administration service, not an unrestricted request field update.

## UI contract

List/filter/sort/pagination, type-dependent form, request detail/timeline, review queue, reason dialogs, and HR type editor. Explain current reviewer and locked fields. Preserve recoverable draft input after validation/network failure. Refetch on 409; do not optimistically approve. Status changes invalidate detail/list/summary/notifications queries. All six states, mobile record cards, keyboard focus, and accessible reasons are required.

## Atomic and external effects

Transition, steps, event, and durable notification commit together. Scope is checked again at notification target/read time. Notification summaries omit sensitive free-text details.
