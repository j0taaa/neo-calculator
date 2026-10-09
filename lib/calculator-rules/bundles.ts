/* eslint-disable @typescript-eslint/no-explicit-any -- Bundle trees carry service-defined attributes. */
import type { CatalogProduct } from "../huawei-snapshot/types";
import type { NativeField } from "../huawei-native/native-types";
import { matchingRows } from "./catalog";
import type { ControlContext, ControlResult } from "./controls";
import type { RuleEvaluator } from "./evaluate";

type Node = CatalogProduct & { __package: number };
/** Resolve optional and required resources from the published bundle tree. */
export function bundleControls(config: any, packages: CatalogProduct[], context: ControlContext, evaluator: RuleEvaluator, build: (config: any, rows: any[], namespace: string) => ControlResult): ControlResult {
  const descendants = (nodes: any[]): any[] => nodes.flatMap(node => node.resourceType ? [node, ...descendants(node.sub_bundle_offerings ?? [])] : descendants(node.sub_bundle_offerings ?? []));
  let available = packages.map((row, index) => ({ row, index }));
  const children: Record<string, CatalogProduct[]> = {}, values: Record<string, any> = {};
  const fields: NativeField[] = [], products: CatalogProduct[] = [], notes: string[] = [];
  const append = (part: ControlResult) => {
    const bindings = part.fields.map(f => context.bindings.get(f.id)!);
    part.fields.forEach((f, i) => { f.id = `${config.id}:${fields.length}`; context.bindings.set(f.id, bindings[i]); fields.push(f); });
    notes.push(...part.notes); products.push(...part.products);
  };
  for (const child of config.subComponents) {
    const namespace = `${config.id}:bundle:${child.id}`;
    let nodes: any[];
    if (child.cascadedSource) nodes = evaluator.run(child.cascadedSource.function, child.cascadedSource.inputs.map((id: string) => children[id] ?? values[id] ?? []));
    else nodes = available.flatMap(({ row, index }) => matchingRows(descendants(row.sub_bundle_offerings as any[] ?? []).filter(n => child.resourceTypes?.includes(n.resourceType) && (!child.selectType || n.select_type === child.selectType)), child.rules).map(node => {
      const inherited = Object.fromEntries((child.inheritAttrs ?? []).map((key: string) => [key, row[key]]));
      return { ...structuredClone(node), ...inherited, __package: index } as Node;
    }));
    let active = true;
    if (child.selectType === "OPTIONAL") {
      const key = namespace + ":enabled", id = `${config.id}:${fields.length}`;
      active = Boolean(context.chosen.get(key));
      fields.push({ id, component: config.id, label: String(context.translate(child.selectOptTip ?? child.title ?? child.id)), type: "checkbox", value: active, disabled: Boolean(child.disabled) });
      context.bindings.set(id, { key });
    }
    if (!active) { children[child.id] = []; continue; }
    const part = build({ ...child, id: config.id }, nodes, namespace);
    children[child.id] = part.products; values[child.id] = part.value;
    append(part);
    if (child.resourceTypes && child.selectType !== "OPTIONAL" && part.products.length) {
      const packageIds = new Set(part.products.map(p => p.__package));
      available = available.filter(p => packageIds.has(p.index));
    }
  }
  const selectedPackage = available[0]?.index;
  const selectedProducts = products.filter(row => row.__package === undefined || row.__package === selectedPackage);
  for (const row of selectedProducts) { row.regionId = packages[selectedPackage ?? 0]?.regionList && (packages[selectedPackage ?? 0].regionList as any[])[0]?.regionId; delete row.__package; }
  return { fields, products: selectedProducts, value: values, notes };
}
