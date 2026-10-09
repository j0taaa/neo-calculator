/* eslint-disable @typescript-eslint/no-explicit-any -- Specialized schemas describe sets of native controls. */
import type { CatalogProduct } from "../huawei-snapshot/types";
import type { ControlContext, ControlResult } from "./controls";
import { orderedOptions } from "./catalog";
import { buildControls } from "./controls";

type Builder = (config: any, source: any[], namespace: string) => ControlResult;

export function tableControls(config: any, source: CatalogProduct[], context: ControlContext): ControlResult {
  const fields: ControlResult["fields"] = [];
  let rows = source;
  const select = (key: string, options: any[], label: string, labels: string[], initial: any) => {
    let selected = context.chosen.get(key);
    if (!options.includes(selected)) selected = options.includes(initial) ? initial : options[0];
    context.chosen.set(key, selected);
    const id = `${config.id}:${fields.length}`;
    context.bindings.set(id, { key, options });
    fields.push({ id, component: config.id, label, type: "select", value: String(options.indexOf(selected)), disabled: !options.length, options: labels.map((label, i) => ({ label, value: String(i), disabled: false })) });
    return selected;
  };
  (config.filters?.optionKeys ?? []).forEach((attribute: string, i: number) => {
    const options = ["__ALL__", ...orderedOptions(rows.map(row => row[attribute]), config.filters.sortMethods?.[i], context.translate)];
    const selected = select(`${config.id}:filter:${attribute}`, options, context.translate(config.filters.titles?.[i] ?? attribute), options.map(v => v === "__ALL__" ? "All" : context.translate(v)), "__ALL__");
    if (selected !== "__ALL__") rows = rows.filter(row => row[attribute] === selected);
  });
  const filterKey = `${config.id}:filters`, filters = JSON.stringify(fields.map(f => f.value));
  if (context.chosen.has(filterKey) && context.chosen.get(filterKey) !== filters) context.chosen.delete(`${config.id}:row`);
  context.chosen.set(filterKey, filters);
  const sorts = Object.entries(config.column.sortMethods ?? {}).map(([key, method]) => ({ key, order: orderedOptions(rows.map(row => String(row[key])), method, context.translate) }));
  rows = [...rows].sort((a, b) => {
    for (const { key, order } of sorts) { const difference = order.indexOf(String(a[key])) - order.indexOf(String(b[key])); if (difference) return difference; }
    return 0;
  });
  const identity = (row: CatalogProduct) => `${row.resourceSpecCode}_${config.column.optionKeys.map((key: string) => row[key]).join("_")}`;
  const label = (row: CatalogProduct) => config.column.optionKeys.map((key: string) => context.translate(row[key] ?? "")).join(" | ");
  const options = rows.map(identity);
  const sourceKey = `${config.id}:rows`, signature = JSON.stringify(options);
  if (context.chosen.has(sourceKey) && context.chosen.get(sourceKey) !== signature) context.chosen.delete(`${config.id}:row`);
  context.chosen.set(sourceKey, signature);
  const defaultRow = rows[0];
  let selected: CatalogProduct[];
  if (config.withSelect === "multi") {
    selected = rows.filter(row => {
      const key = `${config.id}:row:${identity(row)}`, id = `${config.id}:${fields.length}`, active = context.chosen.get(key) ?? config.defaultValues?.includes(identity(row)) ?? false;
      context.chosen.set(key, active); context.bindings.set(id, { key });
      fields.push({ id, component: config.id, label: label(row), type: "checkbox", value: active, disabled: false }); return active;
    });
  } else {
    const selectedId = select(`${config.id}:row`, options, context.translate(config.column.titles?.[0] ?? "Specification"), rows.map(label), config.defaultValues?.[0] ?? (defaultRow && identity(defaultRow)));
    selected = rows.filter(row => identity(row) === selectedId).slice(0, 1);
  }
  return { fields, products: selected.map(row => ({ ...structuredClone(row), _id: identity(row), addToList_product: label(row), addToList_title: config.title ?? "" })), value: selected.map(identity), notes: [] };
}
export function joinControls(parts: ControlResult[], component: string, context: ControlContext): ControlResult {
  const fields = parts.flatMap(part => part.fields.map(field => ({ field, binding: context.bindings.get(field.id)! })));
  fields.forEach(({ field, binding }, i) => { field.id = `${component}:${i}`; context.bindings.set(field.id, binding); });
  return { fields: fields.map(p => p.field), products: parts.flatMap(p => p.products), value: parts.map(p => p.value), notes: parts.flatMap(p => p.notes) };
}

