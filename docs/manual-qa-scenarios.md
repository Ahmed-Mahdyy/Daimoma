# Daimoma — Manual Acceptance Test Scenarios

Requirement-to-scenario mapping for `Employee_Requests_and_Time_Tracking_System (4).pdf` (sections §4–§17).
Each scenario is executable by hand against the running stack. Check off the Result column during your pass.

## How to run

```bash
cd /home/mahdy/cds-playground/odoo-19/Daimoma
docker compose up -d
docker compose exec backend python manage.py seed_e2e   # once — creates the test accounts + data
```

- App: http://localhost:5173 · API: http://localhost:8000/api/v1/ · API docs: http://localhost:8000/api/v1/schema/docs/
- API-level checks: sign in via UI first (session cookie), then open a second tab to `http://localhost:8000/api/v1/...` or use `curl -b` with the session cookie. A `403`/`404` at the API = server-enforced, not just hidden UI.
- IDs in steps are placeholders — use any row your account can see. `[E]` = Employee, `[M]` = Manager, `[H]` = HR.

## Test accounts (synthetic, D-008)

| Role | Email | Password | Has |
| --- | --- | --- | --- |
| Employee | `employee-e2e@acme.test` | `E2ePassw0rd1` | Drafts, submitted requests, allocations, timesheets |
| Manager | `manager-e2e@acme.test` | `E2ePassw0rd1` | Direct reports, pending reviews, own requests |
| HR | `hr-e2e@acme.test` | `E2ePassw0rd1` | Org-wide view, admin nav |

---

## A. Authentication & Users — PDF §5, §6, §10, §15

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | §15 | Successful sign-in | Login as each of the 3 accounts | Lands on dashboard; name + role shown in sidebar | ☐ |
| AUTH-02 | §15 | Bad password | Login `employee-e2e@acme.test` + wrong password | Generic "email or password incorrect" — never reveals account existence | ☐ |
| AUTH-03 | §15 | Unknown email | Login `nobody@acme.test` | Identical generic error (no enumeration) | ☐ |
| AUTH-04 | §15 | Protected route redirect | Signed out, open `/requests`, `/employees`, `/settings` directly | Redirected to `/login`; after login returns to app | ☐ |
| AUTH-05 | §15 | Sign-in throttling | Fail login 6+ times within 5 min (same account) | Further attempts throttled ~5 min; no permanent lock | ☐ |
| AUTH-06 | §5 | Profile visible | Any role → own profile/employee record | Personal data, employee code, manager shown; read-only where expected | ☐ |
| AUTH-07 | §16 | Session expiry | Stay signed in; session expires after 2h idle / 24h absolute | Next action redirects to login (D-009) | ☐ |
| AUTH-08 | §5 | Sign out | Click Sign Out | Session cleared; protected pages redirect to login; Back button does not restore data | ☐ |
| AUTH-09 | §5 | Forgot password | Login → "Forgot your password?" → enter email | Acknowledgement shown regardless of account existence (D-009) | ☐ |
| AUTH-10 | §5 | Invite acceptance | HR provisions a new employee → open the emailed invite link → set password | Single-use link works ≤48h, then expires (D-009); new account can sign in | ☐ |

