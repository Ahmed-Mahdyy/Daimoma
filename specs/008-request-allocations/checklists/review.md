# Requirements Review Checklist: Request Allocations

**Purpose**: Reviewer-owned quality gate for feature 008's business, integrity, privacy and UX requirements.
**Created**: 2026-10-04
**Feature**: [spec.md](../spec.md)
**Ownership**: All entries are unchecked until a reviewer evaluates requirement quality; checking an item is not implementation evidence.
**Amended**: 2026-10-06 — CHK001/CHK002/CHK003 were accepted against the category model (weekdays, billing minutes, category-unit mapping); owner then directed the unit redesign, which supersedes those answers. Allocation lifecycle, privacy and concurrency acceptances (CHK004–CHK012) remain valid under the unit model.

## Business rules

- [x] CHK001 Are the company working weekdays and holiday inclusion rules precisely defined without assuming a default workweek? [Clarity, Spec §FR-003]
- [x] CHK002 Are category-to-unit mappings, inclusive date boundaries, same-day minutes and equipment's submission-date basis specified unambiguously? [Clarity, Spec §FR-003/FR-004]
- [x] CHK003 Are no-overlap, zero-day, invalidating grant edits, incompatible category changes and schedule effective dates explicitly accepted by the owner? [Assumption, Spec §Decisions]
- [x] CHK004 Are request spans across grant boundaries and requests without a suitable grant fully specified? [Coverage, Spec §FR-004/FR-005]

## Integrity and privacy

- [x] CHK005 Are available, reserved and used amounts consistently defined across approval, return, rejection, resubmission and expiry? [Consistency, Spec §FR-005/FR-006]
- [x] CHK006 Are duplicate/concurrent submissions, HR reductions and competing edits specified with an observable winner/error outcome? [Coverage, Spec §FR-002/FR-010]
- [x] CHK007 Are employee self, HR org and manager-not-other-employee visibility rules applied to lists, details, choices and aggregates? [Coverage, Spec §FR-007]
- [x] CHK008 Are historical submissions and current types preserved without retroactive debits or grant creation? [Consistency, Spec §FR-008]

## UX and readiness

- [x] CHK009 Are no-grant, zero-remaining, expired-pending, failed-fetch and conflicting-edit states distinguishable? [Completeness, Spec §FR-009]
- [x] CHK010 Are EN/AR RTL, keyboard, responsive and accessible-error requirements measurable for HR and employee flows? [Measurability, Spec §FR-009]
- [x] CHK011 Are success criteria testable with synthetic fixtures and approved performance budgets, without implying real-data release readiness? [Measurability, Spec §SC-001/SC-005]
- [x] CHK012 Is the scope exception to Phase 003's no-balance exclusion documented without accidentally introducing payroll, holiday calendars or inventory? [Conflict, Spec §Decisions]

## Notes

Leave all items unchecked until an independent requirements-quality review. Do not represent this checklist as passing application tests.
