# Foundation API and UI Contract

Status: provisional input to generated OpenAPI; no endpoints exist yet. Shared root `/api/v1/`. All endpoints require authentication except explicit CSRF bootstrap, login, invitation acceptance, and recovery entry points; those still validate input and abuse controls.

## Shared transport

Same-origin cookie sessions; unsafe requests send CSRF header/token. Login has explicit CSRF protection despite anonymous access. Responses use safe error `{code, detail, field_errors?, request_id?}`; distinguish authentication_required, csrf_failed, permission_denied, validation_error, state_conflict, rate_limited. Preserve DRF-compatible HTTP behavior: session unauthenticated may be 403; invisible record 404; invalid input 400; conflict 409; limits 429. No traceback, password, token, or arbitrary internal exception reaches clients.

Lists: `{count, next, previous, results}`; default 25/max 100; allowlisted search/ordering; stable ordering adds UUID tie-breaker. UUID/date/datetime formats and readonly fields appear in OpenAPI. Unknown privileged fields are rejected, not silently accepted. Query scope applies before counts and pagination.

| Endpoint | Input and output | Scope |
| --- | --- | --- |
| GET auth/csrf/ | CSRF bootstrap; safe no personal data | Public, same-origin |
| POST auth/login/ | email/password -> authenticated user summary; no returned auth token | CSRF protected, bounded failures, active account |
| POST auth/logout/ | Empty body -> invalidated session | Authenticated and CSRF protected |
| POST auth/invitations/accept/ | Token and validated password -> completion outcome | Expiring, one-use token; replay denied |
| POST auth/password-reset/ | Email -> generic acknowledgement | Bounded public recovery; no account enumeration |
| POST auth/password-reset/confirm/ | Token/new password -> completion | Expiring, one-use token; approved session invalidation |
| GET/PATCH me/ | Identity/roles/profile; allowlisted ordinary profile updates only | Own active account |
| GET employees/ and employees/{id}/ | Filtered employee summaries/detail, safe fields | Own employee, manager direct-team scope, or HR organization scope |
| POST employees/ | Name/email/code/approved department/manager/business roles -> created employee | HR; organization assigned server-side |
| PATCH employees/{id}/ | Approved administrative fields and expected version when needed | HR; no auth hash/staff/superuser input |
| POST employees/{id}/deactivate/ | Reason -> deactivation result | HR, last-HR protection, audit, no history deletion |
| GET/PATCH organization/settings/ | Approved timezone/week/fallback/operational settings | HR; impact checks prevent silently rewriting existing periods/routes |

Department/role choices have dedicated scoped read endpoints or documented embedded options; never expose global user/group lists as arbitrary choices. Specific privileged-MFA endpoints depend on the vetted implementation and must be added before real-data release.

## UI contract

Login/invitation/recovery/profile, employee list/detail/provisioning, role/manager/account-status controls, and organization settings use approved components and all applicable six async states. Warn on unsaved edits and consequential deactivation/role changes. On logout/session/account change clear scoped query data; do not retry a sensitive mutation automatically after authentication.

## Security and transaction side effects

Provision account/profile/groups atomically. Invitations and recovery links are sent through approved transactional delivery; failures are visible to operators and safely retryable without logging tokens. Administrative changes atomically append AuditEvent. Notifications are recipient-only and deduplicated; later domains provide event keys. Recovery responses must not expose account existence through content or avoidable timing differences.
