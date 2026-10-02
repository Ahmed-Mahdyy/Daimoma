/**
 * T018 — cross-role timesheet journey (daily submit → weekly two-stage
 * review → HR reopen). Requires the stack up + `python manage.py seed_e2e`.
 * Synthetic users only (D-008).
 */
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "E2ePassw0rd1";

// Anchor on a fully-past week so entry times are never "future work" —
// independent of the day/time the suite runs. If the week collides with a
// leftover synthetic sheet the API rejects it; step back a week and retry.
const anchorFor = (weeksAgo: number) =>
  new Date(Date.now() - weeksAgo * 7 * 86_400_000).toISOString().slice(0, 10);
let weekLabel = "";

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

async function openSheet(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Timesheets", exact: true }).click();
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
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Timesheets", exact: true }).click();
    const hhmm = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    let editableDay = null;
    let weekFound = false;
    // Walk back through past weeks: leftover overlapping sheets can refuse a
    // week at open time, or own individual workdays inside an otherwise valid
    // week — both cases make us move to the next candidate.
    for (let weeksAgo = 1; weeksAgo <= 16 && !weekFound; weeksAgo++) {
      if (!/\/timesheets\/?$/.test(page.url())) {
        await page
          .getByRole("navigation", { name: "Main" })
          .getByRole("link", { name: "Timesheets", exact: true })
          .click();
      }
      await page.locator('input[type="date"]').fill(anchorFor(weeksAgo));
      // dispatchEvent avoids Playwright's click-retry racing the pending-state
      // re-render and client-side navigation; waiting on the POST response
      // itself is immune to stale refusal alerts.
      const openResp = await Promise.all([
        page
          .waitForResponse(
            (r) =>
              /\/api\/v1\/timesheets\/?$/.test(r.url()) &&
              r.request().method() === "POST",
            { timeout: 8000 },
          )
          .catch(() => null),
        page
          .getByRole("button", { name: /open week/i })
          .dispatchEvent("click"),
      ]).then(([r]) => r);
      if (!openResp || openResp.status() >= 400) continue;
      const heading = page.getByRole("heading", { name: /Week / });
      const onSheet = await heading
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!onSheet) continue;
      const label = (await heading.textContent())!
        .replace(/^Week\s+/, "")
        .trim();

      // Days still editable — prior/partial runs may have submitted others;
      // a reopened (returned) week also stays editable.
      const editableDays = page
        .locator("section")
        .filter({ has: page.getByRole("button", { name: /add entry/i }) });
      if ((await editableDays.count()) === 0) {
        // Fully locked week — usable downstream only if it was already
        // submitted (its badge is pending/approved rather than Collecting).
        const submitted = await page
          .getByText(/pending manager|pending hr|approved/i)
          .first()
          .isVisible()
          .catch(() => false);
        if (submitted) {
          weekLabel = label;
          weekFound = true;
        }
        continue;
      }
      for (let i = 0; i < (await editableDays.count()); i++) {
        const day = editableDays.nth(i);
        await day.getByRole("button", { name: /add entry/i }).click();
        const dialog = page.getByRole("dialog");
        const workDate = (
          await day.getByRole("heading").first().textContent()
        )!.trim();
        // Read the day's existing "HH:MM–HH:MM" intervals and pick a free
        // 60-minute slot — avoids overlapping entries left by earlier runs.
        const used = (await day.locator("li").allTextContents())
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
        let startMin = freeSlot(19 * 60);
        if (startMin < 0) startMin = freeSlot(0);
        if (startMin >= 0) {
          // datetime-local has no 24:00 — cap the end at 23:59.
          const endMin = Math.min(startMin + 60, 23 * 60 + 59);
          await dialog
            .getByLabel(/start/i)
            .fill(`${workDate}T${hhmm(startMin)}`);
          await dialog
            .getByLabel(/end/i)
            .fill(`${workDate}T${hhmm(endMin)}`);
          await dialog.getByLabel(/description/i).fill("E2E entry");
          await dialog.getByRole("button", { name: /^add$/i }).click();
          // Success closes the dialog; a validation error (e.g. the day's
          // workday lives in another sheet) keeps it open — cancel and move
          // on to the next day.
          const closed = await dialog
            .waitFor({ state: "detached", timeout: 5000 })
            .then(() => true)
            .catch(() => false);
          if (closed) {
            editableDay = day;
            weekLabel = label;
            weekFound = true;
            break;
          }
        }
        await dialog.getByRole("button", { name: /cancel/i }).click();
        await expect(dialog).toHaveCount(0);
      }
    }
    if (!weekFound) throw new Error("no usable week found");

    await expect(
      page.getByRole("heading", { name: `Week ${weekLabel}` }),
    ).toBeVisible();
    if (editableDay) {
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
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Timesheets", exact: true }).click();
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
