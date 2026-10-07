import { selectionFields } from "../huawei-native/native-selection";
import type { NativeForm, NativeState } from "../huawei-native/native-types";
import type { NativePricing } from "../huawei-native/native-pricing";
import type { Inquiry, Quote } from "../huawei-native/types";
import type { ScopeSnapshot } from "./types";
export function localState(
  form: NativeForm,
  scope: ScopeSnapshot,
  release: string,
  token: string,
  billingMode: NativeState["billingMode"],
  previous: NativeState | null,
  pricing?: NativePricing,
  quote: Quote | null = null,
  inquiries: Inquiry[] = [],
  error?: string,
): NativeState {
  return {
    ...form,
    selection: {
      version: 2,
      service: scope.service,
      region: scope.region,
      billingMode,
      initial: previous?.selection.initial ?? selectionFields(form),
      steps: previous?.selection.steps ?? [],
      fields: selectionFields(form),
    },
    service: scope.service,
    region: scope.region,
    billingMode,
    session: token,
    revision: (previous?.revision ?? -1) + 1,
    expiresAt: "",
    source: scope.source,
    inquiry: inquiries[0] ?? null,
    inquiries,
    quote: form.diagnostics.length ? null : quote,
    priceError: form.diagnostics.length ? form.diagnostics.join("; ") : error,
    ...(pricing && quote ? { local: { release, pricing, inquiries } } : {}),
  };
}
