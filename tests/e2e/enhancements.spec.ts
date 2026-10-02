/**
 * Post-006 enhancements — early-leave request fields, check-in/out punch,
 * department record view, Settings submenu, and brand/avatar affordances.
 * Requires the stack up + `python manage.py seed_e2e`. Synthetic users (D-008).
 */
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "E2ePassw0rd1";
// 1x1 synthetic PNG — enough for the upload/verify path.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const EARLY_TITLE = `E2E early leave ${Date.now()}`;

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/my dashboard/i)).toBeVisible();
}

async function signOut(page: Page) {
  const sidebarSignOut = page.locator("aside").getByRole("button", { name: /sign out/i, includeHidden: true });
  if (!(await sidebarSignOut.isVisible())) await page.getByRole("button", { name: "Open menu" }).click();
  await sidebarSignOut.click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe.serial("enhancements", () => {
  test.setTimeout(60_000);

  test("early-leave request collects Date + From/To hours", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Requests", exact: true }).click();
    await page.getByRole("link", { name: "New request", exact: true }).first().click();

    await page.getByLabel(/request type/i).selectOption({ label: "Early leave" });
    await expect(page.getByLabel(/^date$/i)).toBeVisible();
    await expect(page.getByLabel(/^from$/i)).toBeVisible();
    await expect(page.getByLabel(/^to$/i)).toBeVisible();
    // Date-range fields are irrelevant for this category.
    await expect(page.getByLabel(/end date/i)).toHaveCount(0);

    await page.getByLabel(/^title$/i).fill(EARLY_TITLE);
    await page.getByLabel(/^date$/i).fill("2027-06-01");
    await page.getByLabel(/^from$/i).fill("15:00");
    await page.getByLabel(/^to$/i).fill("17:00");
    await page.getByRole("button", { name: /save draft/i }).click();

    await expect(page.getByRole("heading", { name: EARLY_TITLE })).toBeVisible();
    await expect(page.getByText("From", { exact: true })).toBeVisible();
    await expect(page.getByText("15:00")).toBeVisible();
    await expect(page.getByText("17:00")).toBeVisible();
    await signOut(page);
  });

  test("check-in shows status; instant check-out is a friendly error", async ({
    page,
  }) => {
    await loginAs(page, "manager-e2e@acme.test");
    // Reset any leftover open punch so the journey is deterministic.
    if (await page.getByRole("button", { name: "Check out" }).first().isVisible()) {
      await page.getByRole("button", { name: "Cancel check-in" }).first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Discard check-in" }).click();
      await expect(page.getByRole("button", { name: "Check in" }).first()).toBeVisible();
    }

    await page.getByRole("button", { name: "Check in" }).first().click();
    // The navbar widget shows the live elapsed timer with a tooltip.
    await expect(page.getByTitle(/checked in since/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Check out" }).first()).toBeVisible();

    // E2E checks out within seconds — the API rejects sub-minute intervals
    // and keeps the punch open so it can be cancelled.
    await page.getByRole("button", { name: "Check out" }).first().click();
    await expect(page.getByRole("alert").first()).toContainText(/less than a minute/i);
    await expect(page.getByRole("button", { name: "Check out" }).first()).toBeVisible();

    // Cancelling requires an explicit confirmation — the dialog can be
    // dismissed without discarding the punch.
    await page.getByRole("button", { name: "Cancel check-in" }).first().click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(/discard this check-in/i);
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByRole("button", { name: "Check out" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Cancel check-in" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Discard check-in" }).click();
    await expect(page.getByRole("button", { name: "Check in" }).first()).toBeVisible();
    await signOut(page);
  });

  test("HR opens a department record with members and breadcrumbs", async ({ page }) => {
    const name = `E2E Dept ${Date.now()}`;
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Departments", exact: true }).click();
    await page.getByLabel("New department name").fill(name);
    await page.getByRole("button", { name: "Add department" }).click();
    await page.getByRole("link", { name }).click();

    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByText("Active").first()).toBeVisible();
    await expect(page.getByText(/current employees/i)).toBeVisible();
    // Empty state — nobody is assigned to a brand-new department.
    await expect(page.getByText(/no employees are assigned/i)).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await breadcrumb.getByRole("link", { name: "Departments" }).click();
    await expect(page.getByRole("heading", { name: "Departments", level: 1 })).toBeVisible();
    await signOut(page);
  });

  test("HR sees a Settings submenu containing Request types + Audit", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    const submenu = page.getByRole("navigation", { name: "Settings" });
    await expect(submenu.getByRole("link", { name: "Request types" })).toBeVisible();
    await expect(submenu.getByRole("link", { name: "Audit" })).toBeVisible();
    await submenu.getByRole("link", { name: "Request types" }).click();
    await expect(page.getByRole("heading", { name: /request types/i })).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByRole("link", { name: "Settings" })).toBeVisible();
    await signOut(page);
  });

  test("logo navigates home; avatar has a pointer affordance", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("link", { name: "Requests", exact: true }).first().click();
    await page.getByRole("link", { name: "Daimoma home" }).click();
    await expect(page.getByText(/my dashboard/i)).toBeVisible();
    const avatar = page.getByRole("button", { name: "Account menu" });
    await expect(avatar).toHaveClass(/cursor-pointer/);
    await signOut(page);
  });

  test("dashboard has no check-in; filters show a compact 'All'", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    // The punch clock lives in the navbar — not on the dashboard hero.
    const hero = page.locator("main");
    await expect(hero.getByRole("button", { name: "Check in" })).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Requests", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Status", exact: true }).locator("option").first(),
    ).toHaveText("All");
    await expect(
      page.getByRole("combobox", { name: "Type", exact: true }).locator("option").first(),
    ).toHaveText("All");
    await signOut(page);
  });

  test("language switcher flips the shell to Arabic RTL and persists (D-002)", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "ltr");

    await page
      .getByRole("button", { name: "Switch to Arabic" })
      .first()
      .click();
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "ar");
    // Shell chrome renders translated.
    await expect(
      page.getByRole("link", { name: "الرئيسية" }).first(),
    ).toBeVisible();

    // The choice survives a reload.
    await page.reload();
    await expect(html).toHaveAttribute("dir", "rtl");

    // Switch back so later navigation keeps English labels.
    await page
      .getByRole("button", { name: "التبديل إلى الإنجليزية" })
      .first()
      .click();
    await expect(html).toHaveAttribute("dir", "ltr");
    await signOut(page);
  });

  test("every role gets Settings > Profile; photo uploads and displays", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    const submenu = page.getByRole("navigation", { name: "Settings" });
    await expect(
      submenu.getByRole("link", { name: "Profile" }),
    ).toBeVisible();
    // HR-only children stay hidden from a plain employee.
    await expect(
      submenu.getByRole("link", { name: "Request types" }),
    ).toHaveCount(0);

    await submenu.getByRole("link", { name: "Profile" }).click();
    await expect(
      page.getByRole("heading", { name: "My profile" }),
    ).toBeVisible();
    // The submenu entry is highlighted while editing the profile.
    await expect(
      submenu.getByRole("link", { name: "Profile" }),
    ).toHaveClass(/workspace-nav-active/);

    // Upload a small synthetic PNG; the avatar swaps initials for the photo.
    await page.getByLabel("Choose profile photo").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(
      page.locator('img[src*="/api/v1/me/photo/"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    // The photo persists and shows in the topbar avatar.
    await expect(
      page.getByRole("button", { name: "Account menu" }).locator("img"),
    ).toBeVisible();
    await signOut(page);
  });

  test("HR configures per-type approval stages dynamically", async ({
    page,
  }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Settings", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: "Request types" })
      .click();

    // Turn HR approval on: the type becomes a manager-then-HR chain.
    const hrBox = page.getByLabel("HR approval for General request");
    await hrBox.check();
    await expect(hrBox).toBeChecked();

    // The server rejects an empty approval chain: unchecking both reverts
    // the controlled checkbox and shows a friendly alert.
    const managerBox = page.getByLabel("Manager approval for General request");
    await hrBox.click(); // HR off — now manager-only
    await expect(hrBox).not.toBeChecked();
    await managerBox.click();
    await expect(page.getByRole("alert")).toContainText(/stage/i);
    await expect(managerBox).toBeChecked();
    await signOut(page);
  });

  test("clicking a notification opens the exact record", async ({ page }) => {
    const title = `E2E notif ${Date.now()}`;
    await loginAs(page, "employee-e2e@acme.test");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Requests", exact: true })
      .click();
    await page.getByRole("link", { name: "New request", exact: true }).first().click();
    await page.getByLabel(/request type/i).selectOption({ label: "Annual leave" });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByLabel(/details/i).fill("notification target check");
    await page.getByLabel(/start date/i).fill("2027-07-01");
    await page.getByLabel(/end date/i).fill("2027-07-02");
    await page.getByRole("button", { name: /save draft/i }).click();
    await page.getByRole("button", { name: /submit for review/i }).click();
    await expect(page.getByText("Pending manager").first()).toBeVisible();
    await signOut(page);

    await loginAs(page, "manager-e2e@acme.test");
    await page.getByRole("button", { name: /notifications/i }).click();
    const item = page
      .getByRole("menu")
      .getByRole("button", { name: new RegExp(title.slice(0, 25), "i") })
      .or(page.getByRole("menu").getByRole("button").filter({ hasText: /review/i }).first());
    await item.click();
    await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await signOut(page);
  });

  test("employee detail page shows the scoped profile photo", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: "Profile" })
      .click();
    await page.getByLabel("Choose profile photo").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(
      page.locator('img[src*="/api/v1/me/photo/"]').first(),
    ).toBeVisible({ timeout: 10_000 });
    const me = await (await page.request.get("/api/v1/me/")).json();
    const profileId = me.id as string;
    await signOut(page);

    // HR opens the record — the avatar uses the scoped employee endpoint,
    // not the viewer's own /me/photo/ URL.
    await loginAs(page, "hr-e2e@acme.test");
    await page.goto(`/employees/${profileId}`);
    await expect(
      page.locator(`img[src*="/api/v1/employees/${profileId}/photo/"]`),
    ).toBeVisible();
    await signOut(page);
  });
});
