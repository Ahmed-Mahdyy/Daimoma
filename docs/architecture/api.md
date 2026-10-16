# Daimoma — API Reference (007:T012)

Base URL: `/api/v1/` — session-authenticated (HttpOnly cookie + CSRF), same-origin only. Errors use `{code, detail, field_errors?, request_id?}`; unauthenticated → `403 authentication_required`, invisible record → 404, stale version → 409 `state_conflict`, throttled → 429 `rate_limited`.

Interactive schema/docs: `GET /api/v1/schema/` (OpenAPI YAML) and `/api/v1/schema/docs/` (Swagger UI). Types for the frontend are generated via `openapi-typescript`.

## Auth & profile
| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/login/` · `logout/` | Session login/logout (throttled, CSRF-enforced) |
| `GET /api/v1/auth/csrf/` | CSRF cookie bootstrap |
| `GET/PATCH /api/v1/me/` · `me/password/` · `me/photo/` | Own profile, password change, avatar |
| `POST /api/v1/auth/recovery/` · `recovery/confirm/` | Password recovery (generic responses, single-use tokens) |
| `POST /api/v1/invitations/accept/` | Invitation acceptance (48h single-use) |

## HR administration (`HR` role)
| Endpoint | Purpose |
|---|---|
| `GET/POST /api/v1/employees/` · `GET/PATCH /api/v1/employees/<id>/` | Directory (org-scoped), provision, deactivate/reactivate |
| `GET/POST /api/v1/departments/` · `GET/PATCH /api/v1/departments/<id>/` | Departments (never deleted) |
| `GET/PUT /api/v1/settings/organization/` | Org name, timezone, week start, working weekdays, working window |
| `GET/POST /api/v1/request-types/` · `GET/PATCH …/<id>/` | Type config: unit, requires_{allocation,dates,item}, approval stages |

## Requests & approvals (role-scoped)
| Endpoint | Purpose |
|---|---|
| `GET/POST /api/v1/requests/` · `GET/PATCH/DELETE …/<id>/` | Draft CRUD (owner only), scoped lists |
| `POST /api/v1/requests/<id>/submit/` · `bulk-delete/` | Atomic submit; bulk draft delete |
| `POST /api/v1/requests/<id>/approve/` · `reject/` · `return/` | Reviewer actions (reason required, version-checked) |
| `POST /api/v1/requests/preview/` | Advisory allocation/charge preview |
| `GET /api/v1/requests/<id>/history/` | Append-only event trail |

## Allocations (HR admin + employee self-balance)
`GET/POST /api/v1/allocations/` · `GET/PATCH …/<id>/` · `POST …/<id>/adjust/` · `void/` · `GET …/adjustments/` · `changes/` · `GET /api/v1/allocations/mine/`

## Timesheets
`GET/POST /api/v1/timesheets/` · `GET/PATCH …/<id>/` · `POST …/entries/` · `…/entries/<id>/` (PATCH/DELETE) · `POST …/days/<date>/submit/` · `POST …/submit/` · `POST …/approve/` `reject/` `return/` `reopen/` · `GET/POST /api/v1/timesheets/punch/` · `POST …/punch/checkout/`

## Notifications & reporting
`GET /api/v1/notifications/` (50/page, unread badge poll 60s) · `POST …/<id>/read/` · `GET /api/v1/dashboard/?scope=personal|team|organization` · `GET /api/v1/reports/…` (requests/time reports, CSV ≤10k rows, formula-injection neutralized)

## Operations
`GET /health/` (liveness, no dependencies) · `GET /readyz/` (readiness, bounded `SELECT 1`, 503 on failure)
