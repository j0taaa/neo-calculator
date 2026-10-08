import type { ScopeSnapshot, CatalogProduct } from "./types";
import { QuoteGateway } from "../huawei-native/quotes";
import { catalogRows, ratingRuleKey, matchingPlans } from "./rating";
import { compareInquiry } from "./audit";
import type { Inquiry } from "../huawei-native/types";

/** Check unselected SKUs using validated component request shapes, including every RI payment/term. */
export function declaredCapacityMeasure(row: CatalogProduct) {
  const units = new Set(
    Object.values(row).flatMap((value) => {
      const match =
        typeof value === "string"
          ? value.match(/^nullBSSUNIT\.(?:unit|pluralUnit)\.(\d+)$/)
          : null;
      return match ? [Number(match[1])] : [];
    }),
  );
  return units.size === 1 ? [...units][0] : undefined;
}

export async function validateCatalogContracts(
  scope: ScopeSnapshot,
  gateway = new QuoteGateway(),
) {
  const seen = new Set<string>();
  let checks = 0;
  const templates = (scope.proof ?? []).map((proof) => proof.inquiry),
    rows = catalogRows(scope);
  const family = (plan: {
    billingMode: string;
    billingEvent?: string;
    usageFactor?: string;
    measureUnit?: number | null;
    divisionType?: string;
  }) =>
    JSON.stringify([
      plan.billingMode,
      plan.billingEvent ?? "",
      plan.usageFactor ?? "",
      plan.measureUnit ?? null,
      plan.divisionType ?? "",
    ]);
  const pending: Inquiry[] = [];
  for (const row of catalogRows(scope))
    for (const plan of row.planList ?? []) {
      if (plan.originType && plan.originType !== "price") continue;
      const mode = (
        { ONDEMAND: 1, MONTHLY: 0, YEARLY: 0, ONETIME: 2, RI: 10 } as Record<
          string,
          number
        >
      )[plan.billingMode];
      const template = templates.find(
        (request) =>
          request.chargingMode === mode &&
          (request.availableZoneId ?? "") === (row.locationCode ?? "") &&
          request.productInfos.some(
            (product) =>
              product.resourceType === row.resourceType &&
              matchingPlans(rows, request, product).some(
                (item) => family(item.plan) === family(plan),
              ),
          ),
      );
      if (!template) continue; // Custom/free resources are checked through their component flow instead.
      const sample = template.productInfos.find(
        (product) =>
          product.resourceType === row.resourceType &&
          matchingPlans(rows, template, product).some(
            (item) => family(item.plan) === family(plan),
          ),
      )!;
      const [riYears, riPeriod] = (row.RITime ?? "")
        .replace("nodeData.", "")
        .split("_")
        .map(Number);
      const capacityMeasure = declaredCapacityMeasure(row);
      const inquiry: Inquiry = {
        ...template,
        periodType:
          plan.billingMode === "YEARLY"
            ? 3
            : plan.billingMode === "MONTHLY"
              ? 2
              : plan.billingMode === "RI"
                ? riPeriod
                : template.periodType,
        periodNum:
          plan.billingMode === "RI"
            ? riYears
            : plan.periodNum || template.periodNum,
        siteCode: plan.siteCode ?? template.siteCode,
        productInfos: [
          {
            ...sample,
            ...(capacityMeasure === undefined
              ? {}
              : { resourceSize: 1, resouceSizeMeasureId: capacityMeasure }),
            id: "contract",
            cloudServiceType: row.cloudServiceType,
            resourceType: row.resourceType,
            resourceSpecCode: row.resourceSpecCode,
            productNum: 1,
            productId: plan.productId,
            skuCode: plan.skuCode,
          } as typeof sample,
        ],
      };
      const key = ratingRuleKey(scope, inquiry, inquiry.productInfos[0]);
      if (seen.has(key)) continue;
      seen.add(key);
      pending.push(inquiry);
    }
  // Independent modes/terms/sites are never combined into the same inquiry.
  const groups = new Map<string, Inquiry[]>();
  for (const request of pending) {
    const key = JSON.stringify([
      request.chargingMode,
      request.periodType,
      request.periodNum,
      request.siteCode,
      request.availableZoneId ?? "",
    ]);
    const group = groups.get(key) ?? [];
    group.push(request);
    groups.set(key, group);
  }
  async function check(request: Inquiry): Promise<number> {
    try {
      return (await compareInquiry(scope, request, gateway)).checks;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      const fixedPackage =
        error.message.includes("CBC.6069") &&
        error.message.includes("resourceSpeceSize");
      const missingSize =
        error.message.includes("CBC.6001") &&
        error.message.includes("resourceSpecSize");
      if (!fixedPackage && !missingSize) throw error;
      if (request.productInfos.length > 1) {
        let count = 0;
        for (const product of request.productInfos)
          count += await check({ ...request, productInfos: [product] });
        return count;
      }
      // A synthetic template for a variable-size SKU may encounter a fixed package.
      // Retry that contract without capacity; the actual component remains unmodified.
      if (missingSize) {
        if (request.productInfos[0].resourceSize !== undefined) throw error;
        return (
          await compareInquiry(
            scope,
            {
              ...request,
              productInfos: [{ ...request.productInfos[0], resourceSize: 1 }],
            },
            gateway,
          )
        ).checks;
      }
      const { resourceSize, resouceSizeMeasureId, ...product } =
        request.productInfos[0];
      if (resourceSize === undefined && resouceSizeMeasureId === undefined)
        throw error;
      return (
        await compareInquiry(
          scope,
          { ...request, productInfos: [product] },
          gateway,
        )
      ).checks;
    }
  }
  for (const group of groups.values())
    for (let offset = 0; offset < group.length; offset += 50) {
      const chunk = group.slice(offset, offset + 50),
        request = {
          ...chunk[0],
          productInfos: chunk.map((r, index) => ({
            ...r.productInfos[0],
            id: `contract-${offset + index}`,
          })),
        };
      checks += await check(request);
    }
  return checks;
}
