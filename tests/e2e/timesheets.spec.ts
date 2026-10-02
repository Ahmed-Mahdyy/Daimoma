/**
 * T018 — cross-role timesheet journey (daily submit → weekly two-stage
 * review → HR reopen). Requires the stack up + `python manage.py seed_e2e`.
 * Synthetic users only (D-008).
 */
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "E2ePassw0rd1";

// Anchor on a fully-past week so entry times are never "future work" —
// independent of the day/time the suite runs.
const anchor = new Date(Date.now() - 7 * 86_400_000)
  .toISOString()
  .slice(0, 10);
let weekLabel = "";

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/my dashboard/i)).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function openSheet(page: Page) {
  await page.getByRole("link", { name: "Timesheets" }).click();
  await page.getByRole("link", { name: weekLabel }).click();
  await expect(
    page.getByRole("heading", { name: `Week ${weekLabel}` }),
  ).toBeVisible();
}

test.describe.serial("timesheet lifecycle", () => {
  // Full multi-step journeys — give them headroom over the 30s default.
  test.setTimeout(60_000);

  test("employee logs a day and submits the week", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("link", { name: "Timesheets" }).click();
    await page.locator('input[type="date"]').fill(anchor);
    await page.getByRole("button", { name: /open week/i }).click();

    await expect(page.getByRole("heading", { name: /Week / })).toBeVisible();
    weekLabel = (await page
      .getByRole("heading", { name: /Week / })
      .textContent())!
      .replace(/^Week\s+/, "")
      .trim();

    // Pick a day still editable — prior/partial runs may have submitted
    // others; a reopened (returned) week also stays editable.
    const editableDay = page
      .locator("section")
      .filter({ has: page.getByRole("button", { name: /add entry/i }) })
      .last();
    if ((await editableDay.count()) > 0) {
      await editableDay
        .getByRole("button", { name: /add entry/i })
        .click();
      const dialog = page.getByRole("dialog");
      const workDate = await editableDay
        .getByRole("heading")
        .first()
        .textContent();
      // Read the day's existing "HH:MM–HH:MM" intervals and pick a free
      // 60-minute slot — avoids overlapping entries left by earlier runs.
      const used = (await editableDay.locator("li").allTextContents())
        .map((t) => t.match(/(\d{2}):(\d{2})–(\d{2}):(\d{2})/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => [
          Number(m[1]) * 60 + Number(m[2]),
          Number(m[3]) * 60 + Number(m[4]),
        ]);
      const freeSlot = (from: number) => {
        let m = from;
        while (
          m + 60 <= 24 * 60 &&
          used.some(([s, e]) => m < e && m + 60 > s)
        ) {
          m += 15;
        }
        return m + 60 <= 24 * 60 ? m : -1;
      };
      const startMin =
        freeSlot(19 * 60) >= 0 ? freeSlot(19 * 60) : freeSlot(0);
      if (startMin < 0) throw new Error("no free 60-min slot on the day");
      const endMin = startMin + 60;
      const hhmm = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      await dialog
        .getByLabel(/start/i)
        .fill(`${workDate!.trim()}T${hhmm(startMin)}`);
      await dialog
        .getByLabel(/end/i)
        .fill(`${workDate!.trim()}T${hhmm(endMin)}`);
      await dialog.getByLabel(/description/i).fill("E2E entry");
      await dialog.getByRole("button", { name: /^add$/i }).click();
      // Wait for the dialog to actually close — a server-side overlap error
      // keeps it open and its backdrop would swallow later clicks.
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.locator("li").filter({ hasText: /e2e entry/i }).last(),
      ).toBeVisible();
      await editableDay
        .getByRole("button", { name: /submit day/i })
        .click();
      // The day loses its Add-entry button on submit, so scope back by the
      // visible badge instead of the (now non-matching) filtered locator.
      await expect(
        page.getByText("Submitted").first(),
      ).toBeVisible();
    }

    // Submit week only if still collecting — a previous run may already
    // have submitted (or the week is mid-cycle after a reopen).
    const submitWeek = page.getByRole("button", { name: /submit week/i });
    if ((await submitWeek.count()) > 0) {
      await submitWeek.click();
      const confirm = page.getByRole("dialog");
      await confirm.getByRole("button", { name: /^submit$/i }).click();
    }
    await expect(
      page.getByText(/pending manager|pending hr|approved/i).first(),
    ).toBeVisible();
    await signOut(page);
  });

  test("employee cannot self-review", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await openSheet(page);
    await expect(
      page.getByRole("button", { name: /^approve$/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^reject$/i }),
    ).toHaveCount(0);
    await signOut(page);
  });

  test("manager reviews and forwards to HR", async ({ page }) => {
    await loginAs(page, "manager-e2e@acme.test");
    await openSheet(page);
    await page.getByRole("button", { name: /^approve$/i }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: /^approve$/i }).click();
    await expect(page.getByText("Pending HR").first()).toBeVisible();
    await signOut(page);
  });

  test("HR final-approves the week", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await openSheet(page);
    await page.getByRole("button", { name: /^approve$/i }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: /^approve$/i }).click();
    await expect(page.getByText("Approved").first()).toBeVisible();
    // Approved sheets are locked — no entry actions for anyone.
    await expect(
      page.getByRole("button", { name: /add entry/i }),
    ).toHaveCount(0);
    await signOut(page);
  });

  test("HR reopens the approved sheet with a reason", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await openSheet(page);
    await page.getByRole("button", { name: /^reopen$/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/reason/i).fill("Payroll correction needed");
    await dialog.getByRole("button", { name: /confirm/i }).click();
    await expect(page.getByText("Returned").first()).toBeVisible();
    await page.getByRole("button", { name: /history/i }).click();
    await expect(
      page.getByText(/payroll correction/i).first(),
    ).toBeVisible();
    await signOut(page);
  });

  test("employee can edit the reopened week", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await openSheet(page);
    await expect(page.getByText("Returned").first()).toBeVisible();
    await expect(
      page.locator("section").first().getByRole("button", {
        name: /add entry/i,
      }),
    ).toBeVisible();
    await signOut(page);
  });
});

test("timesheet page is usable at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAs(page, "employee-e2e@acme.test");
  await page.getByRole("link", { name: "Timesheets" }).click();
  await expect(
    page.getByRole("heading", { name: "Timesheets" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /open week/i }),
  ).toBeVisible();
  await signOut(page);
});

test("an unknown sheet id does not expose data", async ({ page }) => {
  await loginAs(page, "employee-e2e@acme.test");
  await page.goto("/timesheets/00000000-0000-0000-0000-000000000000");
  // React Query retries the 404 a few times before surfacing the error.
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /week /i }),
  ).toHaveCount(0);
  await signOut(page);
});
