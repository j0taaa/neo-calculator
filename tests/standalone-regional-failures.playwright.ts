import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { NativeState, NativeDirectory } from "../lib/huawei-native/native-types";
import { nativeBillingModes } from "../lib/huawei-native/native-billing";

type ObservedWindow = Window & { regionalState?: NativeState };
async function observe(page: Page) {
  await page.addInitScript(() => {
    addEventListener("message", event => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Local calculator rules"]');
      if (event.source === frame?.contentWindow && event.data?.result?.fields)
        (window as ObservedWindow).regionalState = event.data.result;
    });
  });
}
const read = (page: Page) => page.evaluate(() => (window as ObservedWindow).regionalState!);
const scopes = [
  ["hss", "me-east-1"], ["dew", "me-east-1"],
  ["sfsturbo", "la-south-2"], ["sfsturbo", "na-mexico-1"], ["sfsturbo", "la-north-2"],
  ["mrs", "la-south-2"], ["kafka", "eu-west-0"],
  ["servicestage", "sa-brazil-1"], ["rds", "sa-argentina-1"],
  ["search", "cn-east-3"], ["apig", "cn-east-4"], ["apig", "cn-south-1"],
  ["obs", "ap-southeast-1"],
];

test("previously failing regional scopes work through the offline Neo interface", async ({ page, baseURL }) => {
  test.setTimeout(180000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const external: string[] = [];
  page.on("request", request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== baseURL)
      external.push(request.url());
  });
  const directory = await (await page.request.get("/api/calculator/native")).json() as NativeDirectory;
  await observe(page);
  for (const [service, region] of scopes) {
    const mode = directory.billingModes[service][region][0];
    const params = new URLSearchParams({ service: `HUAWEI:${service}`, region, billing: nativeBillingModes[mode].label });
    await page.goto(`/?${params}`);
    await page.waitForFunction(({ service, region, mode }) => {
      const state = (window as ObservedWindow).regionalState;
      return state?.service === service && state.region === region && state.billingMode === mode;
    }, { service, region, mode });
    const state = await read(page);
    expect(state.diagnostics, `${service}/${region}`).toEqual([]);
    expect(state.quote, `${service}/${region}: ${state.priceError}`).not.toBeNull();
    await expect(page.getByTestId("lab-price")).toBeVisible();
    if (service === "servicestage" || service === "rds") {
      const empty = state.fields.filter(field => field.type === "select" && !field.options?.length);
      expect(empty.length).toBeGreaterThan(0);
      expect(empty.every(field => field.disabled)).toBe(true);
    }
  }
  expect(external).toEqual([]);
});

test("regional API Gateway duration crosses the official time tariff boundary locally", async ({ page }) => {
  await observe(page);
  await page.goto("/?service=HUAWEI%3Aapig&region=cn-east-4&billing=Pay-per-use");
  await page.getByTestId("lab-price").waitFor();
  const first = await read(page);
  const componentAmount = (state: NativeState) => {
    const product = state.inquiries.flatMap(inquiry => inquiry.productInfos)
      .find(product => product.resourceType === "hws.resource.type.apig.publicip")!;
    return state.local!.pricing.result!.productRatingResult.find(item => item.id === product.id)!.amount;
  };
  expect(componentAmount(first)).toBe(0.05);
  const duration = page.locator('[data-field-id="global_ONDEMANDTIME:0"]').first();
  await duration.fill("6");
  await duration.press("Tab");
  await expect.poll(async () => componentAmount(await read(page))).toBe(1.14);
});
