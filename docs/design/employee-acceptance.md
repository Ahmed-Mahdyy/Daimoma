# Employee Journey Acceptance Cases (Design Review)

Status: phase-001 deliverable (T007). Written before prototypes; each case is exercised in `docs/design/prototypes/` and reviewed per `quickstart.md`. EN + AR coverage required for every case.

## Request submission

1. **Happy path** — Given a draft request, when the employee completes required fields and submits, then a confirmation shows the request is pending, names the next reviewer (manager), and appears in "My requests" with a timeline entry.
2. **Required fields** — Given an empty required field, when submitting, then field-linked errors in the active language appear, an error summary receives focus, and entered data is preserved.
3. **Validation** — Given a past end-date before start-date, when submitting, then a field-level error explains the rule in the active language.
4. **Draft save** — Given partial input, when the employee leaves, then an unsaved-changes warning offers save-draft / discard / stay; a saved draft appears in "My requests" labeled Draft.
5. **Attachment** — Given a file over the type/size limit, when selecting it, then an inline error explains the limit before upload (policy values provisional under D-006).

## Status and correction

6. **Pending visibility** — Given a submitted request, when opening it, then the employee sees current stage, reviewer role, and full history; no edit affordance appears on locked fields.
7. **Returned** — Given a returned request, when opening it, then the manager's reason is prominent, fields are editable, and "Resubmit" is distinct from "Rejected" (which is terminal with reason shown, no resubmit control).
8. **Rejected** — Given a rejected request, when viewing, then the reason displays, the record is read-only, and the suggested next action is creating a new request.

## Timesheet

9. **Weekly entry** — Given a draft week, when logging a day, then start/end (or hours, per D-005) save with running total; overlapping intervals trigger an inline conflict error.
10. **Submit lock** — Given a submitted timesheet, when viewing, then entries are read-only with an explanatory banner ("Submitted — awaiting manager review" / «بانتظار مراجعة المدير»).
11. **Returned timesheet** — Given a returned week, when opening, then the reviewer's reason and editable entries show, with resubmit available.
12. **No future time** — Given a future date, when logging completed work, then a validation error blocks it (per approved D-005 policy).

## States and devices

13. **Empty** — Given no requests, when opening "My requests", then an empty state explains and offers "New request" (not a blank table).
14. **Loading/slow** — Given a slow network, when navigating, then skeletons show for lists; submit buttons show progress and disable to prevent duplicates.
15. **Failure** — Given a failed save, when it errors, then a retryable error banner appears and input is preserved; nothing claims success.
16. **Session expired** — Given an expired session mid-form, when submitting, then a re-authentication prompt appears without losing input or silently resubmitting.
17. **Responsive** — Given 360px width, when viewing lists/forms, then tables become cards and filters collapse into an accessible disclosure; at 320px nothing requires two-axis scrolling (except approved wide tables).
18. **RTL** — Given Arabic selected, when viewing any screen, then layout mirrors, icons mirror only where directional, and mixed IDs/dates render correctly via bidi isolation.
19. **Keyboard** — Given no mouse, when tabbing, then every action is reachable, focus is visible and never fully obscured, dialogs trap/restore focus.
20. **Non-color status** — Given color blindness, when scanning status, then icon + text label disambiguate Draft/Pending/Returned/Approved/Rejected.
21. **Previous weeks** — Given older weeks, when paging through history and opening one, then its read-only day totals, current status and prior review transitions are visible; returning to the draft week is explicit. Prototype values are synthetic and do not persist.