## B. Role-Based Access & Ownership — PDF §4, §5, §12, §15, §22 (cap rule)

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| RBAC-01 | §5 | Employee request scope | `[E]` Requests list | Only own requests; no other employees' rows | ☐ |
| RBAC-02 | §5 | Draft visibility — owner only | `[M]`/`[H]` open `/requests` | No employee drafts appear anywhere (D-003) | ☐ |
| RBAC-03 | §5 | Draft direct-URL block | `[M]` opens `/requests/<employee's draft id>` via URL or API | `404` — existence not revealed | ☐ |
| RBAC-04 | §5 | Manager team scope | `[M]` Requests list | Own requests + direct reports' non-draft requests only | ☐ |
| RBAC-05 | §15 | Other manager's team | `[M]` opens a request/employee outside their reporting line | `404`/`403` at API level | ☐ |
| RBAC-06 | §5 | HR scope | `[H]` Requests list | All org non-draft requests + HR's own drafts | ☐ |
| RBAC-07 | §5 | Nav reflects role | Compare sidebars `[E]` `[M]` `[H]` | Employee: no Employees/Settings; Manager: +team tabs; HR: +Employees, Departments, Settings | ☐ |
| RBAC-08 | §12 | UI-hidden ≠ authorized | `[E]` calls `GET /api/v1/employees/` directly (address bar while signed in) | `403` — server enforces even though nav hides it | ☐ |
| RBAC-09 | §12 | Employee can't reach admin APIs | `[E]` calls `GET /api/v1/request-types/` write ops, `/api/v1/dashboard/?scope=organization` | `403` | ☐ |
| RBAC-10 | §5 | Employee edits only own drafts | `[E]` PATCH another's request via API | `403`/`404` | ☐ |
| RBAC-11 | §5 | Non-draft locked for employee | `[E]` PATCH own `pending_manager` request | Rejected — only draft/returned editable | ☐ |
| RBAC-12 | §12 | Draft delete — owner only | `[M]`/`[H]` DELETE an employee's draft id | `404` (out of scope); `[E]` DELETE own submitted → `400` | ☐ |
| RBAC-13 | §12 | Bulk delete scoping | `[E]` POST `bulk-delete` mixing own draft + another's id + submitted id | Only the own draft deleted; others `skipped`; no partial unauthorized delete | ☐ |
| RBAC-14 | §5 | Timesheet scope | `[E]`/`[M]`/`[H]` timesheet lists | Employee: own; Manager: own + direct reports; HR: org | ☐ |
| RBAC-15 | §4 | Reporting-line integrity | `[M]` reviews own submitted request/timesheet | Never assigned to self — falls back to eligible HR (D-004) | ☐ |
| RBAC-16 | §10 | Org isolation | Signed-in user requests a foreign-org resource id | `404`, not a permission hint | ☐ |

## C. Employee Requests — PDF §5, §6, §7, §15

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| REQ-01 | §7 | Create draft — each type | `[E]` New request → pick each enabled type (leave, equipment, HR service, WFH, early leave, general) | Type-specific fields render (dates / item+qty / title+desc / times); draft saved | ☐ |
| REQ-02 | §15 | Validation | Submit/leave required fields empty, end < start, qty ≤ 0 | Inline field errors, nothing saved | ☐ |
| REQ-03 | §7 | Edit draft | `[E]` open own draft → Edit → change fields → save | Changes persist; stays draft | ☐ |
| REQ-04 | §7 | Submit | `[E]` draft → Submit | Status `pending_manager`; detail shows assigned reviewer; entry in history | ☐ |
| REQ-05 | §7 | Submitted is read-only | `[E]` reopen submitted request | No edit controls (only view + history) | ☐ |
| REQ-06 | §7 | Status tracking | `[E]` list + detail after each transition | Status badges current; status filter chips match | ☐ |
| REQ-07 | §5 | Activity history | `[E]` request detail → History | Every transition: actor, action, timestamp, note | ☐ |
| REQ-08 | — | Delete draft (row) | `[E]` check a draft row → Delete selected → confirm | Row removed; 204 on API; list refreshes | ☐ |
| REQ-09 | — | Delete draft (detail) | `[E]` draft detail → Delete draft → confirm | Deleted; navigated back to list | ☐ |
| REQ-10 | — | Bulk delete | `[E]` select multiple drafts → Delete selected → confirm | All eligible deleted; skipped/ineligible reported if mixed | ☐ |
| REQ-11 | — | Selection eligibility | `[E]` requests table | Checkboxes enabled only on draft rows; submitted/approved/returned rows disabled | ☐ |
| REQ-12 | §7 | Returned → resubmit | `[M]` returns a request → `[E]` opens it | Returned reason visible; editable; resubmit re-enters review | ☐ |
| REQ-13 | §6 | Empty state | `[E]` filter to a status with no rows | Friendly empty state, no broken table | ☐ |

