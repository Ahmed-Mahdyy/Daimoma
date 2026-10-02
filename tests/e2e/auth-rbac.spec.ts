/**
 * T020 — cross-role browser checks (FR-002, FR-008, FR-010).
 * Requires the stack up and `python manage.py seed_e2e` run once.
 * Synthetic users only (D-008).
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

test("unauthenticated visitors are redirected to login for protected routes", async ({
  page,
}) => {
  await page.goto("/employees");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login/);
});

test("bad credentials show a generic error, never account existence", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("nobody@acme.test");
  await page.getByLabel(/password/i).fill("WrongPassw0rd1");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    /email or password is incorrect/i,
  );
});

test("HR sees admin navigation and the org-wide directory", async ({
  page,
}) => {
  await loginAs(page, "hr-e2e@acme.test");
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Departments", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Audit" })).toBeVisible();

  await page.getByRole("link", { name: "Employees" }).click();
  const table = page.getByRole("table");
  await expect(table.getByText("Harriet HR")).toBeVisible();
  await expect(table.getByText("Edu Employee")).toBeVisible();
});

test("employee has no directory nav link; direct URL stays self-scoped", async ({
  page,
}) => {
  await loginAs(page, "employee-e2e@acme.test");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(
    nav.getByRole("link", { name: "Departments", exact: true }),
  ).not.toBeVisible();
  await expect(nav.getByRole("link", { name: "Employees" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Audit" })).not.toBeVisible();

  // The route remains reachable; the API self-scopes the directory.
  await page.goto("/employees");
  const table = page.getByRole("table");
  await expect(table.getByText("Edu Employee")).toBeVisible();
  await expect(table.getByText("Harriet HR")).not.toBeVisible();
});

test("manager sees only direct reports in the directory", async ({ page }) => {
  await loginAs(page, "manager-e2e@acme.test");
  await expect(page.getByRole("link", { name: "Audit" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Departments", exact: true }),
  ).not.toBeVisible();

  await page.getByRole("link", { name: "Employees" }).click();
  const table = page.getByRole("table");
  await expect(table.getByText("Edu Employee")).toBeVisible();
  await expect(table.getByText("Harriet HR")).not.toBeVisible();
});

test("direct API access without a session is rejected", async ({
  request,
}) => {
  const response = await request.get("/api/v1/employees/");
  expect([401, 403]).toContain(response.status());
});

test("employee directory filters produce an empty state", async ({ page }) => {
  await loginAs(page, "hr-e2e@acme.test");
  await page.getByRole("link", { name: "Employees" }).click();
  await page
    .getByLabel(/search employees/i)
    .fill("no-such-person-xyz");
  await page
    .getByLabel(/search employees/i)
    .press("Enter");
  await expect(page.getByText(/no employees match/i)).toBeVisible();
});
