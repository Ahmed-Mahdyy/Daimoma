# Evidence 006 — Defect register (release hardening)

Severity gates per `contracts/quality-gates.md`: critical/high block release;
each entry records reproduction, root cause, fix, and regression coverage.

## D6-01 — Vulnerable runtime dependencies (HIGH, security) — FIXED

- **Found by:** `pip-audit` (T006).
- **State:** Django 5.2.7 and DRF 3.16.1 carried published advisories; pytest
  8.4.2 and the container's bundled pip also flagged.
- **Fix:** `requirements.txt` → Django 5.2.17, DRF 3.17.2, psycopg 3.2.10,
  gunicorn 23.0.0; `requirements-dev.txt` → pytest 9.0.3, pytest-django 4.11.1,
  ruff 0.13.2, pip-audit 2.10.1; Dockerfile upgrades pip at image build.
- **Regression:** full backend suite **372 passed** on the patched image;
  `npm audit` reports 0 vulnerabilities.
- **Residual:** pip-audit runs inside the container show pip advisories scoped
  to the image build tool only — runtime packages clean. Dev-only pytest
  advisory accepted (not shipped); recorded, not hidden.

## D6-02 — Timesheet list N+1 → 13s p95 (HIGH, performance) — FIXED

- **Found by:** D-009 load measurement (T010), 25 concurrent users,
  500-employee dataset.
- **Reproduction:** `GET /api/v1/timesheets/` → p95 **13,269ms**.
- **Root cause:** `TimesheetSerializer` emits nested `days`+`entries` per list
  row; the list queryset had no prefetch. Existing budget test used only 6
  sheets — under the 15-query cap even with N+1, so CI didn't catch it.
- **Fix:** `TimesheetListSerializer` (no `days`) + queryset `Sum` annotation
  for `total_minutes` + `select_related("current_reviewer__profile")`.
- **Result:** p95 **201ms** under the same load; OpenAPI clean (shared
  `TimesheetStatusEnum`); frontend types regenerated; 83 timesheet tests +
  8 e2e pass.
- **Regression guard:** `test_list_bounded_queries` now seeds 12 sheets — a
  reintroduced N+1 fails the ≤15 budget.

## D6-03 — Dead session kept authenticated UI (MEDIUM, security/UX) — FIXED

- **Found by:** `resilience.spec.ts` expired-session journey (T007).
- **Reproduction:** clear cookies mid-session → SPA stayed on `/requests`
  showing stale data instead of redirecting to `/login`.
- **Root cause:** `RequireAuth` trusted TanStack-cached `me`; nothing cleared
  it when the API returned `authentication_required` (403).
- **Fix:** `apiFetch` emits an auth-required event on that 403; `AuthProvider`
  listens, clears the `me` query, and the route guard redirects.
- **Regression:** resilience suite 3/3 + full e2e 31/31 pass.

## D6-04 — Header horizontal overflow at 360px (MEDIUM, a11y) — FIXED

- **Found by:** new reflow test in `accessibility.spec.ts` (T008).
- **Reproduction:** `documentElement.scrollWidth` = **838px** at 360px viewport
  (WCAG 1.4.10 reflow failure).
- **Root cause:** rigid single-row flex header; 6+ nav links + bell + sign-out
  cannot shrink below ~838px.
- **Fix:** header wraps (`flex-wrap`), nav moves to its own row below `sm`.
- **Regression:** reflow test asserts `scrollWidth ≤ width+1` at 360/768/1440.

## Deferred / not defects

- Inbox paginator uses the global page size (25) rather than the spec'd 50 —
  recorded in 005 evidence; cosmetic, scheduled with any inbox polish.
- Dev `runserver` inflates p95 ~2x under load — environment note, not a defect;
  gunicorn numbers are the recorded measurement.
- Timesheet write-path p95 has no dedicated load scenario (covered indirectly
  by concurrency tests) — recorded limit in 006-performance.md.
