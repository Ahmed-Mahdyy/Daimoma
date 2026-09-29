# Daimoma (ديمومة): Master Project Reference and Delivery Plan

Created: 2026-09-20. Status: planning artifacts and directory scaffold created; application implementation and owner acceptance are not complete. This persistent reference is the entry point for every future Devin session. Never infer implementation progress from the existence of a specification.

## 1. Start every session here

1. Stay inside this project; its parent is an unrelated Odoo workspace.
2. Read this reference and the [constitution](.specify/memory/constitution.md).
3. Inspect `.specify/feature.json` and the working tree, if Git has been initialized.
4. Read only the active feature's `spec.md`, `plan.md`, `tasks.md`, research, models, contracts, and checklists; load dependency artifacts when needed.
5. State the next task, its requirement IDs, unresolved decisions, verification, and permitted scope before coding.
6. Do not implement an affected policy until its approval is recorded. Do not mark a task or human review complete without evidence.
7. After working, report actual results and update only the affected tasks/decisions. This file and versioned specifications, not conversation memory, preserve context.

## 2. Mission, source, and required outcome

Source: `Employee_Requests_and_Time_Tracking_System (4).pdf`, the 13-page product brief supplied by the owner. The original is currently in the parent workspace; no copy is represented as committed project evidence. Sections 1-25 are mapped below.

Build a complete employee operations product from discovery and branding through a tested production deployment. Employees submit and track internal requests and working time; managers review their direct team; HR administers employees and oversees organization operations. Replace fragmented processes with one accessible, secure workspace.

Required stack: Django + Django REST Framework, PostgreSQL with versioned migrations, React + TypeScript frontend, documented REST APIs. Required process: Spec Kit constitution, feature specifications, technical plans, actionable tasks, reviewed AI work, automated/manual verification, deployment, and final demonstration.

Required objectives: visible ownership/status; reliable time recording/submission/review; UI and authoritative server permissions; consistent desktop/tablet/mobile brand and experience; traceable specification-led AI development.

## 3. Scope and exclusions

Release includes authentication/users, role-based access, employee requests, request approvals, timesheets, timesheet review, dashboards, scoped search/filter/sort/pagination, persistent in-app notifications, and reporting. Branding, accessible UI, employee administration, reporting lines, request-type/organization configuration, private supporting files, activity history, deployment, and evidence are deliverables.

Exclude payroll, salary calculations, statutory leave accrual, GPS/biometrics/surveillance, shifts, billing, native mobile, offline sync, arbitrary workflow builders, public signup, multi-tenant SaaS onboarding, microservices, Kubernetes, and in-product AI unless separately approved. Time tracking does not automatically mean live clock-in/out. Example request categories are leave, equipment, HR service, work-from-home, and general internal requests; final category fields require D-006.

## 4. Approval register

D-000 through D-004 are approved; the phase-001 UX portion of D-009 is approved, while its operating limits remain pending. D-010 records conditional design handoff: prototype interactions approved, logo and colors not finalized. Other policy decisions remain pending. Planning is authorized, but recommended defaults are not approved business policy. Approvals must record owner, date, answer, and affected artifacts. Do not backdate or invent answers.

