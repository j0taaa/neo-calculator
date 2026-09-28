import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { HuaweiCollector, MENU_URL } from "../lib/huawei-sync/collector";
import { evaluateForm, inspectConfig } from "../lib/huawei-sync/engine";
import { SyncStore } from "../lib/huawei-sync/store";

async function observe(page: Page) {
  return page.evaluate(() => {
        const config = (window as unknown as { viewConfig: { calc_view: { components: { id: string; type: string }[] } } }).viewConfig;
        return config.calc_view.components.flatMap(component => {
          if (component.id.startsWith("global_")) return [];
          const root = document.getElementById(component.id);
          if (!root || !root.getClientRects().length) return [];
          return [{ id: component.id, type: component.type, text: root.innerText, fields: [...root.querySelectorAll<HTMLElement>(".tiny-form-item")].filter(el => el.getClientRects().length).map(item => ({
            label: item.querySelector(".tiny-form-item__label")?.textContent?.trim() ?? "",
            selected: item.querySelector("li.active")?.textContent?.trim() ?? item.querySelector<HTMLInputElement>("input")?.value ?? "",
            options: [...item.querySelectorAll("li")].map(el => el.textContent?.trim()).filter(Boolean),
          })) }];
        });
      });
}

const output = process.env.HUAWEI_AUDIT_DIR ?? "/tmp/neo-sync-complex-audit";
await mkdir(output, { recursive: true });
const store = new SyncStore(process.env.HUAWEI_SYNC_DB ?? `${output}/sync.sqlite`);
const collector = new HuaweiCollector(store);
const { snapshot: menu } = await collector.directory();
const language = JSON.parse(menu.body).languagePack;
const services = (process.env.HUAWEI_AUDIT_SERVICES ?? "ecs,elb,redis,nat").split(",");
const regions = (process.env.HUAWEI_AUDIT_REGIONS ?? "ap-southeast-1,sa-brazil-1,ap-southeast-3").split(",");
const proxy = process.env.HWC_SOCKS5_PROXY?.replace("socks5h://", "socks5://");
const browser = await chromium.launch({ headless: true, ...(proxy ? { proxy: { server: proxy } } : {}) });
const results: Record<string, unknown>[] = [];
try {
  for (const service of services) for (const region of regions) {
    const start = Date.now();
    const result: Record<string, unknown> = { service, region, checkedAt: new Date().toISOString(), officialUrl: `https://www.huaweicloud.com/intl/en-us/pricing/calculator.html?region=${region}&inIframe=true#/${service}` };
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block" });
    try {
      const { config, products } = await collector.service(service, region);
      result.configHash = config.hash; result.productsHash = products.hash;
      const parsed = JSON.parse(products.body);
      const items: Record<string, unknown>[] = [];
      function collect(value: unknown) {
        if (!value || typeof value !== "object") return;
        const row = value as Record<string, unknown>;
        if (row.resourceType && row.resourceSpecCode && Array.isArray(row.planList)) { items.push(row); return; }
        Object.values(row).forEach(collect);
      }
      collect(parsed.product);
      result.catalog = { productCount: items.length, resources: [...new Set(items.map(p => p.resourceType))], specCodes: [...new Set(items.map(p => String(p.resourceSpecCode)))].sort() };
      result.components = (await inspectConfig(config.body)).components;
      try { result.neo = await evaluateForm(config.body, parsed, { region, values: {} }, language); }
      catch (error) { result.neoError = String(error); }
      // Replay exactly the captured source versions into Huawei's independent renderer.
      await context.route("**/api/config?**", route => route.fulfill({ contentType: "text/plain", body: config.body }));
      await context.route("**/api/productInfo?**", route => route.fulfill({ contentType: "application/json", body: products.body }));
      await context.route("**/api/menuInfo?**", route => route.fulfill({ contentType: "application/json", body: menu.body }));
      const page = await context.newPage();
      const quotes: unknown[] = [];
      page.on("response", async response => {
        if (!response.url().includes("/inquiry/resource") || response.request().method() !== "POST") return;
        try { quotes.push({ request: response.request().postDataJSON(), response: await response.json() }); } catch { /* Failed response is not evidence. */ }
      });
      await page.goto(String(result.officialUrl), { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForFunction(() => typeof (window as unknown as { iframeSetValue?: unknown }).iframeSetValue === "function", undefined, { timeout: 45000 });
      await page.locator('[id^="calculator_"]').first().waitFor({ timeout: 45000 });
      await page.evaluate(region => (window as unknown as { iframeSetValue: (input: unknown) => void }).iframeSetValue({ global_REGIONINFO: { region, chargeMode: "ONDEMAND", locationType: "commonAZ" } }), region);
      // Require a quote for the requested region and mode, then allow debounced fields to settle.
      const deadline = Date.now() + 20000;
      while (!quotes.some(q => (q as { request: { regionId: string; chargingMode: number } }).request.regionId === region && (q as { request: { chargingMode: number } }).request.chargingMode === 1) && Date.now() < deadline) await page.waitForTimeout(200);
      await page.waitForTimeout(1000);
      const guideClose = page.locator(".guide-dialog").getByRole("button", { name: "Close", exact: true });
      if (await guideClose.isVisible()) {
        await guideClose.click();
        await page.locator(".guide-dialog").waitFor({ state: "hidden" });
        // The dialog's separate backdrop fades out after the dialog is hidden.
        await page.waitForTimeout(350);
      }
      result.official = await observe(page);
      result.screenshot = `${service}-${region}.png`;
      await page.screenshot({ path: `${output}/${result.screenshot}`, fullPage: true });
      const transitions = service === "ecs" ? [{ id: "calculator_ecs_radio", label: "Kunpeng" }] : service === "elb" ? [
        { id: "calculator_elb_type", label: "Shared load balancer" },
        { id: "calculator_elb_type", label: "Dedicated load balancer" },
        { id: "calculator_elb_type_spec", label: "Fixed" },
      ] : [];
      const variants = [];
      for (const transition of transitions) {
        const control = page.locator(`[id="${transition.id}"]`).getByText(transition.label, { exact: true });
        if (await control.count() !== 1 || !await control.isVisible()) continue;
        const nextQuote = page.waitForResponse(response => {
          if (!response.url().includes("/inquiry/resource") || response.request().method() !== "POST") return false;
          try { return response.request().postDataJSON().regionId === region; } catch { return false; }
        }, { timeout: 10000 }).catch(() => null);
        await control.click();
        await nextQuote;
        await page.waitForTimeout(500);
        variants.push({ name: transition.label, components: await observe(page) });
      }
      result.variants = variants;
      result.quotes = quotes;
      result.screenshot = `${service}-${region}.png`;
      await writeFile(`${output}/${service}-${region}.html`, await page.content());
    } catch (error) { result.auditError = String(error); }
    finally { await context.close(); }
    result.elapsedSeconds = (Date.now() - start) / 1000;
    results.push(result);
    await writeFile(`${output}/report.json`, JSON.stringify({ generatedAt: new Date().toISOString(), menuHash: store.latest(MENU_URL)?.hash, services, regions, results }, null, 2));
    console.log(`${service}/${region}: ${result.auditError ?? result.neoError ?? "captured"} (${result.elapsedSeconds}s)`);
  }
} finally {
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
  store.close();
}
