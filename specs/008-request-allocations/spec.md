# Feature Specification: Request Allocations

**Feature**: 008-request-allocations | **Created**: 2026-10-04 | **Status**: Requirements-review checklist accepted by owner 2026-10-05; **design amended 2026-10-06 (owner): category model replaced by a visible allocation unit.** Implementation and release remain pending.
**Source**: Owner discussion 2026-10-04, 2026-10-05 and 2026-10-06; extends 003:FR-001/FR-003/FR-009 and 005:FR-001/FR-002. This feature explicitly supersedes the Phase 003 exclusion of leave balances *for this allocation capability only*; it does not authorize payroll or automatic leave accrual.

## Clarifications

### Session 2026-10-05

- Q: When HR removes an employee's allocation, should it be removed from active use while retaining the record, or permanently deleted? → A: Remove it from active use; retain its record and audit history for HR. Do not permanently delete it.
- Q: Should early-leave requests be at least 30 minutes with any whole-minute duration thereafter, or only multiples of 30 minutes? → A: The minimum *allocation charge* is 30 minutes; requests shorter than 30 minutes are allowed but charge 30, and longer requests round up to the next 15-minute block (e.g. 35 charges 45).

### Session 2026-10-06 — unit model redesign (owner)

- Q: Fixed request-type categories hard-code allocation behavior; how should types be configured? → A: **Remove the category concept.** Request types are free-named; HR picks a visible **allocation unit** per type — `none`, `unit` (whole-count quantity) or `hour`. The unit *is* the allocation switch (`requires_allocation` is derived from `unit != none`) and it controls which amount the employee enters. No hard-coded category calculations: employees enter the amount directly (a whole number of units, or hours in quarter-hour steps). Dates/times remain optional context on every type but must be coherent when provided.
- Q: The early-leave billing formula (30-minute minimum, 15-minute rounding) was tied to the category model — does it still apply? → A: **No.** Hour-unit requests charge the exact hours the employee entered (quarter-hour precision, stored as whole minutes). Grant balances, company workweek counting and per-category rules from the earlier design no longer drive charges.
- Q: What about the request-type `code`? → A: Remove it from the UI; the server auto-generates codes for database uniqueness.
- Q: Layout of grant creation? → A: "Add allocation" gets its own page (`/settings/allocations/new`), separate from the allocation list.
- Owner UI refinement 2026-10-06: show **Request types** and **Allocations** under the main **Requests** navigation group, not under Settings. Keep the current allocation route and HR-only authorization. Use layered, low-contrast branded backgrounds in both light and dark themes without compromising text and control contrast.
- All other accepted review items stand: no overlapping active grants, single-grant-per-request coverage (request's stated dates or org-local submission date), reserve→use→release lifecycle, versioned HR edits, scoped access, void-not-delete, additive migration remapping existing data (allocated leave → `unit`, early leave → `hour`, unallocated types → `none`; grant/commitment units remapped to `unit`/`hour`).

## User Scenarios & Testing

### User Story 1 - Configure and award allocations (Priority: P1)

As HR, I select measurable request types that need an allocation and assign employees a positive allowance for a defined inclusive date range. I can view allocations, edit permitted dates and amounts with an audit trail, and remove an unused allocation from active use without deleting its history.

**Independent Test**: Configure a measurable type, give an employee an allowance, inspect it as HR and employee, and confirm other roles cannot change it.

**Acceptance Scenarios**:
1. Given an HR-created or existing type, when HR sets its unit to Units or Hours and grants an employee a dated allowance, then the employee sees that allowance for that type and period; other types and employees are unchanged.
2. Given a type with unit `none`, when HR tries to create a grant for it, then the system refuses because the type is not measurable.
3. Given 10 awarded units, 4 used and 3 reserved, when HR tries to reduce the award below 7, then the adjustment is rejected without changing any balances; valid adjustments preserve actor, reason and history.
4. Given overlapping active grants for the same employee and request type, when HR tries to create the second grant, then the system rejects the overlap rather than making grant selection ambiguous.
5. Given an allocation with no reserved or used amount, when HR removes it with a reason, then it is excluded from new requests and the active employee dashboard, but remains in HR's historical list with its actor, time, reason and any released request-cycle history. Given any reserved or used amount, removal is blocked; request decisions or a permitted adjustment must be made through the normal workflow first.

### User Story 2 - Request against an allowance (Priority: P1)

As an employee, I can see how much a request will consume before submission and receive a clear explanation if I have no matching allowance or insufficient remaining capacity.

**Independent Test**: Submit a unit-counted and an hour-counted request with enough allocation, then try missing, exhausted, outside-period, and competing requests.

**Acceptance Scenarios**:
1. Given a `unit` type, when I enter a whole-number quantity, then that quantity consumes units; given an `hour` type, when I enter hours in quarter-hour steps, then those hours consume minutes from the grant.
2. Given dates on a request, when I submit, then the grant must cover the stated period; without dates, the organization's local submission date picks the grant.
3. Given a request that crosses two grants or is not wholly within one valid dated grant, when I submit, then submission is blocked; the system never silently splits a request across grants.
4. Given adequate unreserved balance, when I submit, then the amount is reserved atomically and the remainder decreases; a concurrent submission cannot overspend the same grant.
5. Given no eligible grant, a missing/nonpositive amount, or insufficient remaining balance, when I submit, then I receive an actionable error and the request remains editable without creating an approval decision or reservation.

### User Story 3 - Understand and settle balances (Priority: P1)

As an employee, I see my own granted, reserved, used and available amounts by request type and grant period on my personal dashboard; reviewers can decide normally without having to recalculate balances.

**Independent Test**: Observe the dashboard before submission, while pending, after approval, after return/rejection, and after grant expiry; verify another employee cannot see the data.

**Acceptance Scenarios**:
1. Given a pending request, when its final approval is recorded, then its amount moves from reserved to used without a second deduction from available.
2. Given a pending request, when it is returned or rejected, then its reservation is released once; a corrected/resubmitted request must pass a fresh allocation check.
3. Given a valid request submitted before grant expiry, when the grant expires while it remains pending, then its reservation stays valid until approval, return or rejection.
4. Given a personal dashboard, when viewing allocation cards, then each card names its type, unit, period, granted, reserved, used and remaining. No assigned grant is distinguishable from an exhausted grant; pending submissions are not described as approved usage.
5. Given another employee's, another organization's, or an unauthorized manager's allocation identifier, when I query lists, details, dashboard or options, then no unauthorized grant, amount or count is exposed.

### Edge Cases

Missing or nonpositive amount; amount entered for a `none` type; non-quarter-hour hours; leap day; organization time-zone boundary; grant expiry while review is pending; duplicate submit/decision; return and resubmit after expiry; type deactivated or unit change attempted after allocation use; grant edited during concurrent submission; employee transferred to another department; stale HR form; no grant; overlapping grants; exhausted grant; request crossing grant boundaries; zero/negative award; service timeout or error; Arabic/RTL and keyboard use.

## Requirements

### Functional Requirements

- **FR-001**: HR configures a visible **unit** per request type — `none`, `unit` or `hour` — independent of approval routing; `requires_allocation` is derived (`unit != none`), so it can never disagree with the unit. The type's `code` is auto-generated server-side and never shown in the UI. Changing a type's unit while grants or commitments exist is rejected.
- **FR-002**: HR can view organization-scoped dated allocation grants and create them with positive initial amounts. HR can edit a grant's inclusive dates with an auditable reason and version check, and edit its effective amount through an append-only, reasoned adjustment rather than replacing the initial award; actor and timestamp are retained. Employee, request type and unit are immutable. Active grants for the same employee/type must not overlap. Amount reductions below reserved plus used are blocked; date edits that leave any reserved or used commitment outside the new period are blocked, while released cycles remain in history without blocking a date edit. HR can remove a grant from active use (mark it void, not delete it) with an auditable reason only if no reserved or used amount exists; released cycles do not block removal. A voided grant is unavailable for new submissions, absent from active dashboard balances, and retained in scoped HR history. No ordinary API deletes grants, adjustments or commitments.
- **FR-003**: Employees enter the charged amount directly: a `unit` request requires a positive whole-number quantity; an `hour` request requires positive hours in quarter-hour steps (0.25, 0.5, ...), charged and stored as whole minutes. Dates and times remain optional context on every type but must be coherent when provided (dates paired and ordered, times paired and ordered). A `none` request rejects amount fields. The server is authoritative; the form shows the same estimate before submission.
- **FR-004**: A request needing allocation must fit within one grant for the employee/type; the grant must cover the request's stated date interval, or the organization's local submission date when no dates were given. Do not split across grants or allow a request with a zero or missing amount.
- **FR-005**: Submitting an allocation-required request must atomically check capacity and reserve the calculated amount alongside its existing cycle, approval route, event and notification. No grant or insufficient capacity blocks submission. Drafts do not reserve; manager/HR approval rules remain unchanged.
- **FR-006**: Final approval converts a reservation into used amount exactly once. Return or rejection releases it exactly once. A pending reservation stays valid if the grant expires after submission; a returned request's new cycle must qualify again. Completed cycle usage and the submission-time schedule/type/amount must remain auditable and must not be recalculated from later configuration changes.
- **FR-007**: Personal dashboards and employee-facing forms show only the employee's own grants, units, periods and granted/reserved/used/remaining values. HR can administer organization grants. Managers receive no other employee's allocation details by default. New APIs, choices, lists and aggregates must enforce scope before filtering and aggregation.
- **FR-008**: Existing requests, grants and type settings must migrate additively with no automatic grant creation, retroactive reservation, deletion or reinterpretation. Previously submitted requests remain under their original policy; enabling allocation applies to new submission cycles.
- **FR-009**: HR administration and employee balance UI must be accessible, responsive and bilingual EN/AR with RTL, clear missing/zero/error/loading/success states and current balance refreshed after relevant transitions or adjustments. Record lists use the existing table component.
- **FR-010**: Automated tests must cover positive/negative allocation calculations, permissions, concurrent submissions/admin edits, return/resubmission, approval/rejection, old data migration, dashboard reconciliation and bounded query/performance behavior.

### Key Entities

- **Request type unit**: HR's visible choice — `none`, `unit` or `hour` — that makes a type measurable, derives `requires_allocation`, and decides which amount the employee enters.
- **Employee allocation grant**: Dated allowance for one employee and one request type, with unit, awarded amount and auditable adjustment history. Hour-unit grants store whole minutes.
- **Request allocation commitment**: Submission-cycle record linking a request to one grant with its frozen amount, unit, policy and current reserved/used/released disposition.
- **Personal allocation summary**: A scoped projection of awards and current commitments, not an independent editable balance.

## Success Criteria

- **SC-001**: On a fixture containing `unit` and `hour` types, 100% of displayed amounts reconcile with grants and active commitments across draft, pending, approved, returned and rejected requests.
- **SC-002**: In two simultaneous requests competing for one remaining unit, at most one reserves it; remaining never goes below zero.
- **SC-003**: Cross-user/organization and unauthorized-manager tests expose zero grant rows, amounts or counts.
- **SC-004**: An employee can distinguish no allocation, reserved amount and available amount for each assigned type on a mobile and desktop personal dashboard in both supported languages.
- **SC-005**: Existing requests and type behavior are preserved after an additive migration; the approved workload and p95 quality gates in D-009 remain satisfied when measured rather than assumed.

## Decisions, Assumptions and Gates

**Owner choices, 2026-10-04**: measurable types configurable by HR; reserve on submit and release on return/rejection; dated grants, not annual auto-renewal; no cross-grant splitting; block reductions below used plus reserved; reservations persist when grant expires during pending review.

**Policy review, owner choices recorded 2026-10-04**: no overlapping active grant periods for the same employee/type (adjacent periods allowed); grant date changes are allowed only when no reserved or used commitment would fall outside the new period, while released history never blocks an edit; expired grants remain visible as labeled history while pending reservations stay reserved until decision; incompatible unit changes on types with grants or commitments are rejected.

**Unit-model redesign, owner 2026-10-06**: the fixed request-type categories and their hard-coded charge calculations are replaced by a visible per-type **unit** — `none`, `unit` (whole-count) or `hour` (quarter-hour precision, stored as whole minutes). Employees enter the charged amount directly. Grant coverage uses the request's stated dates, or the org-local submission date when none are given. The 2026-10-05 early-leave billing formula and company-workweek counting are superseded — `working_weekdays` is no longer consumed by allocation logic (the column is retained non-destructively). The request-type `code` is hidden from the UI and auto-generated server-side. Grant creation moved to a dedicated `/settings/allocations/new` page. Migration 0005 remaps existing data: allocated date types → `unit`, early leave → `hour`, unallocated types → `none`; grant/commitment unit values remap to `unit`/`hour`.

**Removal clarification, approved by owner 2026-10-05**: HR may view, edit permitted dates and amount, and remove an unused allocation from active use; removal retains the allocation and its audit history rather than permanently deleting it. Removal is blocked while an amount is reserved or used. Early-leave allocation is charged in whole minutes with a 30-minute minimum and 15-minute rounding (15 actual → 30 charged; 35 actual → 45 charged), with nonzero seconds rejected; HR may assign a dated 240-minute grant for one month without automatic renewal. Owner accepted all requirements-review checklist items on 2026-10-05; implementation evidence remains pending.

This extends the explicit Phase 003 leave-balance exclusion for this feature only. Payroll, leave accrual, holiday calendars, equipment inventory/stock, employee-specific schedules, split grants, negative balances, automatic grant renewal, unrestricted manager balance visibility, retroactive conversion of requests, and production data migration are out of scope. No real employee data is authorized under D-008. No code, migration, or deployment is approved by this planning artifact.