## D. Request Approvals — PDF §5, §6, §7

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| APR-01 | §7 | Manager approve | `[M]` team request → Approve (+note) | `approved` (or `pending_hr` if type is HR-required); history + notification | ☐ |
| APR-02 | §7 | Manager reject | `[M]` → Reject + note | `rejected`; employee sees reason; reservation released | ☐ |
| APR-03 | §7 | Manager return | `[M]` → Return + note | `returned`; employee can edit + resubmit; reservation released | ☐ |
| APR-04 | §4 | HR stage (HR-required type) | Approve a request whose type requires HR review | Moves `pending_hr`, not `approved`; `[H]` decision completes it | ☐ |
| APR-05 | §4 | HR fallback | Employee with no/ineligible manager submits | Eligible non-self HR reviewer assigned automatically (D-004) | ☐ |
| APR-06 | §4 | No self-approval | `[M]` submits own request | Routed to eligible reviewer, never self | ☐ |
| APR-07 | §4 | Manager change reassignment | `[H]` changes an employee's manager with pending steps | Outstanding steps reassigned atomically; old manager loses access; history preserved (D-004) | ☐ |
| APR-08 | §7 | Wrong-reviewer block | `[M]` approve a request not assigned to them (API) | `403`/`404` | ☐ |
| APR-09 | §7 | Double-decision block | Re-approve an already-approved request via API | Rejected — invalid state transition | ☐ |

## E. Allocations — PDF §5 (config) + D-011

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| ALLOC-01 | §5 | Assign allocation | `[H]` Requests → Allocations → New → employee, type, dates, amount | Grant created; appears on employee's dashboard | ☐ |
| ALLOC-02 | — | Dashboard balance | `[E]` My dashboard → Allocation balance | Each grant shows current remaining balance (incl. `0`); section hidden for users with none | ☐ |
| ALLOC-03 | §5 | Balance preview in form | `[E]` new request on allocated type | Estimated charge + remaining shown before submit | ☐ |
| ALLOC-04 | §5 | Insufficient balance | `[E]` request > remaining → submit | Blocked with clear message | ☐ |
| ALLOC-05 | §5 | Reserve/release/finalize | Submit → manager decision | Reserve at submit; released on reject/return; consumed on approve — check grant Reserved/Used/Remaining | ☐ |
| ALLOC-06 | §5 | No overlap | `[H]` create overlapping grant same employee+type | Rejected; adjacent dates allowed | ☐ |
| ALLOC-07 | §5 | Adjust/remove | `[H]` adjust grant amount; remove allocation | Can't go below reserved+used; removal blocked while reserved/used exists; record kept in history | ☐ |
| ALLOC-08 | §5 | Expired grant | View an expired grant | Labeled "Expired" history; can't fund new requests; pending reservations persist | ☐ |

## F. Timesheets — PDF §5, §6, §7, §15

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| TS-01 | §6 | Open week | `[E]` Timesheets → pick this week | Weekly sheet opens, day rows shown | ☐ |
| TS-02 | §6 | Add entry | `[E]` day → Add entry → from/to (+ break) | Saved; day total computed (D-005) | ☐ |
| TS-03 | §6 | Edit draft entry | Edit/void an entry before submit | Updates totals; version-safe | ☐ |
| TS-04 | §7 | Submit day | `[E]` day → Submit day | Day locks; status `pending_manager`; each day submits independently | ☐ |
| TS-05 | §7 | Submitted read-only | Reopen submitted day | No edit controls | ☐ |
| TS-06 | §7 | Manager review | `[M]` team timesheet → approve days/week | Week `pending_hr` after manager approval (D-005 two-stage) | ☐ |
| TS-07 | §7 | HR final approval | `[H]` review → approve | `approved`; hours count in dashboard/reports | ☐ |
| TS-08 | §7 | Return for correction | `[M]`/`[H]` return + note | Whole week unlocks; employee edits + resubmits | ☐ |
| TS-09 | §7 | HR reopen | `[H]` reopen approved week + reason | Reason required; re-enters review | ☐ |
| TS-10 | §5 | Check in/out | `[E]` topbar Check in → later Check out | Entry created with real elapsed time; discard asks confirmation | ☐ |
| TS-11 | §5 | Future blocked | `[E]` current week | Future days dimmed "Upcoming", no controls; API `end_at > now` → `400` | ☐ |
| TS-12 | §5 | Overnight split | Entry 22:00 → 02:00 | Splits at local midnight across days correctly | ☐ |
| TS-13 | §5 | Working-window flag | Entry outside org working window | Flagged; reason required to save | ☐ |
| TS-14 | §6 | Week navigation | Prev/next week pickers | Future weeks can't be opened; current week quick action resolves correctly | ☐ |
| TS-15 | §15 | Validation | End before start, overlapping entries, break > duration | Inline errors; nothing persisted | ☐ |

