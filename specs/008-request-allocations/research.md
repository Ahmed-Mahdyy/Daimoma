# Research: Request Allocations

**Status**: Planning decisions 2026-10-04; items labeled proposed still need owner review before implementation. Based on existing 003/005 artifacts and current code, not performance measurements.

## R-001: Source of truth and usage units

**Decision**: Dated employee/type grants with integer units (working days for leave and work-from-home; minutes for early leave; item count for equipment). Do not infer a number for general or HR-service types.
**Rationale**: Existing type categories already have range/time/quantity fields; neither a money balance nor a universal request-count rule was requested. Separating units prevents summing incompatible values.
**Alternatives considered**: Free-form quantities entered by employees (rejected by owner); HR-decided request amount (rejected by owner); company-wide pooled budget (not requested).

## R-002: Calendar and grant matching

**Decision**: HR-configured company weekday set, inclusive date count, no holiday deductions or per-employee schedule; use organization-local date at submission for equipment. One request uses exactly one dated grant; date requests' entire start/end interval must fit the grant, including nonworking dates at the edges.
**Rationale**: Approved owner choices; existing `week_start` is not a work schedule, and no holiday calendar exists. Full-interval matching prevents implicit cross-grant splitting.
**Alternatives considered**: Calendar days, employee schedules, split grants, approval-time equipment date (rejected by owner).
**Proposed validation**: Reject a zero-consuming date range when allocation is required; do not create a free request using a grant.

## R-003: Balance and historical integrity

**Decision**: Available = initial award + auditable adjustments - currently reserved - approved usage; use a submission-cycle commitment with frozen unit/amount/grant and policy snapshot. Drafts don't reserve; final approval moves reserved to used; return/rejection releases; pending remains reserved after grant expiry. Re-submission calculates afresh. No materialized dashboard balance to edit.
**Rationale**: Live reconciliation preserves historical decisions and prevents a second deduction at approval. Owner approved reserve-on-submit and pending-after-expiry policy.
**Alternatives considered**: Deduct only on approval (rejected); recompute prior usage using current type/schedule (would rewrite history); update a plain mutable remaining column without events (audit and race risk).

## R-004: Concurrency and grant administration

**Decision**: Serialize allocation mutations using a consistent transaction/lock order across grant creation/adjustment and request submission/decisions, starting with the employee profile, then grant, then request/steps where needed. Revalidate scope/version/status/capacity under lock and commit commitment/event/notification together. Use unique request+cycle commitment and database amount/date checks; no additional service/queue.
**Rationale**: Existing request services lock request rows, so their lock order needs deliberate integration to avoid deadlocks. Grant-level serialization prevents two requests spending the same remainder. Grant date changes must not invalidate live or historical commitments.
**Alternatives considered**: Browser-side balance checks, unprotected aggregate-then-save, Redis balance cache (all unsafe/unnecessary). Grant non-overlap enforcement via application transactions and tests; a database exclusion constraint would require a reviewed extension/index and is not assumed here.
**Proposed policy**: No overlapping grants for one employee/type, positive award, mandatory reason on adjustment. Category/unit changes on types with grants or commitments should be rejected rather than silently converted.

## R-005: Visibility and reporting semantics

**Decision**: Employee self and HR-organization only for grant details; manager role does not confer another person's balance. Add personal dashboard allowance projection and a separate paginated HR grant list; keep team/org request summaries unchanged. A grant can expire for new submissions while still showing a pending reserved amount and history separately from current availability.
**Rationale**: Scoping grants independently of request review avoids leaking entitlement information to managers. Existing reporting selectors already distinguish personal/team/org scope.
**Alternatives considered**: Embed every employee's allocations in team dashboards (not approved); store a second dashboard balance table (drift risk).

## R-006: Migrations and release scope

**Decision**: Additive fields/tables, `requires_allocation=false` for existing types, no initial awards or retroactive commitments; validate on synthetic populated upgrade. No automatic removal of data, grant rollover, payroll, stock, holiday calendar, notification spam or inventory integration.
**Rationale**: Existing requests must retain their original policy and history. Organization working weekday configuration is new; organization existing `week_start` and working-hour window do not identify working weekdays.
**Alternatives considered**: Backfill allocations from past leave requests (unsupported policy); default all dates to weekdays without HR configuration (may be wrong for the organization).

## Open review gates

- Owner/reviewer acceptance of proposed no-overlap, zero-day, schedule effective-date, category-change and grant-edit rules in the spec before implementation.
- Confirm company workweek configuration is required before enabling allocation for date-based types; no implicit Monday-Friday or other workweek.
- Confirm expired grant presentation and how HR corrects an erroneous award without deletion or changing history.
- No real employee data, production rollout, performance result or release acceptance is implied by this plan.
