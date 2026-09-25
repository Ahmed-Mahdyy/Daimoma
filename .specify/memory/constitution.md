# CDS Employee Operations Constitution
<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

Status: ratified by the owner on 2026-09-25 (decision D-000). This constitution is binding governance; it does not by itself implement features or authorize a release. The normative rules below override upstream illustrative examples and optional-test suggestions.

## Core Principles

### I. Product scope and traceability
<!-- Example: I. Library-First -->
Every feature MUST solve an approved user problem within the source brief and agreed MVP. Requirements MUST have stable feature-qualified identifiers, testable acceptance scenarios, linked tasks, and real evidence. Out-of-scope additions require approval. Source brief coverage and phase ownership are maintained in `AGENTS.md`.
<!-- Example: Every feature starts as a standalone library; Libraries must be self-contained, independently testable, documented; Clear purpose required - no organizational-only libraries -->

### II. Server-authoritative security
<!-- Example: II. CLI Interface -->
Django MUST enforce authentication, organization scope, ownership, current reporting-line eligibility, and transition permissions. Access MUST be denied by default on lists, details, create/update actions, related objects, aggregates, exports, attachments, notifications, and audit views. Frontend visibility is not authorization. Self-approval is forbidden, including HR fallback review.
<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

### III. Tests before critical implementation
<!-- Example: III. Test-First (NON-NEGOTIABLE) -->
Critical workflows, validation, authorization boundaries, concurrency, and regressions MUST have automated tests. Write the relevant failing test before a critical implementation or bug fix where practical. Test omissions require explicit review, not silent interpretation of upstream optional-test templates. Tests MUST NOT be weakened to obtain a passing build.
<!-- Example: TDD mandatory: Tests written → User approved → Tests fail → Then implement; Red-Green-Refactor cycle strictly enforced -->

### IV. Data integrity and integration
<!-- Example: IV. Integration Testing -->
Schema changes MUST use versioned migrations preserving existing data. Production resets are forbidden. Business transitions and their histories/notifications MUST be atomic. Concurrent operations MUST NOT cause duplicate decisions or overlapping time. PostgreSQL integration tests MUST cover relevant locking and constraints. Durations MUST use integer minutes, not floating-point hours. Submitted timesheets and all child mutations MUST remain locked until an authorized return/reopen.
<!-- Example: Focus areas requiring integration tests: New library contract tests, Contract changes, Inter-service communication, Shared schemas -->

### V. Maintainable architecture and observability
<!-- Example: V. Observability, VI. Versioning & Breaking Changes, VII. Simplicity -->
Use a modular Django monolith, explicit services, scoped reads, thin HTTP adapters, and feature-oriented React. Dependencies MUST have an approved purpose and supported pinned versions. Do not introduce microservices, queues, caches, or generic repositories without a documented requirement. Errors MUST be safe and observable; logs MUST exclude secrets and sensitive employee payloads.
<!-- Example: Text I/O ensures debuggability; Structured logging required; Or: MAJOR.MINOR.BUILD format; Or: Start simple, YAGNI principles -->

### VI. Privacy and immutable business history

Attachments MUST be private and unavailable until accepted by the scanning policy. Current authorization MUST be rechecked before download. Business and security events MUST preserve actor, target, action, and time without storing unnecessary personal data. Ordinary APIs MUST NOT edit/delete history. Credentials, tokens, and real employee data MUST NOT enter source control, fixtures, demos, or AI prompts. Retention and production deletion require approved policy and execution authorization.

### VII. Accessible and responsive UX

Core flows MUST support desktop, tablet, and mobile. Async screens MUST define loading, empty, error, validation, disabled, and success behavior. Forms MUST have accessible labels and associated errors. Keyboard operation, visible focus, non-color status cues, contrast, and focus restoration MUST be verified against WCAG 2.2 AA goals. Brand tokens and shared components MUST prevent arbitrary visual variants.

### VIII. Explicit contracts and measurable performance

APIs MUST document writable/read-only fields, authorization, pagination, filters, ordering, time semantics, and error responses. Client validation MUST NOT replace server validation. Large collections MUST be paginated and scoped before aggregation. Query counts and latency MUST be measured with a documented dataset and environment before claiming optimization.

### IX. Safe delivery and evidence

Releases MUST pass tests, migration checks, security checks, and human acceptance. Secrets MUST come from approved environment/secret storage; production MUST use HTTPS, private database access, and safe settings. Backups MUST include database and attachments, with an isolated restore rehearsal. A live public application is required; a public database is forbidden.

### X. Disciplined AI and change control

AI work MUST be reviewed and disclosed with tool/model when known, purpose, accepted/rejected changes, and actual verification. Agents MUST distinguish planned, implemented, and verified work. No automatic commits, pushes, remote issue creation, subagents, destructive actions, or production deployment without explicit approval. Unresolved decisions block affected implementation, not the writing of clearly provisional planning artifacts.

## Technical and Product Constraints
<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

The required stack is Django, Django REST Framework, PostgreSQL, and React with strict TypeScript. Recommended application baseline is Python 3.13 and Django 5.2 LTS; the local Spec Kit tool runs independently on Python 3.12.3. The product supports Employee, Manager, and HR roles. Account provisioning, approval routing, weekly periods, languages, hosting, retention, and attachment limits remain proposed until decisions in `AGENTS.md` are approved. Exclude payroll, leave accrual, surveillance, native mobile, offline synchronization, arbitrary workflow building, and SaaS billing unless separately specified.
<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

## Development Workflow and Quality Gates
<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

Use constitution -> specify -> clarify -> plan -> requirements checklist -> tasks -> analyze -> approved implementation -> tests/review -> converge -> human acceptance. Each feature MUST define happy-path, edge-case, permission, and relevant performance/migration tests. A checklist approval evaluates requirement quality, not working code. Tasks remain unchecked until their work and verification are complete. `AGENTS.md` is the persistent master reference; each feature's specification is the authority for its detailed behavior. Native templates are starting points, not permission to bypass these gates.
<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

Initial draft version was 0.1.0, created 2026-09-20; ratified by the owner under D-000 on 2026-09-25 as version 1.0.0 without amendment. Amendments require a stated reason, owner approval, impact review, and corresponding changes to affected specifications, contracts, tasks, and tests. Breaking governance changes increment MAJOR; new principles increment MINOR; clarifications increment PATCH. Do not dilute principles to accommodate defects. Preserve requirement/task identifiers and completed evidence. The original brief remains the source for competition requirements; record and escalate contradictions instead of silently choosing a different requirement.
<!-- Example: All PRs/reviews must verify compliance; Complexity must be justified; Use [GUIDANCE_FILE] for runtime development guidance -->

**Version**: 1.0.0 | **Ratified**: 2026-09-25 (owner, D-000) | **Last Amended**: 2026-09-25
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->
