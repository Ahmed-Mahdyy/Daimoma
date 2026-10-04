# Feature Specification: Request Allocations

**Feature**: 008-request-allocations | **Created**: 2026-10-04 | **Status**: Planning only; owner-approved choices recorded below; implementation and release not authorized.
**Source**: Owner discussion 2026-10-04; extends 003:FR-001/FR-003/FR-009 and 005:FR-001/FR-002. This feature explicitly supersedes the Phase 003 exclusion of leave balances *for this allocation capability only*; it does not authorize payroll or automatic leave accrual.

## User Scenarios & Testing

### User Story 1 - Configure and award allocations (Priority: P1)

As HR, I select measurable request types that need an allocation and award employees a positive allowance for a defined inclusive date range. I can inspect granted, reserved, used and remaining amounts and make audited adjustments without invalidating commitments.

**Independent Test**: Configure a measurable type, give an employee an allowance, inspect it as HR and employee, and confirm other roles cannot change it.

**Acceptance Scenarios**:
1. Given an HR-created or existing measurable type, when HR enables allocation and grants an employee a dated allowance, then the employee sees that allowance for that type and period; other types and employees are unchanged.
2. Given a general or HR-service type, when HR tries to enable allocation, then the system refuses because no automatic usage quantity exists.
3. Given 10 awarded units, 4 used and 3 reserved, when HR tries to reduce the award below 7, then the adjustment is rejected without changing any balances; valid adjustments preserve actor, reason and history.
4. Given overlapping grants for the same employee and request type, when HR tries to create the second grant, then the system rejects the overlap rather than making grant selection ambiguous.

### User Story 2 - Request against an allowance (Priority: P1)

As an employee, I can see how much a request will consume before submission and receive a clear explanation if I have no matching allowance or insufficient remaining capacity.

**Independent Test**: Submit a date-based, time-based and quantity-based request with enough allocation, then try missing, exhausted, outside-period, and competing requests.

**Acceptance Scenarios**:
1. Given a date-based type with allocation required, when I request a date range, then only company-scheduled working weekdays in that inclusive range consume days. Public/company holidays are not excluded; employees have no individual workday overrides.
2. Given an early-leave type with allocation required, when I submit a valid same-day time interval, then its duration consumes whole minutes. Given an equipment type, its quantity consumes item units and the grant is selected using the submission date.
3. Given a request that crosses two grants or is not wholly within one valid dated grant, when I submit, then submission is blocked; the system never silently splits a request across grants.
4. Given adequate unreserved balance, when I submit, then the amount is reserved atomically and the remainder decreases; a concurrent submission cannot overspend the same grant.
5. Given no eligible grant, a zero-day date request, or insufficient remaining balance, when I submit, then I receive an actionable error and the request remains editable without creating an approval decision or reservation.

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

Range starts/ends on a nonworking weekday; date range with no working weekdays; leap day; organization time-zone boundary; grant expiry while review is pending; duplicate submit/decision; return and resubmit after expiry; type deactivated or allocation setting changed; company working weekdays changed; grant edited during concurrent submission; employee transferred to another department; stale HR form; no grant; overlapping grants; exhausted grant; request crossing grant boundaries; zero/negative award; service timeout or error; Arabic/RTL and keyboard use.

## Requirements

### Functional Requirements

