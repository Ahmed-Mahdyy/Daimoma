# Operational Artifact Model

No new production business tables beyond any separately reviewed implementation need.

| Artifact | Required fields | Invariants |
| --- | --- | --- |
| Release identity | source revision, image digest, schema revision, environment, approver/date, smoke results | Actual immutable candidate; no invented commit or approval |
| Environment inventory | provider/region, service role, private connectivity, secret references, owner | No plaintext secret values in versioned artifacts |
| Backup/restore record | dataset/file scope, protected backup reference, retention, RPO/RTO, rehearsal method/results | Actual isolated restoration and integrity checks; protected restored copies |
| Incident/recovery procedure | trigger, owner, safe diagnosis, stop/promotion conditions, compatible rollback/forward fix | No destructive reset or unapproved production operation |
| Demo manifest | synthetic identities/roles/teams, scenario states, seed version | No real employee data or passwords; idempotent non-overwrite seed |
| Deliverable/evidence index | brief/rubric criterion, artifact reference, verification, reviewer/date | Eight final groups covered; missing evidence clearly marked |

Demo identity counts: one organization, two departments, two managers, four employees distributed across teams, two HR users; domain scenarios through real services. Credentials generated at runtime and delivered privately. Retention is approved operational policy, not an automatic deletion behavior introduced by these specifications.
