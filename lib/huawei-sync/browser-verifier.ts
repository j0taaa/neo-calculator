import { chromium, type Page } from "playwright";
import { evaluateForm } from "./engine";
import { QuoteGateway } from "./quotes";
import { canonical, hash } from "./store";
import type { VerifyCandidate } from "./worker";
import type { FormState, Inquiry } from "./types";

export function semanticInquiry(inquiry: Inquiry) {
  return { ...inquiry, productInfos: inquiry.productInfos.map(product => Object.fromEntries(Object.entries(product).filter(([key]) => key !== "id"))).sort((a,b) => canonical(a).localeCompare(canonical(b))) };
}

function rewrite(form: FormState, region: string) {
  const render: Record<string, Record<string, unknown>> = {};
  for (const field of form.fields) {
    if (field.binding) {
      const { component, key, measureId } = field.binding;
      (render[component] ??= {})[key] = measureId != null ? { measureValue: Number(field.value), measureId } : field.value;
      continue;
    }
    const separator = field.id.indexOf(".");
    if (separator < 0 || field.type !== "select") throw new Error(`Unsupported browser control: ${field.id}`);
    const id = field.id.slice(0, separator), key = field.id.slice(separator + 1);
    (render[id] ??= {})[key] = field.value;
  }
  return {
    global_REGIONINFO: { region, chargeMode: "ONDEMAND", locationType: "commonAZ" },
    template_RENDER: render,
    global_ONDEMANDTIME: { UNSET_Stepper_0: { measureValue: form.duration.value, measureId: form.duration.measureId } },
    global_QUANTITY: { UNSET_Stepper_0: { measureValue: 1, measureId: 41 } },
  };
}

async function checkFields(page: Page, form: FormState) {
  const actual = await page.evaluate(() => {
    const result: { component: string; label: string; selected: string; options: string[] }[] = [];
    const config = (window as unknown as { viewConfig: { calc_view: { components: { id: string; type: string }[] } } }).viewConfig;
    for (const component of config.calc_view.components) {
      if (component.id.startsWith("global_") || component.type === "CommonTip") continue;
      const root = document.getElementById(component.id);
      if (!root || !root.getClientRects().length) continue;
      for (const item of root.querySelectorAll<HTMLElement>(".tiny-form-item")) {
        if (!item.getClientRects().length) continue;
        const options = [...item.querySelectorAll("li")].map(el => el.textContent?.trim() ?? "").filter(Boolean);
        const selected = item.querySelector("li.active")?.textContent?.trim() ?? item.querySelector<HTMLInputElement>("input")?.value ?? "";
        result.push({ component: component.id, label: item.querySelector(".tiny-form-item__label")?.textContent?.trim() ?? "", selected, options });
      }
    }
    return result;
  });
  if (actual.length !== form.fields.length) throw new Error(`Field count mismatch: official ${actual.length}, Neo ${form.fields.length}`);
  for (const [index, field] of form.fields.entries()) {
    const item = actual[index];
    const selected = field.type === "number" ? String(field.value) : field.options?.find(option => option.value === field.value)?.label;
    if (item.label !== field.label || item.selected !== selected) throw new Error(`Field state mismatch: ${field.id} (${item.label}/${item.selected})`);
    if (field.type === "select" && canonical(item.options) !== canonical(field.options?.map(option => option.label))) throw new Error(`Field options mismatch: ${field.id}`);
  }
  return actual;
}

