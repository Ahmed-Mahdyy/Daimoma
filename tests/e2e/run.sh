#!/usr/bin/env bash
# Run the Phase 002 browser checks: seed synthetic e2e users, then Playwright.
# Usage: bash tests/e2e/run.sh   (from the project root, Docker Desktop up)
set -euo pipefail
cd "$(dirname "$0")/../.."

docker compose up -d --wait
docker compose exec -T backend python manage.py seed_e2e
docker compose exec -T frontend npx playwright test
