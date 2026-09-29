import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // "frontend" is the compose service name used by container-to-container
    // checks (e.g. Playwright); harmless in local dev.
    allowedHosts: ["localhost", "frontend"],
    proxy: {
      // Same-origin contract: the SPA calls /api/v1/ on its own origin;
      // in dev Vite proxies to the backend container.
      "/api": {
        target: "http://backend:8000",
        // Rewrite Host to the target so Django's ALLOWED_HOSTS accepts
        // proxied requests from any dev hostname (localhost or frontend).
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./src/test/setup.ts"],
    // tests/e2e/ is Playwright — Vitest must not collect it.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
  },
});
