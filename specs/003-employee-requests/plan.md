# Implementation Plan: Employee Requests

**Feature**: 003-employee-requests | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)
**Status**: Provisional; D-004/D-006/D-007/D-008 must resolve affected policies.

## Summary and Technical Context

Extend the phase 002 Django/DRF/PostgreSQL and React/TypeScript foundation with explicit request workflow services. Reuse scoped permissions, notifications, audit, forms, error transport, and OpenAPI types. Private storage and scanning are justified by supporting attachments; select maintained adapters/service and bounded failure handling, not an unaudited upload helper.

## Constitution Check

I scope excludes payroll/general workflow building; II scopes every surface; III-IV requires state/race/permission tests; VI protects files/history; VII includes six states; VIII paginates and measures; X keeps decisions pending. No production uploads before confidentiality/scanning policy acceptance.

## Project Structure

`backend/apps/employee_requests/`: models, migrations, services, selectors, serializers, permissions, views, storage/scanning adapter, tests. Frontend: `frontend/src/features/requests/` and shared components. Cross-role E2E: `tests/e2e/requests.spec.ts`.

## Execution Design

1. Approve fixed type fields and routing; write model/API/permission tests before logic.
2. Create type/request/attachment/step/event schema and constraints from `data-model.md`.
3. Scope lists/details/related choices before serialization; assign owner/organization from authenticated identity.
4. Implement draft services and storage quarantine. Size/count/type checks are server-side; enforce parent editability and concurrent count limits under lock. Scanner failures stay unavailable, never fail open. File downloads recheck request scope and acceptance state.
5. Lock employee profile then request for submission/review/reassignment; recheck current eligibility and expected version. On submission create validated route/content snapshot, steps, event, and notification in one transaction. Use one documented lock order shared with phase 002 administration.
6. Implement approve/reject/return; restart all required steps on resubmission with incremented cycle. Final decisions are immutable. Generic updates cannot alter workflow fields.
7. Integrate reporting-line changes with atomic pending-step reassignment; past decisions remain unchanged. No eligible reviewer means an explicit blocked queue needing HR action.
8. Generate OpenAPI/types and complete forms, list/detail/history, review queues, and request-type administration.

## Failure and Side-Effect Boundaries

An untrusted filename never chooses a storage path. External uploads/scans require consistent metadata lifecycle: staged file, persisted quarantine reference, accepted scan state; submission cannot use pending content. Orphan cleanup/retention is a separately approved operation, not destructive request-path behavior. Domain history may hold an allowlisted request snapshot under request permissions; generic audit logs must not duplicate sensitive content.

Durable notification rows commit with transitions. Email is optional unless independently approved; never add it to approval correctness. Competing mutations return documented 409 with unchanged losing state; clients refresh rather than optimistically assume approval.

## Verification and Performance

See quickstart for positive/negative/race/file tests. List queries eager-load type/employee/current reviewer; cap page sizes. Index organization/employee/status/created_at and pending assigned-reviewer lookups after query review. Measure p95 and query budgets against D-009 rather than claim performance from indexes alone.

## Migration and Rollout

Additive migrations and reviewed type configuration; no fixed credentials, foreign IDs, destructive resets, or rewriting previous cycles. Deploy only after phase 002 and storage/scanner readiness. Gate confidential HR content separately until D-006 scope is explicit.
