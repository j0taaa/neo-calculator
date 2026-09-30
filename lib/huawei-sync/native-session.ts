import {
  parseNativeSelection,
  selectionField,
  selectionFields,
  sameSelection,
  type NativeSelection,
} from "./native-selection";
import { randomUUID } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { HuaweiCollector, PAGE_URL } from "./collector";
import { readNativeForm, setNativeValue, validateNativeValue } from "./native-dom";
import { QuoteGateway } from "./quotes";
import type { Inquiry, Quote } from "./types";
import type { NativeAction, NativeDirectory, NativeForm, NativeState } from "./native-types";

const IDLE_MS = 10 * 60_000;
const MAX_AGE_MS = 30 * 60_000;
export class NativeError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}
type Session = {
  id: string;
  page: Page;
  context: BrowserContext;
  service: string;
  region: string;
  created: number;
  touched: number;
  revision: number;
  busy: boolean;
  selection: NativeSelection;
  source: NativeState["source"];
  form: NativeForm;
  sourceErrors: string[];
  generation: number;
  requestedAt: number;
  inquiry: Inquiry | null;
  quote: Quote | null;
  priceError?: string;
};

/** One upstream renderer per short-lived anonymous session. No application data is loaded in it. */
export class NativeCalculator {
  private browser?: Promise<Browser>;
  private sessions = new Map<string, Session>();
  private opening = 0;
  private gateway = new QuoteGateway();
  constructor(
    private readonly collector: HuaweiCollector,
    private readonly capacity = 6,
  ) {}
  async directory(): Promise<NativeDirectory> {
    const { snapshot, services } = await this.collector.directory();
    const menu = JSON.parse(snapshot.body);
    return {
      services: services.filter((service) => service.available),
      regions: Object.keys(menu.regionRules)
        .filter(
          (id) =>
            menu.regionsOfSite.HWC.includes(id) &&
            (menu.regionRules[id] === "ALL" || menu.regionRules[id]?.calc === true),
        )
        .map((id) => ({ id, name: menu.global[id] || id })),
    };
  }
  private async getBrowser() {
    if (!this.browser) {
      const proxy = process.env.HWC_SOCKS5_PROXY?.replace("socks5h://", "socks5://");
      this.browser = chromium
        .launch({ headless: true, ...(proxy ? { proxy: { server: proxy } } : {}) })
        .then((browser) => {
          browser.on("disconnected", () => {
            this.browser = undefined;
            this.sessions.clear();
          });
          return browser;
        })
        .catch((error) => {
          this.browser = undefined;
          throw error;
        });
    }
    return this.browser;
  }
  async sweep() {
    const now = Date.now();
    for (const session of this.sessions.values())
      if (!session.busy && (now - session.touched > IDLE_MS || now - session.created > MAX_AGE_MS))
        await this.remove(session.id);
  }
  async remove(id: string) {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    await session.context.close().catch(() => {});
  }
  async close() {
    await Promise.all([...this.sessions.keys()].map((id) => this.remove(id)));
    await (await this.browser)?.close();
    this.browser = undefined;
  }
  async open(service: string, region: string): Promise<NativeState> {
    await this.sweep();
    if (this.sessions.size + this.opening >= this.capacity)
      throw new NativeError("The preview is busy. Close another preview or try again shortly.", 503);
    this.opening++;
    let context: BrowserContext | undefined, session: Session | undefined;
    try {
      const directory = await this.directory();
      if (!directory.services.some((s) => s.id === service) || !directory.regions.some((r) => r.id === region))
        throw new NativeError("Unknown service or region");
      const [{ config, products }, framework, { snapshot: menu }] = await Promise.all([
        this.collector.service(service, region),
        this.collector.framework(),
        this.collector.directory(),
      ]);
      const pageSource = this.collector.store.latest(PAGE_URL);
      if (!pageSource) throw new Error("Huawei calculator page snapshot is missing");
      context = await (
        await this.getBrowser()
      ).newContext({ viewport: { width: 1440, height: 1200 }, serviceWorkers: "block", acceptDownloads: false });
      context.setDefaultTimeout(8000);
      const sourceErrors: string[] = [];
      // Outbound browser access is limited to public Huawei resources and the read-only pricing inquiry.
      await context.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        const allowed =
          url.protocol === "https:" &&
          ["huaweicloud.com", "hc-cdn.com", "hc-cdn.cn"].some(
            (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
          );
        if (
          !allowed ||
          (request.method() !== "GET" &&
            request.method() !== "OPTIONS" &&
            !(request.method() === "POST" && url.pathname.endsWith("/inquiry/resource")))
        )
          return route.abort();
        if (url.origin === new URL(PAGE_URL).origin && url.pathname === new URL(PAGE_URL).pathname)
          return route.fulfill({ contentType: "text/html", body: pageSource.body });
        if (url.pathname.endsWith("/api/config")) {
          if (url.searchParams.get("urlPath") !== service) {
            sourceErrors.push("Huawei requested configuration outside this service snapshot");
            return route.abort();
          }
          return route.fulfill({ contentType: "text/plain", body: config.body });
        }
        if (url.pathname.endsWith("/api/productInfo")) {
          if (url.searchParams.get("region") !== region || url.searchParams.get("urlPath") !== service) {
            sourceErrors.push("Huawei requested products outside this service/region snapshot");
            return route.abort();
          }
          return route.fulfill({ contentType: "application/json", body: products.body });
        }
        if (url.pathname.endsWith("/api/menuInfo"))
          return route.fulfill({ contentType: "application/json", body: menu.body });
        if (url.pathname.endsWith("/framework.js")) {
          if (request.url() !== framework.url) return route.abort();
          return route.fulfill({ contentType: "application/javascript", body: framework.body });
        }
        return route.continue();
      });
      const page = await context.newPage();
      if (process.env.NATIVE_DEBUG) {
        page.on("requestfailed", (r) => console.error("FAILED", r.url(), r.failure()));
        page.on("pageerror", (e) => console.error("PAGE", e.message));
      }
      session = {
        id: randomUUID(),
        page,
        context,
        service,
        region,
        created: Date.now(),
        touched: Date.now(),
        revision: 0,
        busy: true,
        selection: { version: 1, service, region, initial: [], steps: [], fields: [] },
        source: {
          page: pageSource.hash,
          config: config.hash,
          products: products.hash,
          framework: framework.hash,
          menu: menu.hash,
          fetchedAt: products.fetchedAt,
        },
        form: { fields: [], notes: [], diagnostics: [] },
        sourceErrors,
        generation: 0,
        requestedAt: 0,
        inquiry: null,
        quote: null,
      };
      const current = session;
      // Capture the *last request*, not the last response. Old responses cannot overwrite newer selections.
      page.on("request", (request) => {
        if (!request.url().includes("/inquiry/resource") || request.method() !== "POST") return;
        current.generation++;
        current.requestedAt = Date.now();
        current.quote = null;
        current.inquiry = null;
        current.priceError = undefined;
        try {
          const inquiry = request.postDataJSON() as Inquiry;
          if (inquiry.regionId !== region || inquiry.chargingMode !== 1 || inquiry.siteCode !== "HWC")
            throw new Error("Huawei returned a different region or billing mode");
          current.inquiry = inquiry;
        } catch (error) {
          current.priceError = String(error);
        }
      });
      await page.goto(`${PAGE_URL}?region=${region}&inIframe=true#/${service}`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForFunction(
        () => typeof (window as unknown as { iframeSetValue?: unknown }).iframeSetValue === "function",
        undefined,
        { timeout: 45000 },
      );
      await page.locator('[id^="calculator_"]').first().waitFor({ timeout: 45000 });
      await page.evaluate(
        (region) =>
          (window as unknown as { iframeSetValue: (value: unknown) => void }).iframeSetValue({
            global_REGIONINFO: { region, chargeMode: "ONDEMAND", locationType: "commonAZ" },
          }),
        region,
      );
      const guide = page.locator(".guide-dialog").getByRole("button", { name: "Close", exact: true });
      if (await guide.isVisible()) {
        await guide.click();
        await page.waitForTimeout(350);
      }
      await this.settle(session, 0);
      session.selection.initial = selectionFields(session.form);
      this.sessions.set(session.id, session);
      await this.price(session);
      session.busy = false;
      return this.state(session);
    } catch (error) {
      if (session) this.sessions.delete(session.id);
      await context?.close().catch(() => {});
      throw error;
    } finally {
      this.opening--;
    }
  }
  private state(s: Session): NativeState {
    return {
      ...s.form,
      selection: { ...s.selection, fields: selectionFields(s.form) },
      session: s.id,
      revision: s.revision,
      service: s.service,
      region: s.region,
      source: s.source,
      expiresAt: new Date(Math.min(s.touched + IDLE_MS, s.created + MAX_AGE_MS)).toISOString(),
      inquiry: s.form.diagnostics.length ? null : s.inquiry,
      quote: s.form.diagnostics.length ? null : s.quote,
      priceError: s.priceError,
    };
  }
  private async settle(s: Session, after: number) {
    const deadline = Date.now() + 25000;
    let previous = "",
      stableSince = Date.now();
    while (Date.now() < deadline) {
      const form = await readNativeForm(s.page);
      form.diagnostics.push(...new Set(s.sourceErrors));
      const signature = JSON.stringify(form);
      if (signature !== previous) {
        previous = signature;
        stableSince = Date.now();
      }
      if (s.generation > after && Date.now() - Math.max(stableSince, s.requestedAt) >= 1500) {
        s.form = form;
        return;
      }
      await s.page.waitForTimeout(200);
    }
    s.inquiry = null;
    s.quote = null;
    throw new NativeError(
      "Huawei did not produce a settled quote for this change. Reopen the calculator to retry.",
      502,
    );
  }
  private async price(s: Session) {
    s.quote = null;
    if (s.form.diagnostics.length || !s.inquiry) return;
    s.priceError = undefined;
    const generation = s.generation;
    try {
      const quote = await this.gateway.quote(
        `${s.source.config}:${s.source.products}:${s.source.framework}`,
        s.inquiry,
        true,
      );
      const current = await readNativeForm(s.page);
      if (s.sourceErrors.length || s.generation !== generation || JSON.stringify(current) !== JSON.stringify(s.form))
        throw new Error("Huawei changed the configuration while pricing. Reopen to retry.");
      s.quote = quote;
    } catch (error) {
      s.priceError = error instanceof Error ? error.message : "Huawei price unavailable";
    }
  }
  async act(action: NativeAction): Promise<NativeState> {
    const s = this.sessions.get(action.session);
    if (!s || Date.now() - s.touched > IDLE_MS || Date.now() - s.created > MAX_AGE_MS) {
      if (s) await this.remove(s.id);
      throw new NativeError("This calculator session expired. Reopen it to load current Huawei data.", 410);
    }
    if (s.selection.steps.length >= 200)
      throw new NativeError("This configuration has too many edits. Reopen the calculator.");
    if (s.busy || action.revision !== s.revision)
      throw new NativeError("This form has changed. Reload before editing it again.", 409);
    const field = s.form.fields.find((field) => field.id === action.field);
    if (!field) throw new NativeError("Unknown control");
    validateNativeValue(field, action.value);
    s.busy = true;
    s.quote = null;
    s.touched = Date.now();
    try {
      const current = await readNativeForm(s.page);
      if (JSON.stringify(current) !== JSON.stringify(s.form))
        throw new NativeError("Huawei changed this form. Reopen it before editing.", 409);
      if (field.type === "action" || action.value !== field.value) {
        const generation = s.generation;
        await setNativeValue(s.page, field, action.value);
        await this.settle(s, generation);
        s.selection.steps.push({
          before: selectionField(field),
          value: action.value,
          ...(field.type === "select"
            ? { optionLabel: field.options?.find((option) => option.value === String(action.value))?.label }
            : {}),
        });
      }
      s.revision++;
      await this.price(s);
      return this.state(s);
    } catch (error) {
      await this.remove(s.id);
      throw error;
    } finally {
      s.busy = false;
    }
  }
  async refresh(id: string, revision: number): Promise<NativeState> {
    const s = this.sessions.get(id);
    if (!s || Date.now() - s.touched > IDLE_MS || Date.now() - s.created > MAX_AGE_MS)
      throw new NativeError("This calculator session expired. Reopen it before saving.", 410);
    if (s.busy || s.revision !== revision)
      throw new NativeError("The configuration changed before saving. Try again.", 409);
    s.busy = true;
    s.touched = Date.now();
    try {
      await this.price(s);
      if (!s.quote || s.form.diagnostics.length)
        throw new NativeError(s.priceError ?? "A complete Huawei price is required before saving.");
      return this.state(s);
    } finally {
      s.busy = false;
    }
  }
  async restore(input: unknown): Promise<NativeState> {
    const saved = parseNativeSelection(input);
    let state = await this.open(saved.service, saved.region);
    try {
      if (!sameSelection(selectionFields(state), saved.initial))
        throw new NativeError("Huawei's defaults or controls changed. Configure this item again before saving.");
      for (const step of saved.steps) {
        const field = state.fields.find((field) => field.id === step.before.id);
        if (
          !field ||
          !sameSelection(selectionField(field), step.before) ||
          (field.type === "select" &&
            field.options?.find((option) => option.value === String(step.value))?.label !== step.optionLabel)
        )
          throw new NativeError("A saved Huawei option changed or is unavailable. Configure this item again.");
        state = await this.act({
          session: state.session,
          revision: state.revision,
          field: field.id,
          value: step.value,
        });
      }
      if (!sameSelection(selectionFields(state), saved.fields))
        throw new NativeError("Huawei could not restore the exact saved configuration.");
      return state;
    } catch (error) {
      await this.remove(state.session);
      throw error;
    }
  }
}
