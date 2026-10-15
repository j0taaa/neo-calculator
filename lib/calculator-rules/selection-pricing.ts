/* eslint-disable @typescript-eslint/no-explicit-any -- Product dimensions are defined by the compiled service schema. */
import type { ScopeSnapshot, CatalogProduct, Plan } from "../huawei-snapshot/types";
import type { NativePricing } from "../huawei-native/native-pricing";
import type { Inquiry, InquiryProduct, Quote } from "../huawei-native/types";
import { calculateQuote } from "../huawei-snapshot/verify";
import { nativeComponentId } from "../huawei-native/native-quote";
import type { CompiledRules } from "./program";
import type { RuleEvaluator } from "./evaluate";

function planFor(row: CatalogProduct, mode: string, period: any, installment?: any): Plan | Record<string, unknown> {
  const plans = row.planList ?? [];
  if (mode === "RI") return Object.assign({}, ...plans.map((p: any) => ({ paymentType: p.paymentType, planId: p.planId, productId: p.productId, skuCode: p.skuCode, billingMode: p.billingMode, [String(p.originType)]: p.amount })));
  if (mode !== "PERIOD") return plans.find(p => p.billingMode === mode) ?? {};
  const type = period.measureId === 19 ? "YEAR" : "MONTH", count = Number(period.measureValue);
  let eligible = plans.filter(p => p.billingMode.includes(type) && count % Number(p.periodNum) === 0 && (installment ? (p.feeInstallMode ?? "ALL_PAY") === installment.feeInstallMode && p.installPeriodType === installment.installPeriodType : !p.feeInstallMode));
  if (!eligible.length && type === "YEAR") eligible = plans.filter(p => p.billingMode === "MONTHLY" && !p.feeInstallMode);
  return eligible.sort((a, b) => Number(b.periodNum) - Number(a.periodNum))[0] ?? {};
}

export function selectProducts(rules: CompiledRules, evaluator: RuleEvaluator, inputs: Record<string, CatalogProduct[]>, values: Record<string, any>, global: any, translate: (input: any) => any): Record<string, any[]> {
  const period = values.global_PERIODTIME?.UNSET_PeriodTime ?? { measureValue: 1, measureId: 20 };
  const duration = values.global_ONDEMANDTIME?.UNSET_Stepper_0;
  const quantity = values.global_QUANTITY?.UNSET_Stepper_0;
  const products: Record<string, any[]> = {};
  for (const [id, rows] of Object.entries(inputs)) {
    products[id] = rows.map(original => {
      const row: any = structuredClone(original), plan = planFor(row, String(row._injectedMode ?? global.chargeMode), period, values.global_FEEINSTALLMODE);
      row.bakPlanList = row.planList;
      for (const [key, value] of Object.entries(plan)) if (row[key] === undefined || row[key] === null || row[key] === "") row[key] = value;
      delete row.planList;
      if (row.feeInstallMode) row.installNum = Math.ceil(Number(period.measureValue) * (period.measureId === 19 ? 12 : 1) / Number(row.periodNum ?? 1));
      row.inquiryTag = row.inquiryTag ?? "normal";
      row.productNum = Number(row.productNum ?? 1);
      if (quantity) { row.selfProductNum = row.productNum; row.productNum *= Number(quantity.measureValue ?? 1); }
      if (global.chargeMode === "ONDEMAND" && duration) {
        row.transRate = duration.transRate; row.transTarget = duration.transTarget;
        if (["duration", "Duration", "period"].includes(row.usageFactor)) { row.usageValue = duration.measureValue; row.usageMeasureId = duration.measureId; }
        else { row.durationNum = duration.measureValue; row.productNum *= duration.measureValue; }
      }
      return row;
    });
  }
  for (const transform of rules.transforms as any[]) {
    if (!(transform.id in products) || !products[transform.id].length) continue;
    products[transform.id] = evaluator.run(transform.function, transform.inputs.map((key: string) => key in products && products[key].length ? products[key] : values[key] ?? translate(key)), { translate, toThousands: (value: any) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",") });
    if (!Array.isArray(products[transform.id])) throw new Error("Invalid compiled resource transform");
  }
  return products;
}

