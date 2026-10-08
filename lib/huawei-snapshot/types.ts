import type { NativeDirectory } from "../huawei-native/native-types";
import type { NativeBillingMode } from "../huawei-native/native-billing";

export type Plan = {
  productId?: string;
  skuCode?: string;
  siteCode?: string;
  billingMode: string;
  periodNum?: number;
  amount?: number;
  measureUnit?: number | null;
  measureUnitStep?: number | null;
  usageFactor?: string;
  usageMeasureId?: number;
  billingEvent?: string;
  divisionType?: string;
  condition?: string;
  feeInstallMode?: string;
  perAmount?: number;
  installPeriodType?: string;
  originType?: string;
  divisionList?: {
    amount: number;
    division: {
      beginValue: number;
      endValue: number;
      beginUnit?: number;
      endUnit?: number;
      measureUnitStep?: number;
    };
  }[];
};
export type CatalogProduct = {
  resourceSpecCode: string;
  resourceType: string;
  cloudServiceType: string;
  planList?: Plan[];
  RITime?: string;
  [key: string]: unknown;
};
export type ScopeSnapshot = {
  service: string;
  region: string;
  modes: NativeBillingMode[];
  locationModes?: Record<string, NativeBillingMode[]>;
  commonModes?: NativeBillingMode[];
  tag?: "general.online.portal" | "general.online.beta";
  config: string;
  products: {
    product: Record<string, CatalogProduct[]>;
    region: string;
    urlPath: string;
    [key: string]: unknown;
  };
  source: {
    page: string;
    config: string;
    products: string;
    framework: string;
    menu: string;
    fetchedAt: string;
  };
  customProof?: {
    product: Record<string, unknown>;
    months: number;
    amount: number;
  }[];
  customPricing?: { support: import("./custom-pricing").PriceStatement[] };
  ratingRuleVersion?: 1 | 2;
  ratingRules?: Record<
    string,
    {
      size: "multiply" | "ignore";
      multiplier: number;
      scale?: { numerator: number | string; denominator: number | string };
      rounding?: "floor" | "round" | "round7-floor6";
      recurring?: { hourly: number; monthly: number };
    }
  >;
  proof?: import("../huawei-native/native-pricing").NativeInquiryQuote[];
  verifiedAt: string;
  checks: number;
};
export type SnapshotRelease = {
  version: 1;
  id: string;
  createdAt: string;
  bridgeHash?: string;
  auditHash?: string;
  directory: NativeDirectory;
  menu: string;
  frameworkUrl: string;
  assets: Record<
    string,
    { hash: string; type: string; imports?: import("./imports").AssetImport[] }
  >;
  scopes: Record<string, string>;
  diagnostics: { service: string; region: string; error: string }[];
};
export const scopeKey = (service: string, region: string) =>
  `${service}/${region}`;
