import type { ProductMutationBody } from "@/lib/calculator-types";
import type { NativeState } from "./native-types";
import { nativeBillingModes } from "./native-billing";
export function nativeDraft(state: NativeState, name: string, title = name, durable = false): ProductMutationBody {
  if (!state.quote || state.diagnostics.length) throw new Error("Wait for a complete Huawei price before saving this configuration.");
  return {
    serviceCode: `HUAWEI:${state.service}`, serviceName: name, productType: "huawei-native", title,
    quantity: 1, pricing: null,
    config: { runtime: "huawei-native", region: state.region, billingMode: nativeBillingModes[state.billingMode].label,
      selection: state.selection, ...(state.local ? {local:state.local} : {}), ...(durable ? {} : { session: state.session, revision: state.revision }) },
  };
}
