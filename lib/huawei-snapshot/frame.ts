import {
  readFormInDocument,
  validateNativeValue,
} from "../huawei-native/native-dom";
import {
  selectionField,
  sameSelection,
  parseNativeSelection,
  selectionBillingMode,
} from "../huawei-native/native-selection";
import { validateAggregatedQuote } from "../huawei-native/native-quote";
import type { NativeState, NativeField } from "../huawei-native/native-types";
import type {
  NativePricing,
  NativeInquiryQuote,
} from "../huawei-native/native-pricing";
import type { ScopeSnapshot } from "./types";
import type { Inquiry } from "../huawei-native/types";
import { rateInquiry, UnavailableProduct } from "./rating";
import { localState } from "./state";
import { calculateQuote } from "./verify";
import { createEmissionQueue } from "./emissions";

// Opaque sandbox origins deliberately have no cookies or persistent browser storage.
Object.defineProperty(document, "cookie", {
  get: () => "",
  set: () => {},
  configurable: true,
});
Object.defineProperty(window, "indexedDB", {
  value: undefined,
  configurable: true,
});
const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
  };
};
for (const key of ["localStorage", "sessionStorage"])
  Object.defineProperty(window, key, {
    value: memoryStorage(),
    configurable: true,
  });
// Vendor navigation icons are presentation-only in this hidden rule executor.
// Replace their URLs before Vue sets src, so no external image request is attempted.
const transparentIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
const localImage = (value: unknown) =>
  typeof value === "string" && /^https?:/.test(value) ? transparentIcon : value;
const imageSrc = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "src",
)!;
Object.defineProperty(HTMLImageElement.prototype, "src", {
  ...imageSrc,
  set(value: string) {
    imageSrc.set!.call(this, localImage(value));
  },
});
const setAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name, value) {
  setAttribute.call(
    this,
    name,
    this instanceof HTMLImageElement && name.toLowerCase() === "src"
      ? String(localImage(value))
      : value,
  );
};
type Payload = {
  release: string;
  snapshot: ScopeSnapshot;
  menu: string;
  billingMode: NativeState["billingMode"];
  token: string;
  locationCode?: string;
};
const win = window as unknown as {
  __neoSnapshot: Payload;
  __neoNativePricing?: NativePricing;
  iframeSetValue?: (value: unknown) => void;
};
const payload = win.__neoSnapshot,
  scope = payload.snapshot;
