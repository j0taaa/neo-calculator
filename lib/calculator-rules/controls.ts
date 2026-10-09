/* eslint-disable @typescript-eslint/no-explicit-any -- Generic controls use the service's compiled attribute schema. */
import type { NativeField } from "../huawei-native/native-types";
import type { CatalogProduct } from "../huawei-snapshot/types";
import { matchingRows, orderedOptions } from "./catalog";

export type ControlResult = { fields: NativeField[]; products: CatalogProduct[]; value: any; notes: string[] };
export type ControlContext = {
  environment?: { region: string; chargeMode: string; tag?: string };
  chosen: Map<string, any>;
  bindings: Map<string, { key: string; options?: any[]; action?: () => void; validate?: (value: string | number | boolean) => boolean }>;
  translate: (value: any) => any;
  measure: (id: number, plural?: boolean) => string;
};

/** Neo's controls select product rows and attach usage. No upstream component code is executed. */
export function buildControls(config: any, source: any[], context: ControlContext, component = config.id, namespace = config.id): ControlResult {
  const { chosen, bindings, translate, measure } = context;
  const fields: NativeField[] = [], notes: string[] = [];
  let products: CatalogProduct[] = source.filter(v => v && typeof v === "object").map(v => ({ ...v }));
  const value: Record<string, any> = {};
  const label = (text: any) => String(translate(text ?? "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const names: Record<string, string> = { cpu: "vCPUs", mem: "Memory", generation: "Generation", vm_spec: "Specification", image: "Image", name: "Image version" };
  const add = (key: string, field: Omit<NativeField, "id" | "component">, options?: any[], action?: () => void) => {
    const id = `${namespace}:${fields.length}`;
    fields.push({ ...field, id, component }); bindings.set(id, { key, options, action });
  };
  const select = (key: string, options: any[], title: any, presentation?: "options", defaultValue?: any, unitSelector?: boolean) => {
    let current = chosen.get(key);
    if (!options.includes(current)) current = options.includes(defaultValue) ? defaultValue : options[0];
    chosen.set(key, current);
    add(key, { label: label(title), type: "select", value: String(options.indexOf(current)), disabled: !options.length, ...(presentation ? { presentation } : {}), ...(unitSelector ? { unitSelector } : {}), options: options.map((v, i) => ({ value: String(i), label: label(v?.label ?? v), disabled: Boolean(v?.disabled) })) }, options);
    return current;
  };
  const stepper = (step: any, index: number) => {
    const candidates = matchingRows(products, step.rules, context.environment);
    if (!candidates.length && source.length) return;
    const key = `${namespace}:step:${index}`, unitKey = key + ":unit";
    const prefixes: any[] = step.prefixs?.length ? step.prefixs : [{ measureId: 0, min: 0, max: 9999, defaultValue: 1 }];
    let unit = chosen.get(unitKey);
    if (!prefixes.some(p => p.measureId === unit)) unit = prefixes[step.defaultIndex ?? 0]?.measureId ?? prefixes[0].measureId;
    chosen.set(unitKey, unit);
    const prefix = prefixes.find(p => p.measureId === unit)!;
    const min = prefix.min ?? 1, max = prefix.max ?? 9999;
    let amount = chosen.get(key);
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < min || amount > max) amount = Math.min(max, Math.max(min, prefix.defaultValue ?? min));
    chosen.set(key, amount);
    if (["radioGroup", "radioGroupWithStepper"].includes(step.category) && step.enumValues?.length) {
      const options = step.enumValues;
      amount = select(key, options, step.title ?? config.title, "options", prefix.defaultValue);
      const field = fields.at(-1)!;
      field.options = options.map((v: any, i: number) => ({ value: String(i), label: label(step.enumLabels?.[i] ?? v), disabled: false }));
    }
    const target = ["Resource", "Usage", "ProductNum"].includes(step.target) ? step.target : "ProductNum";
    const title = label(step.title ?? config.title ?? fields[0]?.label ?? "Value") || "Value";
    if (step.category !== "radioGroup") add(key, { label: title + (prefixes.length > 1 || !step.title && fields.some(f => f.type === "select") ? " amount" : ""), type: "number", value: amount, disabled: min === max, min, max, unit: label(prefix.measureName ?? measure(unit, amount !== 1)) });
    if (prefixes.length > 1) {
      const options = prefixes.map(p => p.measureId);
      add(unitKey, { label: title || "Unit", type: "select", unitSelector: true, value: String(options.indexOf(unit)), disabled: false, options: prefixes.map((p, i) => ({ value: String(i), label: label(p.measureName ?? measure(p.measureId, false)), disabled: false })) }, options);
    }
    const emitted = { measureValue: amount, measureId: unit, measureNameBeforeTrans: prefix.measureName ?? "", measurePluralNameBeforeTrans: prefix.measurePluralName ?? "", transRate: prefix.transRate, transTarget: prefix.transTarget };
    value[`UNSET_Stepper_${index}`] = emitted;
    const attrs = target === "Resource" ? ["resourceSize", "resouceSizeMeasureId", "resource"] : target === "Usage" ? ["usageValue", "usageMeasureId", "usage"] : ["productNum", "productNumMeasureId", "productNum"];
    for (const row of candidates) {
      row[attrs[0]] = amount; row[attrs[1]] = unit;
      row[`${attrs[2]}MeasureName`] = emitted.measureNameBeforeTrans;
      row[`${attrs[2]}MeasurePluralName`] = emitted.measurePluralNameBeforeTrans;
      if (target === "Usage") { row.transRate = prefix.transRate; row.transTarget = prefix.transTarget; }
    }
    products = candidates;
  };
  if (config.type === "CommonTip") return { fields, products: [], value: source, notes: source.map(label).filter(Boolean) };
  if (config.type === "CommonInput") {
    const key = namespace + ":input", current = chosen.get(key) ?? Number(config.defaultValue ?? 0);
    chosen.set(key, current);
    add(key, { label: label(config.title), type: "number", value: Number(current), disabled: false, hint: label(config.errorMessage) });
    return { fields, products: (products.length ? products : [{} as CatalogProduct]).map(row => ({ ...row, UNSET_Input: current, addToList_title: config.title, addToList_product: String(current) })), value: { UNSET_Input: current }, notes };
  }
  if (["CommonRadioGroup", "CommonSelect", "CommonSwitch", "CommonCheckboxGroup"].includes(config.type)) {
    const keys = config.optionKeys ?? [config.optionKey || "UNSET_Switch"];
    keys.forEach((optionKey: string, index: number) => {
      const rawValues = optionKey.startsWith("UNSET_") ? source : products.map(row => row[optionKey]);
      const sort = config.sortMethods?.[index] ?? (["CommonRadioGroup", "CommonSelect"].includes(config.type) ? undefined : config.sortMethod);
      const options = orderedOptions(rawValues, sort, translate);
      const key = `${namespace}:option:${optionKey}`;
      const title = label(config.titles?.[index] ?? config.title) || names[optionKey] || (optionKey === "UNSET_Switch" ? "Specification" : optionKey.replace(/([a-z])([A-Z])/g, "$1 $2"));
      if (config.type === "CommonCheckboxGroup") {
        const defaults = Array.isArray(config.defaultValues) ? config.defaultValues : config.defaultValues ? [config.defaultValues] : [];
        const matching = defaults.filter((v: unknown) => options.includes(v));
        const selected: any[] = chosen.get(key) ?? (matching.length ? matching : config.min ? options.slice(0, Number(config.min)) : []);
        options.forEach((option: any) => {
          const itemKey = `${key}:${String(option)}`;
          const active = chosen.has(itemKey) ? Boolean(chosen.get(itemKey)) : selected.includes(option);
          chosen.set(itemKey, active);
          add(itemKey, { label: label(option), type: "checkbox", value: active, disabled: false });
        });
        value[optionKey] = options.filter(v => chosen.get(`${key}:${String(v)}`));
        const count = value[optionKey].length;
        for (const field of fields.filter(f => f.type === "checkbox")) field.disabled = field.value ? count <= Number(config.min ?? 0) : config.max !== undefined && count >= Number(config.max);
        products = products.filter(row => value[optionKey].includes(row[optionKey]));
      } else {
        if (!options.length && config.type !== "CommonSelect" && !(config.type === "CommonRadioGroup" && index === 0)) return;
        const current = select(key, options, title, config.type === "CommonSelect" ? undefined : "options", config.defaultValues?.[index] ?? config.defaultValue);
        value[optionKey] = current;
        if (!optionKey.startsWith("UNSET_") && current !== undefined) products = products.filter(row => row[optionKey] === current);
      }
    });
  } else if (config.type !== "CommonStepper" && config.type !== "CommonRadioStepper") {
    throw new Error(`Unimplemented native control: ${config.type}`);
  }
  if (config.type === "CommonStepper" || config.type === "CommonRadioStepper") stepper(config, 0);
  else {
    const usedTargets = new Set<string>();
    (config.steppers ?? []).forEach((step: any, index: number) => {
      if (usedTargets.has(step.target) || !matchingRows(products, step.rules, context.environment).length) return;
      usedTargets.add(step.target); stepper(step, index);
    });
  }
  const description = Object.values(value).map(v => v && typeof v === "object" && !Array.isArray(v) ? `${v.measureValue}${v.measureNameBeforeTrans || ""}` : Array.isArray(v) ? v.join(" | ") : String(v ?? "")).filter(Boolean).join(" | ");
  for (const row of products) { row.addToList_title = config.titles?.[0] ?? config.title ?? ""; row.addToList_product = description; }
  if (config.type === "CommonSwitch") return { fields, products, value: value[keysForSwitch(config)], notes };
  if (config.type === "CommonCheckboxGroup") return { fields, products, value: Object.values(value)[0] ?? [], notes };
  return { fields, products, value, notes };
}

function keysForSwitch(config: any) { return config.optionKey || "UNSET_Switch"; }
