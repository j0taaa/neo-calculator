import { expect, test } from "bun:test";
import { verifyNativeProduct } from "./native-product";
import { selectionFields, parseNativeSelection } from "./native-selection";
import type { NativeState } from "./native-types";
import type { ProductMutationBody } from "../calculator-types";

const fields: NativeState["fields"] = [
  {
    id: "global_QUANTITY:0",
    component: "global_QUANTITY",
    label: "Quantity",
    type: "number",
    value: 2,
    disabled: false,
  },
];
const selection = {
  version: 1 as const,
  service: "ecs",
  region: "ap-southeast-1",
  initial: selectionFields({ fields, notes: [], diagnostics: [] }),
  steps: [],
  fields: selectionFields({ fields, notes: [], diagnostics: [] }),
};
const state: NativeState = {
  session: "server-session",
  revision: 3,
  service: "ecs",
  region: selection.region,
  expiresAt: "2099-01-01",
  fields,
  notes: [],
  diagnostics: [],
  selection,
  source: {
    page: "page",
    config: "config",
    products: "products",
    framework: "framework",
    menu: "menu",
    fetchedAt: "2026-09-29",
  },
  inquiry: {
    regionId: selection.region,
    chargingMode: 1,
    periodType: 4,
    periodNum: 1,
    subscriptionNum: 2,
    siteCode: "HWC",
    productInfos: [],
  },
  quote: {
    amount: 42.125,
    currency: "USD",
    quotedAt: "2026-09-29",
    releaseId: "snapshot",
    requestHash: "verified",
    source: "huawei-inquiry",
    breakdown: [],
  },
};
function body(config: object = {}): ProductMutationBody {
  return {
    serviceCode: "HUAWEI:ecs",
    serviceName: "ECS",
    title: "Example",
    productType: "huawei-native",
    quantity: 999,
    pricing: { total: "USD 0" },
    config: { selection, ...config },
  };
}
function requester(result = state) {
  const calls: { action: string; session?: string; revision?: number }[] = [];
  return {
    calls,
    request: async <T>(input?: unknown): Promise<T> => {
      calls.push(input as (typeof calls)[number]);
      return result as T;
    },
  };
}
test("native saves replace forged prices and quantities with a fresh server quote and strip session IDs", async () => {
  const { calls, request } = requester();
  const product = await verifyNativeProduct(body({ session: "server-session", revision: 3 }), request);
  expect(calls).toEqual([{ action: "refresh", session: "server-session", revision: 3 }]);
  expect(product.quantity).toBe(2);
  expect(product.pricing).toMatchObject({ amount: 42.125, total: "USD 42.125000", source: "huawei-inquiry" });
  expect(product.config).not.toHaveProperty("session");
  expect(product.config).toHaveProperty("selection", selection);
});
test("durable configurations replay without a session and release their temporary renderer", async () => {
  const { calls, request } = requester();
  await verifyNativeProduct(body(), request);
  expect(calls.map((c) => c.action)).toEqual(["restore", "close"]);
});
test("native saves reject changed sessions, missing quotes, diagnostics and mismatched scopes", async () => {
  for (const change of [
    { quote: null },
    { diagnostics: ["unknown widget"] },
    { selection: { ...selection, region: "different" } },
  ]) {
    const { request } = requester({ ...state, ...change });
    await expect(verifyNativeProduct(body({ session: "server-session", revision: 3 }), request)).rejects.toThrow();
  }
  for (const config of [
    { region: "different" },
    { billingMode: "RI" },
    { selection: { ...selection, service: "elb" } },
  ]) {
    await expect(verifyNativeProduct(body(config), requester().request)).rejects.toThrow();
  }
  const { calls, request } = requester({ ...state, quote: null });
  await expect(verifyNativeProduct(body(), request)).rejects.toThrow();
  expect(calls.map((c) => c.action)).toEqual(["restore", "close"]);
});
test("saved selection rejects unknown versions and oversized action histories", () => {
  expect(() => parseNativeSelection({ ...selection, version: 2 })).toThrow();
  expect(() => parseNativeSelection({ ...selection, steps: Array(201).fill({}) })).toThrow();
});
