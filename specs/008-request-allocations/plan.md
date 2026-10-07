# Implementation Plan: Request Allocations

**Feature**: 008-request-allocations | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)
**Status**: Design reviewed and accepted by owner 2026-10-05; implemented and verified 2026-10-05; **redesigned and re-verified 2026-10-06** per owner direction — `category` → visible `unit` (`none`/`unit`/`hour`) with employee-entered amounts; category-based calculations (weekday counting, early-leave billing, equipment submission-date inference) removed; `code` auto-generated/hidden; dedicated new-grant page. Category-era passages below are the accepted design record; [spec.md](spec.md), [data-model.md](data-model.md) and [research.md](research.md) carry the amended model.

## Summary

Add HR-controlled dated allowances to measurable request types, reserve employee capacity on submission, settle or release it with the existing approval workflow, and show personal remaining amounts on the dashboard. Preserve existing request history, authorization and non-allocation request behavior. See [research.md](research.md), [data-model.md](data-model.md), [API/UI contract](contracts/api.md), and [validation guide](quickstart.md).

## Technical Context

- **Language/version**: Existing Python/Django/DRF backend and strict React/TypeScript frontend; use resolved repository lockfiles rather than the older aspirational version statement in AGENTS.
- **Dependencies/storage**: Existing PostgreSQL, Django ORM, DRF, drf-spectacular, TanStack Query, React Hook Form, existing table/UI primitives. No new service or library proposed.
- **Testing**: Existing pytest PostgreSQL integration/concurrency, Ruff, OpenAPI/type generation, TypeScript, ESLint, Vitest and Playwright/axe.
- **Target**: Existing same-origin self-hosted web application; synthetic data only pending D-008 real-data gates.
- **Performance**: Approved D-009 budgets on the synthetic 500-employee workload; scoped balance/list reads <300ms p95 and write/transition <500ms p95 where those categories apply, measured on documented hardware. Avoid per-type/employee N+1 queries.
- **Constraints**: Integer amounts (`hour` stored as whole minutes, entered in quarter-hour steps); employee-entered amount per unit; time-zone-aware grant selection by stated dates or submission date; no grants spanning a request; no physical deletion or rewriting of grant history (HR removal is a soft status transition); work-information privacy remains HR-only and is independent of allocation cards.

## Scope and Impact

- **In**: HR per-type unit selector; dated employee/type grants with HR view, audited date edits/amount adjustments and soft removal; submission-cycle reservations; HR grant table and history; employee amount entry + preview and personal dashboard analysis; bilingual accessible UI; additive migrations and tests.
- **Out**: Accrual/payroll, automatic annual rollover, company holidays, per-employee schedules, inventory, monetary budget, split grants, retroactive conversions, other employees' balance visibility to managers, live deployment or real data.
- **Models/modules**: `organizations.Organization`, `employee_requests.RequestType`/`EmployeeRequest` and request service, new allocation grant/adjustment/commitment models, `reporting` personal projection; frontend request forms, HR request types/grants, personal dashboard.
- **Data/security**: Additive schema; existing types default off and existing submissions unchanged. Scoped HR mutation and self-only balance read, with audit history and capacity checks under DB locks. Accounting and stock untouched.

## Constitution Check — pre-design and post-design

- **I/X scope and traceability**: New 008 feature explicitly extends the 003 exclusion of leave balances. Owner decisions are stated and ratified. Do not alter old requirement IDs or mark old tasks done.
- **II/VI authorization/privacy**: Scope related employees/types, grant lists/details, dashboard aggregates and choices before filtering; no cross-org IDs, draft leakage or generic client balance edits; immutable adjustment history and PII-safe events.
- **III/IV integrity/tests**: Write failing calculation, authorization, race and migration tests before critical implementation. Commit reservation with existing request/event/notification transitions; establish a consistent lock order and test concurrent admin edits.
- **V/VIII maintainability/performance**: Extend modular monolith and current tools; no cache, queue or ledger service. Measure query plans and approved workload instead of asserting optimizations.
- **VII/IX UX/release**: EN/AR RTL, WCAG 2.2 AA, responsive states and safe errors. This plan neither approves deployment nor real employee data.
- **Gate verdict**: No architectural exception required. Owner choices on non-overlap, zero-day, prospective schedule changes and guarded grant edits were recorded on 2026-10-04; soft removal without deletion was clarified on 2026-10-05. Owner accepted each requirements-review checklist item on 2026-10-05. No passing application checks claimed.

