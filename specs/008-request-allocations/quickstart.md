# Validation Guide: Request Allocations

**Status**: Planned tests and expected results; none executed. Refer to [spec.md](spec.md), [data-model.md](data-model.md) and [contract](contracts/api.md). Use synthetic accounts and PostgreSQL; never seed real employee data or reset production.

## Preconditions

- Review and ratify proposed grant overlap, zero-day, schedule edits and grant correction policies; resolve open requirements checklist items.
- Run the project's documented migration, backend/frontend and browser commands in a disposable synthetic environment once implementation exists; check generated OpenAPI/types and migration drift. Do not claim these are currently passing for this feature.
- Configure one organization schedule explicitly (example: Sunday–Thursday), two employees in different teams, one manager, one HR, and a second isolated organization; create dated grants through the HR service. Preserve existing roles and request approval routing.

## Happy path

1. HR enables allocation for Leave and creates a 10-working-day grant for employee A covering October. Employee A's personal dashboard shows 10 granted, zero used/reserved and 10 remaining; employee B sees no grant.
2. Employee A drafts leave across a configured weekend: the preview counts scheduled weekdays only, with no holiday deduction. Save remains a draft and changes no balance.
3. Employee A submits a 2-day request: one commitment reserves 2; dashboard shows 2 reserved, 8 remaining and the existing reviewer step. If the route has manager then HR stages, manager approval does not use a second 2; final HR approval shows 2 used, 0 reserved, 8 remaining.
4. HR creates an early-leave grant measured in minutes and an equipment grant in units; a 90-minute request and an equipment quantity of 1 consume those units, not days. Equipment grant selection uses org-local successful submission date.

## Edge cases

- A Thursday-through-Sunday date interval uses the configured weekdays only; a holiday falling on a configured weekday still consumes one day. Weekend-only/zero-consuming request is blocked under the proposed rule.
- A request crossing June 30/July 1 where two grants separately cover halves is blocked rather than split. An out-of-range or exhausted request remains editable with a safe error and no commitment/event/notification.
- Pending submission immediately before grant expiry remains reserved after expiry, can complete approval, and is shown as expired-but-pending; return releases and a later resubmission needs a new eligible grant.
- Return and rejection each release once; changing type or company schedule cannot rewrite earlier cycle usage. Approval moves reserved to used once; duplicate/stale approvals do not create extra commitment.
- HR cannot create an overlapping grant, reduce a 10-unit award below 7 when 4 used and 3 reserved, change a unit incompatibly, or shorten a grant so an active commitment no longer qualifies; valid adjustment records actor/reason.
- Two concurrent submissions for one remaining item: at most one succeeds; remaining never negative. Simultaneous HR adjustment/submission obey the same invariant. Verify no deadlock or double write.

## Permission tests

- Employee A cannot list/read employee B's grants; manager cannot see direct report balances; HR from organization A cannot read/mutate organization B's grants; unauthenticated calls are denied. Out-of-scope UUID reads yield non-enumerating 404 and no count leaks.
- Employee cannot create/adjust grants, toggle type policy, or set computed remaining/commitment status in draft payload; HR cannot bypass request owner/eligible reviewer policy to review an allocation-backed request.

## UX, migration and performance checks

- Verify loading, empty/no-grant versus zero-remaining, stale conflict, failed fetch, pending, expired pending and success states in EN/AR LTR/RTL at 360/768/1440 px and 200% zoom; keyboard and axe contrast scans in both themes. Grant history/table uses the table library.
- Upgrade a populated synthetic database: existing request types stay allocation-free; no existing request is debited or rewritten; existing request and employee data survives; check migration drift and reversible rollback limits without destructive reset.
- Measure scoped personal dashboards, paged HR grant lists, submission and approval under the D-009 workload (500 employees, 5k requests, 25 concurrent users), record query plans/counts and p95 values on documented hardware. No latency/performance claim until measured.
