# Feature Specification: Deployment and Handover

**Feature**: 007-deployment-handover
**Created**: 2026-09-20
**Status**: Draft; hosting/data/operational decisions and release approval pending.
**Source**: Brief sections 10-11, 14, 16-25; master delivery/rubric/schedule.

## User Scenarios & Testing

### User Story 1 - Access the live product safely (Priority: P1)

Employees, managers, HR, and judges can use the genuine application through a working HTTPS URL.

**Independent Test**: Complete all three role journeys from a browser outside the developer machine.

**Acceptance Scenarios**:
1. Given an approved candidate and environment, when deployed with migrations, then frontend, API, authentication, files, and core flows work without localhost-only dependencies.
2. Given the public application, when examining access, then database/storage remain private and secrets are not exposed through assets, errors, or configuration.
3. Given a failed readiness/migration/smoke check, when releasing, then promotion stops and the approved recovery procedure is followed without resetting data.

### User Story 2 - Operate and recover without losing data (Priority: P1)

An authorized operator can reproduce deployment, monitor failures, restore backups, and recover a compatible application release.

**Independent Test**: Restore database and attachments into an isolated environment and verify synthetic record/file integrity and role flows.

**Acceptance Scenarios**:
1. Given separate environments, when configuring secrets, then production credentials/data are not reused in development/CI.
2. Given a backup, when rehearsing restoration, then actual results demonstrate approved recovery objectives or an explicit blocker is recorded.
3. Given application/email/storage/scanner failures, when observing operations, then safe logs/alerts identify the failure without disclosing secrets or HR content.
4. Given an incompatible schema rollback, when recovering, then operators follow the reviewed forward-fix/compatibility strategy rather than assume reverse migrations are safe.

### User Story 3 - Demonstrate and hand over verified work (Priority: P2)

The owner/judges receive a coherent product, secure synthetic demo accounts, complete deliverables, and truthful technical/AI evidence.

**Independent Test**: A reviewer follows setup/test/deployment instructions and rehearses the live demonstration against the rubric.

**Acceptance Scenarios**:
1. Given synthetic demo data and Employee/Manager/HR credentials delivered securely, when demonstrating workflows, then real services produce real state transitions/history.
2. Given repository handover, when setting up a fresh environment, then documented setup/architecture/test/deployment/API/model information is sufficient to reproduce approved checks.
3. Given the evidence pack, when judging, then all eight final deliverable groups, source criteria, AI review, and provisional feedback are traceable without fabricated results.
4. Given feature freeze, when a change is proposed, then only permitted critical deployment/presentation fixes proceed under explicit approval.

### Edge Cases

Provider outage, migration lock/failure, bad secrets/hosts, SPA fallback swallowing API errors, private file loss, scanner/email unavailability, failed restore, incompatible rollback, expired demo access, seed rerun over existing data, missing deliverables, and unpublished/unapproved credentials.

## Requirements

### Functional Requirements

- **FR-001**: Deliver a functioning HTTPS frontend/API accessible beyond localhost with private secured PostgreSQL/storage and safe production settings.
- **FR-002**: Use reproducible locked builds, isolated environments, managed secrets, production application serving, health checks, and controlled migration/deployment steps.
- **FR-003**: Require human release approval after staging verification and phase 006 acceptance; stop promotion on failed health/migration/smoke gates.
- **FR-004**: Provide database/attachment backups, approved retention/recovery objectives, an actual isolated restore rehearsal, and safe rollback/forward-fix instructions.
- **FR-005**: Provide PII-safe logs/correlation and observable application/dependency failures with named operational ownership.
- **FR-006**: Provide disclosed synthetic Employee/Manager/HR demo data and securely shared credentials without overwriting existing records or committing secrets.
- **FR-007**: Deliver setup/architecture/test/deployment README, API contracts, database model/diagram, brand/product/design assets, maintained Spec Kit artifacts, and reviewed source/test evidence.
- **FR-008**: Prepare truthful AI-use disclosure, evidence mapped to all rubric criteria, stage-feedback history, live demo/rehearsal/Q&A, and freeze/change-control records.

### Key Entities

Release candidate identity, environment configuration, migration/recovery record, backup/restore evidence, synthetic demo identities, deliverable manifest, and presentation evidence. No new production business model is implied.

## Success Criteria

- **SC-001**: External browsers complete Employee/Manager/HR workflows at the working live URL without mocked core behavior.
- **SC-002**: Restore rehearsal verifies database and file integrity against approved recovery targets.
- **SC-003**: A fresh environment can reproduce setup and required checks from the handover instructions.
- **SC-004**: Every final deliverable and rubric area has honest accessible evidence; no production credentials are committed or publicly disclosed.

## Assumptions and Approval Gates

Provider selection and early staging start in 002; final promotion waits on 006. D-007 budget/region/providers, D-008 data/retention/RPO/RTO/MFA, D-009 operational limits require approval. No provisioning, payment, remote publication, production mutation, or Git push is authorized merely by this specification. Tests and human acceptance are mandatory.
