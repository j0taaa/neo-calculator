import { expect, test, type Locator, type Page } from "@playwright/test";

export async function chooseControl(page: Page, control: Locator, option: string | { label: string }) {
  await expect(control).toBeVisible();
  if (await control.evaluate(el => el.tagName === "SELECT")) return control.selectOption(option);
  const label = typeof option === "string" ? undefined : option.label;
  const value = typeof option === "string" ? option : undefined;
  const grid = control.locator('[data-option-grid]');
  if (await control.getAttribute("data-option-grid") !== null || await grid.count()) {
    const group = await grid.count() ? grid : control;
    const button = label ? group.getByRole("button", { name: label, exact: true }) :
      group.locator(`button[data-value="${value}"]`);
    await button.click();
    return;
  }
  await control.click();
  if (await control.getAttribute("aria-label") === "Service") {
    await page.getByRole("combobox", { name: "Search services" }).fill(label ?? value!);
  }
  if (label) await page.getByRole("option", { name: label, exact: true }).click();
  else await page.locator(`[role="option"][data-value="${value}"]`).click();
}


/** Release only sessions created by this test, even when a browser fixture is forcibly closed. */
export function trackNativeSessions(page: Page) {
  const sessions = new Set<string>();
  const operations = new Set<string>();
  const reads: Promise<void>[] = [];
  const onRequest = (request: import("@playwright/test").Request) => {
    if (!request.url().endsWith("/api/calculator/native") || request.method() !== "POST") return;
    const body = request.postDataJSON();
    if (["open", "restore"].includes(body.action) && body.operationId) operations.add(body.operationId);
  };
  const onResponse = (response: import("@playwright/test").Response) => {
    const request = response.request();
    if (!request.url().endsWith("/api/calculator/native") || request.method() !== "POST" || !["open", "restore"].includes(request.postDataJSON().action)) return;
    reads.push(response.json().then(body => { if (body.session) sessions.add(body.session); }).catch(() => {}));
  };
  page.on("request", onRequest); page.on("response", onResponse);
  return async () => {
    page.off("request", onRequest); page.off("response", onResponse);
    await Promise.all(reads);
    await Promise.all([
      ...[...operations].map(operationId => page.request.post("/api/calculator/native", { data: { action: "cancel", operationId } })),
      ...[...sessions].map(session => page.request.post("/api/calculator/native", { data: { action: "close", session } })),
    ]);
  };
}


/** Exercise one explicit recovery when Huawei's initialization or aggregation finishes late. */
export async function waitForNativePrice(page: Page, timeout = 150000) {
  const price = page.getByTestId("lab-price");
  const retry = page.getByRole("button", { name: /^(Retry calculator|Retry price)$/ });
  await expect.poll(async () => await price.isVisible() || await retry.isVisible(), { timeout }).toBe(true);
  if (!await price.isVisible()) {
    const alert = await page.getByRole("alert").filter({ has: retry }).innerText();
    expect(alert).not.toContain("calculator is busy");
    test.info().annotations.push({ type: "Huawei recovery", description: alert });
    await retry.click();
  }
  await expect(price).toBeVisible({ timeout });
}
