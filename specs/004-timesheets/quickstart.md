# Validation Guide: Timesheets

## Preconditions

Artifact validation now: `python3 .devin/scripts/specs.py check`. Application verification later requires completed phase 002, approved D-004/D-005/D-009, real PostgreSQL test transactions, known IANA timezone examples, and synthetic employee/manager/HR fixtures.

## Happy Path

Create a week -> add daily intervals/breaks -> compare expected minute totals -> submit -> confirm parent/entries locked -> manager returns with reason -> owner corrects/resubmits -> manager approves. Separately reject a sheet, then exercise authorized HR reopening and a fresh review cycle.

## Edge Cases

Empty week, duplicate employee/period, invalid break/end, minute precision, future completed interval, overnight/day/week boundaries, nonexistent and repeated local DST instants, explicit split-break allocation, active intervals overlapping across sheets, simultaneous edit/submit/review, stale expected version, reviewer deactivation/reporting change, and organization timezone changes after submission.

## Permission Tests

Employee other-owner records; manager other-team records; foreign-org IDs; forged owner/org/period/totals/status; add/edit/void/reparent/bulk bypass on submitted or decided work; self-review including HR; employee/manager reopen; missing reopen reason; former manager after reassignment. Inspect unchanged stored values for failed mutations.

## Planned commands and evidence

After implementation: backend `pytest apps/timesheets` against PostgreSQL; concurrency cases use separate connections and committed fixture setup. Run frontend time-form/week/history tests, Playwright `tests/e2e/timesheets.spec.ts`, migration and query-budget checks. Record expected versus actual integer minutes, transactional outcomes, report reconciliation after reopening, viewports, and reviewed exceptions in `docs/evidence/004-timesheets.md`. No domain test is claimed as run by this scaffold.
