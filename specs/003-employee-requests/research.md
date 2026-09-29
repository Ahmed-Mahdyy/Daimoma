# Research and Decisions: Requests

| Decision | Rationale | Alternative not selected |
| --- | --- | --- |
| Fixed typed categories and two approved route shapes | Meets brief without arbitrary workflow/schema complexity | User-programmable approval engine and unvalidated JSON form data |
| Submission cycles and snapshots | Returned/resubmitted work preserves what was actually reviewed | Editing previous approval rows or replacing historical content |
| Parent/profile locking and expected version | Makes duplicate review and reporting-line changes testable | Client-only disabled buttons or last-write-wins |
| Private quarantine and validated downloads | Supporting files contain employee information and untrusted bytes | Public media URLs or trusting MIME filename extensions |
| Persistent notification row with business event | Required feedback survives browser refresh | Toast-only confirmation |

Resolved 2026-09-29: D-004 approved during Phase 002 planning; D-006 approved (5 categories, attachments deferred, no confidential mode). Still pending for later phases: D-007 private storage providers (only if attachments return), D-008 retention and sensitive-data policy. No file handling exists in this phase.