| ID | Decision | Recommended default | Affected phases |
| --- | --- | --- | --- |
| D-000 | Ratify constitution and MVP | **Approved 2026-09-25 (owner):** constitution ratified as version 1.0.0 as written; amendments via change control | All |
| D-001 | Product identity | **Approved 2026-09-25 (owner):** name is **Daimoma (ديمومة)** — "continuity/permanence," root د-و-م; real Arabic word, not CDS-related; Phase 001 created candidate artwork, with final logo/colors deferred under D-010; tagline still unselected (Dawamna rejected: existing business) | 001 |
| D-002 | Languages | **Approved 2026-09-25 (owner):** bilingual English + Arabic with full RTL layouts, translated UI text, and directional icons | 001, 002-005 |
| D-003 | Accounts, organization, role scope | **Approved 2026-09-25 (owner, option B):** one organization per deployment; HR provisions accounts, no self-signup; drafts visible only to their employee owner, including against managers and HR. Manager sees current direct-team non-draft work; HR sees organization non-draft work; Manager/HR retain personal Employee capabilities. Employees edit own draft/returned work only. Cross-organization test fixtures remain for isolation checks. | 002-005 |
| D-004 | Approval routing and reassignment | **Approved 2026-09-25 (owner):** when an ordinary manager is missing/ineligible or would self-review, an eligible non-self HR reviewer is assigned responsibility; if none is eligible, block submission rather than leave an unowned queue. No self-approval. **Approved 2026-09-25 (owner, option A):** after an eligible manager approves a request, only request types explicitly configured as HR-required enter an additional HR stage; otherwise manager approval is final. **Approved 2026-09-25 (owner, option A):** an eligible non-self HR fallback decision completes even an HR-required request; do not add a second HR stage. **Approved 2026-09-25 (owner, option A):** manager changes atomically reassign outstanding steps to the new eligible manager or eligible non-self HR fallback; revoke former-manager access immediately, preserve completed history, and block the administrative change if no eligible reviewer can own all pending steps. Which request types are configured HR-required remains a later request-type configuration decision (D-006). | 002-005 |
| D-005 | Time policy | Weekly sheet; organization timezone/week boundary; start/end and unpaid breaks; integer minutes; split overnight intervals at local boundaries; no future completed work; HR-only justified reopening | 004, 005 |
| D-006 | Request fields, confidentiality, attachments | **Approved 2026-09-29 (owner):** all 5 fixed categories — leave (start/end dates), equipment (item + quantity), hr_service (title/description), work_from_home (start/end dates), general (title/description). **Attachments deferred entirely from Phase 003** — no upload feature built; if files are added later, the recorded preference is manual HR accept. **No confidential mode** — all request types route manager-first per D-004; confidential HR-only routing is not built. | 003, 005, 007 |
| D-007 | Hosting and external services | **Revised 2026-09-25 (owner):** self-hosted target, not the earlier managed-service staging proposal; local development requires no new paid service. **Approved 2026-09-25 (owner):** Phase 002 is local-development only; self-hosted synthetic staging is deferred until a server is available and deployment is explicitly approved — Phase 002 verifies with a local production-like smoke check, not a live deployment. Keep frontend/API same-origin and PostgreSQL private. **Approved 2026-09-25 (owner):** local development is fully dockerized — `python:3.12` backend image, Node LTS frontend image, PostgreSQL container; Python 3.12 replaces the proposed 3.13 baseline for this toolchain. Staging server, mail transport, region, cost and deployment remain unapproved. Invitation/recovery delivery must be server-side (never browser JavaScript with credentials or reset tokens exposed). **Approved 2026-09-25 (owner):** local development uses Django's built-in console/file email backend — no external service or credentials; any later SMTP service is a separate approval. Self-hosting is not a guarantee of zero operating cost; private file storage/scanning remain later decisions. | 002, 003, 007 |
| D-008 | Real data, privacy, retention, privileged authentication | **Partially approved 2026-09-25 (owner, option A):** only synthetic people/records in development, tests and early staging. No real or de-identified employee records in Phase 002. **Approved 2026-09-25 (owner):** defer selection/implementation of privileged MFA to a later stage; real-data use remains prohibited until MFA, privacy, retention and operational policy are explicitly approved, implemented and verified. Production deletion and retention/RPO/RTO remain unapproved. | 002, 003, 006, 007 |
| D-009 | Measurable operating limits | **Partially approved 2026-09-25 (owner):** phase-001 UX acceptance — WCAG 2.2 AA target; EN/LTR + AR/RTL at 360/768/1440 px; 320 px reflow; 200% text enlargement; keyboard/contrast/state checks. **Approved 2026-09-25 (owner):** session expires after 2 hours idle or 24 hours absolute from sign-in; single-use invitation link expires after 48 hours; single-use recovery link after 30 minutes. **Approved 2026-09-25 (owner, option A):** count failed sign-ins per account and per source IP over 5 minutes; after 5/account or 20/IP throttle further sign-in attempts for 5 minutes, without permanent account locks. **Approved 2026-09-25 (owner):** recovery requests max 3/email/hour and 20/source IP/5 minutes; failed invitation-link attempts max 20/source IP/5 minutes; recovery acknowledgements never reveal account existence or throttle state. Still pending: performance workload and report ranges | 001-007 |
| D-010 | Phase 001 design handoff and production brand | **Approved 2026-09-25 (owner):** Phase 001 design/prototype direction accepted; current SVG logo and palette/tokens are provisional. Revisit and obtain explicit approval of final logo and color palette while building React UI, before treating assets/tokens as production branding (002:T025 before branded UI tasks). Name and EN/AR scope remain approved. No accessibility, legal, or release approval implied. | 001, 002 |

Until approved, references to these defaults in feature artifacts are provisional contracts. Safe structural work and review may continue, but affected implementation gates stay closed. Missing manager or sole self-reviewing HR is not permission to bypass review.

## 5. Architecture and dependency strategy

Use a modular monolith, not a distributed backend:

```text
Browser: React + strict TypeScript
                 |
              HTTPS, same origin
                 |
        Production application entry
          |                    |
    React static assets     /api/v1/
                                |
                         Django + DRF
                 /              |             \
       private PostgreSQL  private storage  transactional email
```

The public URL serves frontend and API. PostgreSQL is private. The SPA fallback must never absorb API errors or missing protected routes.

