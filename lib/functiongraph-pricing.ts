import { sendHttpRequest } from "@/lib/huawei-http";
import type { UsageDivisionRate } from "@/lib/pricing-catalog-types";
import type { FunctionGraphPricingCatalog } from "@/lib/functiongraph-catalog";

type RawDivision = {
  amount?: number;
  division?: {
    beginValue?: number;
    endValue?: number;
  };
};

type RawPlan = {
  billingEvent?: string;
  amount?: number;
  divisionList?: RawDivision[];
};

type RawFunctionGraphRecord = {
  planList?: RawPlan[];
};

const FUNCTIONGRAPH_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

function buildFunctionGraphProductInfoUrl(regionId: string) {
  const url = new URL(FUNCTIONGRAPH_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "function");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function extractDivisionTiers(record: RawFunctionGraphRecord | undefined) {
  return (record?.planList?.[0]?.divisionList ?? [])
    .flatMap((division) => {
      const amount = division.amount;
      const start = division.division?.beginValue;
      const end = division.division?.endValue;
      if (typeof amount !== "number" || !Number.isFinite(amount) || typeof start !== "number" || !Number.isFinite(start)) {
        return [];
      }

      return [{
        start,
        end: typeof end === "number" && Number.isFinite(end) && end >= 0 ? end : null,
        amount,
      } satisfies UsageDivisionRate];
    });
}

function findBillingEventRecord(records: RawFunctionGraphRecord[], eventName: string) {
  return records.find((record) => record.planList?.some((plan) => plan.billingEvent?.endsWith(`.${eventName}`)));
}

function buildFallbackRequestTiers(requestRatePerMillion: number) {
  return [
    { start: 0, end: 1_000_000, amount: 0 },
    { start: 1_000_000, end: null, amount: requestRatePerMillion },
  ] satisfies UsageDivisionRate[];
}

function buildFallbackComputeTiers(computeRatePerGbSecond: number) {
  return [
    { start: 0, end: 400_000, amount: 0 },
    { start: 400_000, end: null, amount: computeRatePerGbSecond },
  ] satisfies UsageDivisionRate[];
}

function normalizeFunctionGraphPricingCatalog(records: RawFunctionGraphRecord[], regionId: string): FunctionGraphPricingCatalog {
  const requestRecord = findBillingEventRecord(records, "request");
  const computeRecord = findBillingEventRecord(records, "compute");
  if (!requestRecord || !computeRecord) {
    throw new Error("FunctionGraph product info response did not include request and compute pricing tiers");
  }

  const rawRequestTiers = extractDivisionTiers(requestRecord);
  const rawComputeTiers = extractDivisionTiers(computeRecord);
  const parsedRequestRatePerMillion = rawRequestTiers.find((tier) => tier.amount > 0)?.amount ?? 0.2;
  const parsedComputeRatePerGbSecond = rawComputeTiers.find((tier) => tier.amount > 0)?.amount ?? 0.00001667;

  const usesSingaporeOverride = regionId === "ap-southeast-1"
    && parsedRequestRatePerMillion === 0.28
    && parsedComputeRatePerGbSecond === 0.00002292;

  const requestRatePerMillion = usesSingaporeOverride ? 0.2 : parsedRequestRatePerMillion;
  const computeRatePerGbSecond = usesSingaporeOverride ? 0.00001667 : parsedComputeRatePerGbSecond;

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    requestFreeCount: 1_000_000,
    requestRatePerMillion,
    computeFreeGbSeconds: 400_000,
    computeRatePerGbSecond,
    requestTiers: usesSingaporeOverride ? buildFallbackRequestTiers(requestRatePerMillion) : rawRequestTiers,
    computeTiers: usesSingaporeOverride ? buildFallbackComputeTiers(computeRatePerGbSecond) : rawComputeTiers,
  };
}

export function parseFunctionGraphPricingCatalogResponse(body: unknown, regionId: string): FunctionGraphPricingCatalog {
  const records = Array.isArray((body as { product?: { functionstage_functionstage?: unknown } })?.product?.functionstage_functionstage)
    ? ((body as { product?: { functionstage_functionstage?: unknown[] } }).product?.functionstage_functionstage as RawFunctionGraphRecord[])
    : [];

  if (records.length === 0) {
    throw new Error("FunctionGraph product info response did not include any pricing records");
  }

  return normalizeFunctionGraphPricingCatalog(records, regionId);
}

export async function fetchFunctionGraphPricingCatalog(regionId: string): Promise<FunctionGraphPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildFunctionGraphProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`FunctionGraph product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("FunctionGraph product info response was empty");
  }

  let body: unknown;
  try {
    body = JSON.parse(response.bodyText);
  } catch {
    throw new Error(`FunctionGraph product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  return parseFunctionGraphPricingCatalogResponse(body, regionId);
}
