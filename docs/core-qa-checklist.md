# Core QA checklist — self-run

Hands-on pass over the core requirements. Auth/login is already verified — start here.
Work top to bottom; tick each box. If something fails, note the ID (e.g. `C-03`).

Accounts — password `E2ePassw0rd1` for all:
`employee-e2e@acme.test` · `manager-e2e@acme.test` · `hr-e2e@acme.test`

---

## 1. Roles & visibility (as employee)

- [ ] 1.1 Sidebar shows only: Home, Timesheets, Requests, Reports — **no** Employees/Departments/Settings.
- [ ] 1.2 Dashboard shows your allocation card(s) (Early leave balance) — no team/org data.
- [ ] 1.3 Visiting `/employees` directly in the URL → blocked or redirected (not a data view).
- [ ] 1.4 Requests list shows **your** requests only; no checkbox on submitted rows, checkbox on drafts.

## 2. Requests (as employee) — core flow

- [ ] 2.1 `/requests/new` → type dropdown shows review hint (`Early leave (HR)`, `Annual leave (Manager)`).
- [ ] 2.2 **Annual leave**: Start–End merged control; quantity counts working days itself, read-only; weekend-only range → warning.
- [ ] 2.3 Annual leave with no grant → amber "No allocation covers this period" hint.
- [ ] 2.4 **Early leave**: green "Available balance" hint; Date + merged From→To; **Hours is read-only** and derives from the times (14:00–14:20 → 0.5, 14:00–17:00 → 3).
- [ ] 2.5 **Equipment**: asks for item name + editable quantity.
- [ ] 2.6 **Work from home**: dates show, quantity auto-counts, saves without a grant.
- [ ] 2.7 Save as draft → appears in list as Draft with checkbox.
- [ ] 2.8 Open the draft (row click) → Edit draft / Submit for review / Delete draft at **top** of page.
- [ ] 2.9 Submit → status flips to pending; history shows the submission.
- [ ] 2.10 Draft checkbox + bulk delete → confirm dialog → row gone.

## 3. Approvals (manager + HR)

- [ ] 3.1 `manager-e2e` sees the submitted request in team list; **not** the employee's drafts.
- [ ] 3.2 Approve → request moves on; **Return** requires a reason → employee sees it returned + can edit/resubmit.
- [ ] 3.3 Early leave (HR-stage): after manager approves… wait — Early leave is **HR-only**; check `hr-e2e` sees it in pending and can approve → status approved, allocation deducts.
- [ ] 3.4 Reject requires a reason; rejected request shows terminal badge + history entry.
- [ ] 3.5 Manager cannot approve a request they submitted themselves (self-review blocked).

## 4. Allocations (as HR)

- [ ] 4.1 Requests → Allocations → row click opens the manage page (`Manage allocation — …`).
- [ ] 4.2 One Save form: change dates or granted total + reason → "Changes saved.", history gains an entry.
- [ ] 4.3 Set granted total below reserved+used → error explains why (only testable when a grant is reserved).
- [ ] 4.4 Remove → confirm dialog → status "Removed", history preserved, stops funding new requests.
- [ ] 4.5 Add allocation (employee + type + dates + amount) → appears in list; employee dashboard shows it.
- [ ] 4.6 Duplicate/overlapping grant for same employee+type+dates → rejected with a clear error.

## 5. Timesheets

- [ ] 5.1 Employee: Current Timesheet quick action → add an entry (Start→End merged datetime), save.
- [ ] 5.2 Entry outside org working window → flagged, needs a reason to save.
- [ ] 5.3 Submit the day → status changes; submit each day of the week.
- [ ] 5.4 Manager reviews the **week** bundle → approve → moves to HR → HR approves → approved.
- [ ] 5.5 Return unlocks the week for the employee with the reason visible.
- [ ] 5.6 Check In widget (top bar) → records a punch; Check Out works; today row updates.

## 6. Dashboards, search, lists

- [ ] 6.1 Employee dashboard: personal overview only. Manager: + Team tab. HR: + Organization tab.
- [ ] 6.2 Every list (requests/timesheets/employees/departments/allocations/types): search box works, Filters popover works, pagination appears past 25 rows.
- [ ] 6.3 Table rows clickable → open the record (all list pages).
- [ ] 6.4 Column headers with sort arrows toggle ordering where offered.

## 7. Notifications & reports

- [ ] 7.1 Bell shows unread badge after an event (e.g. request submitted → manager's bell).
- [ ] 7.2 Notifications page lists them; clicking marks read.
- [ ] 7.3 Reports: date From–To merged filter works; "Generate" → table; Export CSV downloads a file.
- [ ] 7.4 Reports never include drafts; group-by labels show.

## 8. HR admin

- [ ] 8.1 Employees → Add Employee → invite fields (mobile: one stacked form with section headings).
- [ ] 8.2 Departments → create/edit; members table rows open employee.
- [ ] 8.3 Employee detail: edit fields → Save changes → persists after reload.
- [ ] 8.4 Deactivate an employee → they can no longer sign in (test in a private window, then reactivate).

## 9. Request types & org settings (HR)

- [ ] 9.1 Types editor: Unit `none` disables allocation checkbox; `unit`/`hour` auto-check it (uncheckable); item flag → item field; dates flag → required range.
- [ ] 9.2 Editing a type does not change already-submitted requests.
- [ ] 9.3 Settings → Organization: working weekdays change → new request quantity counts them.
- [ ] 9.4 Working window times saved → timesheet entries outside it demand a reason.

## 10. UX / i18n / accessibility

- [ ] 10.1 Language toggle → full Arabic RTL: nav, fields, tables, arrows flip.
- [ ] 10.2 Dark mode toggle → every page readable (buttons mint, no washed-out text).
- [ ] 10.3 Mobile width (~390px): hamburger menu works, no tabs — sections stack with headings, tables scroll.
- [ ] 10.4 Keyboard only: Tab through a form, open a dropdown, submit — focus ring visible.
- [ ] 10.5 Breadcrumbs in the top bar are clickable and correct on every page.
- [ ] 10.6 Bad URL (`/nope`) → branded 404 inside the shell; Back to home works.
- [ ] 10.7 Browser tab title/favicon correct; no console errors on normal navigation (F12 → Console).

## 11. Data safety spot-checks

- [ ] 11.1 Employee deep-link to another user's request ID → error/blocked, not shown.
- [ ] 11.2 Manager deep-link to an employee's draft → blocked.
- [ ] 11.3 Draft deleted → row + record gone; submitted request has no delete.
- [ ] 11.4 Reload any detail page → same data, no stale state.
