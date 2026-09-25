# Data Model: Accounts, Organization, Audit, Notifications

Status: provisional schema; D-003/D-004/D-008/D-009 approval and migration review required. Business records use UUID primary keys and timezone-aware created/updated timestamps where applicable.

| Model | Fields | Constraints/defaults |
| --- | --- | --- |
| Organization | name Char(160); timezone Char(64); week_start SmallInteger; fallback_reviewer nullable FK User | Nonblank name; valid IANA timezone; week_start 0..6; no unapproved timezone/week default; eligible same-org non-self fallback checked per operation |
| Department | organization FK; name Char(120); is_active Boolean | Unique normalized name per organization; active default true; PROTECT referenced records |
| User | custom AbstractUser-based model; UUID id; email EmailField; organization FK; is_active; password/auth fields; groups | Use email as USERNAME_FIELD with a matching custom manager and remove the unused username field; normalize email consistently and enforce case-insensitive database uniqueness; no public org/groups/staff/superuser writes; active defaults require provisioning policy |
| EmployeeProfile | organization FK; user OneToOne; employee_code Char(40); department nullable FK; manager nullable self-FK; job_title Char(150); preferred_locale Char(16); version PositiveInteger | Unique organization/employee_code; user/profile org invariant; no self-manager/cycle; locale allowlist; version default 1 advances on administrative mutations; historical relationships protected |
| AuditEvent | organization FK; actor nullable protected FK User; action Char(80); target_type Char(80); target_id UUID; metadata JSON; occurred_at DateTime | Server-created append-only; metadata schema allowlist and redaction; actor nullable only for server-generated system/authentication events without a known user; ordinary API/admin cannot update/delete |
| Notification | organization FK; recipient FK User; event_key Char(160); kind Char(40); summary Char(240); target_type Char(40); target_id UUID; read_at nullable DateTime; created_at | Unique recipient/event_key; recipient-org invariant; allowlisted target types; no arbitrary external URL or sensitive request body; unread default read_at=null |

Business roles: Employee, Manager, HR groups. Manager/HR retain employee capability. `is_staff`/`is_superuser` remain separate operational privileges. Email change is not an ordinary profile edit without an approved verification flow. Profile allowlist and locale values follow D-002/D-003.

## Relationships and transaction rules

Organization -> users/departments/profiles/events/notifications. User -> exactly one employee profile for application employees. Manager is a profile in the same organization with eligibility checked at use time. Serialize administrative graph changes through an organization lock; acquire employee locks in stable order before affected workflow records. Concurrent A->B and B->A changes cannot both bypass cycle checks.

## Indexes

Email normalized unique index; organization/employee_code unique index; organization/manager and department selectors; notification recipient/read_at/created_at; audit organization/occurred_at. Confirm actual query plans rather than adding every possible index.

## Migration and lifecycle

Declare AUTH_USER_MODEL before initial auth migrations. Resolve organization/user/fallback FK cycles through ordered migrations. Add business groups without credentials. No account or department hard-delete endpoint; deactivate and preserve history. Retention is a separately approved operational procedure, not an automatic unlink.
