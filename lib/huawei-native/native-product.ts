import { verifySnapshotProduct } from "../huawei-snapshot/product";
export function isNativeProduct(product: {
  serviceCode?: string;
  productType?: string;
}) {
  return (
    product.serviceCode?.startsWith("HUAWEI:") ||
    product.productType === "huawei-native"
  );
}
export const verifyNativeProduct = verifySnapshotProduct;
