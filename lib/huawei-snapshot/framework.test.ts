import { test, expect } from "bun:test";
import { frameworkAssetsHash, offlineFramework } from "./framework";
import type { SnapshotRelease } from "./types";
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

test("framework identity includes all imported scripts, styles and their URL resolution, independently of fetch order", () => {
  const assets: SnapshotRelease["assets"] = {
    "https://official/framework.js": { hash: "main", type: "application/javascript", imports: [] },
    "https://official/style.css": { hash: "style", type: "text/css", imports: [] },
    "https://official/component.js": { hash: "component", type: "application/javascript", imports: [] },
  };
  const hash = frameworkAssetsHash(assets);
  expect(frameworkAssetsHash(Object.fromEntries(Object.entries(assets).reverse()))).toBe(hash);
  for (const url of Object.keys(assets)) {
    expect(frameworkAssetsHash({ ...assets, [url]: { ...assets[url], hash: "changed" } })).not.toBe(hash);
    const renamed = { ...assets, [url + "?revision=2"]: assets[url] };
    delete renamed[url];
    expect(frameworkAssetsHash(renamed)).not.toBe(hash);
  }
  expect(frameworkAssetsHash({ ...assets, "https://official/new.js": { hash: "new", type: "application/javascript" } })).not.toBe(hash);
});
