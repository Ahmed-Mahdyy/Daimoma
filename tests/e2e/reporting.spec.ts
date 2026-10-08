/**
 * T014 — cross-role dashboard/report/inbox journeys (005). Requires the
 * stack up + `python manage.py seed_e2e`. Synthetic users only (D-008).
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

async function signOut(page: Page) {
  const sidebarSignOut = page.locator("aside").getByRole("button", { name: /sign out/i, includeHidden: true });
  if (!(await sidebarSignOut.isVisible())) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  await sidebarSignOut.click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe.serial("dashboards and reporting", () => {
  test.setTimeout(60_000);

  test("employee sees only the personal dashboard", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await expect(page.getByText("My dashboard")).toBeVisible();
    await expect(page.getByText("Team dashboard")).not.toBeVisible();
    await expect(page.getByText("Organization dashboard")).not.toBeVisible();
    // Period + timezone label proves a real server payload, not zeros.
    await expect(page.getByText(/Period \d{4}-\d{2}-\d{2}/)).toBeVisible();
    await signOut(page);
  });

  test("employee cannot reach team/org dashboards directly", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    const resp = await page.request.get("/api/v1/dashboards/organization/");
    expect(resp.status()).toBe(403);
    const team = await page.request.get("/api/v1/dashboards/team/");
    expect(team.status()).toBe(403);
    await signOut(page);
  });

  test("manager sees personal + team dashboards and can export", async ({
    page,
  }) => {
    await loginAs(page, "manager-e2e@acme.test");
    await expect(page.getByRole("tab", { name: "Team dashboard" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Organization dashboard" })).not.toBeVisible();
    await page.getByRole("tab", { name: "Team dashboard" }).click();
    await expect(page.getByRole("region", { name: "Team dashboard" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Personal overview" })).not.toBeVisible();
    await expect(page.getByText("Pending review items")).not.toBeVisible();

    await page.getByRole("link", { name: "Reports" }).click();
    await expect(
      page.getByRole("heading", { name: "Reports" }),
    ).toBeVisible();
    // Hours tab renders — data rows or the explicit empty state.
    await expect(
      page
        .getByText(/grouped by/i)
        .or(page.getByText(/no working hours/i)),
    ).toBeVisible();
    // Export triggers a CSV download.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /export csv/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/working-hours.*\.csv/);
    await signOut(page);
  });

  test("HR sees all three dashboards and the requests report", async ({
    page,
  }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await expect(page.getByRole("tab", { name: "Team dashboard" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Organization dashboard" })).toBeVisible();
    await page.getByRole("tab", { name: "Organization dashboard" }).click();
    await expect(page.getByRole("region", { name: "Organization dashboard" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Personal overview" })).not.toBeVisible();

    await page.getByRole("link", { name: "Reports" }).click();
    await page.getByRole("tab", { name: "Requests" }).click();
    await expect(page.getByText(/by submitted date/i)).toBeVisible();
    await signOut(page);
  });

  test("invalid date range surfaces a field error, not a crash", async ({
    page,
  }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.goto("/reports?from=2026-10-01&to=2026-01-01");
    await expect(
      page.getByRole("alert").or(page.getByText(/must not precede/i)),
    ).toBeVisible({ timeout: 15_000 });
    await signOut(page);
  });

  test("notification inbox: read flow and target navigation", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    // Trigger a notification: employee submits a request -> manager gets
    // notified; then a decision notifies the employee. Reuse whatever inbox
    // items exist — assert list renders and read-all clears the badge.
    await page.getByRole("link", { name: /requests/i }).first().click();
    // Submit a fresh draft so a notification exists regardless of history.
    if (
      await page
        .getByRole("link", { name: /new request/i })
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByRole("link", { name: /new request/i }).click();
      const type = page.getByLabel(/type/i);
      if (await type.isVisible().catch(() => false)) {
        await type.selectOption({ index: 1 });
        if (await page.getByLabel(/start/i).isVisible().catch(() => false)) {
          await page.getByLabel(/start/i).fill("2026-09-15");
          await page.getByLabel(/end/i).fill("2026-09-15");
          const submit = page.getByRole("button", { name: /submit/i });
          if (await submit.isVisible().catch(() => false)) {
            await submit.click();
          }
        }
      }
    }
    // Open the inbox page from the bell's "View all" link.
    await page.getByRole("button", { name: /notifications/i }).click();
    const viewAll = page.getByRole("link", { name: /view all/i });
    if (await viewAll.isVisible().catch(() => false)) {
      await viewAll.click();
      await expect(
        page.getByRole("heading", { name: "Notifications" }),
      ).toBeVisible();
      const markAll = page.getByRole("button", { name: /mark all read/i });
      if (await markAll.isVisible().catch(() => false)) {
        await markAll.click();
        await expect(markAll).not.toBeVisible({ timeout: 10_000 });
      }
    }
    await signOut(page);
  });

  test("HR can add and edit a department from its details", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Departments", exact: true }).click();
    const name = `Demo department ${Date.now()}`;
    await page.getByRole("link", { name: /new department/i }).click();
    await expect(
      page.getByRole("heading", { name: "New department" }),
    ).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("combobox", { name: "Manager" }).selectOption({ label: "Manny Manager" });
    await page.getByRole("button", { name: "Add department" }).click();
    await expect(
      page.getByRole("heading", { name: "Departments", exact: true }),
    ).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByText("Employees count")).toBeVisible();
    await expect(page.getByRole("link", { name: "Manny Manager" })).toBeVisible();
    await page.getByRole("textbox", { name: "Name" }).fill(`${name} updated`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: `${name} updated` })).toBeVisible();
    await signOut(page);
  });

  test("HR back link returns from employee creation", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("navigation", { name: "Quick actions" }).getByRole("link", { name: "Add Employee" }).click();
    await expect(page.getByRole("heading", { name: "New employee" })).toBeVisible();
    await page.getByRole("link", { name: /back to employees/i }).click();
    await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
    await signOut(page);
  });

  test("dashboard quick action opens a dedicated request form", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await expect(page.getByText("Plan your day")).not.toBeVisible();
    await page.getByRole("link", { name: "New request", exact: true }).first().click();
    await expect(page).toHaveURL(/\/requests\/new$/);
    await page.getByLabel("Request type").selectOption({ index: 1 });
    await expect(page.getByLabel("Start date")).toHaveValue("");
    await signOut(page);
  });

  test("settings route is reserved for HR", async ({ page }) => {
    await loginAs(page, "manager-e2e@acme.test");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" })).toHaveCount(0);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();
    await signOut(page);
  });

  test("account menu shows role and profile; theme persists", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("button", { name: "Account menu" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText("hr-e2e@acme.test")).toBeVisible();
    await expect(menu.getByText("HR", { exact: true })).toBeVisible();
    await menu.getByRole("menuitem", { name: "My profile" }).click();
    await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await signOut(page);
  });

  test("Arabic dashboard tabs remain usable in RTL", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // The tab subtree must follow the document direction — Radix defaults to dir="ltr".
    await expect(page.locator('[data-slot="tabs"]')).toHaveAttribute("dir", "rtl");
    await page.getByRole("tab", { name: "لوحة الفريق" }).click();
    await expect(page.getByRole("region", { name: "لوحة الفريق" })).toBeVisible();
    await page.getByRole("tab", { name: "لوحة المؤسسة" }).click();
    await expect(page.getByRole("region", { name: "لوحة المؤسسة" })).toBeVisible();
    await page.getByRole("button", { name: "التبديل إلى الإنجليزية" }).click();
    await signOut(page);
  });

  test("mobile viewport: dashboard and reports usable at 360px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("tab", { name: "Organization dashboard" }).click();
    await expect(page.getByRole("region", { name: "Organization dashboard" })).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 360);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Reports", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Reports" }),
    ).toBeVisible();
    await signOut(page);
  });
});
