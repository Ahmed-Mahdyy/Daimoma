# Reviewer Checklist: Hardening

Created: 2026-09-20. Owner: security/QA/product reviewer. These are requirement-quality gates.

- [ ] CHK001 Are all server authorization surfaces and negative cases enumerated? [Coverage, Spec FR-001]
- [ ] CHK002 Are concurrency, time, history, and migration integrity outcomes explicit? [Completeness, Spec FR-002]
- [ ] CHK003 Are real-API, manual accessibility, responsive, and failure checks required? [Coverage, Spec FR-003]
- [ ] CHK004 Are performance workload, measurement method, and thresholds defined without invented results? [Measurability, Spec FR-004]
- [ ] CHK005 Are security findings, severity, regression fixes, and evidence preservation rules clear? [Clarity, Spec FR-005/FR-006]
- [ ] CHK006 Are missing checks, AI disclosure, human acceptance, and release-blocking conditions explicit? [Traceability, Spec FR-007/FR-008]

Approval does not assert any application test has run.
