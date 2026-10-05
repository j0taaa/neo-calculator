import type { ProductMutationBody } from "@/lib/calculator-types";
import type { NativeState } from "./native-types";
import { parseNativeSelection, sameSelection, selectionBillingMode } from "./native-selection";
import { nativeBillingModes } from "./native-billing";
import { nativeRequest } from "./native-client";

export function isNativeProduct(product: { serviceCode?: string; productType?: string }) {
  return product.serviceCode?.startsWith("HUAWEI:") || product.productType === "huawei-native";
}

/** Only the private renderer supplies the inquiry and the fresh quote used for persistence. */
export async function verifyNativeProduct(
  product: ProductMutationBody,
  request = nativeRequest,
): Promise<ProductMutationBody> {
  const config = product.config as {
    selection?: unknown;
    session?: string;
    revision?: number;
    region?: string;
    billingMode?: string;
  };
  const selection = parseNativeSelection(config?.selection);
  const billingMode = selectionBillingMode(selection);
  if (
    product.serviceCode !== `HUAWEI:${selection.service}` ||
    (config.region && config.region !== selection.region) ||
    (config.billingMode && config.billingMode !== nativeBillingModes[billingMode].label)
  )
    throw new Error("Saved Huawei service, region or billing mode does not match its configuration");
  let state: NativeState | undefined;
  let temporary = false;
  try {
    if (config.session && Number.isSafeInteger(config.revision)) {
      state = await request<NativeState>({ action: "refresh", session: config.session, revision: config.revision });
      if (!sameSelection(state.selection, selection))
        throw new Error("The saved selection does not match the current Huawei session");
    } else {
      temporary = true;
      state = await request<NativeState>({ action: "restore", selection });
    }
    if (!state.quote || (!state.inquiry && state.quote.aggregation !== "huawei-renderer") || state.diagnostics.length ||
        state.billingMode !== billingMode || state.region !== selection.region || state.service !== selection.service)
      throw new Error(state.priceError || "A complete Huawei quote is required");
    const quantity = Number(state.fields.find((field) => field.component === "global_QUANTITY")?.value ?? 1);
    return {
      ...product,
      productType: "huawei-native",
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      config: {
        runtime: "huawei-native",
        region: state.region,
        billingMode: nativeBillingModes[billingMode].label,
        selection: state.selection,
        source: state.source,
      },
      pricing: {
        total: `${state.quote.currency} ${state.quote.amount.toFixed(6)}`,
        amount: state.quote.amount,
        currency: state.quote.currency,
        source: state.quote.source,
        quotedAt: state.quote.quotedAt,
        requestHash: state.quote.requestHash,
        breakdown: state.quote.breakdown,
        ...(state.quote.payment ? {payment: state.quote.payment} : {}),
      },
    };
  } finally {
    if (temporary && state) await request({ action: "close", session: state.session }).catch(() => {});
  }
}