- **FR-001**: HR can configure `requires_allocation` independently of approval routing for date-range (leave/work-from-home), same-day timed (early-leave), and equipment categories only; existing types default to not requiring allocation. General and HR-service categories cannot require it.
- **FR-002**: HR can create dated positive allocation grants per employee and request type and inspect/adjust them with actor, timestamp, reason and immutable history. Grants for the same employee/type must not overlap; HR cannot reduce a grant below the sum already reserved and used, nor shorten it to invalidate a live reservation or recorded usage.
- **FR-003**: A single HR-configured company weekday schedule determines date-based use; count inclusive scheduled weekdays, without holiday exclusion or employee overrides. Timed use is exact positive whole minutes from the existing same-day interval; equipment use is positive integer quantity. The server is authoritative; show the same calculation in the form before submission.
- **FR-004**: A request needing allocation must fit within one grant for the employee/type; the full requested date interval must fit a date-based grant. For early leave, the request day must fit. For equipment, use the organization's local submission date to select a grant. Do not split across grants or allow a request with zero consuming days.
- **FR-005**: Submitting an allocation-required request must atomically check capacity and reserve the calculated amount alongside its existing cycle, approval route, event and notification. No grant or insufficient capacity blocks submission. Drafts do not reserve; manager/HR approval rules remain unchanged.
- **FR-006**: Final approval converts a reservation into used amount exactly once. Return or rejection releases it exactly once. A pending reservation stays valid if the grant expires after submission; a returned request's new cycle must qualify again. Completed cycle usage and the submission-time schedule/type/amount must remain auditable and must not be recalculated from later configuration changes.
- **FR-007**: Personal dashboards and employee-facing forms show only the employee's own grants, units, periods and granted/reserved/used/remaining values. HR can administer organization grants. Managers receive no other employee's allocation details by default. New APIs, choices, lists and aggregates must enforce scope before filtering and aggregation.
- **FR-008**: Existing requests, grants and type settings must migrate additively with no automatic grant creation, retroactive reservation, deletion or reinterpretation. Previously submitted requests remain under their original policy; enabling allocation applies to new submission cycles.
- **FR-009**: HR administration and employee balance UI must be accessible, responsive and bilingual EN/AR with RTL, clear missing/zero/error/loading/success states and current balance refreshed after relevant transitions or adjustments. Record lists use the existing table component.
- **FR-010**: Automated tests must cover positive/negative allocation calculations, permissions, concurrent submissions/admin edits, return/resubmission, approval/rejection, old data migration, dashboard reconciliation and bounded query/performance behavior.

### Key Entities

- **Company workweek**: Organization-wide set of working weekdays used for new date-based submissions; no holiday calendar or personal override.
- **Request type allocation setting**: HR's choice that makes a measurable type require an allowance at submission.
- **Employee allocation grant**: Dated allowance for one employee and one request type, with unit, awarded amount and auditable adjustment history.
- **Request allocation commitment**: Submission-cycle record linking a request to one grant with its frozen amount, unit, policy and current reserved/used/released disposition.
- **Personal allocation summary**: A scoped projection of awards and current commitments, not an independent editable balance.

## Success Criteria

- **SC-001**: On a fixture containing each measurable category and a company schedule, 100% of displayed amounts reconcile with grants and active commitments across draft, pending, approved, returned and rejected requests.
- **SC-002**: In two simultaneous requests competing for one remaining unit, at most one reserves it; remaining never goes below zero.
- **SC-003**: Cross-user/organization and unauthorized-manager tests expose zero grant rows, amounts or counts.
- **SC-004**: An employee can distinguish no allocation, reserved amount and available amount for each assigned type on a mobile and desktop personal dashboard in both supported languages.
- **SC-005**: Existing requests and type behavior are preserved after an additive migration; the approved workload and p95 quality gates in D-009 remain satisfied when measured rather than assumed.

## Decisions, Assumptions and Gates

**Owner choices, 2026-10-04**: measurable types configurable by HR; automatic category-based use; general/HR service unavailable; reserve on submit and release on return/rejection; dated grants, not annual auto-renewal; company-only scheduled weekdays; no automatic holiday exclusion; no cross-grant splitting; equipment grant chosen at submission; block reductions below used plus reserved; reservations persist when grant expires during pending review.

**Planning defaults requiring review before implementation**: no overlapping grant periods for the same employee/type; zero-working-day requests blocked when allocation is required; company schedule edits affect future submission cycles only; forbid date/amount changes that would invalidate prior/current commitments. Determine whether a grant may be shortened past a *released* historical cycle and how HR resolves an erroneous grant without deletion; preserve history regardless. All such rules must be ratified in a requirement review before code changes.

This extends the explicit Phase 003 leave-balance exclusion for this feature only. Payroll, leave accrual, holiday calendars, equipment inventory/stock, employee-specific schedules, split grants, negative balances, automatic grant renewal, unrestricted manager balance visibility, retroactive conversion of requests, and production data migration are out of scope. No real employee data is authorized under D-008. No code, migration, or deployment is approved by this planning artifact.
