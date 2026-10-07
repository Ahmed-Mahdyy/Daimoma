# Research: Request Allocations

**Status**: Owner decisions and requirements-review checklist accepted 2026-10-05; **R-001/R-002 superseded 2026-10-06 (owner) by the unit-model redesign** — the decision record below reflects the shipped model. Based on existing 003/005 artifacts and current code, not performance measurements.

## R-001: Source of truth and usage units

**Decision (amended 2026-10-06)**: Dated employee/type grants in the request type's configured unit — `unit` (whole-count) or `hour` (stored as whole minutes). The employee enters the charged amount directly: `quantity` for unit types, `hours` (quarter-hour steps) for hour types. `none` types carry no amount. No per-category calculations, no workweek counting, no early-leave billing formula.
**Rationale**: Owner directed removing the hard-coded category model: types are free-named and the visible unit is the only measurement contract. Employee-entered amounts keep the type catalog dynamic without hard-coded semantics.
**Alternatives considered**: Fixed categories with automatic quantities (previously chosen 2026-10-04, superseded by owner 2026-10-06); HR-decided request amount (rejected); company-wide pooled budget (not requested).

## R-002: Calendar and grant matching

**Decision (amended 2026-10-06)**: One request uses exactly one dated grant. The grant must cover the request's stated inclusive date interval; when the request has no dates, the organization-local submission date selects the grant. `Organization.working_weekdays` is no longer consumed — dates are request context, not consumption.
**Rationale**: Without category-derived consumption, weekday counting is no longer authoritative; the employee-entered amount is. Full-interval matching still prevents implicit cross-grant splitting.
**Alternatives considered**: Company weekday counting (superseded 2026-10-06); employee schedules, split grants, approval-time date (rejected by owner).
**Ratified validation**: Reject missing/zero amounts when the type is measurable; do not create a free request using a grant.

## R-003: Balance and historical integrity

**Decision**: Available = initial award + auditable adjustments - currently reserved - approved usage; use a submission-cycle commitment with frozen unit/amount/grant and policy snapshot. Drafts don't reserve; final approval moves reserved to used; return/rejection releases; pending remains reserved after grant expiry. Re-submission calculates afresh. No materialized dashboard balance to edit.
**Rationale**: Live reconciliation preserves historical decisions and prevents a second deduction at approval. Owner approved reserve-on-submit and pending-after-expiry policy.
**Alternatives considered**: Deduct only on approval (rejected); recompute prior usage using current type/schedule (would rewrite history); update a plain mutable remaining column without events (audit and race risk).

## R-004: Concurrency and grant administration

**Decision**: Serialize allocation mutations using a consistent transaction/lock order across grant creation/adjustment and request submission/decisions, starting with the employee profile. Request transitions then lock the request, grant (on submit) and review steps; HR grant changes lock the same profile before the grant. This serializes all changes to an employee's capacity while preserving the request's existing version checks. Revalidate scope/version/status/capacity under lock and commit commitment/event/notification together. Use unique request+cycle commitment and database amount/date checks; no additional service/queue.
**Rationale**: Existing request services lock request rows, so their lock order needs deliberate integration to avoid deadlocks. Grant-level serialization prevents two requests spending the same remainder. Grant date changes must keep reserved and used commitments covered; released cycles retain their recorded history even if a later date edit excludes their former request dates.
**Alternatives considered**: Browser-side balance checks, unprotected aggregate-then-save, Redis balance cache (all unsafe/unnecessary). Grant non-overlap enforcement via application transactions and tests; a database exclusion constraint would require a reviewed extension/index and is not assumed here.
**Ratified policy**: No overlapping grants for one employee/type, positive award, mandatory reason on adjustment. Unit changes on types with grants or commitments are rejected rather than silently converted. Grant date edits are allowed only while no reserved or used commitment falls outside the new period; grants are never deleted — HR can view and edit permitted fields; an erroneous award is corrected by reasoned adjustment, and HR may remove an allocation from active use with a reason only while it has no reserved or used commitments. Released history stays available.

## R-005: Visibility and reporting semantics

**Decision**: Employee self and HR-organization only for grant details; manager role does not confer another person's balance. Add personal dashboard allowance projection and a separate paginated HR grant list; keep team/org request summaries unchanged. A grant can expire for new submissions while still showing a pending reserved amount and history separately from current availability.
**Rationale**: Scoping grants independently of request review avoids leaking entitlement information to managers. Existing reporting selectors already distinguish personal/team/org scope.
**Alternatives considered**: Embed every employee's allocations in team dashboards (not approved); store a second dashboard balance table (drift risk).

## R-006: Migrations and release scope

**Decision**: Additive fields/tables, `requires_allocation=false` for existing types (now `unit="none"`), no initial awards or retroactive commitments; validate on synthetic populated upgrade. No automatic removal of data, grant rollover, payroll, stock, holiday calendar, notification spam or inventory integration.
**Rationale**: Existing requests must retain their original policy and history. `working_weekdays` is retained non-destructively but no longer consumed by allocation logic.
**Alternatives considered**: Backfill allocations from past leave requests (unsupported policy); default all dates to weekdays without HR configuration (may be wrong for the organization).

## Review outcome

- Owner choices recorded 2026-10-04: no overlapping active grants; grant dates editable only while no reserved/used commitment falls outside the new period; incompatible unit changes rejected; expired grants shown as labeled history while pending reservations remain reserved.
- Owner clarified 2026-10-05: HR can view grants, edit permitted dates and amount with audit history, and remove a grant from active use without deleting its record. Void is blocked while any amount remains reserved or used, but released history is retained.
- Owner redesign approved 2026-10-06: categories removed in favor of a visible per-type unit (`none`/`unit`/`hour`); employees enter the charged amount directly; `code` hidden and auto-generated; grant creation on a dedicated page; dark-mode badge contrast fixed. Category-based calculations (weekday counting, early-leave billing) superseded.
- No real employee data, production rollout, performance result or release acceptance is implied by this plan.