Application baseline: Python 3.13, Django 5.2 LTS, compatible DRF, PostgreSQL 17, React 19, TypeScript strict, Vite, supported Node LTS. These are proposed application baselines, not installed runtimes. Resolve supported patched versions and dependency compatibility in phase 002; prefer versions released at least 7 days earlier unless a reviewed security fix justifies an exception. Lock exact dependency resolutions.

Proposed frontend libraries: React Router for routes, TanStack Query for server state, React Hook Form + Zod for form feedback, Tailwind and curated accessible shadcn/ui primitives for consistency. Avoid Redux unless a measured state-management need appears. Zod does not replace DRF validation.

Proposed backend tooling: drf-spectacular for OpenAPI, generated TypeScript API types, pytest/pytest-django for PostgreSQL-backed tests, Ruff for lint/format, explicit type annotations on service interfaces. Frontend verification: TypeScript, ESLint, Vitest/Testing Library, Playwright and accessibility checks. Docker/CI are defined in phases 002/007, not installed by this scaffold.

Do not add Redis, Celery, Elasticsearch, or background queues automatically. Private storage is justified by attachments; transactional email by account onboarding/recovery; malware scanning by file safety. Any additional worker must have a documented task, retries, failure behavior, and operational owner.

## 6. Code organization and clean-code boundaries

`backend/config/`: environment-specific settings, URL wiring, WSGI/ASGI entry points.

`backend/apps/`: accounts, organizations, employee_requests, timesheets, notifications, reporting, audit. Each domain will contain models, migrations, explicit service functions, scoped selectors/querysets, serializers, permissions, views/routes, and tests as justified. Avoid an extra generic repository around the ORM, giant utility files, and workflow logic hidden in signals. Serializers validate explicit allowlists; views adapt HTTP; services own transactions and transitions.

`frontend/src/app/`: routing, application shell, providers, and error boundaries. `features/`: auth, employees, requests, timesheets, dashboards, reports, notifications, settings. `components/ui/`: shared accessible primitives; `api/`: generated types and HTTP/query integration; `lib/`: genuinely shared utilities. Server state belongs in TanStack Query, form state in form controls, temporary state locally, and shareable filters in the URL.

`tests/e2e/`: cross-role browser journeys. `deployment/`: later container and release configuration. `assets/brand/`: later approved brand assets. `docs/evidence/`: later real test/review/demo evidence; do not manufacture evidence now. Empty `.gitkeep` files reserve directories and contain no working application logic.

## 7. Data model and invariant overview

Detailed field types and constraints are owned by the relevant feature's `data-model.md`.

| Owner | Models | Core invariant |
| --- | --- | --- |
| 002 | Organization, Department, custom User, EmployeeProfile | Organization-bound relationships; custom auth model before first migration; no self-manager/cycles |
| 002 | AuditEvent, Notification foundation | Restricted append-only administrative history; recipient-only durable notification records |
| 003 | RequestType, EmployeeRequest, RequestAttachment | Typed validated fields; server-assigned owner/scope; private files; immutable route per submission cycle |
| 003 | RequestApprovalStep, RequestEvent | One eligible decision per step/cycle; preserve previous review cycles |
| 004 | Timesheet, TimeEntry, TimesheetEvent | Unique employee/period sheet; accurate interval minutes; no overlap; submitted parent and children locked |
| 005 | Read models and report DTOs | No independent stored copy of workflow truth; scope before aggregate/export |

Use UUID business identifiers, explicit timestamps, appropriate uniqueness/check constraints, and protected historical references. A UUID does not provide authorization. Cross-table organization consistency requires explicit validation and service checks; do not claim an ordinary database check constraint can traverse relationships.

Time instants are timezone-aware, persisted in UTC. Periods follow a snapshot of the approved organization timezone. Invalid/ambiguous local times require an explicit resolution. Serialize per-employee time mutations and sheet transitions using a consistent lock order; reject overlaps across all relevant sheets. Backend calculations are authoritative.

## 8. State machines and authorization

```text
Request:
DRAFT -> PENDING_MANAGER -> APPROVED (manager-only route)
                       -> PENDING_HR -> APPROVED
Either pending stage -> RETURNED -> new submission cycle
Either pending stage -> REJECTED

Timesheet:
DRAFT -> SUBMITTED -> APPROVED | RETURNED | REJECTED
RETURNED -> SUBMITTED (new cycle)
APPROVED or REJECTED -> RETURNED (authorized HR reopening + reason)
```

Return/reject/reopen require a reason. Rejected requests are terminal under the proposed MVP; create a new request rather than rewriting a final decision. Reopened timesheets retain prior approvals but no longer count as currently approved. Cancellation, withdrawal, and editing historical approvals are not silently added features.

