# Manager & HR Journey Acceptance Cases (Design Review)

Status: phase-001 deliverable (T011). Mirrors `employee-acceptance.md` for review/admin roles; EN + AR required.

## Manager review

1. **Queue scoping** — Given a manager, when opening Reviews, then only direct-team non-draft items appear; no control implies access to other teams' data.
2. **Approve** — Given a pending request in scope, when approving, then a confirm shows the outcome, the timeline gains an entry, and the employee is notified (prototype labels it simulated).
3. **Return with reason** — Given a pending item, when returning, then a reason field is required; the item leaves the queue and shows as Returned.
4. **Reject** — Given a pending item, when rejecting, then a reason is required and the confirm states this is final for this request.
5. **No self-review** — Given the manager's own request, when viewing, then no approve/reject controls appear; the item routes to an eligible reviewer (prototype shows "another reviewer handles this" state; policy D-004).
6. **Timesheet review** — Given a submitted week, when opening, then entries are read-only with totals; approve/return/reject require reason for return/reject.
7. **Stale queue** — Given an item decided by an eligible fallback while the manager's queue was open, when acting, then a conflict notice explains and refreshes — no double decision.
8. **Empty queue** — Given nothing pending, then empty state confirms "all caught up" without implying hidden items.

## HR administration

9. **Employee admin** — Given HR, when creating or editing a person, then name, email, department, role, manager and status are available with validation and simulated feedback; a manager change asks for confirmation about outstanding reviews. The prototype never provisions a real account or writes an audit event. Directory pagination keeps all sample records reachable.
10. **Role/status clarity** — Given HR, when viewing employees, then role, manager, and account status are explicit; disabled actions explain why (e.g., protecting last HR admin).
11. **Request types/settings** — Given HR, when configuring, then changes show impact hints and a confirm; destructive actions are guarded.
12. **Reporting** — Given HR, when opening reports, then month/employee/request-status filters update synthetic summary cards, status chart and paginated detail rows consistently; an empty combination shows a clear empty state. The export button explains that no file was created. Actual scoping, calculated data and safe exports belong to phase 005.
13. **Unavailable/forbidden** — Given a missing or out-of-scope record, then a safe 404/403-style screen offers a permitted path without revealing whether the record exists to unauthorized viewers.
14. **Session expired** — Given expiry during admin work, then re-auth preserves context without silently applying pending changes.
