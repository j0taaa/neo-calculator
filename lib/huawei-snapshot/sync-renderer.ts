import { chromium, type Browser } from "playwright";
import { readFile } from "node:fs/promises";
import { frameHtml, rewriteImports } from "./frame-html";
import { frameDataScript } from "./frame-data";
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
    locationCode?: string,
  ) {
    const context = await this.browser.newContext({
      viewport: { width: 1500, height: 1300 },
      serviceWorkers: "block",
    });
    const token = crypto.randomUUID();
    let mode: NativeBillingMode = scope.modes[0];
    const origin = "http://calculator.local";
    const dataPath = "/api/calculator/snapshot/candidate/data/scope";
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
          body: frameHtml(release, scope, mode, origin, token, locationCode, dataPath),
        });
      if (url.pathname === dataPath)
        return route.fulfill({
          contentType: "application/javascript",
          body: frameDataScript(release, scope),
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
    function assertLocalPricing(state: NativeState) {
      if (state.quote || state.availability) return;
      const recoverable =
        !state.priceError ||
        state.priceError ===
          "Choose available specifications to calculate a price" ||
        state.priceError.includes(
          "Quantity exceeds Huawei’s calculation limit",
        );
      if (state.diagnostics.length || !recoverable)
        throw new Error(`${state.priceError}; ${JSON.stringify(state.fields)}`);
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
      if (!state.quote || !state.local)
        throw new Error(
          state.priceError ||
            "The corrected local configuration could not be restored",
        );
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
      const pricing = state.local.pricing;
      for (const product of pricing.selectedProduct.productAllInfos.filter(
        (product) => product.inquiryTag === "support",
      )) {
        const id = `${pricing.selectedProduct.timeTag}-${product.selectIndex}-${product.productId || "noId"}`;
        const amount = pricing.result!.productRatingResult.find(
          (item) => item.id === id,
        )?.amount;
        if (amount === undefined)
          throw new Error("Missing official custom pricing result");
        (scope.customProof ??= []).push({
          product,
          months:
            pricing.selectedProduct.periodNum *
            (pricing.selectedProduct.periodType === 3 ? 12 : 1),
          amount,
        });
        checks++;
      }
      return state;
    }
    try {
      for (mode of locationCode
        ? scope.locationModes![locationCode]
        : scope.modes) {
        if (
          !(
            locationCode ? scope.locationModes![locationCode] : scope.modes
          ).includes(mode)
        )
          continue;
        await page.goto(origin, { waitUntil: "load" });
        await page.waitForFunction(
          () => (window as unknown as { ready: boolean }).ready,
          { timeout: 15000 },
        );
        await page
          .frames()[1]
          .waitForFunction(
            () =>
              !!(window as unknown as { viewConfig?: { calc_view?: unknown } })
                .viewConfig?.calc_view,
            undefined,
            { timeout: 15000 },
          );
        const rules = await page.frames()[1].evaluate(
          () =>
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
            ).viewConfig.calc_view.regions ?? [],
        );
        const modes = configuredBillingModes(
          locationCode ? scope.locationModes![locationCode] : scope.modes,
          scope.region,
          rules,
          scope.tag,
        );
        if (locationCode) scope.locationModes![locationCode] = modes;
        else scope.modes = modes;
        if (!modes.includes(mode)) continue;
        let state = await action({ action: "open" });
        if (Object.keys(scope.locationModes ?? {}).length) {
          if (
            !state.fields.some(
              (field) => field.component === "global_LOCATIONTYPE",
            )
          )
            throw new Error(
              "The official availability-zone control was not synchronized",
            );
          if (
            locationCode &&
            (!state.fields.some(
              (field) => field.component === "global_LOCATIONCODE",
            ) ||
              (await page
                .frames()[1]
                .evaluate(
                  () =>
                    (
                      window as unknown as {
                        __neoNativePricing?: {
                          selectedProduct?: { locationCode?: string };
                        };
                      }
                    ).__neoNativePricing?.selectedProduct?.locationCode,
                )) !== locationCode)
          )
            throw new Error(
              `The official calculator did not select availability zone ${locationCode}`,
            );
        }
        const modeChecks = checks;
        if (
          state.availability &&
          !state.diagnostics.length &&
          state.fields.every((field) => field.component.startsWith("global_"))
        ) {
          checks++;
          continue;
        }
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
          if (locationCode)
            scope.locationModes![locationCode] = modes.filter(
              (candidate) => candidate !== mode,
            );
          else scope.modes = modes.filter((candidate) => candidate !== mode);
          continue;
        }
        let onlyUnavailable = state.availability === "unavailable";
        assertLocalPricing(state);
        if (state.quote) state = await verify(state);

        if (scope.customPricing?.support) {
          const literals = new Set<number>([0, 1000000]);
          const visit = (node: unknown) => {
            if (!node || typeof node !== "object") return;
            if (
              "literal" in node &&
              typeof node.literal === "number" &&
              node.literal >= 1
            )
              for (const value of [
                node.literal - 1,
                node.literal,
                node.literal + 1,
              ])
                literals.add(value);
            for (const value of Object.values(node)) visit(value);
          };
          visit(scope.customPricing.support);
          const type = state.fields.find(
            (field) =>
              field.component === "calculator_support_radio" &&
              field.type === "select",
          )!;
          for (const option of type.options!.filter(
            (option) => !option.disabled,
          )) {
            if (
              state.fields.find((field) => field.id === type.id)?.value !==
              option.value
            )
              state = await action({
                action: "change",
                revision: state.revision,
                field: type.id,
                value: option.value,
              });
            for (const value of [...literals].sort((a, b) => a - b)) {
              const field = state.fields.find(
                (field) =>
                  field.component === "calculator_support_radio" &&
                  field.type === "number",
              );
              if (
                !field ||
                value < (field.min ?? 0) ||
                value > (field.max ?? Infinity)
              )
                continue;
              if (field.value !== value)
                state = await action({
                  action: "change",
                  revision: state.revision,
                  field: field.id,
                  value,
                });
              state = await verify(state);
            }
          }
        }
        // Exercise numeric changes and conditional branches using the same client adapter.
        if (unchanged) continue;
        const ids = state.fields
          .filter(
            (field) =>
              !field.disabled &&
              field.type !== "action" &&
              !field.component.startsWith("global_LOCATION"),
          )
          .map((field) => field.id);
        for (const id of ids) {
          const field = state.fields.find((field) => field.id === id);
          if (!field || field.disabled) continue;
          if (field.unitSelector) {
            for (const option of field.options!.filter(
              (option) => !option.disabled,
            )) {
              const current = state.fields.find((field) => field.id === id);
              if (
                !current ||
                current.disabled ||
                !current.options?.some(
                  (item) => item.value === option.value && !item.disabled,
                )
              )
                continue;
              if (current.value !== option.value)
                state = await action({
                  action: "change",
                  revision: state.revision,
                  field: id,
                  value: option.value,
                });
              onlyUnavailable &&= state.availability === "unavailable";
              assertLocalPricing(state);
              if (state.quote) state = await verify(state);
            }
            continue;
          }
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
          onlyUnavailable &&= state.availability === "unavailable";
          assertLocalPricing(state);
          if (state.quote) state = await verify(state);
        }
        if (checks === modeChecks && onlyUnavailable) checks++;
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