| Operation | Employee | Manager | HR |
| --- | --- | --- | --- |
| View own records/profile | Yes | Yes | Yes |
| Edit work | Own draft/returned | Own draft/returned | Own draft/returned |
| Read others' operational records | No | Current direct-team non-drafts only | Organization non-drafts only; other employees' drafts private (D-003) |
| Review requests | No | Current eligible assigned manager | Required HR stage or explicit eligible fallback |
| Review timesheets | No | Current eligible assigned manager | Explicit authorized fallback/escalation |
| Configure employees/roles/reporting lines | No | No | Controlled and audited |
| Configure request types/settings | No | No | Yes |
| Reopen decided sheets | No | No | Yes, reason required |
| Django superuser | No | No | Not implied by HR role |

No self-approval under any role. Protect the last eligible HR administrator. Never expose `is_superuser` or `is_staff` in HR role APIs. Reporting-line changes remove old manager access and audit reassignment. Historical completed decisions remain intact. Eligibility is checked on every request, not only at login.

Scope list/detail/create/update, related objects, files, notifications, reports, counts, and exports. DRF object permissions alone do not filter list results or enforce create ownership. Out-of-scope record identifiers return a non-enumerating 404; authorized but prohibited operations return 403. Auth/session/CSRF errors have distinguishable safe codes.

## 9. API and transactional contract

Use `/api/v1/`, explicit serializers, schema-documented endpoints, and action endpoints for submit/approve/reject/return/reopen. Do not permit generic `PATCH status` bypasses.

Shared proposed contract: UUID identifiers; ISO dates; offset-bearing ISO datetimes; integer minute totals; paginated lists default 25/max 100; allowlisted filtering/ordering; safe errors `{code, detail, field_errors?, request_id?}`. Invalid input is 400, forbidden operation 403, invisible record 404, stale transition/version 409, throttled request 429. DRF session authentication may return 403 for unauthenticated requests; frontend must use the documented error code rather than assume 401.

Mutation flow: load/lock -> scope/eligibility -> expected version/state -> validate -> update -> record event -> create notification -> commit. Duplicate actions cannot produce duplicate decisions. External email failure must not reverse a successful business transition; delivery failures are observable and retryable. Notification summaries avoid sensitive request content; following a target rechecks current access.

OpenAPI generated in phase 002 and expanded with each domain is the implementation contract; current phase Markdown contracts are reviewed input to it, not a claim that an API exists.

## 10. Branding and UX delivery

Produce the approved Daimoma (ديمومة) name/meaning/rationale and propose tagline; primary logo, icon, light/dark variants; primary/secondary/success/warning/error/neutral palette; both Latin and Arabic typography; 3-5 personality attributes; spacing, imagery, radius, and emphasis rules. The owner accepted the Phase 001 prototype direction under D-010 but deferred final logo and palette approval to React implementation (002:T025); do not copy candidate SVGs/tokens into production as approved branding. Proposed personality: clear, trustworthy, calm, supportive, efficient. Check licensing and confusing names; do not assert trademark clearance without evidence.

Design Employee request/time flows, Manager review/return flows, and HR administration/reporting flows before coding. Inventory login/invitation/recovery/profile, role dashboards, personal requests/editor/detail/history, weekly timesheet/editor/history, review queues, employee directory/detail/roles, request-type/settings screens, reports, notifications, forbidden/unavailable/session-expired states.

Use a shared shell with role-specific navigation. Define buttons, inputs, dropdowns, tables/mobile cards, metric cards, badges, dialogs, toasts, filters, pagination, skeletons, empty/error states, and timelines. Use consistent design tokens and plain language. Preserve recoverable form input, explain read-only states, warn on unsaved changes, and distinguish return from rejection. Toasts are not persistent notification history.

Target WCAG 2.2 AA: semantic labels, keyboard navigation, visible focus, focus restoration, non-color status cues, readable contrast, reduced-motion support, accessible errors. Review representative widths 360, 768, and 1440 CSS pixels with zoom/reflow. Arabic is approved under D-002: include translated validation/status text, Arabic typography, directional icons, and RTL layout tests; do not merely translate navigation labels.

## 11. Security baseline

Same-origin Django session authentication; HttpOnly secure session cookie; secure CSRF cookie; appropriate SameSite; CSRF enforcement on login and every unsafe action; session rotation and logout invalidation; active-account and role checks each request. Invitations/recovery are expiring/single-use with generic account-existence responses. Use framework password hashing/validation, a vetted login abuse limiter plus edge limits, and approved session policy. DRF throttling alone is not comprehensive attack protection. Privileged MFA is a real-data release gate.

Private attachment storage, validated type/size/count, generated keys, quarantine/scanning, unavailable scan failures, authorized downloads, safe content headers, no public bucket. Proposed limits require D-006. Define confidentiality/routing before accepting sensitive HR documents.

Production: DEBUG false, explicit hosts/origins, HTTPS, secure headers/CSP/framing rules, trusted proxy configuration, restricted database/network privileges, reviewed secrets storage, non-root application process, patched dependencies, secret scanning, PII-safe logs. Never make PostgreSQL public to satisfy the deployment sentence in the brief.

