/**
 * T007 — degraded/failure journeys (006:FR-003): expired session mid-flow,
 * API errors surfacing (not fabricated success), and empty states.
 * Real API through the frontend container; synthetic users only (D-008).
 */
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "E2ePassw0rd1";

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/my dashboard/i)).toBeVisible();
}

test.describe("resilience", () => {
  test.setTimeout(60_000);

  test("API 500 shows an error state, not fabricated content", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    // Intercept the report endpoint AFTER login so the failure is targeted.
    await page.route("**/api/v1/reports/working-hours/**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "error", detail: "Server error" }),
      }),
    );
    await page.getByRole("link", { name: "Reports" }).click();
    // AsyncState must render the real error — never silent zeros.
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await page.unroute("**/api/v1/reports/working-hours/**");
  });

  test("expired/invalid session redirects to login without data leak", async ({
    page,
    context,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    // Kill the session cookie mid-flow — the app must bounce to /login,
    // not show stale authenticated content.
    await context.clearCookies();
    await page.getByRole("link", { name: "Requests" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("failed login surfaces a generic error without account enumeration", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("ghost@nowhere.test");
    await page.getByLabel(/password/i).fill("WrongPassw0rdX");
    await page.getByRole("button", { name: /sign in/i }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    // Generic message — must not say whether the account exists.
    await expect(alert).not.toHaveText(/no such (user|account|email)/i);
  });
});
