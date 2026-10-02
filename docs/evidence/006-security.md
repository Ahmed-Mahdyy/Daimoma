# Security Evidence — 006 Release Hardening (T006)

Reviewed 2026-10-02. All findings recorded; nothing hidden or downgraded.

## Dependency audit — ACTION TAKEN

### Backend (`pip-audit`, container `backend`)

**Before remediation:**

| Package | Pinned | Advisories | Fix |
|---------|--------|------------|-----|
| Django | 5.2.7 | **~50 PYSEC advisories** (SQL injection, DoS, XSS classes across 5.2.8–5.2.17 fix releases) | → **5.2.17** |
| djangorestframework | 3.16.1 | PYSEC-2026-3827, PYSEC-2026-3828 | → **3.17.2** |
| pytest | 8.4.2 | PYSEC-2026-1845 | → **9.0.3** |
| pip | 25.0.1 | PYSEC-2026-1795/-1796/-196/-2875/-2876/-3721 | → Dockerfile now runs `pip install --upgrade pip` before deps |

**Remediation:** `requirements.txt` → Django==5.2.17, DRF==3.17.2;
`requirements-dev.txt` → pytest==9.0.3 + pip-audit==2.10.1 (pinned so the
audit is reproducible, not a one-off). Backend image rebuilt; full suite
**372 tests pass** on the patched stack.

**Residual:** none for shipped code. `pip`'s own advisories are a
build-time tool inside the image — the Dockerfile upgrade clears them.

### Frontend (`npm audit --omit=dev`, container `frontend`)

**0 vulnerabilities** in production dependencies.

## Secrets and configuration review

| Check | Result |
|-------|--------|
| `.env` committed? | **No** — `.gitignore` covers `.env`/`.env.*`, `git check-ignore` confirmed; `.env.example` has only placeholders |
| `SECRET_KEY` | env-driven (`DJANGO_SECRET_KEY`); no hardcoded fallback |
| `DEBUG` | `env.bool` default **False**; only `settings/development.py` sets True |
| `ALLOWED_HOSTS` | env list, default empty |
| CSRF trusted origins | env-driven; dev `.env` lists only localhost/frontend |
| Postgres password in compose | dev-only default `daimoma_dev_password`, overridable by env — documented dev value, not a production secret |
| Email backend | console/file in dev (D-007 approved); no SMTP credentials present anywhere |
| Tokens/passwords in repo | none found (grep over tracked files) |

## Session/auth security (covered by tests)

- 2h idle / 24h absolute session expiry — `test_auth.py::test_idle_expiry`, `test_absolute_expiry`
- Throttling: 5/account + 20/IP in 5min → 429 `rate_limited` — `test_login_throttled_after_failures`
- CSRF required on session mutations — `test_login_requires_csrf` + security-matrix `test_session_post_without_csrf_rejected`
- Logout invalidates session; password change kills other sessions

## Consolidated negative matrix — `backend/tests/test_security_matrix.py` (new, T003)

31 tests: unauthenticated denial across 15 protected endpoints, employee →
HR/admin/org-surface 403s, cross-org 404s (no existence leak), inbox
isolation (foreign notifications unreadable/unmarkable), mass-assignment
rejection (status/employee/org not writable), CSRF-less session POST 403.

## Privacy posture

- Synthetic data only (D-008) — no real employee records in dev/test.
- No real-data release until privileged MFA + retention policy approved
  (006:T015 gate; unresolved, recorded, not bypassed).

## Verdict

One release-blocking class of finding (unpatched framework CVEs) was found
and **remediated and re-verified**. No critical/high security defects remain
open in shipped code as of 2026-10-02.