## 12. Performance and verification budgets

Proposed workload: 1,000 employees, 100,000 time entries, 20,000 requests, 30 concurrent active users. Ordinary list/detail p95 <400 ms; dashboard summary p95 <1 s; unexpected 5xx <1% under the approved workload. Record environment, duration, request mix, error classification, and query measurements. Proposed mobile targets LCP <=2.5 s, INP <=200 ms, CLS <=0.1; distinguish lab proxies from field percentiles. D-009 approval required before claiming these as contractual limits.

Backend: authorization scope first, bounded pagination/report ranges, deliberate select_related/prefetch_related, N+1 regression tests, database aggregation, indexes justified by query plans, connection limits matched to database capacity. No cross-user cache sharing. Frontend: stable query keys, cache invalidation, account-change cache clearing, debounced/cancelled search, route splitting, lazy heavy reports, paginated data, controlled initial bundle.

Mandatory tests: authentication/sign-in failure/protected routes; all role/ownership boundaries; request create/validate/submit/review/final status; timesheet create/edit/submit/review/return; unauthorized API and other-manager access; search/filter/sort/pagination/empty results; mobile/desktop flows; backend/network failure handling. Add concurrency, attachment, role/reporting-line changes, self-approval, CSRF, migrations, and backup restore coverage.

Planned scripts after phase 002: backend Ruff checks, pytest against PostgreSQL, `manage.py makemigrations --check --dry-run`, migration checks, production `check --deploy`; frontend lint/typecheck/test:unit/build/test:e2e; OpenAPI/type drift, dependency and secret scans. These are not runnable application commands in the current scaffold. The artifact validator is runnable now: `python3 .devin/scripts/specs.py check`.

## 13. Phase roadmap and dependencies

| Phase | Entry and complete deliverables | Exit evidence |
| --- | --- | --- |
| [001 Foundation](specs/001-brand-product-foundation/spec.md) | Brief inventory, vision/personas/MVP, branding, flows, wireframes, tokens/components, responsive prototypes | Approved scope/name/language/design and reviewed requirement matrix |
| [002 Auth/RBAC](specs/002-authentication-rbac/spec.md) | 001 decisions; locked runtimes, CI baseline, PostgreSQL/custom auth, HR directory/configuration, sessions, permissions, audit/notifications, app shell, staging smoke | Auth/role/ownership/CSRF tests and first integrated deploy |
| [003 Requests](specs/003-employee-requests/spec.md) | 002; typed requests, private files, routes, review queues, histories, notifications, scoped search | Cross-role request flow, file isolation, race/reassignment tests |
| [004 Timesheets](specs/004-timesheets/spec.md) | 002 shared services; time policy; weekly/daily UI, calculations, locks, reviews, correction/reopen | Accuracy/overlap/DST/concurrency/permission tests and browser flow |
| [005 Dashboard/reporting](specs/005-dashboard-reporting/spec.md) | 003/004 data/events; role summaries, notifications center, reports/filter/export | Reconciliation, no aggregate/export leakage, bounded queries |
| [006 Hardening](specs/006-release-hardening/spec.md) | Integrated 002-005; security, accessibility, responsive, performance, migration review and regression fixes | No release blockers; actual QA and workload evidence |
| [007 Delivery](specs/007-deployment-handover/spec.md) | Provider work begins during 002; final release waits on 006 | Live URL, restore rehearsal, real demo flows, setup/API/ERD/AI evidence and presentation |

Default implementation order is 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> final 007. 003 and 004 share foundations but need not depend on each other's implementation. Early CI/staging and delivery decisions are tasks in 002; security/testing are part of every story, never deferred to 006. No subagent or parallel writer is authorized by this dependency diagram.

Every feature package includes spec, plan, tasks, research, data model, contracts, quickstart, requirements checklist, and reviewer-owned quality checklist. Qualified IDs use `003:FR-001` and `003:T001`; local IDs are unique inside each feature. All application tasks initially remain unchecked.

## 14. Delivery, data safety, and demo

Use separate local/CI/staging/production environments and secrets. D-007 now targets self-hosting rather than managed container/database services; staging host and deployment timing remain undecided. Local development should need no new paid provider; use a server-side mail sink for test invitations/recovery rather than browser email delivery. Any self-hosted staging/production design still requires private PostgreSQL, private attachments, reviewed server-side mail delivery, TLS, logging and explicit approval of host, operating budget and release controls. Node builds the SPA; production serves assets/API through one origin. Use Gunicorn or an appropriate production server, never Django runserver for production.

Pipeline: proposed change -> lint/types/tests/security scans -> immutable build -> staging migration/E2E -> human approval -> production migration/deploy -> health/role smoke tests. No automatic production deployment or remote side effects are authorized by this scaffold.

