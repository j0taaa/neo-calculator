export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Values = Record<string, string | number | boolean>;
export type SyncService = { id: string; name: string; category: string; available: boolean };
export type Snapshot = { hash: string; url: string; body: string; fetchedAt: string };
export type Field = {
  id: string; label: string; type: "select" | "number"; value: string | number;
  options?: { value: string; label: string }[]; min?: number; max?: number; step?: number;
  binding?: { component: string; key: string; measureId?: number };
};
export type FormInput = { region: string; values: Values; duration?: number; quantity?: number };
export type InquiryProduct = {
  id: string; cloudServiceType: string; resourceType: string; resourceSpecCode: string;
  productNum: number; resourceSize?: number; resouceSizeMeasureId?: number;
  usageFactor?: string; usageValue?: number; usageMeasureId?: number | string;
};
export type Inquiry = {
  regionId: string; chargingMode: number; periodType: number; periodNum: number;
  subscriptionNum: number; siteCode: string; productInfos: InquiryProduct[];
};
export type FormState = {
  fields: Field[]; values: Values; diagnostics: string[]; inquiry: Inquiry | null;
  duration: { value: number; measureId: number; min: number; max: number };
};
export type ServiceRelease = {
  id: string; service: SyncService; region: string; configHash: string; productsHash: string;
  menuHash: string; frameworkHash: string; engineVersion: string; createdAt: string;
  status: "candidate" | "active" | "quarantined" | "retired";
  diagnostics: string[]; verification: Verification | null;
};
export type Verification = { checkedAt: string; cases: number; source: "official-browser"; evidenceHash: string };
export type Quote = {
  amount: number; currency: string; quotedAt: string; releaseId: string; requestHash: string;
  source: "huawei-inquiry"; breakdown: { id: string; amount: number }[];
};
