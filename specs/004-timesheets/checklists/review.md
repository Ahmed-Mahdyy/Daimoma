# Reviewer Checklist: Timesheets

Created: 2026-09-20. Owner: product/security reviewer. Checked means requirements-quality acceptance, not successful tests.

- [ ] CHK001 Are period uniqueness, timezone, minute precision, future work, breaks, and overnight allocation defined? [Clarity, Spec FR-001/FR-002]
- [ ] CHK002 Are all submitted-child mutations and alternative write paths covered by the read-only rule? [Coverage, Spec FR-003]
- [ ] CHK003 Are review, rejection, return, resubmission, and self-review rules unambiguous? [Consistency, Spec FR-004/FR-005]
- [ ] CHK004 Are reopening authority, required reasons, historical decisions, and current approved totals consistent? [Consistency, Spec FR-006]
- [ ] CHK005 Are cross-sheet races, duplicate period creation, and reporting-line changes specified? [Coverage, Spec FR-007]
- [ ] CHK006 Are history/notification/filter/related-object scopes explicit? [Completeness, Spec FR-008/FR-009]
- [ ] CHK007 Are accuracy, accessible interaction, and failure outcomes measurable? [Measurability, Spec FR-010]

Unresolved D-005 policy is an implementation gate; do not silently choose a timezone or week start.
