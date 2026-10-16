# Live Demo Script — Daimoma (~7 minutes)

Target: `http://13.53.139.255:8380`. Have the deck's appendix slide ready in
case connectivity drops. All data is synthetic (Acme Corporation).

## Setup (before presenting)

- [ ] Open `http://13.53.139.255:8380` — confirm the quick-login panel renders
- [ ] Browser window ~1440px, light theme; a second tab ready for the report
- [ ] Have `hr-1@acme.test` / `Daimoma2026Demo` in reach

## Flow

### 0:00 — Login (30 s)

- Show the quick-login panel: "Demo login — Employee / Manager / HR"
- Click **Employee** → lands on the dashboard
- Point out: status chips, clickable tiles, notification bell (unread badge)

### 0:30 — Employee: request lifecycle (90 s)

- **Requests** → New request → type **Leave** → pick a date range → Save draft → Submit
- Show it appear as *Pending manager* — status is visible immediately
- Switch language to **العربية** briefly — RTL layout flips (brand/UX rubric)
- Switch back to English

### 2:00 — Employee: timesheet (60 s)

- **Timesheets** → open current week — compact grid: one row per day
- Add an entry on an editable day: 09:00–17:00, 45 min break → *Submit day*
- Mention: outside-window entries get flagged and need a reason; punch widget
  in the topbar is real check-in/out

### 3:00 — Manager view (90 s)

- Log out → quick-login **Manager** (dina.mansour@acme.test)
- **Requests**: team's pending items; note **Only mine** toggle and "You" badges
- Open a pending request → **Approve** (or **Return** with a note)
- **Timesheets**: pending weeks → approve a day bundle
- Mention: manager cannot see drafts, cannot self-approve; fallback routing
  to HR when no eligible manager exists

### 4:30 — HR view (90 s)

- Log out → quick-login **HR** (hr-1@acme.test)
- **Settings** → Request types (manager/HR stage toggles) → Allocations
  (dated grants; reserve/release/settle ledger)
- **Reports** → Working hours: pick a past range → table fills with real
  seeded data; mention CSV export
- **Departments** / employee detail → profile photos, team members

### 6:00 — Reports & wrap (60 s)

- Requests report → filter by status/type — server-side, URL-backed
- Final line: "Everything you saw is one repo: specs → tasks → evidence →
  the running deployment — and every deploy after this demo goes through
  the same CI pipeline automatically."

## If something breaks

- App down → check `http://13.53.139.255:8080` (direct edge, bypasses NPM)
- Login fails → password is `Daimoma2026Demo`; panel only works when the
  build flag is on (it is in the current image)
- Screenshots of expected screens are not a substitute for the live demo —
  say so honestly and move to the deck

## Q&A prep (likely questions)

- *Why Django not X?* — batteries-included auth/RBAC/admin, DRF, mature
  migrations; modular monolith chosen deliberately over microservices
- *Is the Arabic real RTL?* — yes, `dir=rtl`, translated chrome, directional icons
- *Who approved the AI-written code?* — every decision in the D-register,
  every phase owner-accepted; evidence files separate verified vs unrun checks
- *Where are backups/TLS?* — waived for synthetic release (D-008); TLS needs
  a domain — NPM will issue a cert in one click once one exists