Review migration locks/SQL, test upgrades from populated data, separate large backfills, prefer expand/contract changes. Retain prior application image and compatible rollback path; do not assume reversing a migration is safe. Database reset is not a deployment technique.

Operations: liveness/readiness, correlation IDs, structured PII-safe logs, latency/error alerts, email/storage/scanning failure visibility, database plus file backups, isolated restore rehearsal, retention/RPO/RTO ownership, incident/rollback procedures. Log actual rehearsal results, never assumed ones.

Synthetic demo: one organization, two departments, two managers, four employees across both teams, two HR users; five approved request categories; draft/pending/returned/approved/rejected requests and sheets created through real services. No real employee data. Runtime-generated credentials are shared securely, never committed. Idempotent seeding must not overwrite existing users/records or run silently in production. Synthetic data is disclosed; mocked behavior presented as working functionality is forbidden.

## 15. Definition of Ready and Done

Ready: approved affected decisions; scoped user stories; permission matrix; testable success scenarios; all UI states; data/API contracts; migration implications; bounded performance targets; dependency-ordered tasks; no critical consistency findings; reviewer checklist accepted.

Done: real UI/API integration, required positive/negative tests, server scope and state enforcement, concurrency/data integrity checks, safe migrations, responsive/a11y review, measured performance, updated contracts/specifications, actual evidence, and human acceptance. No fake success responses or skipped checks represented as passing. A checked requirements checklist is not implementation evidence.

## 16. Beginner's Spec Kit and Devin guide

Spec Kit is a specification workflow, not Django/React code and not an AI model. `spec.md` states what/why; `plan.md` states how; `tasks.md` is executable work; `data-model.md` and `contracts/` prevent interface drift; `quickstart.md` defines validation; custom checklists evaluate requirement quality.

The official CLI is installed locally at `.devin/tools/spec-kit/bin/specify`, version 1.0.6. Its environment is ignored. `.devin/spec-kit-requirements.txt` records the installed resolution and immutable source revision. This local tooling environment is separate from the future backend virtualenv. Python 3.12.3 is available; standalone `devin`, uv, Node, and npm were not on the shell PATH during setup. Open this directory in Devin Desktop to use its detected skills; install supported frontend runtimes before phase 002 builds. Do not assume the terminal CLI exists just because Desktop does.

To reproduce the local tool environment from this directory:

```bash
python3 -m venv ".devin/tools/spec-kit"
".devin/tools/spec-kit/bin/python" -m pip install -r ".devin/spec-kit-requirements.txt"
".devin/tools/spec-kit/bin/specify" version
```

Do not rerun `specify init --force` over reviewed artifacts as a routine workflow. Native integration/templates already exist. Inspect differences on a tool upgrade; never silently accept rewritten project rules.

Select and inspect a feature in the terminal:

```bash
python3 .devin/scripts/specs.py list
python3 .devin/scripts/specs.py select 001
python3 .devin/scripts/specs.py check
python3 -m unittest discover -s ".devin/scripts" -p "test_*.py" -v
bash .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
```

The helper's `check` command is read-only and validates artifact structure, local links, requirement/task/story references, and decision references. It does not prove semantic completeness or application behavior. `check --require-ready` additionally refuses open checklist items; checklist closure still requires genuine owner/reviewer approval. The selector only changes local feature state, rejects unknown/outside/ambiguous selections and symbolic-link state files, and preserves other state metadata.

`.specify/feature.json` is the local pointer. `SPECIFY_FEATURE_DIRECTORY` overrides it; unset an unintended override. Git branch changes do not switch features. Quote the project path whenever using a shell.

Use skills in Devin chat, not Bash. All seven specs/plans/tasks already exist: do not run `/speckit-specify` blindly and create duplicates. Select the existing feature and ask to amend it. Use `/speckit-specify` for genuinely new approved features.

For existing feature 001, begin with `/speckit-clarify` to approve identity/language/scope, review/update artifacts, then `/speckit-checklist`, `/speckit-analyze`, and only after approval `/speckit-implement` for one bounded task group. `/speckit-plan` and `/speckit-tasks` may be used to refine the current design; require preservation of IDs and completed history. `/speckit-converge` checks the code against artifacts and may append missing tasks; it does not replace tests or acceptance.

Suggested resume prompt:

> Read AGENTS.md, the constitution, and the active feature artifacts. Inspect the working tree. State what is planned, implemented, and verified; identify pending decisions and the next task. Do not implement until affected gates are approved. Work only on the approved task group. Do not commit, push, create issues, launch subagents, deploy, or perform destructive actions.

Suggested amendment prompt:

> Amend the active feature for the requested behavior. Analyze security, UI, contracts, data, migration, tests, and deployment impact first. Preserve stable requirement/task IDs and completed evidence; append delta tasks. Keep pending decisions explicit and run read-only consistency analysis before implementation.