export function mediaControls(config: any, source: CatalogProduct[], context: ControlContext, build: Builder): ControlResult {
  return joinControls(config.customerTypes.map((spec: string, index: number) => build({ id: config.id, type: "CommonSelect", optionKeys: config.optionKeys, steppers: config.steppers ?? [{ target: "Usage", prefixs: [{ measureId: 5, min: 0, max: 102400, defaultValue: 0 }, { measureId: 4, min: 0, max: 102400, defaultValue: 0 }] }], ...(config.configs?.[index] ?? {}) }, source.filter(row => row.resourceSpecCode === spec), `${config.id}:media:${index}`)), config.id, context);
}

export function clusterControls(config: any, source: CatalogProduct[], context: ControlContext, build: Builder): ControlResult {
  const title = String(context.translate(config.titlePrefix ?? "")), kind = String(config.nodeType).toLowerCase();
  const specs = Array.isArray(config.nodeSetting?.resourceType) ? config.nodeSetting.resourceType : [config.nodeSetting?.resourceType ?? "hws.resource.type.vm", "hws.resource.type.pm"];
  const vm = build({ id: config.id, type: "CommonRadioGroup", optionKeys: ["vmType", "generation", "nodeSize"], titles: [`${title}Node Specifications`], sortMethods: { 0: ["dataInfo_1_", "dataInfo_3_", "dataInfo_5_", "dataInfo_6_", "dataInfo_8_", "dataInfo_9_", "dataInfo_10_", "dataInfo_11_", "dataInfo_12_", "dataInfo_13_", "dataInfo_14_", "dataInfo_15_", "dataInfo_34_", "dataInfo_35_", "dataInfo_37_", "dataInfo_38_", "dataInfo_43_", "dataInfo_17_"] }, ...(config.nodeSetting ?? {}) }, source.filter(row => specs.includes(row.resourceType)), `${config.id}:cluster:node`);
  const volumes = source.filter(row => row.resourceType === "hws.resource.type.volume");
  const volume = (role: string, defaultSize: number, setting: any, diskCount = false) => {
    const definition = { id: config.id, type: "CommonSelect", optionKeys: ["type"], titles: [`${title}${role}`], sortMethods: [["dataInfo_32_", "dataInfo_41_", "dataInfo_33_", "dataInfo_34_"]], defaultValues: ["dataInfo_32_"], steppers: [{ target: "Resource", prefixs: [{ measureId: 17, min: role === "System Disk" ? 40 : 100, max: role === "System Disk" ? 1000 : 32000, defaultValue: defaultSize }] }, ...(diskCount ? [{ title: "Disks per node", target: "ProductNum", prefixs: [{ measureId: 30, min: kind.includes("task") ? 0 : 1, max: 10, defaultValue: 1 }] }] : [])], ...(setting ?? {}) };
    const namespace = `${config.id}:cluster:${role}`;
    // Cluster disk selectors remain visible when a region offers no disk rows;
    // their capacities and products are absent until a disk can be selected.
    return volumes.length ? build(definition, volumes, namespace) : buildControls({ ...definition, steppers: [] }, [], context, config.id, namespace);
  };
  const localDisk = vm.products.some(row => new RegExp(config.hideLocalDiskRule ?? "a^").test(row.resourceSpecCode));
  const parts = [vm, volume("System Disk", 480, config.rootDiskSetting), ...(!localDisk ? [volume("Data Disk", kind === "master" ? 200 : 100, config.dataDiskSetting, kind !== "master")] : [])];
  const counts = build({ id: config.id, type: "CommonStepper", title: `${title}Nodes`, prefixs: [{ measureId: 30, min: kind === "master" ? 1 : kind.includes("task") ? 0 : 1, max: kind === "master" ? 1 : kind.includes("task") ? 499 : 500, defaultValue: kind === "master" ? 1 : kind.includes("task") ? 1 : 3 }], ...(config.nodeNumSetting ?? {}) }, [{}], `${config.id}:cluster:count`);
  const count = Number(counts.value.UNSET_Stepper_0?.measureValue ?? 0);
  const result = joinControls([...parts, { ...counts, products: [] }], config.id, context);
  result.products = result.products.flatMap(row => {
    const selected = { ...row, productNum: Number(row.productNum ?? 1) * count, addToList_title: config.addToList_title };
    return row.additionProduct ? [selected, { ...row.additionProduct as CatalogProduct, productNum: selected.productNum }] : [selected];
  });
  return result;
}
