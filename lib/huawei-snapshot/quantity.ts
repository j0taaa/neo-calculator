import type { NativeSelection } from "../huawei-native/native-selection";
import type { NativePricing } from "../huawei-native/native-pricing";

/** Huawei scales component counts with purchaseNum, not subscriptionNum. */
export function quotationQuantity(selection: NativeSelection, pricing: NativePricing, checkComponentScaling = true) {
  const fields = selection.fields.filter(field => field.component === "global_QUANTITY");
  if (fields.length && !(typeof fields[0].value === "number" ||
    typeof fields[0].value === "string" && /^\d+$/.test(fields[0].value)))
    throw new Error("Invalid quotation quantity");
  const quantity = Number(fields[0]?.value ?? 1);
  if (fields.length > 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999)
    throw new Error("Invalid quotation quantity");
  const selected = pricing.selectedProduct;
  if (fields.length || selected.purchaseNum !== undefined) {
    if (selected.purchaseNum !== undefined && Number(selected.purchaseNum.measureValue) !== quantity)
      throw new Error("Selected quantity does not match its calculation");
    const counted = selected.productAllInfos.filter(product => product.inquiryTag !== false && product.selfProductNum !== undefined);
    // Fixed/disabled quantity controls (e.g. DSC) have no purchase/scaling metadata.
    // They represent one configuration; they must never permit a fabricated multiple.
    if (fields.length && quantity > 1 && (selected.purchaseNum === undefined || !counted.length))
      throw new Error("Missing priced quantity components");
    for (const product of checkComponentScaling ? counted : []) {
      const perUnit = Number(product.selfProductNum);
      if (!Number.isFinite(perUnit) || perUnit < 0 || !Number.isFinite(Number(product.productNum)) ||
        Math.abs(product.productNum - quantity * perUnit) > 1e-9)
        throw new Error("Selected quantity does not match its priced components");
    }
  }
  return quantity;
}