export function priceSelection(scope: ScopeSnapshot, rules: CompiledRules, evaluator: RuleEvaluator, inputs: Record<string, CatalogProduct[]>, values: Record<string, any>, global: any, translate: (input: any) => any, release: string): { pricing?: NativePricing; quote: Quote | null; inquiries: Inquiry[]; error?: string } {
  const period = values.global_PERIODTIME?.UNSET_PeriodTime ?? { measureValue: 1, measureId: 20 };
  const quantity = values.global_QUANTITY?.UNSET_Stepper_0;
  const products = selectProducts(rules, evaluator, inputs, values, global, translate);
  const selected: NativePricing["selectedProduct"] = {
    // This legacy field only associates components within one calculation.
    // Wall-clock IDs would change identical API results and their request hashes.
    ...global, timeTag: 0, periodNum: global.chargeMode === "PERIOD" ? Number(period.measureValue) : 1,
    periodType: global.chargeMode === "PERIOD" ? period.measureId === 19 ? 3 : 2 : 4,
    subscriptionNum: 1,
    ...(quantity ? { purchaseNum: quantity } : {}),
    productAllInfos: Object.values(products).flat().filter(row => row.inquiryTag).map((row, selectIndex) => ({ ...row, selectIndex })),
  };
  if (global.chargeMode === "RI") {
    const term = selected.productAllInfos.find(p => p.inquiryTag === "normal")?.RITime;
    if (typeof term !== "string" || !/^nodeData\.\d+_\d+$/.test(term)) return { quote: null, inquiries: [], error: "Choose an available reserved instance term" };
    const [count, type] = term.slice(9).split("_").map(Number);
    selected.periodNum = count; selected.periodType = type;
  }
  const pricing: NativePricing = JSON.parse(JSON.stringify({ epoch: 1, pending: false, selectedProduct: selected, result: null }));
  if (!selected.productAllInfos.length) return { pricing, quote: null, inquiries: [], error: "Choose available specifications to calculate a price" };
  const grouped = new Map<string, Inquiry>();
  for (const product of selected.productAllInfos) {
    if (!["normal", "combine", "sameNamePackage"].includes(String(product.inquiryTag)) || product.productNum === 0) continue;
    const mode = String(product._injectedMode ?? (product.inquiryTag === "combine" && product.billingMode ? ["MONTHLY", "YEARLY"].includes(String(product.billingMode)) ? "PERIOD" : product.billingMode : selected.chargeMode));
    const region = String(product.regionId ?? selected.region), siteCode = String(product.siteCode ?? "HWC");
    const key = `${product.inquiryTag}/${mode}/${region}/${siteCode}`;
    if (!grouped.has(key)) grouped.set(key, { regionId: region, chargingMode: ({ PERIOD: 0, ONDEMAND: 1, ONETIME: 2, RI: 10 } as Record<string, number>)[mode], periodNum: mode === "ONETIME" ? null : selected.periodNum, periodType: mode === "ONETIME" ? null : selected.periodType, subscriptionNum: 1, siteCode, productInfos: [] });
    const inquiry = grouped.get(key)!;
    const request: any = { id: nativeComponentId(selected.timeTag, product) };
    for (const field of ["cloudServiceType", "resourceType", "resourceSpecCode", "productNum"]) request[field] = product[field];
    if (product.resourceSize != null && product.resouceSizeMeasureId != null) { request.resourceSize = product.resourceSize; request.resouceSizeMeasureId = product.resouceSizeMeasureId; }
    if (product.usageFactor && product.usageValue != null && product.usageMeasureId != null) for (const field of ["usageFactor", "usageValue", "usageMeasureId"]) request[field] = product[field];
    if (product.skuCode && product.productId) { request.skuCode = product.skuCode; request.productId = product.productId; }
    if (product.inquiryTag === "sameNamePackage" && product.productId) request.productId = product.productId;
    for (const field of ["locationType", "locationCode", "feeInstallMode"]) if (product[field]) { (request.bizExtAttributes ??= []).push({ key: field.replace(/[A-Z]/g, (c: string) => "_" + c.toLowerCase()), value: product[field] }); request.supportBizExt = 1; }
    if (String(request.usageMeasureId).includes("9009")) { request.usageMeasureId = Number(String(request.usageMeasureId).split("9009")[0]); if (typeof product.transTarget !== "string" || !Number.isFinite(Number(product.transRate))) throw new Error("Missing monthly usage conversion"); request[product.transTarget] *= Number(product.transRate); }
    inquiry.productInfos.push(request as InquiryProduct);
  }
  const inquiries: Inquiry[] = JSON.parse(JSON.stringify([...grouped.values()]));
  for (const inquiry of inquiries) {
    const included = selected.productAllInfos.filter(p => inquiry.productInfos.some(i => i.id === nativeComponentId(selected.timeTag, p)));
    if (included.length && included.every(p => p.locationCode)) inquiry.availableZoneId = String(included[0].locationCode);
  }
  try {
    const result = calculateQuote(scope, release, pricing, inquiries);
    pricing.result = result.pricing.result;
    result.quote.aggregation = "neo-engine";
    result.quote.source = "huawei-catalog";
    result.quote.quotedAt = scope.source.fetchedAt;
    return { pricing, quote: result.quote, inquiries };
  } catch (error) { return { pricing, quote: null, inquiries, error: error instanceof Error ? error.message : String(error) }; }
}
