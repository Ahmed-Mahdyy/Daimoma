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

Pending: D-003 account/visibility policy, D-004 fallback/reassignment, D-007 provider/email, D-008 privileged MFA and real-data retention, D-009 session/token/abuse limits. Select and audit compatible auth/MFA/limiter dependencies during T002/T023; their availability and successful integration are not assumed. Research is an initial decision record, not proof that pending choices have been resolved.
