import type { RegionalPricingCatalog, UsageDivisionRate } from "@/lib/pricing-catalog-types";

export type FunctionGraphRequestUnit = "month" | "day" | "hour";
export type FunctionGraphMemoryUnit = "MB" | "GB";

export interface FunctionGraphPricingCatalog extends RegionalPricingCatalog {
  requestFreeCount: number;
  requestRatePerMillion: number;
  computeFreeGbSeconds: number;
  computeRatePerGbSecond: number;
  requestTiers: UsageDivisionRate[];
  computeTiers: UsageDivisionRate[];
}

export interface FunctionGraphEstimateInput {
  averageRequestsAmount: number;
  averageRequestsUnit: FunctionGraphRequestUnit;
  executionDurationMs: number;
  memoryAmount: number;
  memoryUnit: FunctionGraphMemoryUnit;
}

export interface FunctionGraphEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface FunctionGraphEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  monthlyRequestCount: number;
  billableRequestCount: number;
  requestAmount: number;
  computeGbSeconds: number;
  billableComputeGbSeconds: number;
  computeAmount: number;
  memoryGiB: number;
  breakdown: FunctionGraphEstimateBreakdownItem[];
  notes: string[];
}

export const functionGraphRequestUnitOptions = ["month", "day", "hour"] as const satisfies readonly FunctionGraphRequestUnit[];
export const functionGraphMemoryUnitOptions = ["MB", "GB"] as const satisfies readonly FunctionGraphMemoryUnit[];

export const functionGraphDefaults = {
  averageRequestsAmount: 233,
  averageRequestsUnit: "month" as FunctionGraphRequestUnit,
  executionDurationMs: 100,
  memoryAmount: 128,
  memoryUnit: "MB" as FunctionGraphMemoryUnit,
} as const;

export const functionGraphPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/function",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/functiongraph.html",
} as const;

const DEFAULT_CURRENCY = "USD";
const DEFAULT_REGION = "ap-southeast-1";

const fallbackCatalog: FunctionGraphPricingCatalog = {
  currency: DEFAULT_CURRENCY,
  regionId: DEFAULT_REGION,
  requestFreeCount: 1_000_000,
  requestRatePerMillion: 0.2,
  computeFreeGbSeconds: 400_000,
  computeRatePerGbSecond: 0.00001667,
  requestTiers: [
    { start: 0, end: 1_000_000, amount: 0 },
    { start: 1_000_000, end: null, amount: 0.2 },
  ],
  computeTiers: [
    { start: 0, end: 400_000, amount: 0 },
    { start: 400_000, end: null, amount: 0.00001667 },
  ],
};

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function normalizeMonthlyRequestMultiplier(unit: FunctionGraphRequestUnit) {
  if (unit === "day") {
    return 30;
  }

  if (unit === "hour") {
    return 24 * 30;
  }

  return 1;
}

export function isFunctionGraphRequestUnit(value: unknown): value is FunctionGraphRequestUnit {
  return typeof value === "string" && functionGraphRequestUnitOptions.includes(value as FunctionGraphRequestUnit);
}

export function isFunctionGraphMemoryUnit(value: unknown): value is FunctionGraphMemoryUnit {
  return typeof value === "string" && functionGraphMemoryUnitOptions.includes(value as FunctionGraphMemoryUnit);
}

export function convertFunctionGraphMemoryToGiB(amount: number, unit: FunctionGraphMemoryUnit) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return unit === "GB" ? 1 : 128 / 1024;
  }

  return unit === "GB" ? amount : amount / 1024;
}

export function getFallbackFunctionGraphPricingCatalog() {
  return fallbackCatalog;
}

export function estimateFunctionGraphConfiguration(
  catalog: FunctionGraphPricingCatalog = fallbackCatalog,
  input: FunctionGraphEstimateInput,
): FunctionGraphEstimate | null {
  if (!isFunctionGraphRequestUnit(input.averageRequestsUnit) || !isFunctionGraphMemoryUnit(input.memoryUnit)) {
    return null;
  }

  const averageRequestsAmount = Number.isFinite(input.averageRequestsAmount) ? Math.max(0, Math.floor(input.averageRequestsAmount)) : 0;
  const executionDurationMs = Number.isFinite(input.executionDurationMs) ? Math.max(1, Math.floor(input.executionDurationMs)) : 1;
  const memoryAmount = Number.isFinite(input.memoryAmount)
    ? Math.max(input.memoryUnit === "GB" ? 1 : 128, Math.floor(input.memoryAmount))
    : input.memoryUnit === "GB"
      ? 1
      : 128;
  const memoryGiB = convertFunctionGraphMemoryToGiB(memoryAmount, input.memoryUnit);
  const monthlyRequestCount = averageRequestsAmount * 10_000 * normalizeMonthlyRequestMultiplier(input.averageRequestsUnit);
  const billableRequestCount = Math.max(0, monthlyRequestCount - catalog.requestFreeCount);
  const requestAmount = (billableRequestCount / 1_000_000) * catalog.requestRatePerMillion;
  const computeGbSeconds = monthlyRequestCount * (executionDurationMs / 1000) * memoryGiB;
  const billableComputeGbSeconds = Math.max(0, computeGbSeconds - catalog.computeFreeGbSeconds);
  const computeAmount = billableComputeGbSeconds * catalog.computeRatePerGbSecond;
  const amount = roundAmount(requestAmount + computeAmount);
  const breakdown = [
    { label: "Requests", amount: roundAmount(requestAmount) },
    { label: "Execution duration", amount: roundAmount(computeAmount) },
  ];
  const notes = [
    `Includes the monthly free tier: first ${catalog.requestFreeCount.toLocaleString()} requests and ${catalog.computeFreeGbSeconds.toLocaleString()} GB-seconds are free.`,
    input.averageRequestsUnit === "month"
      ? "Average requests are billed directly as a monthly total."
      : `Average requests per ${input.averageRequestsUnit} are projected to a 30-day month.`,
  ];

  return {
    currency: catalog.currency,
    amount,
    suffix: "/mo",
    monthlyAverageAmount: amount,
    monthlyRequestCount,
    billableRequestCount,
    requestAmount: roundAmount(requestAmount),
    computeGbSeconds: roundAmount(computeGbSeconds),
    billableComputeGbSeconds: roundAmount(billableComputeGbSeconds),
    computeAmount: roundAmount(computeAmount),
    memoryGiB: roundAmount(memoryGiB),
    breakdown,
    notes,
  };
}
