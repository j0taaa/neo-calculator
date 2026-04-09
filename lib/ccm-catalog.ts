import { orderedSet, type RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type CcmUiBillingMode = "One-time";
export type CcmCertificateType = "OV" | "OV Pro" | "EV" | "EV Pro" | "DV" | "DV(Basic)";
export type CcmCertificateAuthority = "DigiCert" | "Globalsign" | "GeoTrust";
export type CcmDomainType = "Single domain" | "Multiple domains" | "Wildcard";

export interface CcmBaseTier {
  certificateType: CcmCertificateType;
  certificateAuthority: CcmCertificateAuthority;
  domainType: CcmDomainType;
  validityPeriodYears: number;
  resourceSpecCode: string;
  amount: number;
  productId: string | null;
}

export interface CcmAdditionalDomainTier {
  certificateType: CcmCertificateType;
  certificateAuthority: CcmCertificateAuthority;
  validityPeriodYears: number;
  resourceSpecCode: string;
  amount: number;
  productId: string | null;
}

export interface CcmPricingCatalog extends RegionalPricingCatalog {
  baseTiers: CcmBaseTier[];
  additionalDomainTiers: CcmAdditionalDomainTier[];
}

export interface CcmEstimateInput {
  certificateType: CcmCertificateType;
  certificateAuthority: CcmCertificateAuthority;
  domainType: CcmDomainType;
  validityPeriodYears: number;
  domainQuantity: number;
  quantity: number;
}

export interface CcmEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  domainQuantity: number;
  tier: CcmBaseTier;
  additionalDomainTier: CcmAdditionalDomainTier | null;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const ccmDefaults = {
  type: "SSL Certificates",
  certificateType: "OV" as CcmCertificateType,
  certificateAuthority: "DigiCert" as CcmCertificateAuthority,
  domainType: "Single domain" as CcmDomainType,
  validityPeriodYears: 1,
  domainQuantity: 2,
  quantity: 1,
} as const;

export const ccmPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/ccm",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/ccm.html",
} as const;

const certificateTypeOrder: CcmCertificateType[] = ["OV", "OV Pro", "EV", "EV Pro", "DV", "DV(Basic)"];
const certificateAuthorityOrder: CcmCertificateAuthority[] = ["DigiCert", "Globalsign", "GeoTrust"];
const domainTypeOrder: CcmDomainType[] = ["Single domain", "Multiple domains", "Wildcard"];
const validityOrder = [1, 2, 3] as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listCcmCertificateTypes(catalog: CcmPricingCatalog) {
  const values = new Set<CcmCertificateType>();
  for (const tier of catalog.baseTiers) {
    values.add(tier.certificateType);
  }
  return orderedSet(values, certificateTypeOrder);
}

export function listCcmAuthorities(catalog: CcmPricingCatalog, certificateType: CcmCertificateType) {
  const values = new Set<CcmCertificateAuthority>();
  for (const tier of catalog.baseTiers) {
    if (tier.certificateType === certificateType) {
      values.add(tier.certificateAuthority);
    }
  }
  return orderedSet(values, certificateAuthorityOrder);
}

export function listCcmDomainTypes(catalog: CcmPricingCatalog, input: { certificateType: CcmCertificateType; certificateAuthority: CcmCertificateAuthority }) {
  const values = new Set<CcmDomainType>();
  for (const tier of catalog.baseTiers) {
    if (tier.certificateType === input.certificateType && tier.certificateAuthority === input.certificateAuthority) {
      if (tier.domainType !== "Multiple domains") {
        values.add(tier.domainType);
        continue;
      }
      const additionalTier = catalog.additionalDomainTiers.find((entry) => (
        entry.certificateType === input.certificateType
        && entry.certificateAuthority === input.certificateAuthority
        && entry.validityPeriodYears === tier.validityPeriodYears
      ));
      if (additionalTier) {
        values.add("Multiple domains");
      }
    }
  }
  return orderedSet(values, domainTypeOrder);
}

export function listCcmValidityPeriods(catalog: CcmPricingCatalog, input: {
  certificateType: CcmCertificateType;
  certificateAuthority: CcmCertificateAuthority;
  domainType: CcmDomainType;
}) {
  const values = new Set<number>();
  for (const tier of catalog.baseTiers) {
    if (
      tier.certificateType === input.certificateType
      && tier.certificateAuthority === input.certificateAuthority
      && tier.domainType === input.domainType
    ) {
      if (input.domainType !== "Multiple domains") {
        values.add(tier.validityPeriodYears);
        continue;
      }
      const additionalTier = catalog.additionalDomainTiers.find((entry) => (
        entry.certificateType === input.certificateType
        && entry.certificateAuthority === input.certificateAuthority
        && entry.validityPeriodYears === tier.validityPeriodYears
      ));
      if (additionalTier) {
        values.add(tier.validityPeriodYears);
      }
    }
  }
  return orderedSet(values, validityOrder);
}

export function findCcmBaseTier(catalog: CcmPricingCatalog, input: {
  certificateType: CcmCertificateType;
  certificateAuthority: CcmCertificateAuthority;
  domainType: CcmDomainType;
  validityPeriodYears: number;
}) {
  return catalog.baseTiers.find((tier) => (
    tier.certificateType === input.certificateType
    && tier.certificateAuthority === input.certificateAuthority
    && tier.domainType === input.domainType
    && tier.validityPeriodYears === input.validityPeriodYears
  )) ?? null;
}

export function findCcmAdditionalDomainTier(catalog: CcmPricingCatalog, input: {
  certificateType: CcmCertificateType;
  certificateAuthority: CcmCertificateAuthority;
  validityPeriodYears: number;
}) {
  return catalog.additionalDomainTiers.find((tier) => (
    tier.certificateType === input.certificateType
    && tier.certificateAuthority === input.certificateAuthority
    && tier.validityPeriodYears === input.validityPeriodYears
  )) ?? null;
}

export function estimateCcmConfiguration(catalog: CcmPricingCatalog, input: CcmEstimateInput): CcmEstimate | null {
  const tier = findCcmBaseTier(catalog, input);
  if (!tier) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }

  const quantity = Math.floor(input.quantity);
  let domainQuantity = 1;
  let additionalDomainTier: CcmAdditionalDomainTier | null = null;
  let unitAmount = tier.amount;
  const notes = [
    "Pricing uses the direct Huawei Cloud Certificate & Manager certificate rates from the ccm calculator catalog.",
  ];

  if (input.domainType === "Multiple domains") {
    if (!Number.isFinite(input.domainQuantity) || input.domainQuantity < 2) {
      return null;
    }
    domainQuantity = Math.floor(input.domainQuantity);
    additionalDomainTier = findCcmAdditionalDomainTier(catalog, input);
    if (!additionalDomainTier) {
      return null;
    }
    unitAmount += additionalDomainTier.amount * (domainQuantity - 1);
    notes.push("Multiple-domain pricing includes the base primary-domain certificate plus the additional single-domain add-on for each extra domain.");
  }

  const amount = roundAmount(unitAmount * quantity);
  const domainLabel = input.domainType === "Multiple domains" ? `${domainQuantity} domains` : input.domainType;

  return {
    currency: catalog.currency,
    amount,
    suffix: "",
    monthlyAverageAmount: amount,
    quantity,
    domainQuantity,
    tier,
    additionalDomainTier,
    breakdown: [
      {
        label: `${quantity} x ${input.certificateAuthority} ${input.certificateType} ${domainLabel} ${input.validityPeriodYears} year${input.validityPeriodYears === 1 ? "" : "s"}`,
        amount,
      },
    ],
    notes,
  };
}
