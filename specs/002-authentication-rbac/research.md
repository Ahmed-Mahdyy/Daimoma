# Research and Decisions: Authentication/RBAC

| Decision | Rationale | Rejected alternative |
| --- | --- | --- |
| Same-origin Django sessions | Browser application benefits from server revocation, secure cookies, and framework auth | JWTs persisted in browser storage without a demonstrated cross-client need |
| Custom user before initial migration | Avoid difficult auth-model replacement later | Default user followed by a late incompatible swap |
| Business roles through Django groups plus explicit scope policy | Reuse framework concepts while preserving ownership/team boundaries | Treating HR as superuser or relying on hidden navigation |
| PostgreSQL-backed integration tests | Locking, constraints, and transactions are product-critical | SQLite-only test confidence |
| Explicit services and scoped queries | Discoverable authorization and transaction boundaries | Business workflows hidden in signals |
| OpenAPI-derived frontend types | Reduce contract drift | Manually duplicated DTOs with no schema check |

Verified references: Django 5.2 deployment checklist and DRF authentication/permissions documentation linked in the master. DRF object-level checks do not automatically scope lists or create ownership; anonymous login requires explicit CSRF protection. Spec Kit 1.0.6 supports native Devin skills.

Approved 2026-09-25: D-003 account/visibility policy and D-004 fallback, configured HR stage and reporting-line reassignment (details in `AGENTS.md` and `spec.md`). Partially approved 2026-09-25: D-007 revised by owner to self-hosting after local development with no new paid services; browser-side email delivery is not an approved/safe route for auth tokens. D-008 synthetic-only data; D-009 session/token/sign-in/public-entry abuse limits. Staging timing resolved 2026-09-25: Phase 002 is local-development only; self-hosted staging deferred until a server exists and deployment is approved. Local development mail resolved 2026-09-25: Django console/file email backend; any SMTP service is a later approval. Pending: future staging server, server-side mail transport for deployment, deployment authorization, real-data retention, performance/report budgets. Owner deferred privileged MFA implementation beyond Phase 002 on 2026-09-25; real-data release remains blocked until a vetted method is approved, implemented and tested in the later security gate (006:T015). Select and audit compatible auth/MFA/limiter dependencies during T002/T023; their availability and successful integration are not assumed. Research is an initial decision record, not proof that pending choices have been resolved.
