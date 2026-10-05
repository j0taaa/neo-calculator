/** Live integration audit: Neo actions versus separate, manually driven Huawei pages. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { NativeCalculator } from "../lib/huawei-native/native-session";
import { HuaweiCollector, PAGE_URL } from "../lib/huawei-native/collector";
import { SourceStore, canonical } from "../lib/huawei-native/store";
import { semanticInquiry } from "../lib/huawei-native/inquiry";
import type { Inquiry } from "../lib/huawei-native/types";
import type { NativeState } from "../lib/huawei-native/native-types";

const output = process.env.NATIVE_AUDIT_DIR ?? "/tmp/neo-native-audit";
await mkdir(output, { recursive: true });
const store = new SourceStore(`${output}/sources.sqlite`);
const calculator = new NativeCalculator(new HuaweiCollector(store));
const proxy = process.env.HWC_SOCKS5_PROXY?.replace("socks5h://", "socks5://");
const browser = await chromium.launch({ headless: true, ...(proxy ? { proxy: { server: proxy } } : {}) });
const evidence: unknown[] = [];
const started = Date.now();
async function numeric(page: Page, component: string, value: number, index = 0) {
  const input = page.locator(`[id="${component}"] input[role="spinbutton"]:visible`).nth(index);
  await input.fill(String(value)); await input.press("Tab");
}
async function dropdown(page: Page, component: string, index: number, label: string) {
  await page.locator(`[id="${component}"] .base-select:visible`).nth(index).locator("input").click();
  const options = page.locator(".tiny-select-dropdown__item:visible");
  await options.first().waitFor({ state: "visible" });
  const texts = await options.allTextContents();
  const chosen = texts.findIndex(text => text.replace(/\s+/g, " ").trim() === label);
  assert(chosen >= 0, `Missing official dropdown option ${label}`);
  await options.nth(chosen).click();
}
async function radio(page: Page, component: string, label: string) {
  await page.locator(`[id="${component}"]`).getByRole("button", { name: label, exact: true }).click();
}
try {
  const regions = (process.env.NATIVE_AUDIT_REGIONS ?? "ap-southeast-1,sa-brazil-1,ap-southeast-3").split(",");
  const services = (process.env.NATIVE_AUDIT_SERVICES ?? "ecs,elb,redis,nat").split(",");
  for (const service of services) for (const region of regions) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, serviceWorkers: "block" });
    let state: NativeState | undefined;
    try {
      state = await calculator.open(service, region);
      // Fixed captured versions remove update races; the oracle still runs Huawei's complete renderer independently.
      await context.route("**/api/config?**", route => route.fulfill({ contentType: "text/plain", body: store.body(state!.source.config) }));
      await context.route("**/api/productInfo?**", route => route.fulfill({ contentType: "application/json", body: store.body(state!.source.products) }));
      await context.route("**/api/menuInfo?**", route => route.fulfill({ contentType: "application/json", body: store.body(state!.source.menu) }));
      await context.route("**/framework.js", route => route.fulfill({ contentType: "application/javascript", body: store.body(state!.source.framework) }));
      const page = await context.newPage();
      let latest = 0, receivedAt = 0;
      const generations = new Map<import("playwright").Request, number>();
      let official: { inquiry: Inquiry; amount: number; currency: string; components: number[] } | null = null;
      page.on("request", request => { if (request.url().includes("/inquiry/resource") && request.method() === "POST") generations.set(request, ++latest); });
      page.on("response", async response => {
        if (!response.url().includes("/inquiry/resource") || response.request().method() !== "POST") return;
        const generation = generations.get(response.request());
        try {
          const inquiry = response.request().postDataJSON() as Inquiry, quote = await response.json();
          if (!quote.productRatingResult) { console.error("Official quote failed", response.status(), JSON.stringify(quote)); return; }
          if (generation !== latest || inquiry.regionId !== region || inquiry.chargingMode !== 1) return;
          official = { inquiry, amount: quote.amount, currency: quote.currency, components: quote.productRatingResult.map((p: { amount: number }) => p.amount) }; receivedAt = Date.now();
        } catch { /* A failed request is never evidence. */ }
      });
      await page.goto(`${PAGE_URL}?region=${region}&inIframe=true#/${service}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForFunction(() => typeof (window as unknown as { iframeSetValue?: unknown }).iframeSetValue === "function", undefined, { timeout: 45000 });
      await page.locator('[id^="calculator_"]').first().waitFor({ timeout: 45000 });
      await page.evaluate(region => (window as unknown as { iframeSetValue: (value: unknown) => void }).iframeSetValue({ global_REGIONINFO: { region, chargeMode: "ONDEMAND", locationType: "commonAZ" } }), region);
      const guide = page.locator(".guide-dialog").getByRole("button", { name: "Close", exact: true });
      if (await guide.isVisible()) { await guide.click(); await page.waitForTimeout(350); }
      async function compare(name: string) {
        const deadline = Date.now() + 20000;
        while ((!official || Date.now() - receivedAt < 1500) && Date.now() < deadline) await page.waitForTimeout(200);
        assert(official, `Missing official quote: ${service}/${region}/${name}`);
        assert.deepEqual(state!.diagnostics, []);
        assert(state!.quote, state!.priceError || "Missing Neo quote");
        assert.equal(canonical(semanticInquiry(state!.inquiry!)), canonical(semanticInquiry(official.inquiry)), `${service}/${region}/${name}: complete inquiry mismatch`);
        assert.equal(state!.quote!.currency, official.currency);
        assert(Math.abs(state!.quote!.amount - official.amount) < 0.000001, `${name}: total mismatch`);
        // The complete renderer also includes free catalog images omitted from the billing API.
        const charged = (values: number[]) => values.filter(value => value !== 0).sort((a,b) => a-b);
        assert.deepEqual(charged(state!.quote!.breakdown.map(p => p.amount)), charged(official.components));
        // Independent input coverage check: all visible upstream numeric inputs must be exposed, including inline controls.
        const numericCount = await page.locator('[id^="calculator_"] input[role="spinbutton"]:visible, #global_ONDEMANDTIME input[role="spinbutton"]:visible, #global_QUANTITY input[role="spinbutton"]:visible').count();
        assert.equal(state!.fields.filter(f => f.type === "number").length, numericCount, "Missing numeric controls");
        const entry = { service, region, name, source: state!.source, fields: state!.fields, inquiry: semanticInquiry(state!.inquiry!), amount: official.amount, checkedAt: new Date().toISOString() };
        evidence.push(entry); await writeFile(`${output}/evidence.json`, JSON.stringify({ elapsedSeconds: (Date.now() - started)/1000, evidence }, null, 2));
        console.log(`${service}/${region}/${name}: passed USD ${official.amount}`);
      }
      async function change(name: string, id: string, value: string | number | boolean, drive: () => Promise<void>) {
        const field = state!.fields.find(f => f.id === id); assert(field, `Missing field ${id}`);
        const next = field.type === "select" ? field.options!.find(o => o.label === value)?.value : value;
        assert(next !== undefined, `Missing choice ${value}`);
        official = null;
        await drive();
        state = await calculator.act({ session: state!.session, revision: state!.revision, field: id, value: next });
        await compare(name);
      }
      const generation = service === "ecs" ? process.env.NATIVE_AUDIT_ECS_GENERATION : undefined;
      if (generation) {
        const field = state.fields.find(field => field.options?.some(option => option.label === generation));
        assert(field, `Missing requested ECS generation ${generation}`);
        await change(`selected-generation-${generation}`, field.id, generation, () => radio(page, "calculator_ecs_radio", generation));
      } else await compare("default");
      if (service === "ecs") {
        const choices = await page.locator('#calculator_ims_select_0 .tiny-select-dropdown__item').allTextContents();
        assert.deepEqual(state.fields.find(f => f.id === "calculator_ims_select:0")!.options!.map(o => o.label), choices.map(s => s.replace(/\s+/g, " ").trim()));
        const image = state.fields.find(f => f.id === "calculator_ims_select:0")!;
        const os = image.options!.find(o => o.value !== image.value && !o.disabled)!;
        await change("image-os", image.id, os.label, () => dropdown(page, "calculator_ims_select", 0, os.label));
        await change("disk-type", "calculator_evs_stepper:0", "Ultra-high I/O", () => dropdown(page, "calculator_evs_stepper", 0, "Ultra-high I/O"));
        await change("kunpeng", "calculator_ecs_radio:0", "Kunpeng", () => radio(page, "calculator_ecs_radio", "Kunpeng"));
        await change("data-disk", "calculator_evs_stepper:2", true, () => page.locator("#calculator_evs_stepper .common-addible-addDisk").click());
        await page.screenshot({ path: `${output}/${service}-${region}.png`, fullPage: true });
        await writeFile(`${output}/${service}-${region}.html`, await page.content());
        await change("disk-size", "calculator_evs_stepper:3", 200, () => numeric(page, "calculator_evs_stepper", 200, 1));
        await change("quantity-two", "global_QUANTITY:0", 2, () => numeric(page, "global_QUANTITY", 2));
        await change("no-eip", "calculator_eip_switch:0", "Not required", () => radio(page, "calculator_eip_switch", "Not required"));
        const remove = state!.fields.find(f => f.label === "Remove data disk")!;
        await change("remove-disk", remove.id, true, () => page.locator("#calculator_evs_stepper .common-addible-delete").click());
      }
      if (service === "elb") {
        await change("tcp-lcu", "calculator_tcp_new_connections:0", 10000, () => numeric(page, "calculator_tcp_new_connections", 10000));
        await change("tcp-bytes", "calculator_tcp_flow:0", 100, () => numeric(page, "calculator_tcp_flow", 100));
        await change("tcp-unit", "calculator_tcp_flow:1", "GB/day", () => dropdown(page, "calculator_tcp_flow", 0, "GB/day"));
        await change("http-enabled", "calculator_flavor_checkboxGroup:3", true, () => page.locator("#calculator_flavor_checkboxGroup").getByText("Application load balancing (HTTP/HTTPS)", { exact: true }).click());
        await change("fixed", "calculator_elb_type_spec:1", "Fixed", () => radio(page, "calculator_elb_type_spec", "Fixed"));
        await change("shared", "calculator_elb_type:0", "Shared load balancer", () => radio(page, "calculator_elb_type", "Shared load balancer"));
      }
      if (service === "redis") {
        const version = state.fields.find(f => f.id === "calculator_redis_version:1")!;
        const label = version.options!.find(o => o.value !== version.value && !o.disabled)!.label;
        await change("version", version.id, label, () => radio(page, "calculator_redis_version", label));
        const type = state!.fields.find(f => f.id === "calculator_redis_version:2")!;
        const option = type.options!.find(o => /master/i.test(o.label))!;
        await change("master-standby", type.id, option.label, () => radio(page, "calculator_redis_version", option.label));
        await change("quantity-three", "calculator_redis_quantity:0", 3, () => numeric(page, "calculator_redis_quantity", 3));
      }
      if (service === "nat") {
        const field = state.fields.find(f => f.options?.some(o => o.label === "Private network"))!;
        await change("private", field.id, "Private network", () => radio(page, field.component, "Private network"));
        const size = state!.fields.find(f => f.options?.some(o => o.label === "Large"))!;
        await change("large", size.id, "Large", () => dropdown(page, size.component, 0, "Large"));
      }
      await change("duration-two", "global_ONDEMANDTIME:0", 2, () => numeric(page, "global_ONDEMANDTIME", 2));
      // Request contract guards: no guessed selectors, stale updates, or invalid numeric values.
      const duration = state!.fields.find(f => f.id === "global_ONDEMANDTIME:0")!;
      await assert.rejects(calculator.act({ session: state!.session, revision: state!.revision - 1, field: duration.id, value: 3 }), /changed/);
      await assert.rejects(calculator.act({ session: state!.session, revision: state!.revision, field: duration.id, value: -1 }), /range/);
      await assert.rejects(calculator.act({ session: state!.session, revision: state!.revision, field: "body", value: true }), /Unknown control/);
    } finally { if (state) await calculator.remove(state.session); await context.close(); }
  }
  console.log(`PASS: ${evidence.length} independent comparisons in ${((Date.now()-started)/1000).toFixed(1)}s`);
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await calculator.close(); await browser.close(); store.close(); process.exit(process.exitCode || 0); }
