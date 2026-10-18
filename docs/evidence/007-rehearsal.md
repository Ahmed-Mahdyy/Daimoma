# Evidence 007 — Demo rehearsal (T015)

Date: 2026-10-17. Rehearsal of the product story against the production-compose stack (`deployment/compose.prod.yml` + `seed_demo`).

## Rehearsed demo flow

1. Deployed production stack locally: `up -d --wait` — db healthy → migrate (collectstatic + migrations) → backend healthy → web on `127.0.0.1:8080`.
2. Seeded synthetic demo: `ALLOW_DEMO_SEED=1 … seed_demo` — Acme Corporation, Engineering/Operations/People & Culture, 2 managers (Mona/Omar), 4 employees, 2 HR, all 6 request types, dated `annual_leave` grants (21 units, 2026-01-01→2027-12-31).
3. Verified all request states exist: draft, pending_manager, returned, approved, rejected — via real services (`create_draft`, `submit_request`, `review_request`).
4. Verified all sheet states exist: collecting, pending_manager (weekly submit via `submit_day` + `submit_sheet`), approved (two-stage manager→HR via `review_sheet`).
5. Signed in through the production proxy as `hr-1@acme.test` with a runtime-generated credential — session/CSRF works end-to-end.
6. Second `seed_demo` run — idempotent: every account skipped, no password resets, no overwrites.

## Freeze disposition & Q&A readiness

- No functional changes after the 006 release-hardening review beyond owner-approved 007 deliverables.
- Remaining live-demo prerequisites before a real audience: provision the Ubuntu host, apply `nginx-host.conf.example` + TLS, copy real `.env.prod`, run `seed_demo` once and deliver the printed credentials through a secure channel (T016/T017).
- Known Q&A answer: MFA intentionally deferred (D-008); synthetic data only; mail transport = console backend until SMTP approved.
