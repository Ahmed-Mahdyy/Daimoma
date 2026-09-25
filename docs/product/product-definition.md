# Daimoma — Product Definition

Status: phase-001 deliverable (T001/T003). Defines what the product is, who it serves, and what the MVP excludes. All role rules are provisional contracts pending D-003–D-008.

## Problem

Employee requests and working-time records are spread across chat, email, and spreadsheets. Employees can't see status, managers lack a clear review queue, and HR has no single view of the organization. Daimoma (ديمومة — "continuity") replaces fragmented processes with one secure workspace.

## Vision

A bilingual (English + Arabic/RTL) employee operations platform where every request and hour has a visible owner, state, and history — submitted by employees, reviewed by managers, administered by HR.

## Personas

### Employee — "Mariam"
- Goals: submit leave/equipment/HR-service requests, log daily work time, see status and history, fix returned items quickly.
- Pain points: doesn't know who is reviewing or why something stalled; resubmits from scratch after rejection.
- Capabilities: own profile, own requests, own timesheets; edit own draft/returned work only.

### Manager — "Khaled"
- Goals: review direct-team requests and timesheets, return items with reasons, see team hours and load.
- Pain points: approvals buried in chat; no visibility into team workload.
- Capabilities: all Employee capabilities plus direct-team non-draft records and assigned review steps. Sees **no** other team's data. Cannot self-approve.

### HR Operator — "Sara"
- Goals: administer employees/roles/reporting lines, configure request types and settings, oversee all requests/timesheets, run reports.
- Pain points: scattered records; no audit trail when reporting lines change.
- Capabilities: organization-wide scope per D-003 (including drafts for oversight), employee administration, required HR-stage review or explicit eligible fallback — never self-approval.

## Measurable objectives (phase-001 design targets; production limits under D-009)

- Every mandatory module has a designed journey before implementation (SC-001).
- Every async screen covers loading, empty, error, validation, disabled, success, conflict, and session-expired states (FR-006).
- WCAG 2.2 AA: ≥4.5:1 text contrast, ≥3:1 UI graphics, 24px targets, 320px reflow, 200% resize, keyboard + focus visibility — EN/LTR and AR/RTL at 360/768/1440 px.
- Every requirement maps to artifact → test → evidence (FR-007).

## Ten mandatory modules

1. Authentication & users 2. Role-based access 3. Employee requests 4. Request approvals 5. Timesheets 6. Timesheet review 7. Dashboards 8. Search & filters 9. Notifications 10. Reporting.

## Explicit exclusions (ratified constitution)

Payroll, salary calculation, statutory leave accrual, GPS/biometrics/surveillance, shifts, billing, native mobile, offline sync, arbitrary workflow builders, public signup, multi-tenant SaaS onboarding, microservices, Kubernetes, in-product AI. Additions require change control.

## Brief coverage reconciliation (T001)

The 13-page brief (sections 1–25) is mapped in `AGENTS.md` §17: project description, objectives, personas, branding, design system, UX, modules, workflows, security, tech stack, architecture, testing, deployment, docs, demos, AI usage, deliverables, and rubric — each assigned to phases 001–007 with owning artifacts. **Gaps found: none** — every section has a requirement owner. The only open items are owner decisions D-003–D-009 recorded in the approval register.

## Success signals for this product (post-release, not phase-001 claims)

- Employees can submit a request and see its reviewer/status without asking.
- Managers process a review queue without chat/spreadsheet fallback.
- HR sees organization-wide state and a preserved history.