/** Uses Huawei's real renderer and network requests, never the Neo evaluator as its oracle. */
export const verifyInOfficialBrowser: VerifyCandidate = async (release, scenarios, store) => {
  const deadline = Date.now() + 10 * 60_000;
  const proxy = process.env.HWC_SOCKS5_PROXY?.replace("socks5h://", "socks5://");
  const browser = await chromium.launch({ headless: true, ...(proxy ? { proxy: { server: proxy } } : {}) });
  const gateway = new QuoteGateway();
  const evidence: unknown[] = [];
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    let frameworkVerified = false;
    // Pin the observed inputs while leaving Huawei's renderer and request construction independent.
    await context.route("**/api/config?**", route => route.fulfill({ contentType: "text/plain", body: store.body(release.configHash) }));
    await context.route("**/api/productInfo?**", route => route.fulfill({ contentType: "application/json", body: store.body(release.productsHash) }));
    await context.route("**/api/menuInfo?**", route => route.fulfill({ contentType: "application/json", body: store.body(release.menuHash) }));
    await context.route("**/CBC-PortalCalculator/*/framework.js", async route => {
      const response = await route.fetch();
      if (hash(await response.text()) !== release.frameworkHash) { await route.abort(); return; }
      frameworkVerified = true;
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    const url = `https://www.huaweicloud.com/intl/en-us/pricing/calculator.html?region=${release.region}&inIframe=true#/${release.service.id}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForFunction(() => typeof (window as unknown as { iframeSetValue?: unknown }).iframeSetValue === "function", undefined, { timeout: 45_000 });
    const firstComponent = scenarios[0].form.fields[0]?.id.split(".")[0];
    if (!firstComponent) throw new Error("No independently verifiable controls");
    await page.locator(`[id="${firstComponent}"]`).waitFor({ timeout: 45_000 });
    if (!frameworkVerified) throw new Error("Official shared renderer version was not verified");
    for (const scenario of scenarios) {
      for (const duration of [...new Set([scenario.form.duration.min, Math.min(scenario.form.duration.max, scenario.form.duration.min + 1)])]) {
        if (Date.now() > deadline) throw new Error("Independent verification exceeded its time budget");
        const form = await evaluateForm(store.body(release.configHash), JSON.parse(store.body(release.productsHash)), { ...scenario.input, duration });
        if (!form.inquiry) throw new Error("Candidate quote became unavailable");
        const expected = canonical(semanticInquiry(form.inquiry));
        // Rehydration can emit intermediate requests; only accept the exact final semantic payload.
        const responsePromise = page.waitForResponse(response => {
          if (!response.url().includes("/inquiry/resource") || response.request().method() !== "POST") return false;
          try { return canonical(semanticInquiry(response.request().postDataJSON())) === expected; } catch { return false; }
        }, { timeout: 20_000 });
        // Attach rejection handler immediately while waiting for independent UI rehydration.
        void responsePromise.catch(() => undefined);
        await page.evaluate(value => (window as unknown as { iframeSetValue: (value: unknown) => void }).iframeSetValue(value), rewrite(form, release.region));
        const response = await responsePromise;
        if (!response.ok()) throw new Error(`Official quote failed (${response.status()})`);
        const official = await response.json();
        const quote = await gateway.quote(release.id, form.inquiry, true);
        if (official.amount !== quote.amount || official.currency !== quote.currency) throw new Error("Independent price mismatch");
        const amounts = (items: { amount: number }[]) => items.map(p => p.amount).sort((a,b) => a-b);
        if (canonical(amounts(official.productRatingResult)) !== canonical(amounts(quote.breakdown))) throw new Error("Independent component price mismatch");
        const fields = await checkFields(page, form);
        evidence.push({ input: scenario.input, duration, inquiry: form.inquiry, amount: quote.amount, currency: quote.currency, fields });
        if (evidence.length % 8 === 0) console.log(`Checked ${release.service.id}/${release.region}: ${evidence.length} scenarios`);
      }
    }
    const saved = store.snapshot(`verification:${release.id}:${Date.now()}`, JSON.stringify(evidence));
    return { source: "official-browser", checkedAt: new Date().toISOString(), cases: evidence.length, evidenceHash: saved.hash };
  } finally {
    // Bun can miss Playwright's close acknowledgement after the Chromium process exits.
    // Bound teardown so a completed/failed verification cannot retain the scheduler lease forever.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([browser.close(), new Promise<void>(resolve => { timer = setTimeout(resolve, 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
};