Change procedure: edit behavior in spec -> record decision -> update plan/model/contracts -> amend tasks without erasing history -> analyze -> approved implementation -> regression tests -> converge -> human acceptance. Larger capabilities get new specs. Bugs get tests against intended behavior; do not rewrite requirements to excuse a defect. Constitution changes require separate governance review.

Record AI use per task: tool/model/settings when known, why chosen, context supplied, generated changes, team decisions, rejected/corrected output, actual tests, reviewer and outcome. Avoid full sensitive transcripts. Keep reviewers independent where practical, but do not launch agents without permission.

## 17. Source brief coverage: every section

| Brief section | Requirement coverage and owning artifacts |
| --- | --- |
| 1 Project description | Mission and full lifecycle here; 001:FR-001; all seven phases |
| 2 Product objectives | 001:FR-001, 002 authorization, 003/004 workflow, 005 reporting; measured success criteria |
| 3 Product journey | Sections 10/13 here; discovery/name/brand/specify/build/test/deploy/demo |
| 4 Users and roles | Section 8 here; 002:FR-002 and role contracts |
| 5 Role capabilities | 002 employee administration/profile, 003 requests, 004 time, 005 scoped reports |
| 6 Ten core modules | Section 3 here; 002-005 specs and traceable tasks |
| 7 Workflows/read-only rule | Section 8; 003/004 transition specifications and API locks |
| 8 Branding | 001:FR-002 and UI contract |
| 9 UX/UI | 001:FR-003 through FR-006; every feature UI and tests |
| 10 Technical requirements | Sections 5/9/14; 002 foundation and 007 live deployment |
| 11 Suggested architecture | Section 5; service/dependency justifications |
| 12 Quality/security | Constitution; 002-006 security/integrity/performance tests |
| 13 Spec Kit | Native integration, constitution, all feature packages, this workflow guide |
| 14 AI-assisted process/evidence | Section 16; 006/007 evidence tasks and human approval |
| 15 Minimum testing | Section 12; each quickstart and 006 integrated QA |
| 16 Deployment | Section 14; 007 contracts/runbooks and demo credentials |
| 17 Eight final deliverables | Section 19; phase 007 acceptance |
| 18 Competition schedule | Section 18; historical dates are not completion claims |
| 19 Judging principles | Section 19; evidence-only, equal criteria, quality over feature count |
| 20 Scoring summary | Section 19 exact category weights |
| 21 Rating scale | Section 19 formula and 0-5 definitions |
| 22 Detailed rubric | Section 19 subcriterion weights and evidence |
| 23 Stage feedback | Section 18 review records and freeze policy |
| 24 Penalties | Section 19 mandatory safeguards |
| 25 Tie breaks | Section 19 priority order |

## 18. Competition milestones and review process

These are source-brief dates, not implementation estimates or claims that prior stages are complete. Current setup date is 2026-09-20; audit missing earlier evidence rather than backdating it.

| Stage | Dates in 2026 | Required outcome |
| --- | --- | --- |
| 1 | Sep 8-9 | Problem definition, users, goals, MVP |
| 2 | Sep 10-11 | Name/tagline/logo direction/palette/type |
| 3 | Sep 12-14 | Requirements, roles, permissions, user stories |
| 4 | Sep 15-18 | Flows, wireframes, design system, responsive screens |
| 5 | Sep 19-21 | Constitution, specifications, plans, tasks |
| 6 | Sep 22-23 | Architecture/database/API/security design |
| 7 | Sep 24-29 | Functional integrated frontend/backend |
| 8 | Sep 30 | Verified RBAC, ownership, protected API |
| 9 | Oct 1-2 | Automated/manual QA and defect resolution |
| 10 | Oct 3 | Live delivery, migrations, README, credentials |
| 11 | Oct 4 | Feature freeze, release candidate, evidence, rehearsal |
| 12 | Oct 5 | Live presentation, demo, Q&A and judging |

Period is Sep 8-Oct 5 inclusive, 28 calendar days. At each checkpoint submit evidence; record provisional rating, strongest aspect, principal gap, next action, reviewer/date. Corrected evidence can improve scores before freeze. After Oct 4 accept only critical deployment/presentation fixes under the brief. Final scores follow demo/repository review Oct 5.

## 19. Deliverables, rubric, and penalties

Final deliverables: brand package; vision/objectives/personas/scope/flows; design system/responsive main screens; Spec Kit artifacts; frontend/backend/migrations/tests; architecture/database/API documentation; live URL/repository/secure demo credentials/deployment notes; product/brand/demo/architecture/Spec Kit/AI presentation. README must cover setup, architecture, tests, and deployment. Future documentation is a release deliverable, not evidence already created.

