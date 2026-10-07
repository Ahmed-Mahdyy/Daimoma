# Validation Guide: Request Allocations

**Status**: Executed 2026-10-05 under the category model; **re-executed 2026-10-06 after the owner-approved unit-model redesign** — see [docs/evidence/008-request-allocations.md](../../docs/evidence/008-request-allocations.md) for actual results: 458 backend tests, 45 frontend unit tests, 68 Playwright/axe tests, D-009 re-measurement all PASS. Refer to [spec.md](spec.md), [data-model.md](data-model.md) and [contract](contracts/api.md). Use synthetic accounts and PostgreSQL; never seed real employee data or reset production.

## Preconditions

- Owner choices and requirements-review checklist accepted 2026-10-05; verification ran against the docker-compose dev stack (`seed_e2e` + `seed_perf` synthetic orgs).
- OpenAPI schema regenerated (`backend/schema.yml`), `schema.d.ts` regenerated, `makemigrations --check` clean — no drift.
- Verification fixtures: E2E Corp with HR/manager/employee users, Sun–Thu schedule, a second isolated organization for cross-org checks, PerfCorp for load. Existing roles and request approval routing preserved.

## Happy path

1. HR sets a type's unit to **Units** and creates a 10-unit grant for employee A covering October via **Settings → Allocations → Add allocation** (its own page, showing the type's unit). Employee A's personal dashboard shows 10 granted, zero used/reserved and 10 remaining; employee B sees no grant.
2. Employee A drafts a request of that type: quantity and optional dates are entered directly; the preview estimates the charge. Save remains a draft and changes no balance.
3. Employee A submits quantity 2: one commitment reserves 2; dashboard shows 2 reserved, 8 remaining and the existing reviewer step. If the route has manager then HR stages, manager approval does not use a second 2; final HR approval shows 2 used, 0 reserved, 8 remaining.
4. HR sets another type's unit to **Hours** and creates a grant of 240 minutes (entered as 4 hours) for one calendar month. An employee request entering 1.5 hours charges 90 minutes. The monthly grant is HR-assigned, not auto-renewed. With no dates on the request, grant selection uses the org-local successful submission date.

## Edge cases

- Hour amounts reject non-quarter-hour steps (e.g. 0.30) and nonpositive values; `none` types reject amount fields; `unit` types require a positive whole quantity. An out-of-range or exhausted request remains editable with a safe error and no commitment/event/notification.
- A request crossing June 30/July 1 where two grants separately cover halves is blocked rather than split.
- Pending submission immediately before grant expiry remains reserved after expiry, can complete approval, and is shown as expired-but-pending; return releases and a later resubmission needs a new eligible grant.
- Return and rejection each release once; changing the type's unit cannot rewrite earlier cycle usage (the unit is locked once commitments exist). Approval moves reserved to used once; duplicate/stale approvals do not create extra commitment.
- HR can view a grant, change its dates with a reason when reserved/used commitments remain covered, and adjust its effective amount with an audited reason (hour grants adjust in hours). HR cannot overlap active grants, reduce a 10-unit award below 7 when 4 used and 3 reserved, or change employee/type/unit incompatibly. Removing an unused grant marks it void with actor/reason/time, excludes it from new requests and active cards, and keeps its record and released history in HR views; removal with any reserved or used amount is blocked.
- Two concurrent submissions for one remaining unit: at most one succeeds; remaining never negative. Simultaneous HR adjustment/submission obey the same invariant. Verify no deadlock or double write.

## Permission tests

- Employee A cannot list/read employee B's grants; manager cannot see direct report balances; HR from organization A cannot read/mutate organization B's grants; unauthenticated calls are denied. Out-of-scope UUID reads yield non-enumerating 404 and no count leaks.
- Employee cannot create/edit/adjust/remove grants, toggle type policy, or set computed remaining/commitment status in draft payload; HR cannot permanently delete grants or bypass request owner/eligible reviewer policy to review an allocation-backed request.

## UX, migration and performance checks

- Verify loading, empty/no-grant versus zero-remaining, stale conflict, failed fetch, pending, expired pending and success states in EN/AR LTR/RTL at 360/768/1440 px and 200% zoom; keyboard and axe contrast scans in both themes. Grant history/table uses the table library.
- Upgrade a populated synthetic database: migration 0005 remaps categories to units (allocated date types → `unit`, early leave → `hour`, unallocated → `none`); existing grants/commitments remap to `unit`/`hour`; no existing request is debited or rewritten; existing request and employee data survives; check migration drift and reversible rollback limits without destructive reset.
- Measure scoped personal dashboards, paged HR grant lists, submission and approval under the D-009 workload (500 employees, 5k requests, 25 concurrent users), record query plans/counts and p95 values on documented hardware. No latency/performance claim until measured.
