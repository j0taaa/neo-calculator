import { chromium, type Browser } from "playwright";
import { readFile } from "node:fs/promises";
import { frameHtml, rewriteImports } from "./frame-html";
import { SnapshotStore } from "./store";
import type { ScopeSnapshot, SnapshotRelease } from "./types";
import type { NativeState } from "../huawei-native/native-types";
import type { NativeBillingMode } from "../huawei-native/native-billing";
import { calculateQuote } from "./verify";
import { compareInquiry } from "./audit";
import { configuredBillingModes } from "./availability";

/** Chromium is an oracle in the daily job only. Requests from the local frame are blocked. */
export class SyncRenderer {
  private constructor(
    readonly browser: Browser,
    private store: SnapshotStore,
    private bridge: string,
  ) {}
  static async create(store: SnapshotStore) {
    return new SyncRenderer(
      await chromium.launch({ headless: true }),
      store,
      await readFile("public/calculator-snapshot-bridge.js", "utf8"),
    );
  }
  async close() {
    await this.browser.close();
  }
  async validate(
    release: SnapshotRelease,
    scope: ScopeSnapshot,
    unchanged = false,
  ) {
    const context = await this.browser.newContext({
      viewport: { width: 1500, height: 1300 },
      serviceWorkers: "block",
    });
    const token = crypto.randomUUID();
    let mode: NativeBillingMode = scope.modes[0];
    const origin = "http://calculator.local";
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/")
        return route.fulfill({
          contentType: "text/html",
          body: `<script>window.messages={};addEventListener('message',e=>{if(e.source===document.querySelector('iframe').contentWindow&&e.data.token===${JSON.stringify(token)}){if(e.data.ready)window.ready=true;else window.messages[e.data.id]=e.data;}});</script><iframe sandbox="allow-scripts" src="/frame?inIframe=true&region=${scope.region}#/${scope.service}" style="width:1440px;height:1200px"></iframe>`,
        });
      if (url.pathname === "/frame")
        return route.fulfill({
          contentType: "text/html",
          body: frameHtml(release, scope, mode, origin, token),
        });
      if (url.pathname.endsWith("/bridge"))
        return route.fulfill({
          contentType: "application/javascript",
          body: this.bridge,
        });
      const entry = Object.entries(release.assets).find(
        ([, asset]) => asset.hash === url.pathname.split("/").at(-1),
      );
      if (entry) {
        let body = await this.store.read(entry[1].hash);
        if (entry[1].type === "application/javascript")
          body = rewriteImports(body, entry[0], release);
        return route.fulfill({
          contentType: entry[1].type,
          headers: { "access-control-allow-origin": "*" },
          body,
        });
      }
      return route.abort();
    });
    let checks = 0;
    const page = await context.newPage();
    async function action(body: Record<string, unknown>): Promise<NativeState> {
      const id = crypto.randomUUID();
      await page.evaluate(
        ({ body, id, token }) =>
          document
            .querySelector("iframe")!
            .contentWindow!.postMessage({ ...body, id, token }, "*"),
        { body, id, token },
      );
      await page.waitForFunction(
        (id) =>
          !!(window as unknown as { messages: Record<string, unknown> })
            .messages[id],
        id,
        { timeout: 20000 },
      );
      const data = await page.evaluate(
        (id) =>
          (
            window as unknown as {
              messages: Record<string, { error?: string; result: NativeState }>;
            }
          ).messages[id],
        id,
      );
      if (data.error)
        throw new Error(`${data.error}; action ${JSON.stringify(body)}`);
      return data.result;
    }
    async function verify(state: NativeState) {
      if (!state.quote || state.diagnostics.length)
        throw new Error(
          state.priceError || "Incomplete synchronized configuration",
        );
      let calibrated = false;
      for (const inquiry of state.inquiries) {
        const checked = await compareInquiry(scope, inquiry);
        checks += checked.checks;
        calibrated ||= checked.calibrated;
      }
      if (calibrated) {
        await page.goto(origin, { waitUntil: "load" });
        await page.waitForFunction(
          () => (window as unknown as { ready: boolean }).ready,
        );
        state = await action({ action: "restore", selection: state.selection });
      }
      const rebuilt = calculateQuote(
        scope,
        release.id,
        state.local!.pricing,
        state.inquiries,
      ).quote;
      if (
        !state.quote ||
        Math.abs(rebuilt.amount - state.quote.amount) > 0.0000001
      )
        throw new Error("The local form and server calculation disagree");
      return state;
    }
    try {
      for (mode of scope.modes) {
        await page.goto(origin, { waitUntil: "load" });
        await page.waitForFunction(
          () => (window as unknown as { ready: boolean }).ready,
          { timeout: 15000 },
        );
        const rules = await page.frames()[1].evaluate(() =>
          (
            (
              window as unknown as {
                viewConfig: {
                  calc_view: {
                    regions?: {
                      tag?: string;
                      hideChargeModeList?: string[];
                      hideChargeModeMap?: Record<string, string[]>;
                    }[];
                  };
                };
              }
            ).viewConfig.calc_view.regions ?? []
          ).filter((rule) => !rule.tag || rule.tag === "general.online.portal"),
        );
        scope.modes = configuredBillingModes(scope.modes, scope.region, rules);
        if (!scope.modes.includes(mode)) continue;
        let state = await action({ action: "open" });
        const modeChecks = checks;
        const noResources = await page.frames()[1].evaluate(
          () =>
            (
              window as unknown as {
                __neoNativePricing?: {
                  selectedProduct?: { productAllInfos?: unknown[] };
                };
              }
            ).__neoNativePricing?.selectedProduct?.productAllInfos?.length ===
            0,
        );
        if (
          !state.quote &&
          (noResources ||
            state.fields.some(
              (field) =>
                field.component === "global_PERIODTIME" &&
                field.type === "select" &&
                field.options?.length === 0,
            )) &&
          state.fields.every((field) => field.component.startsWith("global_"))
        ) {
          // Some menu modes have no offer after the official configuration's data filters.
          scope.modes = scope.modes.filter((candidate) => candidate !== mode);
          continue;
        }
        if (state.quote) state = await verify(state);
        else if (state.diagnostics.length)
          throw new Error(
            `${state.priceError}; ${JSON.stringify(state.fields)}`,
          );

        // Exercise numeric changes and conditional branches using the same client adapter.
        if (unchanged) continue;
        const ids = state.fields
          .filter((field) => !field.disabled && field.type !== "action")
          .map((field) => field.id);
        for (const id of ids) {
          const field = state.fields.find((field) => field.id === id);
          if (!field || field.disabled) continue;
          let value: string | number | boolean | undefined;
          if (field.type === "number")
            value = Math.min(
              field.max ?? 9999,
              Math.max(field.min ?? 0, Number(field.value) + 1),
            );
          else if (field.type === "select")
            value = field.options
              ?.filter(
                (option) => !option.disabled && option.value !== field.value,
              )
              .at(-1)?.value;
          else if (field.type === "checkbox") value = !field.value;
          if (value === undefined || value === field.value) continue;
          state = await action({
            action: "change",
            revision: state.revision,
            field: id,
            value,
          });
          if (state.quote) state = await verify(state);
          else if (state.diagnostics.length)
            throw new Error(
              `${state.priceError}; ${JSON.stringify(state.fields)}`,
            );
        }
        if (checks === modeChecks)
          throw new Error(
            `No valid local quotation was found for ${mode}: ${state.priceError}; ${JSON.stringify(state.fields)}`,
          );
      }
      return checks;
    } finally {
      await page.close();
      await context.close();
    }
  }
}
