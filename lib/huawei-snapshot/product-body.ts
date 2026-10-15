import type { ProductMutationBody } from "../calculator-types";
import type { NativeState } from "../huawei-native/native-types";
import { nativeBillingModes } from "../huawei-native/native-billing";
import { quotationQuantity } from "./quantity";
import type { ScopeSnapshot } from "./types";

/** Shared browser/server output from a state evaluated by Neo's independent engine. */
export function independentProductBody(product: ProductMutationBody, state: NativeState, source: ScopeSnapshot["source"], requestHash: string): ProductMutationBody {
  if (!state.quote || !state.local || state.diagnostics.length) throw new Error(state.priceError ?? "The selected options cannot be priced");
  const quote = state.quote;
  return {
    ...product, productType: "huawei-native", quantity: quotationQuantity(state.selection, state.local.pricing, false),
    config: { runtime: "huawei-native", region: state.selection.region, billingMode: nativeBillingModes[state.billingMode].label, selection: state.selection, source, local: state.local },
    pricing: { total: `${quote.currency} ${quote.amount.toFixed(6)}`, amount: quote.amount, currency: quote.currency, source: "huawei-catalog", quotedAt: source.fetchedAt, requestHash, breakdown: quote.breakdown, ...(quote.payment ? { payment: quote.payment } : {}) },
  };
}
