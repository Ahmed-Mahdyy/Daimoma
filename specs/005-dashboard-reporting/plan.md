# Implementation Plan: Dashboards and Reporting

**Feature**: 005-dashboard-reporting | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)
**Status**: Provisional; D-003/D-005/D-006/D-009 require approval.

## Technical Context and Structure

Reuse Django/DRF/PostgreSQL and React/TypeScript foundation. Backend reads live in `backend/apps/reporting/`; notification queries/actions extend `backend/apps/notifications/`. UI lives in `frontend/src/features/dashboards/`, `reports/`, and `notifications/`. Reuse OpenAPI types, TanStack Query, accessible filters/tables, and phase 002 transport. No BI warehouse, new cache service, or WebSocket service is required.

## Constitution Check

Scope-before-aggregate/export is mandatory. Reports cannot bypass confidentiality rules. Exact integer-minute reconciliation, bounded query/response sizes, six UI states, and real evidence are required. Owner gates remain open; no actual performance result is claimed.

## Implementation Design

1. Approve metric definitions and fixture oracle before building selectors. Count current request records by current status; historical approval events never multiply request counts.
2. Scope base querysets by current organization/owner/team first. Group current approved active entries by work_date and approved timezone semantics; exclude voided entries and sheets not currently APPROVED.
3. Reuse the same scoped/filter definitions for summary, detail, count, and export. Apply current department/team grouping with explicit labels; do not invent historical hierarchy data.
4. Serialize date/employee/type/status filters and bounded pagination. Limit export rows/ranges before materializing content; deterministic ordering and safe CSV quoting/formula neutralization.
5. Extend recipient-only notification list/count/mark-read. Repeated marking is safe; event-key uniqueness prevents duplicates. Safe target type/ID resolves internally and rechecks current access.
6. Cache keys include identity/scope/filter parameters; invalidate after request/time transitions and administration changes. Clear caches on account change. Do not cache sensitive responses in a service worker. Poll notifications modestly only when authenticated and visible; exact interval is D-009.
7. Build accessible metric cards with text alternatives to charts, responsive reports, filter URLs, and notification center. A failed fetch is not an actual zero count.

## Performance and Verification

Database aggregation, eager-loaded report rows, query-count regression tests, bounded filters/exports, and measured p95 targets from D-009. Test concurrent state changes with a consistent summary query/snapshot strategy so a response does not mix incompatible totals. Use deterministic fixtures for reconciliation and CSV injection cases. UI tests cover stale requests, clearing filters, empty/error/loading/disabled/success states, and account-switch cache isolation.

## Data and Rollout

No new workflow tables. Add only justified indexes through migrations after query-plan review. Notification schema belongs to 002; do not create a second notification model. Seed reporting examples through real domain services. Release after 003/004 state and authorization invariants pass.
