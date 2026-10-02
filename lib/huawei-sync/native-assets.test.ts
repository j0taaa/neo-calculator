import { expect, test } from "bun:test";
import { NativeAssets } from "./native-assets";
import { instrumentNativePricing } from "./native-pricing";

const framework = (value: number) => `const queryPrice = (selectedInfo, queryOptions) => { return Promise.resolve(${value}); };\nconst funcPriceboardSetup = () => {};`;

test("one instrumented framework is reused by content hash and replaced when its source changes", () => {
  const assets = new NativeAssets(); let reads = 0;
  const first = {hash: "a", get body() { reads++; return framework(1); }};
  const pinned = assets.framework(first);
  expect(assets.framework(first)).toBe(pinned); expect(reads).toBe(1);
  expect(assets.framework({hash: "b", body: framework(2)})).toBe(instrumentNativePricing(framework(2)));
  expect(pinned).toBe(instrumentNativePricing(framework(1)));
  assets.clear(); assets.framework(first); expect(reads).toBe(2);
});

test("an unsupported framework update fails explicitly without returning previously cached code", () => {
  const assets = new NativeAssets(); assets.framework({hash: "a", body: framework(1)});
  for (let i=0;i<2;i++) expect(() => assets.framework({hash: "broken", body: "changed implementation"})).toThrow("pricing renderer changed");
  expect(assets.framework({hash: "c", body: framework(3)})).toBe(instrumentNativePricing(framework(3)));
});

test("common page/menu bodies are independent and older session strings remain pinned", () => {
  const assets = new NativeAssets();
  const source = {hash: "one", body: "old page"};
  const pinned = assets.body("page", source);
  source.body = "mutated caller snapshot";
  expect(assets.body("page", source)).toBe(pinned);
  expect(assets.body("menu", {hash: "one", body: "menu"})).toBe("menu");
  expect(assets.body("page", {hash: "two", body: "new page"})).toBe("new page");
  expect(pinned).toBe("old page"); assets.clear();
  expect(assets.body("page", {hash: "three", body: "latest page"})).toBe("latest page");
});
