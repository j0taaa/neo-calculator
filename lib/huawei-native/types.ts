export type HuaweiService = { id: string; name: string; category: string; available: boolean };
export type Snapshot = { hash: string; url: string; body: string; fetchedAt: string };
export type InquiryProduct = {
  id: string; cloudServiceType: string; resourceType: string; resourceSpecCode: string;
  productNum: number; resourceSize?: number; resouceSizeMeasureId?: number;
  usageFactor?: string; usageValue?: number; usageMeasureId?: number | string;
};
export type Inquiry = {
  regionId: string; chargingMode: number; periodType: number | null; periodNum: number | null;
  subscriptionNum: number; siteCode: string; availableZoneId?: string; productInfos: InquiryProduct[];
};
export type Quote = {
  amount: number; currency: string; quotedAt: string; releaseId: string; requestHash: string;
  source: "huawei-inquiry" | "huawei-catalog"; breakdown: { id: string; amount: number; label?: string }[];
  aggregation?: "huawei-renderer" | "neo-engine";
  payment?: { upfront: number; recurring: number; installments: number; period: "Month" | "Year"; extras: { mode: string; recurring: number }[] };
};
