# Daimoma — PowerPoint Outline

Paste into PowerPoint / Google Slides. Each block = one slide.
Lines under **Slide N — Title** are bullets; *italic* = speaker notes.

---

## Slide 1 — Title

- Daimoma — ديمومة
- «سجّل وانسَ — ديمومة مستمرة»
- Record and forget — Daimoma is ongoing.
- Employee operations, in one place: requests · timesheets · approvals · reports

*Notes: Name is a real Arabic word — root د-و-م, "continuity/permanence", same
root as دَوام (work shift). Sets up the tagline wordplay for slide on brand.*

---

## Slide 2 — The Problem

- Requests and hours scattered across chat, paper, spreadsheets
- No answers to: who approved it? where did the hours go? what's pending?
- Result: lost requests, unverifiable timesheets, zero audit trail

*Notes: Keep it relatable — everyone has lost an approval in a chat thread.*

---

## Slide 3 — What Daimoma Is

- One workspace: employees submit/track, managers review their team, HR runs the org
- Ownership and status always visible — nothing disappears into a queue
- Bilingual EN/AR, accessible, deployed and live

*Notes: "One organization per deployment" — deliberately scoped, not SaaS.*

---

## Slide 4 — Users & Roles

- Employee: own requests, timesheets, balances
- Manager: direct team's non-draft work + own employee view
- HR: organization-wide work, admin, request types, allocations

*Notes: Scoping enforced server-side — not just hidden UI. Comes back on the
security slide.*

---

## Slide 5 — Brand

- Name: Daimoma — ديمومة (continuity)
- Tagline: «سجّل وانسَ — ديمومة مستمرة»
- Teal/gold palette, light + dark themes, approved logos
- Full RTL Arabic — not a translation bolt-on

*Notes: Tagline is bilingual wordplay — ديمومة is both the name and the word
"continuity". Logo files: /brand/logo-*.png — show them here.*

---

## Slide 6 — Live Demo (screenshot / live URL)

- http://13.53.139.255:8380
- Quick-login: Employee / Manager / HR — one click
- Synthetic org: 16 people, 5 departments, 53 requests, 83 timesheets

*Notes: Switch to live site here if doing a live demo — follow
demo-script.md. Otherwise a login-page screenshot with the quick-login panel.*

---

## Slide 7 — Requests

- 6 types: leave, work-from-home, equipment, HR service, general, early leave
- Lifecycle: draft → pending → approved / returned / rejected → resubmit
- Manager-first routing; HR stage only when the type requires it
- No self-approval; HR fallback when no eligible manager exists

*Notes: The routing rules are a recorded owner decision (D-004) — mention that
spec-driven decisions are traceable.*

---

## Slide 8 — Allocations

- HR grants dated allowances per employee per request type
- Reserve on submit → release on return/reject → settle on approve
- Balances always reconcile; no overlapping grants
- Early-leave billing: 15-minute blocks, 30-minute minimum

---

## Slide 9 — Timesheets

- Weekly sheet, per-day submission; compact week-grid view
- Start/end + unpaid breaks, overnight split, no future work
- Outside-window entries flagged — reason required
- Always two-stage review: manager → HR; HR-only reopen
- Punch widget: real check-in/out from the topbar

---

## Slide 10 — Dashboards, Reports, Notifications

- Role-scoped dashboards; clickable stats → filtered lists
- Working-hours + requests reports; CSV export ≤10k rows
- Notification inbox: unread badge, filters, click-through

---

## Slide 11 — Architecture

- React + TypeScript SPA → same-origin Nginx → Django/DRF → PostgreSQL 17
- Modular monolith: services, scoped querysets, thin API layer
- One org per deployment; DB on a private network
- Docs: architecture/api.md + erd.md, OpenAPI schema

---

## Slide 12 — Security

- Server-enforced RBAC + ownership scoping on every endpoint
- Session auth + CSRF; throttling: 5/5min per account, 20/5min per IP
- No secrets in git; DB unreachable from outside Docker network
- Evidence: 31 security tests, negative tests per endpoint

---

## Slide 13 — Deployment & Operations

- Docker Compose production stack; Nginx Proxy Manager public edge
- CI → deploy: push to main → test gate → rebuild → smoke check
- Portainer for container ops; runbook covers deploy/rollback/backup/triage

*Notes: The pipeline ran live during this project — a docs-only push deployed
itself. That's the demo of the pipeline.*

---

## Slide 14 — Spec Kit Process

- Constitution ratified first (v1.0.0)
- 8 features: spec → plan → tasks → implement → evidence → acceptance
- 11 recorded decisions (D-001…D-011): every ambiguity asked, dated, traced
- All phases owner-accepted

---

## Slide 15 — Traceability Example

- D-005 time policy → spec 004 → tasks → code → evidence → acceptance
- Same chain for every feature — auditable end to end

*Notes: If asked "how do we know X was decided" — show the D-register row.*

---

## Slide 16 — AI-Assisted Development (disclosed)

- Built by Devin (Cognition) under spec-kit discipline
- Humans approved every decision and every acceptance
- Evidence files separate verified checks from unrun ones — nothing fabricated

*Notes: This is a strength, not a disclaimer — the rubric rewards honest,
reviewed AI work.*

---

## Slide 17 — Quality Evidence

- 427 backend tests · 45 frontend tests · 60 e2e (13 accessibility)
- Load test: 500 employees, ~130k entries, 25 concurrent users — budgets pass
- Real bug found & fixed under load: timesheet list N+1 (13.3s → 0.2s p95)

---

## Slide 18 — Honest Limitations

- HTTP only — domain + TLS pending (one click once a domain exists)
- Demo quick-login shares a password — demo mode only, off before real data
- No automated backups (owner-waived, documented); attachments deferred

*Notes: Owning limitations builds trust — judges reward honest evidence over
overclaiming.*

---

## Slide 19 — Summary

- Complete, live, bilingual, accessible employee-operations product
- Spec-led, tested, deployed, and operable
- شكراً — Thank you. Questions?

---

## Slide 20 — Appendix / Backup

- Live URL: http://13.53.139.255:8380 (demo quick-login on the page)
- Repo: github.com/Ahmed-Mahdyy/Daimoma
- Docs: docs/architecture, docs/operations/runbook.md, docs/evidence/
