# Research and Decisions: Foundation

## Established constraints

- Source: full 25-section brief; 10 mandatory modules, three roles, branding, accessible responsive bilingual design, Spec Kit traceability and eventual live delivery.
- D-000: constitution and MVP exclusions ratified 2026-09-25. D-001: **Daimoma (ديمومة)** selected 2026-09-25; selection is not evidence of name/trademark availability or logo/font licenses. Dawamna was rejected after owner found an existing business. D-002: English and Arabic with full RTL approved 2026-09-25.
- D-009: measurable UX acceptance **not approved**. WCAG 2.2 AA is a constitution target; additional operating budgets in `AGENTS.md` remain proposals. Reviewer gates and brand deliverables are open.

## Phase 0 decisions, rationale and alternatives

| Decision | Rationale | Alternatives considered |
| --- | --- | --- |
| Retain separate seven feature packages and trace all 25 brief sections. | Bound scope and preserve source-to-acceptance traceability. | One enormous spec obscures ownership/dependencies. |
| One shared design system and navigation shell with role-specific screens. | Consistent product and reusable components while separating personal, team and HR tasks. | Three separate role apps duplicate styles and leak inconsistent permission expectations. |
| Deliver coded static HTML/CSS prototypes plus minimal local JavaScript for state switching, with JSON semantic tokens/CSS custom properties. | Owner selected directly editable browser prototypes. No new build/runtime dependencies are needed for phase 001; tokens can map to React/Tailwind later. | Figma-first needs manual editing/round-tripping; unbuilt Markdown-only wireframes cannot demonstrate focus/RTL/error states; a premature React/Tailwind dependency would blur prototype and production. |
| Bilingual English/LTR and Arabic/RTL throughout core journeys, including errors and accessibility text. | Translation without direction, mixed-script handling or Arabic font coverage is incomplete. Use semantic `lang`/`dir`, isolate mixed-direction identifiers with `<bdi>` as needed, logical CSS properties and case-by-case icon mirroring. | A CSS-only `direction` flip or mirrored logos gives incorrect semantics/layout; translating navigation only misses user journeys. |
| Target WCAG 2.2 AA design criteria with measurable walkthroughs. | Standards provide concrete acceptance checks: 4.5:1 text contrast (3:1 large), 3:1 relevant UI graphic contrast, 320 CSS px reflow, 200% text resize and 24-by-24 CSS px pointer targets or documented exceptions; test visible and non-obscured keyboard focus. | Unquantified "accessible" claims or screenshots alone cannot prove behavior. WCAG 2.2 2.4.13 Focus Appearance is AAA, not an AA gate; don't mislabel it. |
| Prototype states precede presentation/acceptance claims. | Explicit loading/empty/error/validation/disabled/success, conflict and expired-session states are required to understand the user journey. | Happy-path mock screenshots are insufficient and cannot prove server authorization. |
| Synthetic content and provenance only. | No real employee data/secrets. Owner-selected name still needs documented conflict, trademark and font/icon licensing checks prior to external commercial use. | Treating a web search or owner preference as legal clearance is unjustified. |

## External references for the planning recommendations

- [W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/): normative AA success criteria for contrast, reflow, focus visibility/non-obscuring and target size; conformance depends on actual review.
- [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): 320 CSS px equivalent to 400% zoom at a 1280 CSS px starting width, subject to exceptions for layouts that inherently require two dimensions.
- [MDN HTML `dir`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir) and [MDN `<bdi>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/bdi): semantic direction and isolated mixed-direction text.

## Open owner/reviewer gates and handoff

D-009 UX targets still require owner adoption (proposed: WCAG 2.2 AA design walkthrough matrix EN/AR at 360/768/1440 CSS px, 320px reflow, 200% resize, all applicable states). Proposed production p95/Web Vitals in `AGENTS.md` remain for later phases and require workload/environment approval. Trademark/name and font/icon licensing are verification tasks, not claims of availability. Preserve rejection reasons, provenance and actual measurement results. Phase 002 chooses supported pinned runtime/UI package versions after design sign-off; this research is not a new implementation dependency.
