import { expect, test } from "@playwright/test";
import type { NativeState } from "../lib/huawei-native/native-types";

type ObservedWindow = Window & { startupState?: NativeState };

test("native startup loads data only and preserves all billing modes without an embedded calculator", async ({ page, baseURL }) => {
  test.setTimeout(120000);
  const external: string[] = [], replay: string[] = [], errors: string[] = [];
  page.on("request", request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
    if (/\/snapshot\/.*(?:\/asset\/|\/data\/|\/bridge|\/frame)|calculator-snapshot-bridge/.test(request.url())) replay.push(request.url());
  });
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => addEventListener("neo:calculator-state", event => {
    (window as ObservedWindow).startupState = (event as CustomEvent<NativeState>).detail;
  }));
  for (const [service, region, billing] of [
    ["ECS", "cn-hong-kong", "Pay-per-use"], ["ECS", "cn-hong-kong", "Yearly/Monthly"],
    ["ECS", "cn-hong-kong", "RI"], ["ELB", "cn-hong-kong", "Pay-per-use"],
    ["Flexus L", "cn-hong-kong", "Yearly/Monthly"], ["CCM", "cn-hong-kong", "One-time"],
    ["HUAWEI:apig", "cn-east-4", "Pay-per-use"],
  ]) {
    await page.goto(`/?${new URLSearchParams({ service, region, billing })}`);
    await page.waitForFunction(() => !!(window as ObservedWindow).startupState?.quote, undefined, { timeout: 20000 });
    const state = await page.evaluate(() => (window as ObservedWindow).startupState!);
    expect(state.diagnostics).toEqual([]);
    expect(state.quote!.currency).toBe("USD");
    await expect(page.locator("iframe")).toHaveCount(0);
  }
  expect(external).toEqual([]); expect(replay).toEqual([]); expect(errors).toEqual([]);
});

test("initial opening waits for directory and bookmark hydration without creating a browser session", async ({ page }) => {
  await page.route("**/api/calculator/native", async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 750));
    await route.fulfill({ response });
  });
  await page.addInitScript(() => addEventListener("neo:calculator-state", event => {
    (window as ObservedWindow).startupState = (event as CustomEvent<NativeState>).detail;
  }));
  for (const [service, nativeId, mode, billing] of [
    ["CCM", "ccm", "ONETIME", "One-time"], ["Flexus L", "hcss", "PERIOD", "Yearly/Monthly"], ["ECS", "ecs", "RI", "RI"],
  ]) {
    await page.goto(`/?${new URLSearchParams({ service, region: "cn-hong-kong", billing })}`);
    await expect(page.getByTestId("lab-price")).toBeVisible();
    const state = await page.evaluate(() => (window as ObservedWindow).startupState!);
    expect(state.service).toBe(nativeId); expect(state.region).toBe("ap-southeast-1"); expect(state.billingMode).toBe(mode);
    await expect(page.locator("iframe")).toHaveCount(0);
  }
});

test("immutable model endpoint contains data and bounded rules; all UI replay endpoints are retired", async ({ page }) => {
  const models: string[] = [];
  page.on("response", response => { if (/\/snapshot\/[^/]+\/model\//.test(response.url())) models.push(response.url()); });
  await page.goto("/?service=ECS&region=cn-hong-kong");
  await expect(page.getByTestId("lab-price")).toContainText("0.14968");
  expect(models).toHaveLength(1);
  const response = await page.request.get(models[0]);
  expect(response.headers()["cache-control"]).toContain("immutable");
  const model = await response.json();
  expect(model.scope.config).toBe(""); expect(model.scope.rules.version).toBe(1);
  expect(model.scope.rulesChecks).toBeGreaterThan(0);
  const text = await response.text();
  expect(text).not.toContain("<iframe"); expect(text).not.toContain("createApp("); expect(text).not.toContain("eval(");
  const release = new URL(models[0]).pathname.split("/")[4];
  for (const endpoint of ["frame?service=ecs", `${release}/bridge`, `${release}/asset/${"0".repeat(64)}`, `${release}/data/${"0".repeat(64)}`])
    expect((await page.request.get(`/api/calculator/snapshot/${endpoint}`)).status()).toBe(410);
  expect((await page.request.get("/calculator-snapshot-bridge.js")).status()).toBe(404);
});
