# Reviewer Checklist: Authentication/RBAC

Created: 2026-09-20. Owner: product/security reviewer. Checked means requirement-quality approval, not working code.

- [ ] CHK001 Are onboarding, token expiry/replay, recovery, session expiry and abuse limits unambiguous? [Clarity, Spec FR-001]
- [ ] CHK002 Are list/detail/create/related-choice and reporting-line scopes consistently defined? [Coverage, Spec FR-002/FR-005]
- [ ] CHK003 Are self-approval, HR privilege limits, and last-HR protection explicit? [Completeness, Spec FR-002/FR-005]
- [ ] CHK004 Are profile/admin editable fields and account lifecycle boundaries defined? [Clarity, Spec FR-003/FR-004]
- [ ] CHK005 Are audit privacy and notification ownership/deduplication requirements specified? [Completeness, Spec FR-006/FR-007]
- [ ] CHK006 Are session recovery, accessible states, and pagination outcomes testable? [Measurability, Spec FR-008/FR-009]
- [ ] CHK007 Are schema/runtime/CI/staging and real-data MFA gates clearly separated? [Consistency, Spec FR-010/FR-011/FR-012]

No agent may silently approve these on behalf of the reviewer.
