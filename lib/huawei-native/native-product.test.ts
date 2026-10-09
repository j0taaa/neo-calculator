import { expect, test } from "bun:test";
import { isNativeProduct, verifyNativeProduct } from "./native-product";
import { verifySnapshotProduct } from "../huawei-snapshot/product";

test("all native quotation entry points use the independent verifier", () => {
  expect(verifyNativeProduct).toBe(verifySnapshotProduct);
  expect(isNativeProduct({ serviceCode: "HUAWEI:ecs" })).toBe(true);
  expect(isNativeProduct({ productType: "huawei-native" })).toBe(true);
  expect(isNativeProduct({ serviceCode: "ECS" })).toBe(false);
});