## G. Dashboards — PDF §6

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| DASH-01 | §6 | Role scopes | `[E]` `[M]` `[H]` dashboards | Employee: My work only; Manager: +Team tab; HR: +Organization tab | ☐ |
| DASH-02 | §6 | Pending review | `[M]`/`[H]` personal tab | Pending-review count + links to review lists | ☐ |
| DASH-03 | §6 | Approved hours | Personal tab | Approved hours for the period + timezone label | ☐ |
| DASH-04 | §6 | Status chips | Click a status chip | Lands on pre-filtered list showing those rows | ☐ |
| DASH-05 | §6 | Scoped numbers | Compare `[M]` team vs `[H]` org figures | Team < org; no draft leaks into counts | ☐ |
| DASH-06 | — | Allocation balance | `[E]` personal tab | See ALLOC-02 | ☐ |

## H. Search, Filters, Pagination — PDF §6, §15

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| SEARCH-01 | §15 | Text search | Requests/Timesheets/Employees/Departments/Allocations search boxes | Scoped results only; debounced | ☐ |
| SEARCH-02 | §15 | Filters | Status, date range, type filters | Combined correctly; reflected in results | ☐ |
| SEARCH-03 | §15 | Sorting | Sortable column headers | Asc/desc toggle; indicator shown | ☐ |
| SEARCH-04 | §15 | Pagination | Long lists (requests, notifications ≥50/page) | Paged, page controls work; API uses `page` param | ☐ |
| SEARCH-05 | §15 | Empty results | Search with no matches | Clean empty state; filters can be cleared | ☐ |
| SEARCH-06 | §15 | Deep-linkable filter | Copy a `?status=...` URL → new tab | Same filtered view loads | ☐ |

## I. Notifications — PDF §6

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| NOTIF-01 | §6 | Events fire | Submit/approve/reject/return a request + timesheet | Both actor-side and reviewer notifications created | ☐ |
| NOTIF-02 | §6 | Unread badge | Bell icon | Count updates (polls ≤60s, paused when tab hidden) | ☐ |
| NOTIF-03 | §6 | Inbox | Open notification panel | Paginated list (50/page); click → related record | ☐ |
| NOTIF-04 | §6 | Mark read | Click a notification / mark all | Unread clears; persists across reload | ☐ |
| NOTIF-05 | §6 | Localized | Switch to Arabic → trigger a notification | Message fully Arabic incl. params; RTL panel | ☐ |
| NOTIF-06 | §5 | Email settings | `[H]` Settings → email delivery | Environment vs custom SMTP modes; test connection works | ☐ |

## J. Reporting — PDF §5, §6

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| RPT-01 | §6 | Working-hours report | `[M]`/`[H]` Reports | Team (manager) / org (HR) aggregated hours, date-range filter | ☐ |
| RPT-02 | §6 | Requests report | Reports → Requests tab | Counts by status/type; drafts excluded entirely | ☐ |
| RPT-03 | §6 | Scoped data | `[M]` vs `[H]` same report | Manager sees direct-team only, labeled "current team" (D-009) | ☐ |
| RPT-04 | §6 | CSV export | Export a report | CSV downloads ≤10k rows; formulas neutralized; range ≤366 days | ☐ |
| RPT-05 | §15 | Employee access | `[E]` open `/reports` or call its API | `403` | ☐ |

## K. HR Administration — PDF §5

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| HR-01 | §5 | Directory | `[H]` Employees | Org-wide list, search/filter/sort, pagination | ☐ |
| HR-02 | §5 | Provision employee | `[H]` New employee → invite email | Account created inactive → invite sent → acceptance activates (see AUTH-10) | ☐ |
| HR-03 | §5 | Edit record | `[H]` employee detail → edit | Fields, role, manager saved; validation on bad input | ☐ |
| HR-04 | §5 | Reporting lines | Change employee's manager | Reassigns pending review steps (see APR-07) | ☐ |
| HR-05 | §5 | Account status | Deactivate an account → try to sign in | Blocked with safe message; sessions ended | ☐ |
| HR-06 | §5 | Departments | `[H]` Departments → create/edit, set manager, members | CRUD works; member list + stats on detail | ☐ |
| HR-07 | §5 | Role assignment | Grant/revoke Manager role | Nav + scopes update on next login | ☐ |
| HR-08 | §15 | Non-HR blocked | `[E]`/`[M]` call `/api/v1/employees/` mutations | `403` | ☐ |

