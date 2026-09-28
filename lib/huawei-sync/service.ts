import { evaluateForm } from "./engine";
import { ENGINE_VERSION } from "./program";
import { QuoteGateway } from "./quotes";
import { canonical, SyncStore } from "./store";
import type { FormInput, ServiceRelease } from "./types";

let sharedStore: SyncStore | undefined;
const gateway = new QuoteGateway();
export function getSyncStore() { return sharedStore ??= new SyncStore(); }

export function currentRelease(service: string, region: string, expectedId?: string, store = getSyncStore()): ServiceRelease {
  const release = store.active(service, region);
  if (!store.directory().find(item => item.id === service)?.available) throw new Error("Service is not currently offered by Huawei");
  if (!release || release.status !== "active" || release.engineVersion !== ENGINE_VERSION) throw new Error("This service and region have not passed synchronization checks");
  const latest = store.listReleases().find(item => item.service.id === service && item.region === region);
  if (latest && latest.id !== release.id) throw new Error("An upstream change is awaiting verification; current quotes are temporarily unavailable");
  if (expectedId && release.id !== expectedId) throw new Error("Calculator updated. Reload the form before requesting a price.");
  if (!release.verification || Date.now() - Date.parse(release.verification.checkedAt) > 24 * 60 * 60_000) throw new Error("Calculator verification has expired; waiting for a successful synchronization");
  return release;
}

export function parseFormInput(body: unknown): FormInput {
  if (!body || typeof body !== "object") throw new Error("Invalid form input");
  const data = body as Record<string, unknown>;
  if (typeof data.region !== "string" || !/^[a-z0-9-]{1,80}$/.test(data.region)) throw new Error("Invalid region");
  if (!data.values || typeof data.values !== "object" || Array.isArray(data.values)) throw new Error("Invalid field values");
  if (Object.keys(data.values).length > 250) throw new Error("Too many field values");
  for (const [key, value] of Object.entries(data.values)) {
    if (key.length > 200 || !["string", "number", "boolean"].includes(typeof value) || String(value).length > 500) throw new Error("Invalid field value");
  }
  for (const key of ["duration", "quantity"]) if (data[key] != null && (typeof data[key] !== "number" || !Number.isFinite(data[key]))) throw new Error(`Invalid ${key}`);
  return { region: data.region, values: data.values as FormInput["values"], duration: data.duration as number | undefined, quantity: data.quantity as number | undefined };
}

export async function syncedForm(service: string, input: FormInput, expectedId?: string, store = getSyncStore()) {
  const release = currentRelease(service, input.region, expectedId, store);
  const form = await evaluateForm(store.body(release.configHash), JSON.parse(store.body(release.productsHash)), input, JSON.parse(store.body(release.menuHash)).languagePack);
  if (form.diagnostics.length || !form.inquiry) throw new Error(form.diagnostics.join("; ") || "Configuration unavailable");
  return { release, form };
}

export async function syncedQuote(service: string, input: FormInput, expectedId: string, fresh = false, store = getSyncStore()) {
  const { release, form } = await syncedForm(service, input, expectedId, store);
  if (canonical(input.values) !== canonical(form.values)) throw new Error("Selections changed. Refresh the form before requesting a price.");
  if (input.quantity != null && input.quantity !== 1) throw new Error("Only independently verified quantities are available");
  const quote = await gateway.quote(release.id, form.inquiry!, fresh);
  // Do not return a quote as current after a concurrent release change or retirement.
  currentRelease(service, input.region, release.id, store);
  const suffix = `${form.duration.value} ${form.duration.measureId === 0 ? "day(s)" : "hour(s)"}`;
  const hours = form.duration.value * (form.duration.measureId === 0 ? 24 : 1);
  return { release, form, quote, product: {
    serviceCode: `HWC:${service}`, serviceName: release.service.name, productType: "huawei-synchronized",
    title: form.fields.map(field => field.options?.find(option => option.value === field.value)?.label ?? String(field.value)).join(" | "),
    quantity: 1,
    config: { region: input.region, billingMode: "Pay-per-use", huaweiSync: { service, releaseId: release.id, input: { ...input, values: form.values, duration: form.duration.value } } },
    pricing: { ...quote, suffix: `/${hours}h`, total: `USD ${quote.amount.toFixed(2)} / ${suffix}`, estimateAmount: quote.amount, estimate: { amount: quote.amount, currency: quote.currency, suffix: `/${hours}h` } },
  } };
}
