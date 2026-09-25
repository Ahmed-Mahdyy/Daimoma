# UI and Brand Contract

**Status**: Owner-approved Phase 001 interaction/prototype handoff (2026-09-25, D-010) for **Daimoma (ديمومة)** and English + Arabic/RTL. Logo and palette are candidate assets to revisit and approve during React implementation; tagline, licensing, browser accessibility checks and production UX validation remain outstanding. This is not a running application or an API contract.

## Shared primitives

Buttons/links, text/date/time/file inputs, dropdowns, filters, cards, tables/mobile record cards, badges, dialogs, toasts, navigation/breadcrumbs, pagination, timelines, skeletons and empty/error panels. Each component documents label, semantic role, token/typography, input and output states, keyboard/focus/error association, responsive layout and EN/LTR versus AR/RTL placement. Never rely on a toast alone for persistent event history.

## Navigation and journeys

Employee: Home, My requests, My time, Notifications, Profile. Manager adds Team and Reviews; HR adds Employees, Organization reports, Request types, Settings, and authorized Audit visibility. Manager/HR personal work remains distinct from review work. Prototype menus merely illustrate eventual roles; hiding controls does not enforce permissions. Map each journey to the proposed state/role matrix in `AGENTS.md`, and label unresolved D-003/D-004/D-005/D-006 policies as provisional.

## Required state matrix

| State | Observable design contract |
| --- | --- |
| Loading | Busy status announced accessibly; preserve already-useful content where possible. |
| Empty | Explain absence and expose a permitted next action, without revealing out-of-scope records. |
| Error | Safe explanation, recoverable retry; preserve form input when safe; no claim of success. |
| Validation | Field-linked localized errors, error summary/focus when appropriate. |
| Disabled/read-only | Explain in both languages why a control is unavailable (eligibility, submitted state or prerequisite). |
| Success | Distinguishable result and status/history; label all prototype changes as simulated rather than persisted. |
| Stale/conflict | Explain external change and provide refresh; do not imply a mutation succeeded. |
| Session expired/unavailable | Safe reauthentication or return path; never silently resubmit or expose protected data. |

## Responsive and accessibility contract

Test English/LTR and Arabic/RTL at representative 360, 768 and 1440 CSS px; review reflow at 320 CSS px and text enlargement to 200% without losing content/functionality. Tables may become cards; filters may move into keyboard-operable dialogs/drawers. Target WCAG 2.2 AA, including focus visibility/non-obscuring, non-color cues, labels and associated errors, reduced-motion preference and sufficient contrast. Measure ordinary text at >=4.5:1, large text and meaningful UI graphics at >=3:1 where the WCAG criterion applies; interactive target size per WCAG 2.2 AA 2.5.8 (24 CSS px minimum or valid exception). Record exceptions, browser/viewport, actual results and remediation. These are design targets, not claims of compliance or owner sign-off; additional UX limits under D-009 require approval.

## Language and directional contract

English and Arabic are required in every designed core journey, not optional. Set document/section `lang` and `dir` for each locale; use logical CSS properties rather than left/right assumptions; review icon mirroring case-by-case (directional navigation icons mirror, logos and non-directional illustrations do not). Isolate mixed-direction names, UUIDs, email addresses, numerals and date/time text so they read correctly in Arabic. Translate form labels, actions, status/validation/error/success strings and accessibility text; Arabic translation and font coverage require actual review. Locale formatting is presentation only; it never changes persisted time semantics or authorization.

## Prototype interface

Deliver clearly labelled static HTML/CSS mockups with minimal local JavaScript to switch locales, navigate mock journeys and show state variants; no Figma dependency, backend, real sign-in, submitted requests, stored time, or live permission enforcement. Use local synthetic data only; do not capture credentials. The mockups in `docs/design/prototypes/` and candidate tokens in `assets/brand/tokens.json` now exist; the latter must be reviewed under D-010 before production React use. React/Tailwind integration is phase 002.

## Brand outputs

The name and Arabic spelling are approved. Candidate editable logos (including light/dark) and a product icon exist in `assets/brand/`; candidate palette/tokens exist in `assets/brand/tokens.json`. Neither the logo nor palette is final under D-010: revisit both with the owner during React work (002:T025) before branding production components. Tagline, font licenses and legal availability remain separate unresolved checks. Light/dark logo variants do not imply application-wide dark mode. Maintain provenance and explicit approval for final assets.
