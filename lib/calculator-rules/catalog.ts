/* eslint-disable @typescript-eslint/no-explicit-any -- Synchronized product attributes differ by service. */
import type { CatalogProduct } from "../huawei-snapshot/types";
import type { CompiledRules } from "./program";

export function sameCategory(a: string, b: string) {
  const parse = (key: string) => key.startsWith("hws.resource.type.") ? ["", key.slice(18)] : [key.slice(0, key.indexOf("_")), key.slice(key.indexOf("_") + 1)];
  const [as, ar] = parse(a), [bs, br] = parse(b);
  return ar === br && (!as || !bs || as === bs);
}
export function category<T>(catalog: Record<string, T>, key: string): T | undefined {
  return Object.entries(catalog).find(([name]) => sameCategory(name, key))?.[1];
}
export function matchingRows(rows: CatalogProduct[], rules?: Record<string, any>[], environment?: { region: string; chargeMode: string; tag?: string }): CatalogProduct[] {
  if (!rules) return rows;
  return rows.flatMap(row => {
    for (const rule of rules) {
      if (environment && (rule.regions && !rule.regions.includes(environment.region) || rule.chargeModes && !rule.chargeModes.includes(environment.chargeMode) || rule.tags && !rule.tags.includes(environment.tag))) continue;
      if (rule.resourceSpecCode && !new RegExp(rule.resourceSpecCode).test(row.resourceSpecCode)) continue;
      const plans = rule.billingEvent ? row.planList?.filter(p => new RegExp(rule.billingEvent).test(String(p.billingEvent))) : row.planList;
      if (rule.billingEvent && !plans?.length) continue;
      return [{ ...row, ...(plans ? { planList: plans } : {}) }];
    }
    return [];
  });
}

export function ruleLanguage(rules: CompiledRules, menu: any) {
  const language: Record<string, any> = { ...menu.languagePack, ...menu.global, ...rules.language };
  const lookup = (path: string) => path.split(".").reduce((v: any, key) => v?.[key], language);
  const nodeLabels: Record<string, string> = {
    ALL_UPFRONT: "All Upfront", PARTIAL_UPFRONT: "Partial Upfront", NO_UPFRONT: "No Upfront",
    ALL_PAY: "All Upfront", HALF_PAY: "Partial Upfront", NO_PAY: "No Upfront",
    STANDARD: "Standard", "1_3": "1 Year", "3_3": "3 Years", "1_2": "1 Month",
  };
  function translate(input: any): any {
    if (Array.isArray(input)) return input.map(translate);
    if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, k === "inputs" || k === "$rule" ? v : translate(v)]));
    if (typeof input !== "string") return input;
    if (lookup(input) !== undefined && typeof lookup(input) !== "object") return lookup(input);
    return input.replace(/BSSUNIT\.(unit|pluralUnit)\.(\d+)/g, (_, form, id) => menu.measureID?.[id]?.[form] ?? "")
      .replace(/(?:dataInfo|calc|detail)_\d+_/g, token => String(language[token] ?? ""))
      .replace(/nodeData\.([A-Za-z0-9_]+)/g, (_, token) => String(language[token] ?? nodeLabels[token] ?? token))
      .replace(/image_[A-Za-z0-9_]+/g, token => String(menu.languagePack?.imageLang?.[token] ?? token));
  }
  return { translate, measure: (id: number, plural = false) => String(menu.measureID?.[id]?.[plural ? "pluralUnit" : "unit"] ?? "") };
}

export function orderedOptions(values: any[], sort: any, translate: (input: any) => any) {
  const result = [...new Set(values.filter(Boolean))];
  if (sort === false) return result;
  const preferred: any[] = Array.isArray(sort) ? sort.map(translate) : [];
  const units = ["MB", "GB", "TB", "PB"];
  const tailFirst = /^\d+\s?(MB|GB|TB|PB)/.test(String(translate(result[0])));
  const chunks = (v: any) => {
    const parts = String(translate(v)).replace(/[,\s]/g, "").split(/(\d+)/);
    return tailFirst ? parts.reverse() : parts;
  };
  return result.sort((a, b) => {
    const first = preferred.indexOf(translate(a)), second = preferred.indexOf(translate(b));
    if (preferred.length) return first - second;
    const left = chunks(a), right = chunks(b);
    for (let i = 0; i < left.length; i++) {
      if (left[i] === right[i]) continue;
      const comparison = right[i] === undefined ? 1 : units.indexOf(left[i]) !== units.indexOf(right[i]) ? units.indexOf(left[i]) - units.indexOf(right[i]) : Number.isNaN(Number(left[i]) - Number(right[i])) ? left[i] < right[i] ? -1 : 1 : Number(left[i]) - Number(right[i]);
      return comparison * (sort === "reverse" ? -1 : 1);
    }
    return 0;
  });
}
