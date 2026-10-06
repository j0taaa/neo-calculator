import { expect, test } from "bun:test";
import { configureNativeFlavor } from "./native-flavor";
import type { NativeState, NativeField } from "./native-types";
import type { CatalogFlavor } from "@/lib/calculator-types";
const flavor: CatalogFlavor = { resourceSpecCode: "c9.large.2", family: "c9", architecture: "x86", series: "C9", description: null, cpu: 2, ramGiB: 4, prices: {}, currency: "USD", updatedAt: "" };
const field = (label: string, options: string[], value = "0"): NativeField => ({ id: label, component: label, label, type: "select", value, disabled: false,
  options: options.map((label, i) => ({ label, value: String(i), disabled: false })) });
function state(): NativeState { return { fields: [field("CPU Architecture", ["x86", "Kunpeng"]), field("Type", ["General", "Plus"]),
  field("Generation", ["S9"]), field("vCPUs", ["1 vCPU", "2 vCPUs"]), field("Memory", ["2GiB", "4GiB"])],
  inquiries: [{ productInfos: [{ resourceSpecCode: flavor.resourceSpecCode }] }], diagnostics: [] } as NativeState; }
test("flavor selection walks official options and verifies the exact SKU", async () => {
  const applied: string[] = [];
  const result = await configureNativeFlavor(state(), flavor, async (state, target, value) => {
    applied.push(`${target.label}:${value}`);
    return { ...state, fields: state.fields.map(f => f.id === target.id ? { ...f, value } : target.label === "Type" && f.label === "Generation" ? field("Generation", ["C9"]) : f) };
  });
  expect(applied).toEqual(["Type:1", "vCPUs:1", "Memory:1"]);
  expect(result.fields.find(f => f.label === "Memory")?.value).toBe("1");
});
test("missing generation and incorrect final SKU cannot silently choose an approximation", async () => {
  await expect(configureNativeFlavor(state(), { ...flavor, series: "unknown" }, async state => state)).rejects.toThrow("generation");
  const wrong = state(); wrong.fields[2] = field("Generation", ["C9"]); wrong.inquiries[0].productInfos[0].resourceSpecCode = "c9.large.4";
  await expect(configureNativeFlavor(wrong, flavor, async (state, f, value) => ({ ...state, fields: state.fields.map(item => item.id === f.id ? { ...item, value } : item) }))).rejects.toThrow("different compute SKU");
});