## Project Structure

```text
specs/008-request-allocations/
  spec.md  plan.md  research.md  data-model.md  quickstart.md
  contracts/api.md  checklists/requirements.md
backend/apps/organizations/                 # company weekday setting, HR settings service
backend/apps/employee_requests/              # types, grants, adjustments, commitments, scope, transactions, API, tests
backend/apps/reporting/                      # personal allocation projection and tests
frontend/src/api/                            # documented/generated contract clients
frontend/src/features/requests/              # HR type flag and employee calculation preview
frontend/src/features/dashboards/            # personal balance cards
frontend/src/features/employees/ or requests/ # HR allocation administration, scoped employee choice
frontend/src/lib/i18n.ts                     # English/Arabic copy
backend/apps/*/migrations/ and tests/e2e/     # additive migrations and cross-role journeys
```

**Structure decision**: Extend existing modules and feature folders rather than create a new standalone app or a duplicated dashboard balance store. Tasks are deliberately not generated by this planning phase.

## Implementation sequence after review/approval — no code in this phase

1. Owner choices recorded in [spec.md](spec.md) and the AGENTS approval register (D-011) through 2026-10-05; owner accepted the requirements-review checklist on 2026-10-05. Reconcile the approved 008 extension with 003/005 contracts and tasks without erasing completed history (008:FR-001–FR-010).
2. Write failing model/API/service tests for company-day/time/quantity calculation, grant eligibility, scope, reservation lifecycle, exact-once settlement and concurrency; include populated-data migration baseline (008:FR-001–FR-008, FR-010).
3. Introduce additive organization/type fields and grant/adjustment/commitment tables, constraints and indexes justified by measured query plans; no backfill to live employees (008:FR-001–FR-002, FR-008).
4. Add HR administration services and scoped APIs: grant creation, view/history, audited date edits and amount adjustments, guarded remove-from-active-use action, immutable employee/type/unit invariants, workweek settings and optimistic concurrency; reject overlaps or capacity-invalidating edits (008:FR-001–FR-002, FR-007).
5. Integrate request services with one lock order: preview is advisory; submit locks and checks grant then records reserved commitment in the existing atomic transition; review moves it to used or released once, including HR-stage and return/resubmit paths. Protect older cycles against policy changes (008:FR-003–FR-006).
6. Add scoped personal balance projection and documented endpoints; aggregate per grant in bounded queries, distinguish active, expired-but-pending and no-grant states. No extra manager/team counts (008:FR-007).
7. Generate OpenAPI/TypeScript definitions. Build HR grant table and type control, company schedule settings, employee request impact preview and dashboard breakdown using existing UI/table components; add Arabic strings and full async/accessibility states (008:FR-001, FR-003, FR-007, FR-009).
8. Run reconciliation, permissions, concurrency, migration, lint/type/build, browser/axe and synthetic workload gates; review diff and document actual evidence. Any production release requires separate approval and D-008 clearance for real data (008:FR-010).

## Failure boundaries and rollout

- Drafts and existing submitted requests are unchanged until an allocation-required type is submitted in a new cycle. No implicit grant or debit, no auto renewal and no silent grant deletion.
- Capacity or missing-grant errors leave the request editable; conflicting version/repeat actions return 409 where applicable; out-of-scope grant IDs return 404, forbidden HR mutation 403, invalid inputs 400. No partial event, notification or balance mutation.
- Workweek or type changes only affect new cycles; freeze submitted amount and rule snapshot. A pending reservation survives grant expiry. HR cannot reduce below used plus reserved.
- Follow expand/contract rollout with synthetic populated migrations and a compatibility plan for mixed app versions; do not execute database migration, reset, deploy, commit or push under this planning request.
