# Research and Decisions: Hardening

| Decision | Rationale | Alternative rejected |
| --- | --- | --- |
| PostgreSQL and real-API verification | Proves actual locks/constraints/authentication | SQLite-only or mocked integration confidence |
| Measured workload with environment identity | Performance claims must be reproducible | Claiming optimization based on indexes alone |
| Risk-based blocking gates | Security/correctness cannot be traded for a demo score | Waiving mandatory failures near the deadline |
| Regression-first defect fixes | Preserves intended behavior and guards recurrence | Deleting tests or rewriting requirements to match defects |
| Manual plus automated accessibility | Automated tools cannot establish complete usability | Treating a zero automated warning count as compliance |

Pending D-008 production-data/privacy/MFA requirements and D-009 measurable limits. The load tool and scanner versions must be reviewed rather than assumed installed. No security audit, benchmark, migration rehearsal, user test, or passing result is claimed by these artifacts.
