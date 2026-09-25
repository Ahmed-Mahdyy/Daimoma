# Validation Guide: Reporting

Current runnable check: `python3 .devin/scripts/specs.py check` validates artifacts only. Domain checks require implemented 002-005 and approved limits/metric definitions.

## Happy Path

Seed synthetic workflows using real services; compare employee/manager/HR dashboards to exact expected counts/minutes. Filter a partial week, reconcile rows and export, follow an inbox item, mark read twice, and reload. Reopen an approved sheet and confirm current approved totals update without losing history.

## Edge Cases

No records, zero minutes, boundary dates/timezones, long names, filter clearing, stale responses, changed manager/department, export row/range limit, formula-like CSV content, deleted/inaccessible notification target, and failed polling/network requests.

## Permission Tests

Attempt another employee/team/org report, count, filter-choice, inbox item, target, and CSV export. Ensure an unauthorized filter does not widen scope. Switch accounts and inspect cache isolation. Compare all aggregate totals with scoped source records.

## Planned Verification

Backend `pytest apps/reporting apps/notifications`; frontend dashboard/report/inbox component tests; real-API Playwright reporting journeys; query-count/schema/migration tests and approved load measurement. Record command/environment/result, dataset oracle, viewports, and unresolved findings in `docs/evidence/005-reporting.md`. No domain test is represented as already run.
