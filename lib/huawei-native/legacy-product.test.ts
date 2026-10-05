import { expect, test } from "bun:test";
import { isHuaweiCalculatorProduct, isLegacyHuaweiProduct, legacyHuaweiConfiguration, synchronizedRedirect } from "./legacy-product";

test("old and current Huawei estimates use the live editor without capturing unrelated services", () => {
  expect(isHuaweiCalculatorProduct({ serviceCode: "HWC:nat" })).toBe(true);
  expect(isHuaweiCalculatorProduct({ productType: "huawei-synchronized" })).toBe(true);
  expect(isHuaweiCalculatorProduct({ serviceCode: "HUAWEI:ecs" })).toBe(true);
  expect(isHuaweiCalculatorProduct({ productType: "huawei-native" })).toBe(true);
  expect(isHuaweiCalculatorProduct({ serviceCode: "ECS", productType: "ecs" })).toBe(false);
  expect(isLegacyHuaweiProduct({ serviceCode: "HUAWEI:nat" })).toBe(false);
});

test("old links preserve the item identifier while ignoring untrusted destination parameters", () => {
  expect(synchronizedRedirect({})).toBe("/?tab=huawei-live");
  expect(synchronizedRedirect({ edit: "a&list=b", service: "//evil.test", next: "//evil.test" }))
    .toBe("/?tab=huawei-live&editProduct=a%26list%3Db");
  expect(synchronizedRedirect({ edit: ["a", "b"] })).toBe("/?tab=huawei-live");
});

test("recovery exposes the saved scope and values without converting identifiers or mutating data", () => {
  const config = { region: "ap-southeast-1", huaweiSync: { input: {
    region: "sa-brazil-1", duration: 3, values: { "calculator_spec.size": "old-product-key" },
  } } };
  const before = JSON.stringify(config);
  expect(legacyHuaweiConfiguration({ serviceCode: "HWC:nat", config })).toEqual({
    service: "nat", region: "sa-brazil-1", duration: 3, values: config.huaweiSync.input.values,
  });
  expect(JSON.stringify(config)).toBe(before);
  for (const bad of [null, {}, { region: "//evil.test" }])
    expect(() => legacyHuaweiConfiguration({ serviceCode: "HWC:nat", config: bad })).toThrow("preserved");
});
