---
trigger: always_on
---

# Daimoma employee operations project

- This is a standalone Django/DRF and React/TypeScript project, not an Odoo addon. Work only inside this project unless asked otherwise.
- Read `AGENTS.md` as the master project reference, `.specify/memory/constitution.md`, and the active feature artifacts before working. Conversation memory is not a source of truth.
- The current delivery is specifications and directory scaffolding only. Application code, migrations, UI assets, tests, CI, and deployment are future tasks, not implemented functionality.
- Treat all pending decisions in `AGENTS.md` and all unchecked reviewer gates as unresolved. Scaffold generation does not approve business policies or authorize deployment.
- Use the native `.devin/skills/speckit-*` skills. Do not install unofficial presets, extensions, hooks, or bypass permissions without approval.
- Keep one active feature. Verify `.specify/feature.json`; changing Git branches does not switch the feature. Never overwrite completed task history when replanning.
- Critical workflow, permissions, concurrency, migration, and accessibility tests are mandatory even when an upstream template calls tests optional.
- Do not commit, push, create remote issues, launch subagents, deploy, reset data, remove existing files, or perform destructive operations without explicit approval.
- Enforce authorization and state transitions on the server; scope lists, details, aggregates, exports, attachments, notifications, and related-field choices.
- Do NOT add the CDS Solutions copyright/maintainer header to Python files in this project — that global rule applies to Odoo addon modules only, and this is a standalone Django/React product (owner instruction 2026-10-02).
- Prefer explicit transactional services, scoped querysets, thin API adapters, strict TypeScript, and accessible shared components; do not introduce speculative abstractions.
- Use the renamed project root `/home/mahdy/cds-playground/odoo-19/Daimoma` for shell and file operations; do not rely on old absolute paths from the former `CDS Project` directory. Never modify surrounding Odoo repositories.
- At completion report files changed, actual checks and outcomes, unrun checks, unresolved decisions, and the next approved task. Never fabricate review or testing evidence.
