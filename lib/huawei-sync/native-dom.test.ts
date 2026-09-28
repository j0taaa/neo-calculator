import { describe, expect, it } from "bun:test";
import { validateNativeValue } from "./native-dom";
import type { NativeField } from "./native-types";
const numeric: NativeField = { id: "duration", component: "duration", type: "number", label: "Duration", value: 1, disabled: false, min: 1, max: 9999 };
describe("native action contract", () => {
  it("rejects non-finite, coerced, and out-of-range numeric values", () => {
    for (const value of [NaN, Infinity, -1, 10000, "2", null, undefined, {}]) expect(() => validateNativeValue(numeric, value)).toThrow();
    expect(() => validateNativeValue(numeric, 1)).not.toThrow();
    expect(() => validateNativeValue(numeric, 9999)).not.toThrow();
  });
  it("accepts only an enabled option from the current form", () => {
    const select: NativeField = { ...numeric, type: "select", options: [{ value: "0", label: "Allowed", disabled: false }, { value: "1", label: "Disabled", disabled: true }] };
    for (const value of [0, "1", "2", "body", "0\"]"]) expect(() => validateNativeValue(select, value)).toThrow();
    expect(() => validateNativeValue(select, "0")).not.toThrow();
  });
  it("rejects writes to derived or disabled controls", () => {
    expect(() => validateNativeValue({ ...numeric, disabled: true }, 1)).toThrow(/disabled/);
  });
  it("does not coerce checkbox and action values", () => {
    for (const type of ["checkbox", "action"] as const) {
      for (const value of ["false", "true", 0, 1, null]) expect(() => validateNativeValue({ ...numeric, type }, value)).toThrow();
      expect(() => validateNativeValue({ ...numeric, type }, true)).not.toThrow();
    }
  });
});
