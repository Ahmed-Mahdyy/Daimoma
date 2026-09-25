# Validation Guide: Foundation

## Available now (planning only)

From the project root, run `python3 .devin/scripts/specs.py check` to validate structure/references. Check `.specify/feature.json` selects feature 001. This does not test an application, design quality or approval. No Django/React runtime or prototypes currently exist.

## Preconditions for feature acceptance

D-000 constitution ratified; D-001 selects **Daimoma (ديمومة)** subject to actual name/confusion clearance; D-002 requires English and Arabic/RTL. D-009 measurable UX acceptance and the reviewer checklist are still pending. Complete T001-T016 design artifacts and use synthetic demo content only. Do not mark any unperformed validation as passing.

## Preview once prototypes exist

1. Review `docs/product/product-definition.md`, `docs/brand/identity.md`, `docs/brand/usage.md` and source mappings for approved scope and all ten modules.
2. Inspect the documented font/icon licenses, original logo/icon sources, light/dark variants, tagline, semantic colors and component rules against [contracts/ui.md](contracts/ui.md) and [data-model.md](data-model.md).
3. From the project root, serve static prototype files locally with `python3 -m http.server 8000 --directory docs/design/prototypes` (only after T010/T013 create them); open the served index in a browser. Do not advertise this server or mockups as a production deployment.
4. Walk Employee request creation/submission/return and weekly time entry; Manager direct-team review/return; HR employee/settings/reporting. Verify each journey and role-specific navigation in both English/LTR and Arabic/RTL at 360, 768 and 1440 CSS px.
5. For each applicable screen, walk loading, empty, failure, invalid, disabled/read-only, success, stale/conflict and session-expired states. Assert any simulated result is visibly marked as a prototype, not a persisted operation.

## Edge and accessibility review

Test reflow at 320 CSS px and enlarged text at 200%, long Arabic/English names, mixed-direction IDs/dates, long labels, large tables, unsaved changes, missing art, reduced motion and slow networks. Navigate using keyboard alone including Shift+Tab, dialogs and error recovery; inspect focus visibility/restoration, label/error association, non-color status and screen-reader announcements. Measure text/UI contrast against the acceptance rules in [contracts/ui.md](contracts/ui.md). A single screenshot is not evidence for interactive, accessibility or translated states.

## Permission review

Compare each displayed action to the provisional role matrix in `AGENTS.md`; designs must not imply employee role administration, self-approval or cross-team manager access. Prototype visibility is not authorization evidence: Django/DRF permissions and real negative tests belong to phases 002-005.

## Evidence and result

For each scenario record reviewer, date, artifact version, browser, viewport, locale, observed behavior, contrast numbers, exceptions and remediation in `docs/evidence/001-design-review.md` and requirement/task links in `docs/evidence/001-traceability.md` once those files are produced by T014/T015. Owner/reviewer signs off only after resolving D-009, clearance/asset issues and checklist findings. Retain failed results; never call a design mockup a completed application.
