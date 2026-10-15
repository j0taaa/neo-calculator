import type { ProductMutationBody } from "../calculator-types";
import { isRecord } from "../product-input";
export const isSavedHuaweiProduct = (product: { productType?: string }) =>
  product.productType === "huawei-saved";
export function assertSavedHuaweiProduct(product: ProductMutationBody) {
  const config = product.config;
  if (
    !isSavedHuaweiProduct(product) ||
    !isRecord(config) ||
    !isRecord(config.huaweiCartItem) ||
    !isRecord(config.huaweiCartItem.selectedProduct) ||
    typeof config.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(config.signature) ||
    !isRecord(product.pricing) ||
    product.pricing.source !== "huawei-saved" ||
    typeof product.pricing.amount !== "number" ||
    !Number.isFinite(product.pricing.amount) ||
    product.pricing.amount < 0 ||
    typeof product.pricing.currency !== "string"
  )
    throw new Error("Invalid preserved Huawei resource.");
  return product;
}