## L. Organization & Type Configuration — PDF §5

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| CFG-01 | §5 | Request types | `[H]` Requests → Types → new/edit | Name, fields config, unit (`none`/`unit`/`hour`), item/dates/allocation flags, HR-required flag; code auto-generated | ☐ |
| CFG-02 | §5 | Allocation option | Type with `unit` ≠ none | `requires_allocation` auto-checks on unit pick but HR can uncheck (opt out); `unit=none` keeps it off | ☐ |
| CFG-02a | §5 | Allocation opt-out | `[H]` WFH type: `unit` + allocation off → `[E]` new request | Dates + read-only derived quantity; no grant needed; draft saves | ☐ |
| CFG-02b | §5 | Item flag | `[H]` Equipment type: `requires_item` on | Employee form asks item name + editable quantity; leave types never show an item field | ☐ |
| CFG-02c | §5 | Dates flag | `[H]` type with `requires_dates` on (any unit) | Employee form shows required start/end dates; save blocked without them | ☐ |
| CFG-03 | §5 | Org working window | `[H]` Settings → earliest start / latest end / max daily | Entries outside flagged (see TS-13) | ☐ |
| CFG-04 | §5 | Week start / timezone | Change org week-start | New sheets align; "Current Timesheet" quick action resolves | ☐ |
| CFG-05 | §15 | Config permissions | `[E]`/`[M]` write to settings endpoints | `403` | ☐ |

## M. UX, Accessibility, i18n — PDF §8, §9, §15, §22

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| UX-01 | §15 | Responsive — mobile | 360px wide: login, dashboard, requests, timesheet day | No horizontal scroll; sidebar → drawer; tables/cards reflow | ☐ |
| UX-02 | §15 | Responsive — tablet | 768px pass | Layout adapts; filters collapse cleanly | ☐ |
| UX-03 | §9 | Loading state | Throttle network (DevTools) → open lists/detail | Skeleton/spinner, no blank flash | ☐ |
| UX-04 | §9 | Error state | Stop backend → reload a page | Friendly error + retry; no stack trace | ☐ |
| UX-05 | §9 | Empty + success states | Empty inbox; successful submit | Empty-state text; success feedback/toast | ☐ |
| UX-06 | §9 | Validation states | Bad form input | Inline per-field errors + summary; focus moves to error | ☐ |
| UX-07 | §9 | Keyboard only | Tab through login→dashboard→a dialog | Focus visible everywhere; Esc closes dialog; focus trapped in it | ☐ |
| UX-08 | §9 | Dialogs | Any confirm (delete, discard check-in) | Branded centered modal, backdrop + Esc cancel, confirm focused | ☐ |
| UX-09 | §9 | Contrast/dark mode | Toggle theme → walk key pages | Both themes readable; brand assets switch (dark logo) | ☐ |
| UX-10 | §8 | Brand consistency | Compare pages | Same palette/typography/spacing; logo variants present | ☐ |
| UX-11 | §8 | Arabic + RTL | Switch language → dashboard, forms, dialogs, sidebar | Full RTL mirror: sidebar right, chevrons flip, text right-aligned, Noto Sans Arabic | ☐ |
| UX-12 | §8 | Arabic input/validation | Arabic text in forms + error messages | Renders/stores correctly; messages translated | ☐ |
| UX-13 | §9 | Reflow at 320px / 200% zoom | Extreme sizes | Still usable per D-009 | ☐ |