| Category | Max | Exact subcriterion points | Evidence |
| --- | --- | --- | --- |
| Discovery/MVP | 7 | Problem clarity 2; users/needs 2; measurable goals 1; realistic MVP/exclusions 2 | Brief, personas, MVP |
| Naming/branding | 8 | Name relevance/memorability 2; tagline/positioning 1; logo/icon 2; colors/type 2; consistency/accessibility 1 | Rationale, variants, palette/type rules |
| Product definition | 7 | Functional requirements 2; role responsibilities 2; workflows/acceptance 2; scope consistency 1 | PRD, role matrix, stories/flows |
| UX/UI | 10 | Flow clarity 2; design consistency 2; responsive 2; loading/empty/error/success 2; accessibility/usability 2 | Design files/coded screens and responsive evidence |
| Spec Kit | 12 | Constitution 2; testable specs 3; plans 2; tasks 2; traceability 2; maintained specs 1 | Constitution/specs/plans/tasks/reviewed change history |
| Technical design | 10 | Boundaries 2; database/migrations 2; contracts/validation 2; security 2; maintainability/justified choices 2 | Architecture, ERD, API |
| Django backend | 12 | Domain behavior 3; structure/maintainability 2; API quality 2; integrity/migrations 2; queries 1; errors 1; docs 1 | Running API/source/migrations/API tests |
| Frontend | 12 | Core flows 3; components 2; responsive 2; state 1; API integration 2; validation/feedback 1; accessibility 1 | Deployed UI/source/browser evidence |
| Security | 8 | Server RBAC 3; ownership/reporting lines 2; auth/session 1; input/secrets 1; unauthorized tests 1 | Permission tests/API responses/config review |
| QA | 6 | Critical automated tests 2; auth tests 1; manual coverage 1; defect handling 1; stable flows 1 | Suite/report/checklist |
| Deployment/docs | 4 | Live environment 2; safe config/migrations 1; README/credentials 1 | Live URL/release record/README |
| Presentation | 4 | Story 1; live demo 1; technical/Spec Kit explanation 1; concise answers/team ownership 1 | Presentation/demo/Q&A |

Total 100. Ratings: 5 excellent/complete/coherent/production-ready and exceeds requirement; 4 strong/fully met/minor weaknesses; 3 acceptable/core works but incomplete depth/consistency; 2 weak/partial with important gaps; 1 minimal/mostly unmet; 0 missing/no usable evidence. Criterion points = rating / 5 * maximum. Final team score averages judges' totals. Record justifications; do not self-award scores without evidence.

Judging is evidence-only and consistent across teams, considering behavior/accessibility/responsiveness/state handling alongside appearance. Backend/API behavior proves permissions. Reward requirement-to-test traceability and team review/verification, not feature count or the chosen AI tool. A smaller coherent tested product outranks a larger incomplete one.

Penalties: committed secret/password/key -10 and immediate security review; frontend-only authorization caps security at 2/8; no live application scores deployment 0/4; destructive schema reset -5; unreviewed/undisclosed AI work makes evidence incomplete and can score affected criteria 0; fabricated core demo data/behavior scores affected stage 0 with a recorded finding. Disclosed synthetic fixtures and real operations are not fabricated working behavior.

Tie order: security -> Spec Kit/traceability -> combined backend/frontend -> testing -> panel judgment of product coherence.

## 20. Current operational status

Planning/scaffolding, the local Spec Kit tool, and the feature-selection/artifact-validation helper with its tooling tests are created. Seven phase packages contain 64 functional requirements and 125 implementation tasks. On 2026-09-20, structural/reference checks, all seven native prerequisite checks, 11 helper tests, and the local tool dependency check passed. These are tooling checks, not application acceptance.

No Django project, React application, migrations, database, CI pipeline, brand assets, application tests, credentials, production services, or Git commits are represented as existing. All application task checkboxes and owner-review gates are intentionally open.

Default active feature is 001. D-000 (constitution), D-001 (Daimoma name) and D-002 (English + Arabic/RTL) were approved 2026-09-25. Phase 001 planning was refined after those decisions; D-009 UX thresholds, name/license verification and reviewer gates remain open before design acceptance. The project directory is now `Daimoma`; the local `specify` launcher was repaired and version 1.0.6 verified after the move. Next action: obtain D-009 UX acceptance decisions and review the phase 001 requirements checklist before an approved discovery/design task group. Application runtime installation belongs to phase 002. Recheck this status before later sessions; update with actual evidence rather than assumptions.

## 21. Official references

- https://github.com/github/spec-kit
- https://github.com/github/spec-kit/blob/v1.0.6/docs/quickstart.md
- https://github.com/github/spec-kit/blob/v1.0.6/docs/installation.md
- https://github.github.io/spec-kit/reference/integrations.html
- https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/
- https://www.django-rest-framework.org/api-guide/authentication/
- https://www.django-rest-framework.org/api-guide/permissions/
