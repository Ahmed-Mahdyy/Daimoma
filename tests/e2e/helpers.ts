import type { Page } from "@playwright/test";

/** The request-type select on /requests/new renders an approver suffix such
 * as "(Manager → HR)" after each name, so exact-label matching is brittle —
 * pick the option containing the name and select it by value. */
export async function selectRequestType(page: Page, name: string) {
  const select = page.getByLabel(/request type/i);
  const value = await select
    .locator("option", { hasText: name })
    .first()
    .getAttribute("value");
  await select.selectOption(value);
}
