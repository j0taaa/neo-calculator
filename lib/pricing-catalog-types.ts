export type StandardPricingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";

export interface RegionalPricingCatalog {
  currency: string;
  regionId: string;
}

export type PricingRateSet<TMode extends string = StandardPricingMode> = Partial<Record<TMode, number>>;

export type PricingProductIdSet<TMode extends string = StandardPricingMode> = Partial<Record<TMode, string>>;

export interface ResourcePricingTier<TMode extends string = StandardPricingMode> {
  resourceSpecCode: string;
  prices: PricingRateSet<TMode>;
}

export interface ResourcePricingTierWithProducts<TMode extends string = StandardPricingMode>
  extends ResourcePricingTier<TMode> {
  productIds: PricingProductIdSet<TMode>;
}

export interface BillingPeriodPlan<TMode extends string = StandardPricingMode> {
  billingMode: TMode;
  periodNum: number | null;
}

export interface AmountPlan<TMode extends string = StandardPricingMode> extends BillingPeriodPlan<TMode> {
  amount: number;
}

export interface UsageDivisionRate {
  start: number;
  end: number | null;
  amount: number;
}

export interface CapacityRateTier {
  upToGb: number | null;
  amountPerGb: number;
}
