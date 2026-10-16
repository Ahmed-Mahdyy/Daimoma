# Daimoma (ديمومة) — Final Presentation Deck

Product · Brand · Demo · Architecture · Spec Kit · AI process
Audience: judges/reviewers. Slide notes in italics. All figures come from
`docs/evidence/` — no claims without evidence.

---

## 1 — Title

# Daimoma — ديمومة
**«سجّل وانسَ — ديمومة مستمرة»**
*Record and forget — Daimoma is ongoing.*

Requests · Timesheets · Approvals · Reports — bilingual, accessible, deployed.

*Daimoma (ديمومة): "continuity/permanence" — a real Arabic word, root د-و-م.*

---

## 2 — The problem

- Employee requests and working time live in chat threads, paper, and spreadsheets.
- Nobody can answer: *who approved what, where did the hours go, what's still pending?*
- Fragmented tracking → lost requests, unverifiable timesheets, no audit trail.

**One accessible workspace**: employees submit and track, managers review their
team, HR administers the organization — with ownership and status always visible.

---

## 3 — Who it serves

| Role | Sees |
|---|---|
| Employee | Own requests, own timesheets, own balances |
| Manager | Team's non-draft work + own employee view |
| HR | Organization-wide work, admin, request types, allocations |

*Scope is enforced on the server — not just hidden in the UI (evidence: 31-test
security matrix, `docs/evidence/006-*`).*

---

## 4 — Brand

- **Name**: Daimoma (ديمومة) — continuity; the work never stops flowing
- **Identity**: approved final logos `/brand/logo-*.png`, teal/gold palette,
  light + dark themes (D-010, approved 2026-10-15)
- **Bilingual by design**: full English + Arabic UI, RTL layouts, directional
  icons (D-002)
- Accessible: WCAG 2.2 AA target — axe checks on login/dashboard/reports/lists
  in both themes

---

## 5 — Live product

**`http://13.53.139.255:8380`**

Quick-login panel on the sign-in page: Employee / Manager / HR — one click,
synthetic demo org (16 people, 5 departments, 53 requests, 83 timesheets,
387 work entries).

*Demo-mode flag is a deliberate, documented deviation (`VITE_DEMO_LOGIN`) —
disabled before any real data per D-008.*

---

## 6 — Requests

- Six categories: leave, work-from-home, equipment, HR service, general, early leave
- Two-stage approval per D-004: manager → HR only when the type requires it;
  non-self fallback when no eligible manager exists; no self-approval
- Full lifecycle: draft → pending → approved / returned / rejected, resubmit
- "Only mine" filter, search, sort, status/type filters — all server-side,
  URL-backed, paginated
- Allocations (008): HR grants dated allowances per employee/type; reserve on
  submit, release on return, settle on approval — balances always reconcile

---

## 7 — Timesheets

- Weekly sheet, per-day submission (D-005); compact week-grid view
- Time entries: start/end + unpaid breaks, integer minutes, overnight split,
  no future work; outside-window entries flagged with required reason
- Always two-stage review: manager then HR; return unlocks the week;
  HR-only reopen with reason
- OpenCheckIn punch widget in the topbar — real check-in/out writes entries

---

## 8 — Dashboards & reports

- Role-scoped dashboards: status chips and stat tiles are clickable → filtered lists
- Working-hours and requests reports (366-day cap), grouped by current team
- CSV export ≤10,000 rows with formula-injection neutralization
- Persistent notification inbox: unread badge (60 s poll), filters, icons,
  click-through targets

---

## 9 — Architecture

```
Browser (React + TypeScript, strict)
        │  same origin, HTTPS-ready
Nginx (edge) ──► web container ──► Django/DRF ──► PostgreSQL 17
                  (static SPA)      modular monolith   (private network)
```

- Modular monolith: explicit services, scoped querysets, thin API adapters
- One organization per deployment; all data scoped server-side
- API documented: OpenAPI schema + `docs/architecture/api.md` + `erd.md`

---

## 10 — Security

- Server-enforced RBAC + ownership/reporting-line scoping on every list,
  detail, aggregate, and export
- Session auth, CSRF, throttling per D-009 (5/5min per account, 20/5min per IP)
- Secrets never in git; DB unreachable from outside the Docker network
- Evidence: 31 security tests; penetration-style negative tests per endpoint

---

## 11 — Deployment & ops

- Docker Compose production stack; web binds loopback only
- **Nginx Proxy Manager** public edge (`:8380`), Portainer for container ops
- **CI → deploy pipeline**: push to `main` → test gate → rsync → rebuild →
  smoke check. Verified end-to-end.
- Runbook: deploy, rollback, backup, failure triage — `docs/operations/runbook.md`
- Deviation noted: HTTP only (no domain/TLS yet); secure defaults retained
  in `production.py`

---

## 12 — Built with Spec Kit

- Constitution ratified (v1.0.0, D-000) before any code
- 8 feature specs → plans → task lists → implementation → evidence
- **11 recorded decisions** (D-001…D-011) — every ambiguity was asked,
  answered, dated, and traced to artifacts
- Requirements ↔ tasks ↔ evidence traceability in every feature folder
- All phases owner-accepted (006/007 on 2026-10-16)

---

## 13 — Traceability example

```
D-005 (time policy)
  → specs/004-timesheets/spec.md
  → plan.md (data model, contracts)
  → tasks.md (T001–T019)
  → backend/apps/timesheets/ + frontend/src/features/timesheets/
  → docs/evidence/004-*.md
  → owner acceptance
```

*Same chain exists for every feature — auditable end to end.*

---

## 14 — AI-assisted development (disclosed)

- Built by Devin (Cognition) under spec-kit discipline
- AI wrote code; **humans approved every decision** (D-register) and every
  phase acceptance
- Reviewed-work policy: no unreviewed AI output represented as accepted
- Evidence files distinguish verified checks from unrun ones honestly —
  e.g. "development-hardware measurement, not production SLA"

---

## 15 — Quality evidence

| Suite | Count |
|---|---|
| pytest (backend) | 427 |
| Vitest (frontend) | 45 |
| Playwright e2e | 60 (13 accessibility) |

- Load check: 500 employees, ~130k entries, 25 concurrent users — all p95
  budgets pass; real N+1 found and fixed (13.3 s → 0.2 s)
- Concurrency suites on separate connections; populated-migration upgrade tests

---

## 16 — Honest limitations

- HTTP only — domain + Let's Encrypt pending (NPM ready)
- Demo quick-login shows a shared password — demo mode only, disabled before real data
- No automated backups — waived by owner (D-008); manual `pg_dump` documented
- Attachments deferred (D-006); console email backend; SMTP unapproved
- Admin UIs (`:8181`,`:9000`) public at owner request — restrict when possible

*Saying what's not done is part of the process — the spec and the truth agree.*

---

## 17 — Summary

- Complete, live, bilingual employee-operations product
- Spec-led: constitution → 8 features → traceable tasks → evidence → acceptance
- Secure by construction, tested, deployed, and operable
- AI-assisted — with every decision and acceptance owned by humans

# شكراً — Thank you. Questions?

---

### Appendix — demo credentials & links

- App: `http://13.53.139.255:8380` (quick-login buttons on the page)
- Repo: `github.com/Ahmed-Mahdyy/Daimoma`
- Ops: Portainer `:9000`, NPM admin `:8181` (credentials server-side)
- Evidence: `docs/evidence/001-…007`, `docs/operations/runbook.md`
