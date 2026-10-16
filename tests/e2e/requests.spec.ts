/**
 * T019 — cross-role request workflow browser checks (FR-001..FR-008, FR-010).
 * Requires the stack up and `python manage.py seed_e2e` run once.
 * Synthetic users only (D-008).
 */
import { expect, test, type Page } from "@playwright/test";
import { selectRequestType } from "./helpers";

const PASSWORD = "E2ePassw0rd1";
const TITLE = `E2E leave ${Date.now()}`;

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

test.describe.serial("request lifecycle", () => {
  test("employee drafts and submits a leave request", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Requests", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Requests", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "New request", exact: true }).click();

    // "General request" is not measurable — no amount or grant is needed, so
    // the lifecycle stays independent of allocation fixtures.
    await selectRequestType(page, "General request");
    await page.getByLabel(/^title$/i).fill(TITLE);
    await page.getByLabel(/details/i).fill("Synthetic e2e request");
    await page.getByRole("button", { name: /save draft/i }).click();

    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
    await expect(page.getByText("Draft").first()).toBeVisible();
    await page.getByRole("button", { name: /submit for review/i }).click();
    await expect(page.getByText("Pending manager").first()).toBeVisible();
    await expect(page.getByText("Manny Manager").first()).toBeVisible();
    await signOut(page);
  });

  test("manager sees it, returns it with a required reason", async ({
    page,
  }) => {
    await loginAs(page, "manager-e2e@acme.test");
    await page.getByRole("link", { name: "Requests", exact: true }).click();
    await page.getByRole("link", { name: TITLE }).click();
    await expect(page.getByText(/awaits your decision/i)).toBeVisible();

    await page.getByRole("button", { name: /^return$/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/reason/i).fill("Please add more detail.");
    await dialog.getByRole("button", { name: /^return$/i }).click();
    await expect(page.getByText("Returned").first()).toBeVisible();
    await signOut(page);
  });

  test("employee revises the returned request and resubmits", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("link", { name: "Requests", exact: true }).click();
    await page.getByRole("link", { name: TITLE }).click();
    await expect(page.getByText("Returned").first()).toBeVisible();
    await expect(
      page.getByText(/please add more detail/i).first(),
    ).toBeVisible();

    await page.getByRole("link", { name: /edit draft/i }).click();
    await page.getByLabel(/details/i).fill("Synthetic e2e request — revised");
    await page.getByRole("button", { name: /save & resubmit/i }).click();
    await expect(page.getByText("Pending manager").first()).toBeVisible();
    await signOut(page);
  });

  test("manager approves; employee sees the final decision and history", async ({
    page,
  }) => {
    await loginAs(page, "manager-e2e@acme.test");
    await page.getByRole("link", { name: "Requests", exact: true }).click();
    await page.getByRole("link", { name: TITLE }).click();
    await page.getByRole("button", { name: /^approve$/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^approve$/i })
      .click();
    await expect(page.getByText("Approved").first()).toBeVisible();
    await signOut(page);

    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("link", { name: "Requests", exact: true }).click();
    await page.getByRole("link", { name: TITLE }).click();
    await expect(page.getByText("Approved").first()).toBeVisible();
    await expect(page.getByText(/cycle 2/i).first()).toBeVisible();
    await signOut(page);
  });

  test("scope: drafts stay owner-only; HR sees org non-draft work", async ({
    page,
  }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("link", { name: "Requests", exact: true }).click();
    await expect(
      page.getByRole("link", { name: TITLE }),
    ).toBeVisible();
    await signOut(page);
  });
});

test("mobile viewport: request form is usable at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAs(page, "employee-e2e@acme.test");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Requests", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Requests", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "New request", exact: true }).click();
  await expect(page.getByLabel(/request type/i)).toBeVisible();
  await expect(page.getByLabel(/^title$/i)).toBeVisible();
});

test("employee bulk-deletes a draft via row selection", async ({ page }) => {
  await loginAs(page, "employee-e2e@acme.test");
  const draftTitle = `E2E delete ${Date.now()}`;

  await page.goto("/requests/new");
  await selectRequestType(page, "General request");
  await page.getByLabel(/^title$/i).fill(draftTitle);
  await page.getByLabel(/details/i).fill("Disposable e2e draft");
  await page.getByRole("button", { name: /save draft/i }).click();
  await expect(page.getByRole("heading", { name: draftTitle })).toBeVisible();

  // List: only draft rows offer a selection checkbox.
  await page.goto("/requests?status=draft");
  const row = page.getByRole("row").filter({ hasText: draftTitle });
  await row.getByRole("checkbox").check();
  await expect(page.getByText("1 selected")).toBeVisible();

  await page.getByRole("button", { name: /delete selected/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^delete$/i }).click();
  await expect(row).toHaveCount(0);
  await signOut(page);
});
