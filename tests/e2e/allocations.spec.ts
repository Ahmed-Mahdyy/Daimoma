/**
 * T018 — request-allocations browser journeys (008): unit-based request
 * type, grant administration on its own page, employee preview +
 * submission reservation, personal dashboard card, axe scan and AR/RTL.
 * Idempotent: existing type/grant rows are reused, never duplicated.
 * Synthetic users only (D-008).
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { selectRequestType } from "./helpers";

const PASSWORD = "E2ePassw0rd1";
const TYPE_NAME = `Allocated leave E2E ${Date.now()}`;
const EMPLOYEE_NAME = "Edu Employee";
const REQUEST_TITLE = `E2E allocated leave ${Date.now()}`;

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/my dashboard/i)).toBeVisible();
}

async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /^filters/i });
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
}

async function expectNoSeriousViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(
    serious,
    `${name}: ${serious.map((v) => `${v.id} (${v.nodes.length} nodes)`).join(", ")}`,
  ).toEqual([]);
}

test.describe.serial("request allocations", () => {
  test("HR creates a unit-measured type and a grant", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.goto("/requests/types");
    await expect(
      page.getByRole("heading", { name: "Request types" }),
    ).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(TYPE_NAME) });
    // Wait for the list to finish loading before deciding the type is absent.
    await expect(page.getByRole("row", { name: /General request/ })).toBeVisible();
    if ((await row.count()) === 0) {
      await page.getByRole("link", { name: /new request type/i }).click();
      await expect(
        page.getByRole("heading", { name: "New request type" }),
      ).toBeVisible();
      await page.getByLabel(/^name$/i).fill(TYPE_NAME);
      await page.getByLabel(/unit/i).selectOption({ label: "Units" });
      await page.getByRole("button", { name: /add type/i }).click();
      await expect(
        page.getByRole("heading", { name: "Request types" }),
      ).toBeVisible();
      await expect(row).toBeVisible();
    }
    // The unit column doubles as the allocation flag — "Yes" means the type
    // draws from allocations.
    await expect(row.getByText("Yes")).toBeVisible();

    await page.goto("/settings/allocations");
    await expect(
      page.getByRole("heading", { name: "Employee allocations" }),
    ).toBeVisible();
    await openFilters(page);
    await page.getByRole("combobox", { name: "Employee" }).first().selectOption({ label: EMPLOYEE_NAME });
    const grantRow = page.getByRole("row", { name: new RegExp(TYPE_NAME) });
    // Wait for the filtered list to settle before deciding the grant is absent.
    await expect(
      page.getByRole("table").getByRole("row").nth(1).or(page.getByText("No allocations yet.")),
    ).toBeVisible();
    if ((await grantRow.count()) === 0) {
      await page.getByRole("link", { name: /add allocation/i }).click();
      await expect(
        page.getByRole("heading", { name: "Add allocation" }),
      ).toBeVisible();
      await page.getByRole("combobox", { name: "Employee" }).selectOption({ label: EMPLOYEE_NAME });
      await page.getByRole("combobox", { name: "Request type" }).selectOption({ label: TYPE_NAME });
      // The amount label reflects the selected type's unit.
      await page.getByRole("spinbutton", { name: /amount/i }).fill("10");
      await page.getByRole("textbox", { name: "Start date" }).fill("2026-01-01");
      await page.getByRole("textbox", { name: "End date" }).fill("2027-12-31");
      await page.getByRole("button", { name: /add allocation/i }).click();
      await expect(
        page.getByRole("heading", { name: "Employee allocations" }),
      ).toBeVisible();
      await openFilters(page);
      await page.getByRole("combobox", { name: "Employee" }).first().selectOption({ label: EMPLOYEE_NAME });
      await expect(page.getByRole("row", { name: new RegExp(TYPE_NAME) })).toBeVisible();
    }
  });

  test("employee sees the preview and the submission reserves capacity", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.goto("/requests/new");
    await selectRequestType(page, TYPE_NAME);
    await page.getByLabel(/^title$/i).fill(REQUEST_TITLE);
    await page.getByLabel(/start date/i).fill("2027-06-01");
    await page.getByLabel(/end date/i).fill("2027-06-02");
    // Quantity is derived from the two working days in the range — read-only.
    const quantity = page.getByLabel(/quantity/i);
    await expect(quantity).toHaveValue("2");
    await expect(quantity).toHaveAttribute("readonly", "");
    await expect(page.getByText(/estimated charge: 2 units/i)).toBeVisible();

    await page.getByRole("button", { name: /save draft/i }).click();
    await expect(page.getByRole("heading", { name: REQUEST_TITLE })).toBeVisible();
    await page.getByRole("button", { name: /submit for review/i }).click();
    await expect(page.getByText("Pending manager").first()).toBeVisible();

    // Personal dashboard card: granted/reserved/used/remaining — never a
    // fabricated zero when the fetch fails, and not "no allocation".
    await page.goto("/");
    await expect(page.getByText("No allocations assigned.")).not.toBeVisible();
    const card = page.locator("li", { hasText: TYPE_NAME });
    await expect(card.getByText("Granted")).toBeVisible();
    await expect(card.getByText("Reserved")).toBeVisible();
    await expect(card.getByText("Used")).toBeVisible();
    await expect(card.getByText("Current balance")).toBeVisible();
  });

  test("HR sees the reservation and removal is blocked while reserved", async ({
    page,
  }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.goto("/settings/allocations");
    await openFilters(page);
    await page.getByRole("combobox", { name: "Employee" }).first().selectOption({ label: EMPLOYEE_NAME });
    const row = page.getByRole("row", { name: new RegExp(TYPE_NAME) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(
      page.getByRole("heading", { name: new RegExp(`Manage allocation — ${EMPLOYEE_NAME}`) }),
    ).toBeVisible();
    await expect(page.getByText(/Reserved [1-9]/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^remove$/i }),
    ).toBeDisabled();
    await expectNoSeriousViolations(page, "allocations admin");
  });

  test("Arabic RTL renders the allocations page", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("button", { name: /switch to arabic/i }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByRole("button", { name: "توسيع قائمة الطلبات" }).click();
    await page.getByRole("link", { name: "المخصصات" }).click();
    await expect(
      page.getByRole("heading", { name: "مخصصات الموظفين" }),
    ).toBeVisible();
    const description = page.getByText(/عيّن مخصصات بفترة محددة/);
    await expect(description).toBeVisible();
    await expectNoSeriousViolations(page, "Arabic allocations header");
  });
});
