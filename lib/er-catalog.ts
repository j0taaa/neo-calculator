import type { RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export interface ErAttachmentTier {
  resourceSpecCode: string;
  attachmentType: string;
  ratePerHour: number | null;
  productId: string | null;
}

export interface ErTrafficTier {
  resourceSpecCode: string;
  trafficType: string;
  ratePerGb: number | null;
  productId: string | null;
}

export interface ErPricingCatalog extends RegionalPricingCatalog {
  attachmentTiers: ErAttachmentTier[];
  trafficTiers: ErTrafficTier[];
}

export interface ErEstimateInput {
  attachmentQuantity: number;
  usageHours: number;
  trafficGb: number;
  quantity: number;
}

export interface ErEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  attachmentQuantity: number;
  usageHours: number;
  trafficGb: number;
  quantity: number;
  attachmentTier: ErAttachmentTier;
  trafficTier: ErTrafficTier | null;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const erDefaults = {
  attachmentQuantity: 1,
  usageHours: 744,
  trafficGb: 0,
  quantity: 1,
} as const;

export const erPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/er",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/er.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function getPrimaryAttachmentTier(catalog: ErPricingCatalog) {
  return catalog.attachmentTiers.find((tier) => tier.ratePerHour != null) ?? null;
}

function getPrimaryTrafficTier(catalog: ErPricingCatalog) {
  return catalog.trafficTiers.find((tier) => tier.ratePerGb != null) ?? null;
}

export function estimateErConfiguration(catalog: ErPricingCatalog, input: ErEstimateInput): ErEstimate | null {
  const attachmentTier = getPrimaryAttachmentTier(catalog);
  if (!attachmentTier || attachmentTier.ratePerHour == null) {
    return null;
  }
  const trafficTier = getPrimaryTrafficTier(catalog);

  if (!Number.isFinite(input.attachmentQuantity) || input.attachmentQuantity < 1) {
    return null;
  }
  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }
  if (!Number.isFinite(input.trafficGb) || input.trafficGb < 0) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }

  const attachmentQuantity = Math.floor(input.attachmentQuantity);
  const usageHours = Math.floor(input.usageHours);
  const trafficGb = roundAmount(input.trafficGb);
  const quantity = Math.floor(input.quantity);

  const attachmentAmount = roundAmount(attachmentTier.ratePerHour * attachmentQuantity * usageHours * quantity);
  const trafficAmount = roundAmount((trafficTier?.ratePerGb ?? 0) * trafficGb * quantity);
  const amount = roundAmount(attachmentAmount + trafficAmount);
  const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));

  return {
    currency: catalog.currency,
    amount,
    suffix: `/${usageHours}h`,
    monthlyAverageAmount,
    attachmentQuantity,
    usageHours,
    trafficGb,
    quantity,
    attachmentTier,
    trafficTier,
    breakdown: [
      {
        label: `${quantity} x ${attachmentQuantity} attachment${attachmentQuantity === 1 ? "" : "s"} for ${usageHours}h`,
        amount: attachmentAmount,
      },
      ...(trafficGb > 0 && (trafficTier?.ratePerGb ?? 0) > 0
        ? [{
            label: `${quantity} x traffic ${trafficGb} GB`,
            amount: trafficAmount,
          }]
        : []),
    ],
    notes: [
      `Attachment rate: ${catalog.currency} ${attachmentTier.ratePerHour.toFixed(6)}/attachment/h.`,
      trafficTier?.ratePerGb != null
        ? `Traffic rate: ${catalog.currency} ${trafficTier.ratePerGb.toFixed(6)}/GB.`
        : "The live Huawei Enterprise Router catalog did not return a traffic rate for this region.",
    ],
  };
}
