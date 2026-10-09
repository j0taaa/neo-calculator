import type { ProductMutationBody } from "../calculator-types";
import type { NativeState } from "../huawei-native/native-types";
import { parseNativeSelection, selectionBillingMode } from "../huawei-native/native-selection";
import { nativeBillingModes } from "../huawei-native/native-billing";
import { CalculatorEngine } from "../calculator-rules/engine";
import { SnapshotStore, digest } from "./store";
import { quotationQuantity } from "./quantity";
import type { SnapshotRelease } from "./types";

/** Replay the choices using Neo's engine. Client-selected resources and totals are never authoritative. */
export async function verifySnapshotProduct(product: ProductMutationBody, store = new SnapshotStore(), currentRates = false, currentRelease?: SnapshotRelease): Promise<ProductMutationBody> {
  const config = product.config as { selection?: unknown; local?: NativeState["local"]; region?: string; billingMode?: string; runtime?: string; source?: NativeState["source"] };
  const selection = parseNativeSelection(config?.selection), mode = selectionBillingMode(selection), local = config?.local;
  const legacy = !local && config.runtime === "huawei-native" && ["page", "config", "products", "framework", "menu"].every(key => /^[a-f0-9]{64}$/.test(String(config.source?.[key as keyof NativeState["source"]] ?? "")));
  if (!legacy && (!local || !Array.isArray(local.inquiries) || local.inquiries.length > 100 || !Array.isArray(local.pricing?.selectedProduct?.productAllInfos) || local.pricing.selectedProduct.productAllInfos.length > 100))
    throw new Error("Open this configuration once to calculate it using the synchronized catalog");
  if (product.serviceCode !== `HUAWEI:${selection.service}` || config.region !== selection.region || config.billingMode !== nativeBillingModes[mode].label || local && local.pricing.selectedProduct.chargeMode !== mode)
    throw new Error("Quotation scope does not match its configuration");
  // Also reject inconsistent client quantity proofs rather than silently accepting a changed quotation.
  if (local) quotationQuantity(selection, local.pricing, false);
  const pinned = local ? await store.release(local.release) : undefined;
  const release = currentRates || !pinned?.engine ? currentRelease ?? await store.active() : pinned;
  if (!release.engine) throw new Error("The independently validated calculator snapshot is not available");
  const scope = await store.scope(release, selection.service, selection.region, false);
  if (!scope.rules || !scope.rulesChecks) throw new Error("Missing independently verified calculator rules");
  const state = new CalculatorEngine(scope.rules, scope, JSON.parse(release.menu), release.id, mode).restore(selection);
  if (!state.quote || !state.local) throw new Error(state.priceError ?? "The selected options cannot be priced");
  // Compiled service rules can multiply or replace counts (duration, cluster
  // nodes, IOPS). Compare with the authoritative reconstruction, rather than
  // assuming every service scales as purchaseNum * selfProductNum.
  const counts = (pricing: NonNullable<NativeState["local"]>["pricing"]) => pricing.selectedProduct.productAllInfos.map(p => p.productNum ?? null).sort((a, b) => Number(a) - Number(b));
  if (local && JSON.stringify(counts(local.pricing)) !== JSON.stringify(counts(state.local.pricing))) throw new Error("Selected quantity does not match its priced components");
  const quote = state.quote, proof = state.local;
  quote.source = "huawei-catalog"; quote.quotedAt = scope.source.fetchedAt;
  quote.requestHash = digest(JSON.stringify({ release: release.id, inquiries: proof.inquiries, amount: quote.amount }));
  return {
    ...product, productType: "huawei-native", quantity: quotationQuantity(state.selection, proof.pricing, false),
    config: { runtime: "huawei-native", region: selection.region, billingMode: nativeBillingModes[mode].label, selection: state.selection, source: scope.source, local: proof },
    pricing: { total: `${quote.currency} ${quote.amount.toFixed(6)}`, amount: quote.amount, currency: quote.currency, source: quote.source, quotedAt: quote.quotedAt, requestHash: quote.requestHash, breakdown: quote.breakdown, ...(quote.payment ? { payment: quote.payment } : {}) },
  };
}
