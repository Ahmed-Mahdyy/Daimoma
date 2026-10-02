/**
 * T008 — accessibility evidence (006:FR-003, WCAG 2.2 AA target per D-009).
 * Real axe-core scans on the live app + keyboard-only journey — not a
 * checklist claim. Synthetic users only (D-008).
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "E2ePassw0rd1";

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/my dashboard/i)).toBeVisible();
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

test.describe("accessibility", () => {
  test.setTimeout(60_000);

  test("login page passes axe WCAG2 AA scan", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expectNoSeriousViolations(page, "login");
  });

  test("dashboard page passes axe scan (authenticated shell)", async ({
    page,
  }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await expectNoSeriousViolations(page, "dashboard");
  });

  test("reports page passes axe scan", async ({ page }) => {
    await loginAs(page, "manager-e2e@acme.test");
    await page.getByRole("link", { name: "Reports" }).click();
    await expect(
      page.getByRole("heading", { name: "Reports" }),
    ).toBeVisible();
    await expectNoSeriousViolations(page, "reports");
  });

  test("dark login passes axe scan", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expectNoSeriousViolations(page, "dark login");
  });

  test("dark dashboard passes axe scan", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expectNoSeriousViolations(page, "dark dashboard");
  });

  test("dark reports pass axe scan", async ({ page }) => {
    await loginAs(page, "manager-e2e@acme.test");
    await page.getByRole("link", { name: "Reports", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expectNoSeriousViolations(page, "dark reports");
  });

  test("dark HR departments pass axe scan", async ({ page }) => {
    await loginAs(page, "hr-e2e@acme.test");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Departments", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Departments" })).toBeVisible();
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expectNoSeriousViolations(page, "dark departments");
  });

  test("dark request and timesheet lists pass axe scans", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Requests", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Requests", level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page, "dark requests");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Timesheets", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Timesheets", level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page, "dark timesheets");
  });

  test("dark timesheet detail passes axe scan (contrast regression)", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Timesheets", exact: true })
      .click();
    await page
      .getByRole("link", { name: /\d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2}/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: /timesheet/i }),
    ).toBeVisible();
    await expectNoSeriousViolations(page, "dark timesheet detail");
  });

  test("keyboard-only: tab through login and submit with Enter", async ({
    page,
  }) => {
    await page.goto("/login");
    // Land on a focusable control, tab through the form in order.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Switch to Arabic" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/email/i)).toBeFocused();
    await page.keyboard.type("employee-e2e@acme.test");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/password/i)).toBeFocused();
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/my dashboard/i)).toBeVisible();
  });

  test("interactive elements expose visible focus", async ({ page }) => {
    await loginAs(page, "employee-e2e@acme.test");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
    // A focused element must have a visible outline or ring — not outline:none
    // with no substitute (WCAG 2.4.7 focus visible).
    const styles = await focused.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        outline: s.outlineStyle + " " + s.outlineWidth,
        shadow: s.boxShadow,
        ring: s.getPropertyValue("--tw-ring-width"),
      };
    });
    const hasIndicator =
      !styles.outline.includes("none") ||
      styles.shadow !== "none" ||
      (styles.ring && styles.ring !== "0px");
    expect(hasIndicator).toBe(true);
  });

  test("usable at 360/768/1440px and 200% zoom (D-009 acceptance)", async ({
    page,
  }) => {
    await loginAs(page, "employee-e2e@acme.test");
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByText(/my dashboard/i)).toBeVisible();
      // No horizontal overflow — content reflows (WCAG 1.4.10).
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(overflow, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(
        width + 1,
      );
    }
    // 200% text enlargement — content must remain visible (WCAG 1.4.4).
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expect(page.getByText(/my dashboard/i)).toBeVisible();
  });

  test("reduced-motion preference is respected (no essential animation)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    // No element may keep an essential CSS animation under reduced motion —
    // transitions/transforms must have near-zero duration (WCAG 2.3.3 spirit).
    const offenders = await page.evaluate(() => {
      return [...document.querySelectorAll("*")].filter((el) => {
        const s = getComputedStyle(el);
        const anim = parseFloat(s.animationDuration) > 0.5;
        const trans = parseFloat(s.transitionDuration) > 0.5;
        return anim || trans;
      }).length;
    });
    expect(offenders).toBe(0);
  });
});
