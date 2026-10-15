import { afterEach, expect, test } from "bun:test";
import { connectionKey, seal, unseal } from "./secrets";

const original = process.env.HUAWEI_CARTS_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.HUAWEI_CARTS_SECRET;
  else process.env.HUAWEI_CARTS_SECRET = original;
});

test("a separate Huawei key overrides the Neo auth key and rejects ciphertext from another deployment", () => {
  delete process.env.HUAWEI_CARTS_SECRET;
  const fallback = connectionKey();
  process.env.HUAWEI_CARTS_SECRET = "test-huawei-key-first-deployment";
  expect(connectionKey()).not.toEqual(fallback);
  const encrypted = seal("private portal cookie");
  expect(encrypted).not.toContain("private portal cookie");
  expect(unseal(encrypted)).toBe("private portal cookie");
  expect(seal("private portal cookie")).not.toBe(encrypted);
  process.env.HUAWEI_CARTS_SECRET = "test-huawei-key-other-deployment";
  expect(() => unseal(encrypted)).toThrow();
});
