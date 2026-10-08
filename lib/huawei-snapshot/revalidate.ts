import { QuoteGateway } from "../huawei-native/quotes";
import { applyRecurringOverrides } from "./recurring";
import { quotesAgree } from "./audit";
import { matchingPlans, catalogRows, rateInquiry } from "./rating";
export class PricingChanged extends Error {}
import type { ScopeSnapshot } from "./types";
/** Unchanged code/data need fresh price checks, not another render of identical conditional rules. */
export async function revalidateUnchangedScope(
  scope: ScopeSnapshot,
  previous: ScopeSnapshot,
  gateway = new QuoteGateway(),
) {
  scope.ratingRules = structuredClone(previous.ratingRules);
  applyRecurringOverrides(scope);
  const rows = catalogRows(scope),
    families = new Map<string, typeof previous.proof>();
  for (const proof of previous.proof ?? []) {
    const key = JSON.stringify([
      proof.inquiry.chargingMode,
      proof.inquiry.periodType,
      proof.inquiry.periodNum,
      proof.inquiry.siteCode,
      proof.inquiry.availableZoneId ?? "",
      proof.inquiry.productInfos.map((product) => [
        product.cloudServiceType,
        product.resourceType,
        product.usageFactor,
        product.usageMeasureId,
        product.resouceSizeMeasureId,
        matchingPlans(rows, proof.inquiry, product, scope.ratingRuleVersion ?? 1).map(({ plan }) => [
          plan.billingMode,
          plan.usageFactor,
          plan.measureUnit,
          plan.divisionType,
          plan.feeInstallMode,
        ]),
      ]),
    ]);
    const entries = families.get(key) ?? [];
    entries.push(proof);
    families.set(key, entries);
  }
  if (!families.size)
    throw new Error(
      "The unchanged snapshot has no pricing validation evidence",
    );
  let checks = 0;
  for (const entries of families.values())
    for (const proof of [
      entries![0],
      ...(entries!.length > 1 ? [entries!.at(-1)!] : []),
    ]) {
      const official = await gateway.inquire(proof.inquiry);
      if (!quotesAgree(rateInquiry(scope, proof.inquiry), official))
        throw new PricingChanged(
          "The pricing API changed while the catalog was unchanged",
        );
      checks += proof.inquiry.productInfos.length;
    }
  // Preserve validated request shapes for a future changed catalog, without accumulating daily copies.
  scope.proof = previous.proof;
  return checks;
}
