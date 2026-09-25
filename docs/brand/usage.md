# Daimoma — Brand Usage Guide

Status: phase-001 deliverable (T006). Tokens live in `assets/brand/tokens.json`; assets in `assets/brand/`. This is a proposed system pending owner design review.

## Name and spelling

- Always **"Daimoma"** in Latin script, **"ديمومة"** in Arabic. Not "Daimoma HR", "Daymooma", or "DAIMOMA" except in uppercase-safe contexts.
- Pronunciation: day-MOO-ma. In sentences, may be followed by a clarifier on first mention ("Daimoma, the employee operations platform").

## Color palette

Calm/professional direction: deep teal + warm neutrals.

| Token | Hex | Contrast vs paired color | Use |
| --- | --- | --- | --- |
| brand.primary #0F6B63 | on white | 6.0:1 | Primary buttons, active nav, brand mark |
| brand.primaryHover #0B5650 | on white | 7.3:1 | Hover/active primary |
| brand.primarySubtle #E0F2F0 | text #0B4B45 | 8.9:1 | Selected rows, badges bg |
| success #1E7F4F | on white | 5.5:1 | Approved/completed |
| warning #8A5A00 | on white | 6.1:1 | Pending attention (with icon + text) |
| error #B42318 | on white | 6.4:1 | Errors, rejections |
| info #175CD3 | on white | 6.3:1 | Links, informational |
| neutral.text #102A43 | on surface #FFFFFF | 14.7:1 | Body text |
| neutral.textMuted #52667A | on surface | 6.4:1 | Secondary text (never below this on white) |

Contrast values computed from the token pairs above (WCAG 2.2 AA: ≥4.5:1 text, ≥3:1 large text/UI graphics). Rules: status is never color-only — always paired with an icon and a text label; never use warning/error colors decoratively; muted text is not for primary content.

## Typography

- **Latin**: Inter (OFL-1.1). **Arabic**: IBM Plex Sans Arabic (OFL-1.1); fallback Noto Sans Arabic. Both required — Arabic text must never render in a Latin-only font.
- Scale (rem): xs .75, sm .875, md 1, lg 1.125, xl 1.375, 2xl 1.75. Arabic line-height ≥1.6 (diacritics/ascenders).
- Headings semibold; body regular; never all-caps Arabic.

## Layout & components

- Spacing scale: 4/8/12/16/24/32/48 px. Radius: 6/10/16/pill. Focus ring: 2px #175CD3, offset 2px.
- Density: comfortable default (touch targets ≥24px CSS, aim 40px+); tables collapse to cards below 768px.
- Imagery: simple human-centered geometric illustrations and subtle continuity motifs; avoid stock photography and detailed portraits. Icon set is outline style, directional icons mirror in RTL, logo never mirrors.
- Personality in UI: calm surfaces, no loud gradients; supportive microcopy ("Your request is with Khaled") over system-speak ("Status: PENDING_MGR").

## Logo rules

Use `logo-primary.svg` on light surfaces, `logo-dark.svg` on dark surfaces, `logo-light.svg` on brand-color surfaces, `logo-arabic.svg` for Arabic light-surface contexts, and `icon.svg` for favicon/avatars ≥32px. Lockups have transparent backgrounds; place them only on appropriate contrasting surfaces. In the prototype header show the icon and exactly one locale-specific wordmark. Minimum clear space = 25% of icon width. Never mirror (even in RTL — the mark stays as drawn), recolor, or stretch.

## What this phase does NOT include

Application-wide dark theme (logo dark variant ≠ dark mode), marketing site, motion brand system. Dark mode is a phase-002+ decision.
