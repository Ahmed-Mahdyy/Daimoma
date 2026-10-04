# Data Model: Request Allocations

**Status**: Proposed additive schema; no migrations created. All business references carry/validate the same organization as the employee and request type. UUID IDs; organization-local dates for policy evaluation, UTC timestamps for events.

| Entity | Proposed fields | Constraints and semantics |
| --- | --- | --- |
| Organization (existing) | `working_weekdays` set/bitmask of weekday numbers 0=Monday..6=Sunday; schedule change history/effective date if changes are permitted | HR-configured, nonempty before a date-based allocation type can accept submissions; existing `week_start` is unrelated. A submission freezes the weekday set used to calculate its amount. Changes are prospective, never recompute commitments. |
| RequestType (existing) | `requires_allocation` Boolean, default false | Only leave/work_from_home/early_leave/equipment; category/unit must not be changed incompatibly while grants/commitments exist. Independent of `requires_hr` and routing. |
| EmployeeAllocationGrant (new) | UUID; organization FK; employee profile FK; request type FK; unit enum (`working_day`, `minute`, `item`); start_date/end_date inclusive; `initial_amount` positive integer; version; grantor; timestamps | Unique identity; same-org references; start<=end; no date overlap for employee/type (proposed gate); unit follows type's category; protect historical references. No automatic renewal. |
| AllocationAdjustment (new) | UUID; grant FK; signed integer delta (nonzero); HR actor FK; nonblank reason; occurred_at | Append-only. Sum of initial award plus deltas is granted amount; cannot reduce below reserved+used, including concurrent writes. History retained; no unlink via ordinary API. |
| RequestAllocationCommitment (new) | UUID; request FK; grant FK; submission cycle; amount positive integer; unit; disposition (`reserved`, `used`, `released`); snapshot of weekday set, date basis and input summary; timestamps | Unique (request, cycle); exactly one grant per submission cycle when type requires allocation; released records remain immutable evidence of amount/grant/cycle. Mutations limited to transition service under locks. |

## Calculation and lifecycle

- Date type: count configured weekdays in inclusive `[start_date, end_date]`; require entire interval inside one grant (including nonworking endpoints). A zero-day request is blocked under the proposed rule. No holidays subtracted.
- Early leave: positive elapsed whole minutes from same-day `start_time` to `end_time`; grant covers `start_date`; no overnight interval allowed by the existing request contract.
- Equipment: `quantity` items; grant covers the organization's local date at submission. Do not infer warehouse availability.
- Granted = `initial_amount + SUM(adjustment.delta)`; reserved = SUM(amount where disposition=reserved); used = SUM(amount where disposition=used); remaining = granted - reserved - used (nonnegative). Released commitments do not subtract. No independent mutable remaining-balance field.
- Draft -> pending: create one reserved commitment after capacity check. Manager -> HR pending: reservation unchanged. Final approval: reserved -> used; rejection/return: reserved -> released. Return then resubmit: new cycle, new validation and commitment. A grant expired after a valid submission retains its pending reservation until decision; expiry only prevents new submissions.
- Request type flag/schedule changes do not change existing commitments. Enabling allocation applies to subsequent submission cycles, including a returned request on new submission; never backfill an already pending or approved cycle.

## Integrity and concurrency

- Validate organization consistency in service and model validation; cross-table organization equality cannot be enforced with a simple CHECK constraint.
- CHECK initial_amount>0, delta!=0, commitment.amount>0, grant end>=start; unique request/cycle; indexes on (organization, employee, type, start_date, end_date) and grant/disposition after query-plan review.
- Use a single documented lock order starting at employee profile for grant and request operations, then grant and request/steps as appropriate; recheck latest grant/version/type/available units inside the same transaction. Adapt existing review/submit services rather than bolt on a separate unlocked after-hook. Database-backed race tests must demonstrate nonnegative availability and no duplicate commitments.
- Audit grant creation, each adjustment, schedule configuration changes and request-cycle transitions without copying sensitive free-text employee payloads. Never delete grant or commitment records as a means of correcting a balance.

## Migration and backfill

Add organization schedule setting, request-type flag and new tables in versioned, additive migrations. Existing request types default false; existing requests retain their lifecycle with no commitment. Existing data and request events are preserved. Require HR to explicitly configure the company workweek and create grants before enabling date-based allocation for live use. Test populated-data migration and backward-compatible deployment ordering; no production change is authorized at planning time.
