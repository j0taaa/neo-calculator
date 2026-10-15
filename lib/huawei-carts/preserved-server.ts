import { createHmac, timingSafeEqual } from "node:crypto";
import type { ProductMutationBody } from "../calculator-types";
import { connectionKey } from "./secrets";
import { assertSavedHuaweiProduct } from "./preserved";
import { canonical } from "./value";

function signature(product: ProductMutationBody) {
  const config = product.config as Record<string, unknown>;
  return createHmac("sha256", connectionKey())
    .update(
      canonical([
        product.serviceCode,
        product.serviceName,
        product.productType,
        product.title,
        product.quantity,
        config.huaweiCartItem,
        config.importedAt,
        product.pricing,
      ]),
    )
    .digest("hex");
}
export function signSavedHuaweiProduct(product: ProductMutationBody) {
  return {
    ...product,
    config: { ...(product.config as object), signature: signature(product) },
  };
}
export function verifySavedHuaweiProduct(product: ProductMutationBody) {
  assertSavedHuaweiProduct(product);
  const expected = signature(product),
    actual = (product.config as { signature: string }).signature;
  if (
    !timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"))
  )
    throw new Error(
      "This preserved Huawei resource was changed. Import it again from Huawei Cloud.",
    );
  return product;
}
