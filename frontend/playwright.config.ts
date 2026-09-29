import { defineConfig } from "@playwright/test";

// Runs inside the frontend container; specs live in the repo-root tests/e2e
// (mounted at /tests). baseURL uses the compose network hostname.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://frontend:5173",
    headless: true,
  },
});
