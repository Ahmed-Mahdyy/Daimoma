# Evidence 006 — Accessibility review (D-009 UX acceptance)

Date: 2026-10-02. Target: WCAG 2.2 AA; EN/LTR + AR/RTL; 360/768/1440px;
200% text enlargement; keyboard/contrast/state checks.

## Method — real browser checks, not checklist claims

`tests/e2e/accessibility.spec.ts` — axe-core (`@axe-core/playwright`) scans
with `wcag2a/2aa/21a/21aa/22aa` tags against the live app, plus behavioral
keyboard/viewport checks. Synthetic users only (D-008).

| Check | Mechanism | Result |
|-------|-----------|--------|
| Login page | axe scan, 5 tag sets | **PASS** — 0 critical/serious violations |
| Dashboard (authenticated shell) | axe scan | **PASS** — 0 critical/serious |
| Reports page | axe scan | **PASS** — 0 critical/serious |
| Keyboard-only login | Tab order + Enter submit, focus assertions | **PASS** — email → password → submit, no mouse |
| Focus visible (2.4.7) | computed outline/ring/shadow on focused control | **PASS** — visible indicator present |
| Reflow 360/768/1440 (1.4.10) | `scrollWidth` ≤ viewport at each width | **PASS after fix** — see defect below |
| 200% text enlargement (1.4.4) | root font-size 200%, content remains visible | **PASS** |
| Reduced motion (2.3.3) | `prefers-reduced-motion: reduce`, no essential animation >0.5s | **PASS** — 0 offenders |

**Suite result: 7/7 tests pass (10.3s).**

## Defect found and fixed

- **Header overflow at 360px** — the authenticated shell nav (6+ links +
  bell + sign-out) was a rigid flex row: `scrollWidth` measured **838px**,
  forcing horizontal scroll (fails WCAG 1.4.10 reflow).
  Fix: `AppLayout` header now wraps (`flex-wrap`); nav drops to its own row
  under `sm` breakpoints. Verified: `scrollWidth ≤ 361` at all three widths.

## Honest limits

- Automated axe covers ~40-50% of WCAG criteria; no screen-reader session was
  performed — recorded as a known gap, not silently claimed.
- Contrast is covered indirectly by axe's `color-contrast` rule (part of the
  scanned tag sets); no dedicated manual contrast sweep beyond axe results.
- RTL spot-checks live in earlier viewport/mobile e2e specs (360px usability
  journeys); Arabic layout was validated at Phase 001 handoff per D-010, but
  this suite scans the EN locale only.

## Post-redesign update (2026-10-02)

After shadcn/ui integration, added dark axe scans for login, dashboard,
reports, HR departments, and request/timesheet lists. Dark-mode contrast
regressions were detected and fixed: dashboard status chips, reports
empty-state text, departments destructive-action text, and legacy gray table
text/badges. The login theme toggle changed keyboard order; the
keyboard-only journey now focuses the email field explicitly. The full
accessibility spec passes **12/12** as part of **48/48** full browser tests.
Manual screen-reader and Arabic/RTL screen-reader review remain unrun.
