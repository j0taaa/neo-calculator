import type { NativeState } from "../huawei-native/native-types";
import type { Inquiry } from "../huawei-native/types";
import { CalculatorEngine } from "./engine";

function inquiries(values: Inquiry[]) {
  return values.map(inquiry => ({ ...inquiry, productInfos: inquiry.productInfos.map(({ id, ...product }) => { void id; return product; }).sort((a, b) => canonical(a).localeCompare(canonical(b))) })).sort((a, b) => canonical(a).localeCompare(canonical(b)));
}
function canonical(value: unknown): string {
  const ordered = (v: unknown): unknown => Array.isArray(v) ? v.map(ordered) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordered(v)])) : v;
  return JSON.stringify(ordered(value));
}
/** Price equality alone cannot prove correctness: the chosen dimensions must also be identical. */
export function assertIndependentState(reference: NativeState, actual: NativeState) {
  assertIndependentControls(reference, actual);
  if (Boolean(reference.quote) !== Boolean(actual.quote) || reference.quote && (!actual.quote || Math.abs(reference.quote.amount - actual.quote.amount) > 0.0000001 || reference.quote.currency !== actual.quote.currency || canonical(reference.quote.payment) !== canonical(actual.quote.payment)))
    throw new Error(`Independent price mismatch: ${reference.service}/${reference.region}/${reference.billingMode}: reference=${reference.quote?.amount}, Neo=${actual.quote?.amount}: ${actual.priceError ?? ""}`);
  if (canonical(inquiries(reference.inquiries)) !== canonical(inquiries(actual.inquiries)))
    throw new Error(`Independent resource dimensions differ: ${reference.service}/${reference.region}/${reference.billingMode}`);
}
export function verifyIndependentConfiguration(reference: NativeState, engine: CalculatorEngine) {
  const actual = engine.restore(reference.selection);
  assertIndependentState(reference, actual);
  return actual;
}

/** Compare selectable values and limits, allowing native presentation of billing terms. */
export function assertIndependentControls(reference: NativeState, actual: NativeState) {
  const label = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  for (const expected of reference.fields) {
    const candidates = actual.fields.filter(f => f.component === expected.component && f.type === expected.type);
    const field = candidates.find(f => f.id === expected.id && label(f.label) === label(expected.label)) ?? candidates.find(f => f.id === expected.id) ?? candidates.find(f => label(f.label) === label(expected.label));
    if (!field) throw new Error(`Independent control missing: ${reference.service}/${reference.region}/${reference.billingMode}/${expected.component}/${expected.label}`);
    const option = (text: string) => {
      if (expected.component === "global_PERIODTIME" && /^\d+$/.test(text.trim())) text += " months";
      return label(text).replace(/(months|years|days|hours|minutes|seconds)$/, unit => unit.slice(0, -1));
    };
    const options = (values: typeof field.options) => values?.map(o => [option(o.label), o.disabled]);
    if (canonical(options(expected.options)) !== canonical(options(field.options)) || expected.min !== field.min || expected.max !== field.max || expected.disabled !== field.disabled)
      throw new Error(`Independent options or limits differ: ${reference.service}/${reference.region}/${reference.billingMode}/${expected.component}/${expected.label}`);
  }
}
