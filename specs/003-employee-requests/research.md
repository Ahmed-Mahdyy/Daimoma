# Research and Decisions: Requests

| Decision | Rationale | Alternative not selected |
| --- | --- | --- |
| Fixed typed categories and two approved route shapes | Meets brief without arbitrary workflow/schema complexity | User-programmable approval engine and unvalidated JSON form data |
| Submission cycles and snapshots | Returned/resubmitted work preserves what was actually reviewed | Editing previous approval rows or replacing historical content |
| Parent/profile locking and expected version | Makes duplicate review and reporting-line changes testable | Client-only disabled buttons or last-write-wins |
| Private quarantine and validated downloads | Supporting files contain employee information and untrusted bytes | Public media URLs or trusting MIME filename extensions |
| Persistent notification row with business event | Required feedback survives browser refresh | Toast-only confirmation |

Pending: D-004 fallback/reassignment and HR-stage eligibility; D-006 category fields/confidentiality/file limits; D-007 private storage/scanning providers; D-008 retention and sensitive-data policy. Confidential HR-only routing is not implemented by the default manager-first design; resolve this explicitly before collecting confidential material. Public file storage and fail-open scanning are not acceptable fallback designs.