const emissions = createEmissionQueue();
Object.assign(window, { __neoLocalEmissions: emissions });
const captured = new Map<string, NativeInquiryQuote>();
let state: NativeState | null = null;
let priceError = "";
let unavailableProduct = false;
// All API reads and ratings are resolved from the pinned release, never from the network.
function respond(url: string, body?: string | null) {
  const target = new URL(url, location.href);
  if (target.pathname.endsWith("/api/config")) {
    if (target.searchParams.get("urlPath") !== scope.service)
      throw new Error("Configuration scope changed");
    return scope.config;
  }
  if (target.pathname.endsWith("/api/productInfo")) {
    if (
      target.searchParams.get("urlPath") !== scope.service ||
      target.searchParams.get("region") !== scope.region
    )
      throw new Error("Product scope changed");
    return JSON.stringify(scope.products);
  }
  if (target.pathname.endsWith("/api/menuInfo")) return payload.menu;
  if (target.pathname.endsWith("/featuredProducts.json"))
    return JSON.stringify({ china: [], intl: [] });
  if (target.pathname.endsWith("/inquiry/resource") && body) {
    const inquiry = JSON.parse(body) as Inquiry;
    let response;
    try {
      response = rateInquiry(scope, inquiry);
      priceError = "";
      unavailableProduct = false;
    } catch (error) {
      unavailableProduct = error instanceof UnavailableProduct;
      throw new Error(
        `${error instanceof Error ? error.message : error}; ${JSON.stringify(inquiry)}`,
      );
    }
    captured.set(JSON.stringify(inquiry), { inquiry, response });
    return JSON.stringify(response);
  }
  // Auxiliary login, marketing and currency features are not part of the local calculator.
  if (/islogin|exchange-rate|\/ad\/|\/report\//.test(target.pathname))
    return "{}";
  throw new Error(`Unsynchronized calculator dependency: ${target.pathname}`);
}
class LocalXHR extends EventTarget {
  readyState = 0;
  status = 0;
  statusText = "";
  responseText = "";
  response: unknown = "";
  responseType = "";
  responseURL = "";
  timeout = 0;
  withCredentials = false;
  upload = new EventTarget();
  onloadend: ((e: Event) => void) | null = null;
  onreadystatechange: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onabort: ((e: Event) => void) | null = null;
  private aborted = false;
  open(_method: string, url: string) {
    this.responseURL = url;
    this.readyState = 1;
  }
  setRequestHeader() {}
  getAllResponseHeaders() {
    return "content-type: application/json\r\n";
  }
  getResponseHeader() {
    return "application/json";
  }
  abort() {
    this.aborted = true;
    this.onabort?.(new Event("abort"));
  }
  send(body?: string) {
    queueMicrotask(() => {
      if (this.aborted) return;
      try {
        this.responseText = respond(this.responseURL, body);
        this.status = 200;
        this.statusText = "OK";
      } catch (error) {
        console.error("Local dependency failed", this.responseURL);
        priceError =
          error instanceof Error ? error.message : "Local rating failed";
        this.responseText = JSON.stringify({ error: priceError });
        this.status = 422;
      }
      this.response =
        this.responseType === "json"
          ? JSON.parse(this.responseText)
          : this.responseText;
      this.readyState = 4;
      this.onreadystatechange?.(new Event("readystatechange"));
      this.onloadend?.(new Event("loadend"));
      this.dispatchEvent(new Event("loadend"));
    });
  }
}
Object.assign(window, {
  XMLHttpRequest: LocalXHR,
  fetch: async (url: string, options?: RequestInit) =>
    new Response(
      respond(url, typeof options?.body === "string" ? options.body : null),
    ),
});
const pause = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
async function settle(afterEpoch = -1) {
  const deadline = Date.now() + 15000,
    started = Date.now();
  let previous = "",
    epoch = -1,
    emissionVersion = -1,
    stableSince = Date.now();
  while (Date.now() < deadline) {
    // Each turn lets Vue's render/microtasks and coalesced component emissions finish.
    // A price is usable only after two identical observations with no pending emissions.
    await pause(0);
    const bridge = win.__neoNativePricing;
    if (emissions.pending || bridge?.pending) {
      previous = "";
      epoch = -1;
      continue;
    }
    const pricing: NativePricing | undefined = bridge
      ? JSON.parse(JSON.stringify(bridge))
      : undefined;
    const form = readFormInDocument();
    if (unavailableProduct) form.availability = "unavailable";
    const signature = JSON.stringify(form);
    if (signature !== previous) stableSince = Date.now();
    if (
      pricing &&
      pricing.epoch > afterEpoch &&
      !pricing.pending &&
      pricing.result &&
      pricing.selectedProduct.chargeMode === payload.billingMode
    ) {
      if (
        epoch === pricing.epoch &&
        signature === previous &&
        emissionVersion === emissions.version
      ) {
        try {
          if (pricing.result.wrongTag)
            throw new Error(
              priceError || "This configuration has no synchronized price",
            );
          const { quote, inquiries } = validateAggregatedQuote(
            pricing,
            [...captured.values()],
            {
              service: scope.service,
              region: scope.region,
              billingMode: payload.billingMode,
              releaseId: payload.release,
            },
          );
          const rebuilt = calculateQuote(
            scope,
            payload.release,
            pricing,
            inquiries,
          ).quote;
          if (Math.abs(rebuilt.amount - quote.amount) > 0.000001)
            throw new Error(
              "Synchronized aggregation does not match local pricing",
            );
          quote.source = "huawei-catalog";
          quote.quotedAt = scope.source.fetchedAt;
          state = localState(
            form,
            scope,
            payload.release,
            payload.token,
            payload.billingMode,
            state,
            pricing,
            quote,
            inquiries,
          );
          const active = new Set(inquiries.map((i) => JSON.stringify(i)));
          for (const key of captured.keys())
            if (!active.has(key)) captured.delete(key);
          return state;
        } catch (error) {
          return (state = localState(
            form,
            scope,
            payload.release,
            payload.token,
            payload.billingMode,
            state,
            undefined,
            null,
            [],
            error instanceof Error ? error.message : String(error),
          ));
        }
      }
    }
    // Some official defaults have no purchasable SKU. Keep their controls available for correction.
    if (
      Date.now() - started > 3000 &&
      Date.now() - stableSince > 500 &&
      (form.fields.length || form.availability) &&
      !pricing?.pending &&
      (!pricing?.result ||
        pricing.selectedProduct?.chargeMode !== payload.billingMode ||
        pricing.result.wrongTag ||
        priceError ||
        form.availability)
    ) {
      return (state = localState(
        form,
        scope,
        payload.release,
        payload.token,
        payload.billingMode,
        state,
        undefined,
        null,
        [],
        form.availability
          ? undefined
          : priceError ||
              "Choose available specifications to calculate a price",
      ));
    }
    previous = signature;
    epoch = pricing?.epoch ?? -1;
    emissionVersion = emissions.version;
    // Informational/unavailable defaults keep the conservative diagnostic deadline.
    if (!pricing?.result || pricing.epoch <= afterEpoch) await pause(16);
  }
  throw new Error(priceError || "The synchronized calculator did not settle");
}
async function change(field: NativeField, value: string | number | boolean) {
  validateNativeValue(field, value);
  if (field.value === value) return state!;
  const priorEpoch = win.__neoNativePricing?.epoch ?? -1;
  const control = document.querySelector<HTMLElement>(
    `[data-neo-control=${JSON.stringify(field.id)}]`,
  );
  if (!control) throw new Error("This control changed");
  if (field.type === "select") {
    if (control.matches(".base-radio-group")) {
      const option = document.querySelector<HTMLElement>(
        `[data-neo-option=${JSON.stringify(`${field.id}:${value}`)}]`,
      )!;
      (option.querySelector<HTMLElement>("button") ?? option).click();
    } else {
      control.querySelector<HTMLInputElement>("input")!.click();
      await pause();
      document
        .querySelector<HTMLElement>(
          `[data-neo-option=${JSON.stringify(`${field.id}:${value}`)}]`,
        )!
        .click();
    }
  } else if (field.type === "number") {
    const input = control as HTMLInputElement;
    input.focus();
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  } else if (field.type !== "checkbox" || field.value !== value)
    control.click();
  await settle(priorEpoch);
  state!.selection.steps.push({
    before: selectionField(field),
    value,
    ...(field.type === "select"
      ? {
          optionLabel: field.options?.find((o) => o.value === String(value))
            ?.label,
        }
      : {}),
  });
  return state!;
}
async function initialize() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !win.iframeSetValue) await pause(10);
  if (!win.iframeSetValue)
    throw new Error("Synchronized component rules did not initialize");
  const locationCode =
    payload.locationCode ??
    (scope.commonModes && !scope.commonModes.includes(payload.billingMode)
      ? Object.entries(scope.locationModes ?? {}).find(([, modes]) =>
          modes.includes(payload.billingMode),
        )?.[0]
      : undefined);
  const values = {
    global_REGIONINFO: {
      region: scope.region,
      chargeMode: payload.billingMode,
      locationType: "commonAZ",
      ...(locationCode ? { locationType: "homeZoneAZ", locationCode } : {}),
      tag: scope.tag ?? "general.online.portal",
    },
  };
  const locationLabel = locationCode
    ? JSON.parse(payload.menu).global?.[locationCode]
    : undefined;
  const locationMatches = () => {
    if (!locationCode) return true;
    const field = readFormInDocument().fields.find(
      (field) => field.component === "global_LOCATIONCODE",
    );
    return win.__neoNativePricing?.selectedProduct?.locationCode === locationCode &&
      !!locationLabel && field?.options?.some(
        (option) => option.value === field.value && option.label === locationLabel,
      );
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const priorEpoch = win.__neoNativePricing?.epoch ?? -1;
    const alreadySelected = locationMatches() &&
      win.__neoNativePricing?.selectedProduct?.region === scope.region &&
      win.__neoNativePricing?.selectedProduct?.chargeMode === payload.billingMode;
    win.iframeSetValue(values);
    const guide = document.querySelector<HTMLElement>(".guide-dialog button");
    guide?.click();
    const result = await settle(alreadySelected ? -1 : priorEpoch);
    if (locationMatches())
      return result;
    // Child controls can finish mounting after the first region assignment.
    // Reapply the requested zone after that render, then verify it explicitly.
    state = null;
  }
  throw new Error(`The synchronized calculator did not select availability zone ${locationCode}`);
}
let busy = false;
window.addEventListener("message", async (event) => {
  if (event.source !== parent || event.data?.token !== payload.token || busy)
    return;
  const { id, action } = event.data;
  busy = true;
  try {
    let result: NativeState;
    if (action === "open") result = await initialize();
    else if (action === "restore") {
      const saved = parseNativeSelection(event.data.selection);
      if (
        saved.service !== scope.service ||
        saved.region !== scope.region ||
        selectionBillingMode(saved) !== payload.billingMode
      )
        throw new Error("Invalid saved scope");
      result = await initialize();
      if (!sameSelection(result.selection.initial, saved.initial))
        throw new Error(
          "The synchronized defaults changed; review this saved configuration",
        );
      for (const step of saved.steps) {
        const field = state!.fields.find((f) => f.id === step.before.id);
        if (!field || !sameSelection(selectionField(field), step.before))
          throw new Error("A saved option changed");
        result = await change(field, step.value);
      }
      if (!sameSelection(result.selection.fields, saved.fields))
        throw new Error("Saved configuration no longer matches its options");
    } else if (action === "change") {
      if (!state || event.data.revision !== state.revision)
        throw new Error("The configuration changed");
      const field = state.fields.find((f) => f.id === event.data.field);
      if (!field) throw new Error("Unknown control");
      result = await change(field, event.data.value);
    } else if (action === "refresh") result = await settle();
    else throw new Error("Invalid local calculation action");
    parent.postMessage({ token: payload.token, id, result }, "*");
  } catch (error) {
    parent.postMessage(
      {
        token: payload.token,
        id,
        error:
          error instanceof Error ? error.message : "Local calculation failed",
      },
      "*",
    );
  } finally {
    busy = false;
  }
});
parent.postMessage({ token: payload.token, ready: true }, "*");
