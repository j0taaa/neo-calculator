import { test, expect } from "bun:test";
import { offlineFramework } from "./framework";
import { assetImports } from "./imports";
const source = `const baseURL = (window.location.origin, () => {
});
const baseURL$1 = (window.location.origin, () => {
});
const observe = (selectedProduct) => {
      if (!selectedProduct || selectedProduct.productAllInfos.length === 0) {
        return;
      }
};
class IdbStorage {
  static get(key) { return key; }
}
const getHandlePriceBoardAmountFn = () => 0;
const queryPrice = (selectedInfo, queryOptions) => {
  return Promise.resolve(selectedInfo);
};
const funcPriceboardSetup = () => 0;`;
test("observing an empty official selection preserves valid JavaScript when preceding the storage adapter", () => {
  const transformed = offlineFramework(source);
  expect(() =>
    assetImports(transformed, "https://example.com/framework.js"),
  ).not.toThrow();
  expect(transformed).toContain("window.__neoNativeEmptySelection");
  expect(transformed).toContain("const getHandlePriceBoardAmountFn = () => 0;");
});
test("changed adapter anchors and invalid synchronized assets fail before publication", () => {
  expect(() =>
    offlineFramework(
      source.replace(
        "selectedProduct.productAllInfos.length === 0",
        "selectedProduct.count === 0",
      ),
    ),
  ).toThrow("observer changed");
  expect(() =>
    assetImports("export const x = {", "https://example.com/asset.js"),
  ).toThrow("Invalid synchronized");
});
