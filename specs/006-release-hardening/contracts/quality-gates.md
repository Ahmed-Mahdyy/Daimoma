# Quality Gate Contract

Status: **approved 2026-10-02 (owner)** — workload/budget figures recorded in AGENTS.md D-009: 500 employees / 52 weeks (~130k entries) / ~5k requests / ~20k notifications; 25 concurrent users; p95 reads <300ms, writes <500ms, reports <1s, export <10s, errors <0.1%; bundle <500KB gzipped; measured on the dev docker-compose stack with hardware documented (development-hardware measurement, not production SLA).

| Gate | Required evidence | Failure behavior |
| --- | --- | --- |
| Security | Server-side role/owner/team/org/CSRF/session/privilege/file/report/inbox tests; reviewed secrets/dependencies/settings | Block on critical/high security defect or missing mandatory check |
| Integrity | Exact minutes, child locks, self-approval denial, concurrent writes/reviews, immutable history, populated migrations | Block on data loss/corruption or incorrect business decision |
| Integration | Real API browser flows for Employee/Manager/HR, including return/resubmit/reopen and network failures | Do not substitute mocked endpoints for final proof |
| UI/accessibility | Responsive widths, six states, keyboard/focus/errors/contrast/zoom and approved languages | Record defects and block inaccessible critical journeys |
| Performance | Approved workload/method, p95/error/query/bundle metrics | Profile and correct; do not invent measurements or weaken agreed thresholds |
| Traceability | Every mandatory requirement linked to implementation and actual verification; AI review disclosed | Mark missing evidence explicitly; complete before acceptance |

Severity: critical/high security or correctness findings block release; other findings require explicit owner disposition with scope and rationale. Human approval does not turn a failed test into a passed test. False-positive tool findings require documented investigation rather than disabling the control.

Read-only analysis checks specification consistency, not runtime security. Scaffold validation checks structure/references, not semantic completeness or working application behavior. Final product acceptance uses all three layers: artifact consistency, executable verification, human review.
