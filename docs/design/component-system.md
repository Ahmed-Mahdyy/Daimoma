# Component System Contract (Design)

Status: phase-001 deliverable (T009). Defines shared components, their states, and accessibility/RTL behavior. Implementation into React/shadcn happens in phase 002; this is the contract it must satisfy. Tokens: `assets/brand/tokens.json`.

## Global rules

- All text via i18n keys — EN + AR required; no hardcoded strings.
- `dir`/`lang` set per locale; layout uses logical CSS properties (`margin-inline-start`, not `margin-left`).
- Focus: visible 2px ring, never removed, restored after dialog/toast/route change; skip-link to main content.
- Status: icon + localized label + color — never color alone.
- Targets ≥24×24 CSS px (aim 40px); errors linked via `aria-describedby` + error summary moves focus on submit failure.

## Component contracts

| Component | States | Key behaviors |
| --- | --- | --- |
| Button (primary/secondary/ghost/danger) | default, hover, focus, disabled(+reason tooltip), loading(spinner+label) | Loading disables; danger actions need confirm dialog; never icon-only without `aria-label` |
| Input / Select / Date / Time / File | default, focus, filled, error(field-linked), disabled, readonly | Labels always visible (no placeholder-as-label); file input announces type/size limits pre-upload |
| Badge (status) | Draft/Pending/Returned/Approved/Rejected + info/success/warning/error | Icon + text; distinct shapes per state, not hue alone |
| Table → responsive cards | loading skeleton, empty, error, populated, sorted, paginated | <768px rows become labeled cards; sort headers expose `aria-sort`; pagination keyboard-reachable |
| Card (metric/record) | loading skeleton, populated, empty | Metric cards show value + delta label; no chart required in v1 |
| Dialog / Drawer | open, busy, error | Focus trap, Esc closes, focus returns to trigger; used for confirms, mobile filters |
| Toast | info/success/error, auto-dismiss ≥4s or persistent for errors | Announced via live region; never the only channel for persistent history (that's Notifications) |
| Filter bar / pagination | collapsed (mobile disclosure + count badge), expanded | Prototype month/employee/status filters update mock report metrics, chart and table; previous/next pages expose current page and record count for request, employee, review, notification, report and weekly-history lists. Production filters reflect in URL; paginated API lists default 25/max 100. |
| Timeline (history) | populated, empty | Ordered actor+action+timestamp; localized dates; bidi-safe values isolated (`<bdi>`) |
| Nav shell | employee, manager(+Team/Reviews), HR(+admin items), collapsed mobile | Role-specific items distinguish personal vs review work; active item marked `aria-current`; hidden ≠ authorized |
| Notification bell + popover | closed, open, unread count, zero unread, empty, session expired | Accessible localized name/count and `aria-expanded`; click/keyboard opens, Escape/outside closes, focus returns on Escape. Each item has read status, mark-read and open action; view-all links to the full list. Prototype state is simulated; production must fetch only recipient-scoped records and recheck target access. |
| Empty state | generic + actionable | Illustration (optional), explanation, primary action if permitted |
| Skeleton | per component | `aria-busy` on region; replaces spinner walls for lists/tables |
| Error banner | inline (field-level) and region-level | Plain-language, localized, actionable; safe — never leaks sensitive detail |
| Unavailable/403/session-expired screens | — | Explain safely, offer permitted path (home/re-auth); session-expired preserves input |

## Prototype-only markers

Every prototype screen carries a visible "PROTOTYPE — synthetic data" ribbon so mockups are never mistaken for production evidence (constitution IX/X).
