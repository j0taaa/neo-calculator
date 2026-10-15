import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { compileSupportPricing } from "./compile-pricing";
import { supportPrice } from "./custom-pricing";
import type { ScopeSnapshot } from "./types";
const config = readFileSync(
  "tests/fixtures/calculator/supportplans.txt",
  "utf8",
);
const program = compileSupportPricing(config)!;
const resource = (name: string, usageValue: number) => ({
  resourceSpecCode: `supportplan.${name}`,
  cloudServiceType: "support",
  resourceType: "support",
  productNum: 1,
  usageValue,
  supportAmount: -99999,
});
const snapshot = {
  customPricing: { support: program },
  products: {
    product: {
      rows: ["developer", "business", "enterprise.On-Ramp", "enterprise"].map(
        (name) => resource(name, 0),
      ),
    },
  },
} as unknown as ScopeSnapshot;
test("official Support Plans tiers, floors and subscription duration calculate from synchronized rules", () => {
  for (const [name, usage, expected] of [
    ["developer", 1000000, 26],
    ["business", 0, 90],
    ["business", 9000, 900],
    ["business", 72000, 5310],
    ["business", 225000, 12960],
    ["business", 1000000, 36210],
    ["enterprise.On-Ramp", 0, 5000],
    ["enterprise.On-Ramp", 1000000, 100000],
    ["enterprise", 0, 13500],
    ["enterprise", 135000, 13500],
    ["enterprise", 450000, 35550],
    ["enterprise", 900000, 58050],
    ["enterprise", 1000000, 61050],
  ] as [string, number, number][]) {
    expect(supportPrice(snapshot, resource(name, usage), 1)).toBe(expected);
    expect(supportPrice(snapshot, resource(name, usage), 36)).toBe(
      expected * 36,
    );
  }
});
test("a changed official coefficient updates the local rule without executable source evaluation", () => {
  const updated = {
    ...snapshot,
    customPricing: {
      support: compileSupportPricing(
        config.replace("input = 26;", "input = 30;"),
      )!,
    },
  };
  expect(supportPrice(updated, resource("developer", 0), 12)).toBe(360);
});
test("unsupported source operations and client resource tampering fail closed", () => {
  expect(() =>
    compileSupportPricing(
      config.replace("input = 26;", "input = fetch('/price');"),
    ),
  ).toThrow("unsupported syntax");
  expect(() =>
    compileSupportPricing(
      config.replace(
        "data.supportAmount = input;",
        "while (true) {} data.supportAmount = input;",
      ),
    ),
  ).toThrow("unsupported syntax");
  expect(() => supportPrice(snapshot, resource("fake", 0), 1)).toThrow();
  expect(() => supportPrice(snapshot, resource("business", -1), 1)).toThrow();
  expect(() =>
    supportPrice(snapshot, { ...resource("business", 0), productNum: 3 }, 1),
  ).toThrow();
  expect(() =>
    supportPrice(
      snapshot,
      { ...resource("business", 0), resourceType: "fake" },
      1,
    ),
  ).toThrow();
});
