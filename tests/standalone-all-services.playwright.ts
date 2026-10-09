import { expect, test } from "@playwright/test";
import { nativeBillingModes } from "../lib/huawei-native/native-billing";
import type { NativeDirectory, NativeState } from "../lib/huawei-native/native-types";
import { chooseControl } from "./calculator-controls";
import { calculatorApiKey } from "./calculator-api-fixture";
import { nativeDraft } from "../lib/huawei-native/native-draft";

type ObservedWindow = Window & { neoSmokeState?: NativeState };

test("every published service is reachable and calculates or preserves its official availability in Neo", async ({ page, baseURL }) => {
  test.setTimeout(15 * 60 * 1000);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  const directory = await (await page.request.get("/api/calculator/native")).json() as NativeDirectory;
  const headers = await calculatorApiKey(page);
  let apiQuotes = 0, quantityChecks = 0;
  const external: string[] = [], failures: string[] = [];
  page.on("request", request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin)
      external.push(request.url());
  });
  await page.addInitScript(() => {
    addEventListener("message", event => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Local calculator rules"]');
      if (event.source === frame?.contentWindow && event.data?.result?.fields)
        (window as ObservedWindow).neoSmokeState = event.data.result;
    });
  });
  for (const service of directory.services) {
    try {
      const region = directory.regions.find(region => directory.billingModes[service.id]?.[region.id]?.length)!;
      expect(region, `${service.id} has a published region`).toBeTruthy();
      const mode = directory.billingModes[service.id][region.id][0];
      const params = new URLSearchParams({ service: `HUAWEI:${service.id}`, region: region.id, billing: nativeBillingModes[mode].label });
      await page.goto(`/?${params}`);
      await page.waitForFunction(({ service, region, mode }) => {
        const state = (window as ObservedWindow).neoSmokeState;
        return state?.service === service && state.region === region && state.billingMode === mode;
      }, { service: service.id, region: region.id, mode }, { timeout: 20000 });
      const read = () => page.evaluate(() => (window as ObservedWindow).neoSmokeState!);
      let state = await read();
      const ids = state.fields.filter(field => !field.disabled && field.type !== "action" && !field.component.startsWith("global_LOCATION")).map(field => field.id);
      for (const id of ids) {
        if (state.quote || state.availability) break;
        const field = state.fields.find(field => field.id === id);
        if (!field || field.disabled) continue;
        const control = page.locator(`[data-field-id="${id}"]`).first();
        const revision = state.revision;
        if (field.type === "number") {
          const value = Math.min(field.max ?? 9999, Math.max(field.min ?? 0, Number(field.value) + 1));
          if (value === Number(field.value)) continue;
          await control.fill(String(value));
          await control.press("Tab");
        } else if (field.type === "select") {
          const option = field.options?.filter(option => !option.disabled && option.value !== field.value).at(-1);
          if (!option) continue;
          await chooseControl(page, control, option.value);
        } else if (field.type === "checkbox") await control.click();
        await page.waitForFunction(revision => (window as ObservedWindow).neoSmokeState!.revision > revision, revision, { timeout: 20000 });
        state = await read();
      }
      expect(state.diagnostics, service.id).toEqual([]);
      if (state.quote) {
        const quantity = state.fields.find(field => field.component === "global_QUANTITY" && !field.disabled && (field.max ?? 9999) >= 2);
        if (quantity) {
          const control = page.locator(`[data-field-id="${quantity.id}"]`).first();
          await control.fill("2"); await control.press("Tab");
          await page.waitForFunction(() => {
            const state = (window as ObservedWindow).neoSmokeState;
            return state?.quote && Number(state.selection.fields.find(field => field.component === "global_QUANTITY")?.value) === 2;
          });
          state = await read();
          quantityChecks++;
        }
        const response = await page.request.post("/api/v1/calculate", { headers, data: { products: [nativeDraft(state, service.name, service.name, true)] } });
        const calculated = await response.json();
        expect(response.status(), `${service.id}: ${JSON.stringify(calculated.results?.[0]?.error)}`).toBe(200);
        // The official aggregator can retain a binary float tail (e.g. 1.4540000000000002).
        expect(calculated.results[0].pricing.amount).toBeCloseTo(state.quote!.amount, 8);
        expect(calculated.results[0].quantity).toBe(quantity ? 2 : 1);
        apiQuotes++;
        await expect.poll(async () => Number((await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g, "")))
          .toBeCloseTo(state.quote.amount, 6);
        await expect.poll(async () => (await page.getByRole("alert").allTextContents()).map(text => text.trim()).filter(Boolean)).toEqual([]);
      } else {
        expect(["information", "unavailable"], `${service.id}: ${state.priceError}`).toContain(state.availability);
        await expect(page.getByTestId("scope-status")).toContainText(state.availability === "information" ? "billing information" : "no purchasable options");
        await expect(page.getByTestId("lab-price")).toHaveCount(0);
      }
      await expect(page.locator('iframe[title="Local calculator rules"]')).toHaveCount(1);
      console.log(`Standalone service passed: ${service.id}/${region.id}/${mode}`);
    } catch (error) {
      const message = `${service.id}: ${error instanceof Error ? error.message : String(error)}`;
      failures.push(message);
      console.error(`Standalone service failed: ${message.split("\n")[0]}`);
    }
  }
  expect(external).toEqual([]);
  expect(failures).toEqual([]);
  console.log(`Standalone services checked: ${directory.services.length}`);
  console.log(`Standalone API quotes checked: ${apiQuotes}; multi-instance quantities: ${quantityChecks}`);
});
