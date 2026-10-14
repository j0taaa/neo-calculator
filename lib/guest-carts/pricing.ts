import type { ProductMutationBody } from "../calculator-types";
import { closeLocalSession, localRequest } from "../huawei-snapshot/client";
import { independentProductBody } from "../huawei-snapshot/product-body";
import { parseNativeSelection } from "../huawei-native/native-selection";
import { selectionBillingMode } from "../huawei-native/native-selection";
import { nativeBillingModes } from "../huawei-native/native-billing";

/** Reconstruct prices locally; persisted or clipboard money is never authoritative. */
export async function priceGuestProduct(product: ProductMutationBody) {
  if (!product.title.trim() || product.title.length > 300) throw new Error("Resource titles must contain 1–300 characters.");
  const selection = parseNativeSelection((product.config as { selection?: unknown } | null)?.selection);
  const config = product.config as { region?: unknown; billingMode?: unknown };
  if (product.serviceCode !== `HUAWEI:${selection.service}` || config.region !== selection.region || config.billingMode !== nativeBillingModes[selectionBillingMode(selection)].label)
    throw new Error("The saved resource scope does not match its calculator configuration.");
  const state = await localRequest({ action: "restore", selection });
  try {
    if (!state.local || !state.quote || !state.source || state.diagnostics.length) throw new Error(state.priceError ?? "This configuration cannot be priced");
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ release: state.local.release, inquiries: state.local.inquiries, amount: state.quote.amount })));
    const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
    return independentProductBody(product, state, state.source, hash);
  } finally { closeLocalSession(state.session); }
}
