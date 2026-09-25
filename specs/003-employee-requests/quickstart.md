# Validation Guide: Requests

## Available now / future prerequisites

`python3 .devin/scripts/specs.py check` checks planning files only. Application verification requires completed phase 002, approved D-004/D-006 policies, test PostgreSQL, private test storage/scanner, and synthetic two-team fixtures. Never upload real HR documents during development.

## Happy Path

1. Employee creates a draft with the approved category fields and accepted supporting file.
2. Submit; verify pending manager state, read-only content, history and durable notification.
3. Manager approves a manager-only request; separately approve a two-stage request and verify HR is still required.
4. HR completes the second stage; employee sees final result and history.
5. Return another request with reason; employee corrects/resubmits; verify preserved old and new cycles.

## Edge Cases

Invalid dates/fields, inactive type, missing/self/inactive reviewer, concurrent submit/approve, stale version, reporting-line change, malicious/oversized files, concurrent file-count boundary, unavailable/rejected scanner, slow upload, empty filters, and lost network response. Assert losing mutations do not change database state or duplicate notifications.

## Permission Tests

Other employee/team/org direct IDs, attachment bytes via guessed paths, mass assignment, manager skipping HR, wrong-stage reviewer, self-approval including HR, editing submitted/decided fields/files, unauthorized type config, notification target after access revocation.

## Planned commands and evidence

After implementation: backend `pytest apps/employee_requests` against PostgreSQL with real concurrent transaction tests; frontend request component tests; Playwright `tests/e2e/requests.spec.ts`; schema-drift/query-count/migration checks. Record exact commands, environments, scan adapter behavior, viewports, outcomes, and reviewed corrections under `docs/evidence/003-requests.md`. Mark unrun checks explicitly; no application test has run in this scaffold.
