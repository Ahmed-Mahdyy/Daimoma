# Evidence Model: Hardening

No new production business models. Store review artifacts with genuine provenance, not invented test runs.

| Record | Required fields | Invariant |
| --- | --- | --- |
| Test execution | requirement IDs, test/command, source/artifact identity, environment, date, result, output reference | Distinguish passed/failed/skipped/not-run; redact secrets |
| Defect | ID, severity, reproduction, expected/actual, affected requirements, owner, correction, regression test, reviewer outcome | Preserve original finding and resolution history |
| Performance run | dataset scale, hardware, concurrency, request mix, warmup/duration, latency/error/query/bundle metrics | Method and limits explicit; synthetic nonproduction data |
| Manual UX review | scenario, role, browser/viewport, keyboard/focus/contrast observations, finding, reviewer/date | No blanket compliance claim from automation alone |
| Release decision | candidate identity, mandatory gate results, residual risks, acceptance authority/date | Unresolved blocking findings or unrun mandatory checks prevent acceptance |

Data/schema findings are remediated in owning domains through reviewed migrations and regression tests. Evidence should not embed credentials, raw HR attachments, session identifiers, or unnecessary personal information.
