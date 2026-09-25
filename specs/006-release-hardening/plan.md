# Implementation Plan: Release Hardening

**Feature**: 006-release-hardening | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)
**Status**: Provisional; no application test evidence exists yet.

## Technical Context and Structure

Use established pytest/PostgreSQL, Vitest/Testing Library, Playwright/accessibility tooling, lint/types/build/schema checks, and approved dependency/secret scanners. Choose a maintained load tool only after review; tests live in `backend/tests/`, domain test directories, `frontend/src/`, `tests/e2e/`, and `tests/performance/`. Evidence and defect records live under `docs/evidence/` when actual runs occur.

## Constitution Check

Mandatory test, scope, integrity, privacy, accessibility, performance, and evidence principles are release gates. No disabled policy, test, scanner, or minimum-version rule is a legitimate workaround. Missing evidence remains missing; no artificial score or review approval.

## Execution Design

1. Freeze a candidate commit/artifact identity after owner-approved version-control workflow; enumerate required matrix and approved workload.
2. Run unit/domain/API/component checks against PostgreSQL and the real application; verify all role/team/org and attachment/export/inbox surfaces.
3. Run genuinely concurrent separate-connection cases and populated-database upgrade rehearsals. Inspect constraints/query plans and generic/admin/bulk paths for bypasses.
4. Review session/CSRF/recovery/MFA, input allowlists, headers, secrets, dependency advisories, private storage/scan failures, and PII logs.
5. Exercise employee/manager/HR flows with network/session faults at 360/768/1440 widths; keyboard/focus/contrast/zoom/reduced-motion checks; RTL only if approved.
6. Measure proposed 1,000-employee/100,000-entry/20,000-request/30-user workload after D-009 approval. State resource sizes, warmup, duration, request mix, p95 and error classification. Measure browser lab proxies separately from field Core Web Vitals.
7. Reproduce defects, write regression tests, fix minimal causes, rerun affected/full gates. Do not mark work passing because mocks pass while real integration fails.
8. Consolidate traceability, actual evidence, AI review and remaining risks; obtain owner release acceptance.

## Performance Targets and Corrections

Proposed ordinary API p95<400 ms, summary p95<1 s, unexpected 5xx<1%; target LCP<=2.5 s, INP<=200 ms, CLS<=0.1 with honest measurement method. Profile scope/query/bundle issues before adding caches/services. Any index change is a reviewed migration; retest semantics and isolation.

## Rollout and Data Safety

Use isolated synthetic datasets, never production load or destructive reset. Preserve populated upgrade fixtures and verify schema/data constraints. Backup restore and production rollout evidence belong to 007; first staging runtime is from 002. Release blockers are not waived by an approaching judging date.