## N. Security & Technical — PDF §10, §12, §22

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | §12 | Input validation | API: POST malformed payloads (bad types, over-length, invalid UUIDs) | `400` with field errors; never 500 | ☐ |
| SEC-02 | §12 | Safe errors | Force an API error | No stack trace/SQL/secret in response body | ☐ |
| SEC-03 | §12 | CSRF | POST to a mutation endpoint without CSRF token (`curl` no cookies) | Rejected | ☐ |
| SEC-04 | §12 | Unauthenticated API | `curl` any `/api/v1/` endpoint signed out | `401`/`403`, no data | ☐ |
| SEC-05 | §12 | Secrets hygiene | `git log -p | grep -i secret/password` + check `.env` ignored | No secrets in repo; `.env.example` has placeholders only | ☐ |
| SEC-06 | §10 | Migrations | `manage.py showmigrations` + `migrate --check` | All changes via versioned migrations; no drift | ☐ |
| SEC-07 | §12 | Pagination enforced | `GET /api/v1/requests/?page_size=10000` | Page size capped; response paginated | ☐ |
| SEC-08 | §10 | API docs | `/api/v1/schema/docs/` | Swagger shows all endpoints + auth | ☐ |
| SEC-09 | §15 | Error handling UI | Kill network mid-request | App shows error state, retry works, no crash | ☐ |
| SEC-10 | §12 | Session cookie flags | DevTools → Cookies | `HttpOnly`/`SameSite` set | ☐ |

## O. Deployment & Docs — PDF §16, §17

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| DEP-01 | §16 | One-command stack | `docker compose up` on clean checkout | App + API + DB come up; migrations applied | ☐ |
| DEP-02 | §16 | Env externalized | Check compose/settings read `.env` | No hardcoded secrets/URLs | ☐ |
| DEP-03 | §16 | README | README has setup, architecture, test, deployment steps | ⚠ **Gap** — no `README.md` at repo root; `AGENTS.md` + `docs/` cover internals but not the §16 README requirement | ☐ |
| DEP-04 | §16 | Demo credentials | All 3 role accounts work | ✔ (this doc) | ☐ |
| DEP-05 | §16 | **Public deployment** | App reachable on a non-localhost URL | ⚠ **Not yet done** — local Docker only (D-007 deferred until a server is approved) | ☐ |

## P. SpecKit & Process — PDF §13, §14, §17

| ID | PDF | Scenario | Steps | Expected | ☐ |
| --- | --- | --- | --- | --- | --- |
| SPEC-01 | §13 | Constitution exists | `.specify/memory/constitution.md` | Ratified v1.0.0, covers product/UX/design/backend/db/security/quality | ☐ |
| SPEC-02 | §13 | Feature specs | `specs/001`–`007` each with spec.md, plan.md, tasks.md | All present; specs testable | ☐ |
| SPEC-03 | §13 | Traceability | Pick a feature → spec → tasks → commit | Requirement → spec → task → code chain visible | ☐ |
| SPEC-04 | §14 | AI evidence | `docs/evidence/` | Tools used, what was generated/reviewed, verification recorded | ☐ |
| SPEC-05 | §17 | Deliverables | Brand package, product docs, design system, docs, tests | All under `docs/` + `specs/` + repo | ☐ |

---

## §15 Minimum Testing Scope — coverage index

| PDF §15 bullet | Scenarios |
| --- | --- |
| Authentication, sign-in failure, protected routes | AUTH-01…05, 08 |
| Employee/Manager/HR permissions + ownership | RBAC-01…16 |
| Request create/validate/submit/review/final | REQ-01…13, APR-01…09 |
| Timesheet create/edit/submit/review/return | TS-01…09, 15 |
| Unauthorized API + other manager's team | RBAC-05, 08–10, APR-08, RPT-05 |
| Search, filters, pagination, empty results | SEARCH-01…05 |
| Responsive mobile/desktop | UX-01, 02, 13 |
| Backend/network error handling | UX-04, SEC-09 |

## Automated coverage already in place

| Area | Evidence |
| --- | --- |
| Backend unit/service tests | `pytest backend/` — ~400+ tests incl. RBAC matrix, workflow, allocation, draft-delete suites |
| Frontend | `vitest` — 57 component/flow tests |
| E2E | `tests/e2e/*.spec.ts` — auth-rbac, requests, timesheets, allocations, reporting, accessibility, resilience |
| Command | `docker compose exec backend pytest` · `npm test` (frontend) · `tests/e2e/run.sh` |
