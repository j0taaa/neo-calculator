import type { CatalogFlavor } from "@/lib/calculator-types";
import type { NativeField, NativeState } from "./native-types";
type Apply = (state: NativeState, field: NativeField, value: string) => Promise<NativeState>;
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Select actual Huawei options, then verify the exact compute SKU. No catalog price is saved. */
export async function configureNativeFlavor(initial: NativeState, flavor: CatalogFlavor, apply: Apply) {
  let state = initial;
  const find = (label: string) => state.fields.find(field => field.type === "select" && field.label === label && !field.disabled);
  async function select(label: string, match: (label: string) => boolean) {
    const field = find(label);
    const option = field?.options?.find(option => !option.disabled && match(option.label));
    if (!field || !option) throw new Error(`Huawei does not offer this flavor's ${label} in the selected region and billing mode.`);
    if (String(field.value) !== option.value) state = await apply(state, field, option.value);
  }
  const family = flavor.series ?? flavor.resourceSpecCode.split(".")[0];
  if (!family || !flavor.cpu || !flavor.ramGiB) throw new Error("Incomplete flavor specification");
  const architecture = /kunpeng|arm/i.test(flavor.architecture ?? "") ? "kunpeng" : "x86";
  await select("CPU Architecture", label => normalized(label) === architecture);
  const type = find("Type");
  const matchingType = type?.options?.find(option => !option.disabled && normalized(option.label) === normalized(flavor.family ?? ""));
  if (type && matchingType && String(type.value) !== matchingType.value) state = await apply(state, type, matchingType.value);
  // Huawei's current Type/Generation options are authoritative; no local family classification table.
  let generation = find("Generation")?.options?.find(option => !option.disabled && normalized(option.label) === normalized(family));
  if (!generation) {
    const types = find("Type")?.options?.filter(option => !option.disabled) ?? [];
    for (const option of types) {
      const field = find("Type")!;
      if (String(field.value) !== option.value) state = await apply(state, field, option.value);
      generation = find("Generation")?.options?.find(option => !option.disabled && normalized(option.label) === normalized(family));
      if (generation) break;
    }
  }
  if (!generation) throw new Error("Huawei does not offer this flavor generation for this region and billing mode.");
  await select("Generation", label => normalized(label) === normalized(family));
  await select("vCPUs", label => Number(label.match(/[\d.]+/)?.[0]) === flavor.cpu);
  await select("Memory", label => Number(label.match(/[\d.]+/)?.[0]) === flavor.ramGiB);
  if (!state.inquiries.some(inquiry => inquiry.productInfos.some(product => product.resourceSpecCode === flavor.resourceSpecCode)))
    throw new Error("Huawei selected a different compute SKU. Reconfigure this flavor using the official controls.");
  return state;
}
