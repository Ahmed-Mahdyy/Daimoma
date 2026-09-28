# Research and Decisions: Delivery

| Decision | Rationale | Alternative rejected |
| --- | --- | --- |
| Same-origin self-hosted target with private data services (D-007 revised 2026-09-25) | Meets owner hosting direction while preserving server-side sessions and database isolation; topology remains to be approved | Public PostgreSQL or broad cross-origin cookie policies |
| Immutable locked build with manual promotion | Reproducible staged candidate and explicit release control | Building unpinned dependencies independently in production |
| Controlled migration job and compatible rollback | Prevent worker races and unsafe schema reversal | Resetting the database or automatically reversing arbitrary migrations |
| Database and attachment restore rehearsal | A successful backup job alone does not prove recoverability | Claiming recovery without restoring files/data |
| Real synthetic workflows and secure demo delivery | Satisfies judge access without exposing employees/passwords | Mock approvals, committed passwords, or seed overwrite of existing data |

Pending D-007 hosting/provider/region/budget, D-008 retention/RPO/RTO/data/MFA, D-009 limits. No vendor was selected, account provisioned, paid service ordered, secret generated, remote URL published, or restore test run in this scaffold. Official Django deployment checklist is the baseline for production configuration review.
