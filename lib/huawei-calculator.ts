import { db } from "@/lib/db";
import { systemDiskCodeMap, type SystemDiskOption } from "@/lib/evs-disk-pricing";
import { ensureRegionCatalogAvailable } from "@/lib/ecs-flavor-catalog";
import { sampleEcsCartItem } from "@/lib/huawei-calculator-template";
import { getCatalogRegionId, getRegionKeyFromCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

const HUAWEI_REFERER = "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html?tempShareList=true";
const HUAWEI_LIST_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/share/list";
const HUAWEI_ADD_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/share/add";
const HUAWEI_DETAIL_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/share/detail";
const HUAWEI_UPDATE_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/share/update";
const HUAWEI_ECS_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_ECS_SERVICE_NAME = "Elastic Cloud Server";
const DEFAULT_ECS_SERVICE_CODE = "ECS";
const DEFAULT_EVS_SERVICE_NAME = "Elastic Volume Service";
const DEFAULT_EVS_SERVICE_CODE = "EVS";
const DEFAULT_HUAWEI_SERVICE_NAME = "Huawei Cloud Product";
const DEFAULT_HUAWEI_SERVICE_CODE = "HWC";
const RI_YEARLY_HOURS = 8760;
const RI_MONTHLY_HOURS = 730;
const RI_INSTALLMENTS = 12;
const RI_INSTALL_PERIOD_TYPE = 2;
const RI_PAYMENT_TYPE = "nodeData.NO_UPFRONT";
const RI_PAYMENT_TYPE_KEY = "NO_UPFRONT";
const RI_TIME_TOKEN = "nodeData.1_3";
const RI_TYPE = "nodeData.STANDARD";
const HUAWEI_HOUR_USAGE_MEASURE_ID = 4;
const LOCAL_BILLING_OPTIONS = ["Pay-per-use", "Yearly/Monthly", "RI"] as const;
const CATALOG_PRICING_MODES = ["ONDEMAND", "MONTHLY", "YEARLY", "RI"] as const;

const catalogBodyCache = new Map<string, { expiresAt: number; body: unknown }>();

type CatalogPricingMode = (typeof CATALOG_PRICING_MODES)[number];
type LocalBillingOption = (typeof LOCAL_BILLING_OPTIONS)[number];

type CatalogPlan = {
  productId?: string;
  billingMode?: string;
  originType?: string;
  amountType?: string;
  siteCode?: string;
  periodNum?: number | null;
  billingEvent?: string;
  measureUnitStep?: number | null;
  measureUnit?: number | null;
  usageFactor?: string;
  usageMeasureId?: number;
  amount?: number;
  source?: string;
  planId?: string;
  skuCode?: string;
  paymentType?: string;
  paymentTypeKey?: string;
  [key: string]: unknown;
};

type ProductFlavor = {
  resourceSpecCode: string;
  resourceType?: string;
  cloudServiceType?: string;
  productSpecSysDesc?: string;
  resourceSpecType?: string;
  mem?: string;
  cpu?: string;
  instanceArch?: string;
  performType?: string;
  series?: string;
  image?: string;
  spec?: string;
  arch?: string;
  generation?: string;
  vmType?: string;
  physical?: string;
  generationType?: string;
  imageSpec?: string;
  riResourceSepc?: string;
  productId?: string;
  billingMode?: string;
  siteCode?: string;
  periodNum?: number | null;
  billingEvent?: string;
  measureUnitStep?: number;
  measureUnit?: number;
  usageFactor?: string;
  usageMeasureId?: number;
  amount?: number;
  productNum?: number;
  inquiryTag?: string;
  selfProductNum?: number;
  transRate?: string;
  transTarget?: string;
  usageValue?: number;
  usageMeasureName?: string;
  usageMeasurePluralName?: string;
  addToList_product?: string;
  addToList_title?: string;
  type?: string;
  localDisk?: string;
  acceleratorCard?: string;
  planList?: CatalogPlan[];
  bakPlanList?: CatalogPlan[];
  inquiryResult?: {
    id?: string;
    productId?: string;
    amount?: number;
    discountAmount?: number;
    originalAmount?: number;
    perAmount?: number | null;
    perDiscountAmount?: number | null;
    perOriginalAmount?: number | null;
    perPeriodType?: number | null;
    measureId?: number;
    extendParams?: unknown;
  };
  [key: string]: unknown;
};

type ProductDisk = {
  resourceSpecCode: string;
  resourceSpecType?: string;
  resourceType?: string;
  cloudServiceType?: string;
  productSpecSysDesc?: string;
  volumeType?: string;
  billingMode?: string;
  siteCode?: string;
  periodNum?: number | null;
  billingEvent?: string;
  amount?: number;
  productId?: string;
  type?: string;
  billingItem?: string;
  info?: string;
  specifications?: string;
  tableUnit?: string;
  resourceMeasureName?: string;
  resourceMeasurePluralName?: string;
  addToList_title?: string;
  addToList_product?: string;
  selfProductNum?: number;
  inquiryTag?: string;
  resourceSize?: number;
  usageValue?: number;
  usageMeasureId?: number;
  measureUnitStep?: number | null;
  measureUnit?: number | null;
  usageFactor?: string;
  periodList?: number;
  _skuInfo?: string[];
  planList?: CatalogPlan[];
  bakPlanList?: CatalogPlan[];
  inquiryResult?: {
    id?: string;
    productId?: string;
    amount?: number;
    discountAmount?: number;
    originalAmount?: number;
    perAmount?: number | null;
    perDiscountAmount?: number | null;
    perOriginalAmount?: number | null;
    perPeriodType?: number | null;
    measureId?: number;
    extendParams?: unknown;
  };
  [key: string]: unknown;
};

type PriceResponseBody = {
  amount: number;
  discountAmount: number;
  originalAmount: number;
  currency?: string;
  productRatingResult?: Array<{
    id?: string;
    productId?: string;
    amount?: number;
    discountAmount?: number;
    originalAmount?: number;
  }>;
};

type CalculatorCartItemPayload = {
  buyUrl?: string;
  rewriteValue?: Record<string, unknown>;
  selectedProduct?: Record<string, unknown>;
};

type ShareCartDetail = {
  billingMode?: string;
  cartListData?: CalculatorCartItemPayload[];
  name?: string;
  totalPrice?: {
    amount?: number;
    originalAmount?: number;
    discountAmount?: number;
  };
};

type ShareCartSummary = {
  key?: string;
  name?: string;
  updateTime?: number;
  billingMode?: string;
  totalPrice?: {
    amount?: number;
    originalAmount?: number;
    discountAmount?: number;
  };
};

type RemoteService = "ecs" | "evs" | "other";

type RemoteCartItem = {
  service: RemoteService;
  title: string;
  description: string;
  region: string;
  quantity: number;
  hours: number;
  pricingMode: CatalogPricingMode;
  diskType: string;
  diskSize: number;
  resourceCode: string;
  vcpus: number;
  ramGb: number;
  amount: number;
  originalAmount: number;
  payload: CalculatorCartItemPayload;
  serviceCode: string;
  serviceName: string;
};

type LocalProductInput = {
  id?: string;
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
};

type LocalEcsConfig = {
  region?: unknown;
  billingMode?: unknown;
  usageHours?: unknown;
  description?: unknown;
  flavor?: unknown;
  vcpu?: unknown;
  ramGiB?: unknown;
  systemDisk?: unknown;
  huaweiPayload?: unknown;
};

type LocalRawConfig = {
  huaweiPayload?: unknown;
};

type SelectedRiPlanGroup = {
  plans: CatalogPlan[];
  price: number;
  perEffectivePrice: number | null;
  perPrice: number;
  productId?: string;
  skuCode?: string;
  planId?: string;
  paymentType: string;
  paymentTypeKey: string;
  siteCode?: string;
};

export type HuaweiRemoteCartSummary = {
  key: string;
  name: string;
  updateTime: number;
  billingMode: string | null;
  totalAmount: number | null;
  originalAmount: number | null;
};

export type HuaweiAssociationMetadata = {
  huaweiCartKey: string | null;
  huaweiCartName: string | null;
  huaweiLastSyncedAt: string | null;
  huaweiLastError: string | null;
  huaweiLastRemoteUpdatedAt: number | null;
};

export class HuaweiSessionError extends Error {
  code?: string;
  authMessage?: string;

  constructor(message: string, options?: { code?: string; authMessage?: string }) {
    super(message);
    this.name = "HuaweiSessionError";
    this.code = options?.code;
    this.authMessage = options?.authMessage;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCatalogPricingMode(value: unknown): value is CatalogPricingMode {
  return typeof value === "string" && CATALOG_PRICING_MODES.includes(value as CatalogPricingMode);
}

function isLocalBillingOption(value: unknown): value is LocalBillingOption {
  return typeof value === "string" && LOCAL_BILLING_OPTIONS.includes(value as LocalBillingOption);
}

function extractCookieValue(cookie: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function normalizeHuaweiCookie(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  if (!trimmed.includes("=") && !trimmed.includes(";")) {
    return `HWS_INTL_ID=${trimmed}`;
  }

  if (trimmed.startsWith("HWS_INTL_ID=") && !trimmed.includes(";")) {
    return trimmed;
  }

  return trimmed;
}

function resolveHuaweiAuth(cookieInput: string) {
  const cookie = normalizeHuaweiCookie(cookieInput);
  if (!cookie) {
    throw new Error("Huawei Cloud cookie is required.");
  }

  return {
    cookie,
    csrf: extractCookieValue(cookie, "csrf") || undefined,
  };
}

function extractAuthCode(body: unknown): string {
  if (!isRecord(body)) {
    return "";
  }

  const exceptionId = body.exceptionId;
  if (typeof exceptionId === "string" && exceptionId.trim()) {
    return exceptionId.trim();
  }

  const retCode = body.retCode;
  if (typeof retCode === "string" && retCode.trim()) {
    return retCode.trim();
  }

  return "";
}

function extractAuthMessage(body: unknown): string {
  if (!isRecord(body)) {
    return "";
  }

  const descArgs = body.descArgs;
  if (Array.isArray(descArgs)) {
    const firstText = descArgs.find((value) => typeof value === "string" && value.trim());
    if (typeof firstText === "string") {
      return firstText.trim();
    }
  }

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }

  if (typeof body.retDesc === "string" && body.retDesc.trim()) {
    return body.retDesc.trim();
  }

  if (typeof body.retMsg === "string" && body.retMsg.trim()) {
    return body.retMsg.trim();
  }

  return "";
}

function detectHuaweiAuthIssue(status: number, body: unknown) {
  const code = extractAuthCode(body);
  const rawMessage = extractAuthMessage(body);
  const normalizedMessage = rawMessage.toLowerCase();
  const looksExpired = (
    code === "CBC.0101"
    || code === "401"
    || status === 401
    || status === 403
    || normalizedMessage.includes("user invalid")
    || normalizedMessage.includes("session")
    || normalizedMessage.includes("login")
    || normalizedMessage.includes("expired")
    || normalizedMessage.includes("unauthorized")
    || normalizedMessage.includes("invalid token")
  );

  if (!looksExpired) {
    return null;
  }

  return {
    code: code || String(status),
    message: rawMessage || "Huawei session expired or is no longer valid",
  };
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (contentType.includes("application/json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

function buildHuaweiHeaders(auth: { cookie: string; csrf?: string }, json = false): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json, text/plain, */*",
    Cookie: auth.cookie,
    Referer: HUAWEI_REFERER,
    Origin: "https://www.huaweicloud.com",
  };

  if (auth.csrf) {
    headers.csrf = auth.csrf;
  }

  if (json) {
    headers["content-type"] = "application/json";
  }

  return headers;
}

async function huaweiJsonRequest(url: string, init: RequestInit, auth: { cookie: string; csrf?: string }) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...buildHuaweiHeaders(auth, init.method === "POST"),
      ...(init.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(30_000),
  });

  const body = await readResponseBody(response);
  const authIssue = detectHuaweiAuthIssue(response.status, body);
  if (authIssue) {
    throw new HuaweiSessionError("Huawei session expired. Save a fresh Huawei Cloud cookie and try again.", {
      code: authIssue.code,
      authMessage: authIssue.message,
    });
  }

  if (!response.ok) {
    throw new Error(`Huawei calculator request failed: ${response.status} ${response.statusText}`);
  }

  return body;
}

function buildDetailUrl(key: string) {
  const url = new URL(HUAWEI_DETAIL_URL);
  url.searchParams.set("key", key.trim());
  url.searchParams.set("language", "en-us");
  return url.toString();
}

function buildUpdateUrl(key: string) {
  const url = new URL(HUAWEI_UPDATE_URL);
  url.searchParams.set("key", key.trim());
  return url.toString();
}

function buildEcsProductInfoUrl(regionId: string) {
  const url = new URL(HUAWEI_ECS_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "ecs");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "detail");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function pickPresentString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extractLocalEcsDescription(product: LocalProductInput, flavorDescription = "") {
  if (isRecord(product.config)) {
    const config = product.config as LocalEcsConfig & { huaweiPayload?: unknown };
    const description = pickPresentString(
      config.description,
      isRecord(config.huaweiPayload) && isRecord(config.huaweiPayload.selectedProduct)
        ? config.huaweiPayload.selectedProduct.description
        : "",
      isRecord(config.huaweiPayload) && isRecord(config.huaweiPayload.rewriteValue)
        ? config.huaweiPayload.rewriteValue.global_DESCRIPTION
        : "",
    );
    if (description) {
      return description;
    }
  }

  return pickPresentString(flavorDescription, product.serviceName, DEFAULT_ECS_SERVICE_NAME);
}

function roundMoney(value: number) {
  return Number(value.toFixed(5));
}

function getCatalogPlans(item: { planList?: CatalogPlan[]; bakPlanList?: CatalogPlan[] }) {
  return [...(item.planList ?? []), ...(item.bakPlanList ?? [])];
}

function getNativeCatalogPlans(item: { planList?: CatalogPlan[]; bakPlanList?: CatalogPlan[] }) {
  return getCatalogPlans(item).filter((plan) => plan.source !== "price_api");
}

function getLowestPlanAmount(plans: CatalogPlan[]) {
  const amounts = plans
    .map((plan) => plan.amount)
    .filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount));

  return amounts.length ? Math.min(...amounts) : Number.POSITIVE_INFINITY;
}

function getHighestPlanAmount(plans: CatalogPlan[]) {
  const amounts = plans
    .map((plan) => plan.amount)
    .filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount));

  return amounts.length ? Math.max(...amounts) : Number.NEGATIVE_INFINITY;
}

function isRiPurchasePricePlan(plan: CatalogPlan) {
  return plan.originType === "perPrice" || plan.amountType === "nodeData.perPrice";
}

function getPreferredRiPrice(plans: CatalogPlan[]) {
  const purchasePrice = getLowestPlanAmount(plans.filter((plan) => isRiPurchasePricePlan(plan)));
  if (Number.isFinite(purchasePrice)) {
    return purchasePrice;
  }

  return getLowestPlanAmount(
    plans.filter((plan) => (
      (plan.originType === "price" || plan.amountType === "nodeData.price")
      && typeof plan.amount === "number"
      && Number.isFinite(plan.amount)
      && plan.amount > 0
    )),
  );
}

function getItemBasePrice(item: { amount?: number; inquiryResult?: { amount?: number; perAmount?: number | null }; planList?: CatalogPlan[]; bakPlanList?: CatalogPlan[] }, pricingMode: CatalogPricingMode) {
  const matchingPlans = getCatalogPlans(item).filter((plan) => plan.billingMode === pricingMode && typeof plan.amount === "number");

  if (pricingMode === "RI") {
    const nativeRiPlans = getNativeCatalogPlans(item).filter((plan) => plan.billingMode === "RI" && typeof plan.amount === "number");
    const oneYearRiPlans = nativeRiPlans.filter((plan) => plan.periodNum === 1);
    const oneYearRiPrice = getPreferredRiPrice(oneYearRiPlans);
    if (Number.isFinite(oneYearRiPrice)) {
      return oneYearRiPrice * 12;
    }

    const nativeUntypedRiPurchasePlans = nativeRiPlans.filter((plan) => (
      (plan.periodNum === undefined || plan.periodNum === null)
      && isRiPurchasePricePlan(plan)
    ));
    if (nativeUntypedRiPurchasePlans.length >= 2) {
      const inferredOneYearRiPrice = getHighestPlanAmount(nativeUntypedRiPurchasePlans);
      if (Number.isFinite(inferredOneYearRiPrice)) {
        return inferredOneYearRiPrice * 12;
      }
    }

    const singleNativeRiPurchasePrice = getPreferredRiPrice(nativeUntypedRiPurchasePlans);
    if (Number.isFinite(singleNativeRiPurchasePrice)) {
      return singleNativeRiPurchasePrice * 12;
    }
  } else {
    const matchedPrice = getLowestPlanAmount(matchingPlans);
    if (Number.isFinite(matchedPrice)) {
      return matchedPrice;
    }
  }

  if (pricingMode === "ONDEMAND" && typeof item.amount === "number") {
    return item.amount;
  }

  if (pricingMode === "ONDEMAND" && typeof item.inquiryResult?.perAmount === "number") {
    return item.inquiryResult.perAmount;
  }

  if (pricingMode === "ONDEMAND" && typeof item.inquiryResult?.amount === "number") {
    return item.inquiryResult.amount;
  }

  return Number.POSITIVE_INFINITY;
}

function getFlavorCpuCount(flavor: ProductFlavor) {
  const sysDesc = flavor.productSpecSysDesc ?? "";
  const sysMatch = sysDesc.match(/vCPUs:(\d+)CORE/i);
  if (sysMatch) {
    return Number.parseInt(sysMatch[1], 10);
  }

  const cpuText = flavor.cpu ?? "";
  const cpuMatch = cpuText.match(/(\d+)/);
  if (cpuMatch) {
    return Number.parseInt(cpuMatch[1], 10);
  }

  const resourceMatch = flavor.resourceSpecCode.match(/(?:^|\.)(\d+)u\./i);
  return resourceMatch ? Number.parseInt(resourceMatch[1], 10) : 0;
}

function getFlavorMemoryGb(flavor: ProductFlavor) {
  const sysDesc = flavor.productSpecSysDesc ?? "";
  const mbMatch = sysDesc.match(/Memory:(\d+)MB/i);
  if (mbMatch) {
    return Number.parseInt(mbMatch[1], 10) / 1024;
  }

  const memText = flavor.mem ?? "";
  const memMatch = memText.match(/(\d+(?:\.\d+)?)/);
  if (memMatch) {
    return Number.parseFloat(memMatch[1]);
  }

  const resourceMatch = flavor.resourceSpecCode.match(/(?:^|\.)(\d+)u\.(\d+(?:\.\d+)?)g/i);
  return resourceMatch ? Number.parseFloat(resourceMatch[2]) : 0;
}

function getEffectiveDiskPricingMode(pricingMode: CatalogPricingMode): CatalogPricingMode {
  return pricingMode === "RI" ? "ONDEMAND" : pricingMode;
}

const DISK_TYPE_LABELS = {
  SATA: "Common I/O",
  SAS: "High I/O",
  SSD: "Ultra-high I/O",
  ESSD: "Extreme SSD",
  GPSSD: "General Purpose SSD",
  "GPSSD2.storage": "General Purpose SSD V2",
} as const;

const DISK_TYPE_ALIASES: Record<string, string> = {
  commonio: "SATA",
  highio: "SAS",
  ultrahighio: "SSD",
  extremessd: "ESSD",
  generalpurposessd: "GPSSD",
  generalpurposessdv2: "GPSSD2.storage",
  gpssd2: "GPSSD2.storage",
};

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeDiskTypeApiCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const directMap = Object.entries(systemDiskCodeMap).find(([, code]) => code === trimmed);
  if (directMap) {
    return trimmed;
  }

  const option = (Object.keys(systemDiskCodeMap) as SystemDiskOption[])
    .find((candidate) => normalizeLookupKey(candidate) === normalizeLookupKey(trimmed));
  if (option) {
    return systemDiskCodeMap[option];
  }

  return DISK_TYPE_ALIASES[normalizeLookupKey(trimmed)] ?? trimmed;
}

export function getDiskTypeDisplayName(value: string) {
  const normalized = normalizeDiskTypeApiCode(value);
  return DISK_TYPE_LABELS[normalized as keyof typeof DISK_TYPE_LABELS] ?? value.trim();
}

function getCatalogDisks(body: unknown) {
  const disks = isRecord(body) && isRecord(body.product) && Array.isArray(body.product.ebs_volume)
    ? (body.product.ebs_volume as ProductDisk[])
    : [];

  const unique = new Map<string, ProductDisk>();
  for (const disk of disks) {
    const code = pickPresentString(disk.resourceSpecCode);
    if (!code) {
      continue;
    }

    const current = unique.get(code);
    if (!current) {
      unique.set(code, disk);
      continue;
    }

    const currentPlanCount = (current.planList?.length ?? 0) + (current.bakPlanList?.length ?? 0);
    const nextPlanCount = (disk.planList?.length ?? 0) + (disk.bakPlanList?.length ?? 0);
    if (nextPlanCount >= currentPlanCount) {
      unique.set(code, disk);
    }
  }

  return [...unique.values()];
}

function formatPriceSummary(mode: CatalogPricingMode, amount: number, hours: number) {
  const base = `USD ${amount.toFixed(amount < 1 ? 4 : 2)}`;
  switch (mode) {
    case "MONTHLY":
      return `${base}/mo`;
    case "YEARLY":
      return `${base}/yr`;
    case "RI":
      return base;
    default:
      return `${base}/${hours}h`;
  }
}

function getStoredPricingMode(item: CalculatorCartItemPayload): CatalogPricingMode {
  const selectedProduct = isRecord(item.selectedProduct) ? item.selectedProduct : {};
  const rewriteValue = isRecord(item.rewriteValue) ? item.rewriteValue : {};
  const globalRegionInfo = isRecord(rewriteValue.global_REGIONINFO) ? rewriteValue.global_REGIONINFO : {};
  const candidate = pickPresentString(
    selectedProduct.calculatorPricingMode,
    selectedProduct.chargeMode,
    rewriteValue.global_PRICINGMODE,
    globalRegionInfo.chargeMode,
  );

  return isCatalogPricingMode(candidate) ? candidate : "ONDEMAND";
}

function getStoredService(item: CalculatorCartItemPayload): RemoteService {
  const selectedProduct = isRecord(item.selectedProduct) ? item.selectedProduct : {};
  const serviceCode = pickPresentString(selectedProduct.serviceCode).toLowerCase();
  if (serviceCode === "evs") {
    return "evs";
  }

  if (serviceCode === "ecs") {
    return "ecs";
  }

  const productInfos = Array.isArray(selectedProduct.productAllInfos) ? selectedProduct.productAllInfos : [];
  const hasVm = productInfos.some((info) => isRecord(info) && typeof info.resourceType === "string" && info.resourceType.includes(".vm"));
  const hasOnlyDisk = productInfos.length === 1 && productInfos.every((info) => isRecord(info) && typeof info.resourceType === "string" && info.resourceType.includes(".volume"));
  if (hasOnlyDisk && !hasVm) {
    return "evs";
  }

  return hasVm ? "ecs" : "other";
}

function getRemoteCartItems(detail: ShareCartDetail) {
  if (!Array.isArray(detail.cartListData)) {
    return [] as RemoteCartItem[];
  }

  return detail.cartListData.map((item) => {
    const selectedProduct = isRecord(item.selectedProduct) ? item.selectedProduct : {};
    const service = getStoredService(item);
    const productInfos = Array.isArray(selectedProduct.productAllInfos) ? selectedProduct.productAllInfos : [];
    const vmInfo = (productInfos.find((info) => isRecord(info) && typeof info.resourceType === "string" && info.resourceType.includes(".vm")) ?? productInfos[0] ?? {}) as Record<string, unknown>;
    const diskInfo = (productInfos.find((info) => isRecord(info) && typeof info.resourceType === "string" && info.resourceType.includes(".volume")) ?? productInfos[2] ?? productInfos[0] ?? {}) as Record<string, unknown>;
    const pricingMode = getStoredPricingMode(item);
    const quantity = typeof (selectedProduct.purchaseNum as { measureValue?: unknown } | undefined)?.measureValue === "number"
      ? ((selectedProduct.purchaseNum as { measureValue: number }).measureValue)
      : (typeof vmInfo.productNum === "number" ? vmInfo.productNum : 1);
    const hours = typeof (selectedProduct.purchaseTime as { measureValue?: unknown } | undefined)?.measureValue === "number"
      ? ((selectedProduct.purchaseTime as { measureValue: number }).measureValue)
      : (typeof vmInfo.usageValue === "number" ? vmInfo.usageValue : 744);
    const diskType = normalizeDiskTypeApiCode(pickPresentString(diskInfo.resourceSpecCode));
    const amount = typeof selectedProduct.amount === "number" ? selectedProduct.amount : 0;
    const originalAmount = typeof selectedProduct.originalAmount === "number" ? selectedProduct.originalAmount : amount;
    const description = pickPresentString(
      selectedProduct.description,
      isRecord(item.rewriteValue) ? item.rewriteValue.global_DESCRIPTION : "",
      selectedProduct._customTitle,
      service === "ecs" ? DEFAULT_ECS_SERVICE_NAME : service === "evs" ? DEFAULT_EVS_SERVICE_NAME : DEFAULT_HUAWEI_SERVICE_NAME,
    );

    let serviceCode = DEFAULT_HUAWEI_SERVICE_CODE;
    let serviceName = DEFAULT_HUAWEI_SERVICE_NAME;
    if (service === "ecs") {
      serviceCode = DEFAULT_ECS_SERVICE_CODE;
      serviceName = DEFAULT_ECS_SERVICE_NAME;
    } else if (service === "evs") {
      serviceCode = DEFAULT_EVS_SERVICE_CODE;
      serviceName = DEFAULT_EVS_SERVICE_NAME;
    }

    return {
      service,
      title: pickPresentString(selectedProduct._customTitle, description, serviceName),
      description,
      region: pickPresentString(selectedProduct.region),
      quantity: Math.max(1, quantity),
      hours: Math.max(1, hours),
      pricingMode,
      diskType,
      diskSize: typeof diskInfo.resourceSize === "number" ? diskInfo.resourceSize : 0,
      resourceCode: service === "ecs" ? pickPresentString(vmInfo.resourceSpecCode) : pickPresentString(diskInfo.resourceSpecCode),
      vcpus: service === "ecs" ? getFlavorCpuCount(vmInfo as ProductFlavor) : 0,
      ramGb: service === "ecs" ? getFlavorMemoryGb(vmInfo as ProductFlavor) : 0,
      amount,
      originalAmount,
      payload: cloneJson(item),
      serviceCode,
      serviceName,
    };
  });
}

function buildCartTotalPrice(items: CalculatorCartItemPayload[]) {
  const amount = items.reduce((sum, item) => {
    const selectedProduct = isRecord(item.selectedProduct) ? item.selectedProduct : {};
    return sum + (typeof selectedProduct.amount === "number" ? selectedProduct.amount : 0);
  }, 0);

  const originalAmount = items.reduce((sum, item) => {
    const selectedProduct = isRecord(item.selectedProduct) ? item.selectedProduct : {};
    return sum + (typeof selectedProduct.originalAmount === "number" ? selectedProduct.originalAmount : (typeof selectedProduct.amount === "number" ? selectedProduct.amount : 0));
  }, 0);

  return {
    amount: roundMoney(amount),
    discountAmount: 0,
    originalAmount: roundMoney(originalAmount),
  };
}

function getFlavorDisplaySpec(flavor: ProductFlavor) {
  if (typeof flavor.spec === "string" && flavor.spec.trim()) {
    return flavor.spec.trim();
  }

  return flavor.resourceSpecCode.replace(/\.(linux|byol)$/i, "");
}

function getFlavorFamily(flavor: ProductFlavor) {
  const familySource = [pickPresentString(flavor.spec), pickPresentString(flavor.riResourceSepc), pickPresentString(flavor.resourceSpecCode)]
    .find(Boolean);
  const match = familySource?.match(/^([^.]+)/);
  return match?.[1]?.trim() ?? "";
}

function getRiPlanGroupKey(plan: CatalogPlan) {
  return JSON.stringify([
    typeof plan.productId === "string" ? plan.productId : "",
    typeof plan.skuCode === "string" ? plan.skuCode : "",
    typeof plan.planId === "string" ? plan.planId : "",
    typeof plan.paymentTypeKey === "string" ? plan.paymentTypeKey : "",
    typeof plan.paymentType === "string" ? plan.paymentType : "",
  ]);
}

function getRiPlanAmount(group: CatalogPlan[], originType: string) {
  const plan = group.find((entry) => entry.originType === originType && typeof entry.amount === "number" && Number.isFinite(entry.amount));
  return typeof plan?.amount === "number" ? plan.amount : null;
}

function sortRiPlans(plans: CatalogPlan[]) {
  const order = new Map<string, number>([
    ["price", 0],
    ["perEffectivePrice", 1],
    ["perPrice", 2],
  ]);

  return [...plans].sort((left, right) => (
    (order.get(typeof left.originType === "string" ? left.originType : "") ?? 99)
    - (order.get(typeof right.originType === "string" ? right.originType : "") ?? 99)
  ));
}

function getSelectedFlavorRiPlanGroup(flavor: ProductFlavor): SelectedRiPlanGroup | null {
  const nativeRiPlans = [...(flavor.planList ?? []), ...(flavor.bakPlanList ?? [])].filter((plan) => (
    plan.billingMode === "RI"
    && plan.source !== "price_api"
    && typeof plan.amount === "number"
    && Number.isFinite(plan.amount)
  ));

  if (!nativeRiPlans.length) {
    return null;
  }

  const groupedPlans = new Map<string, CatalogPlan[]>();
  for (const plan of nativeRiPlans) {
    const key = getRiPlanGroupKey(plan);
    const current = groupedPlans.get(key) ?? [];
    current.push(plan);
    groupedPlans.set(key, current);
  }

  const groups = [...groupedPlans.values()]
    .map((plans) => {
      const perPrice = getRiPlanAmount(plans, "perPrice");
      if (perPrice === null) {
        return null;
      }

      const explicitPeriodNum = plans.find((plan) => typeof plan.periodNum === "number" && Number.isFinite(plan.periodNum))?.periodNum ?? null;
      const reference = plans[0];
      return {
        plans: sortRiPlans(plans),
        explicitPeriodNum,
        price: getRiPlanAmount(plans, "price") ?? 0,
        perEffectivePrice: getRiPlanAmount(plans, "perEffectivePrice"),
        perPrice,
        productId: typeof reference.productId === "string" ? reference.productId : undefined,
        skuCode: typeof reference.skuCode === "string" ? reference.skuCode : undefined,
        planId: typeof reference.planId === "string" ? reference.planId : undefined,
        paymentType: typeof reference.paymentType === "string" && reference.paymentType.trim()
          ? reference.paymentType
          : RI_PAYMENT_TYPE,
        paymentTypeKey: typeof reference.paymentTypeKey === "string" && reference.paymentTypeKey.trim()
          ? reference.paymentTypeKey
          : RI_PAYMENT_TYPE_KEY,
        siteCode: typeof reference.siteCode === "string" ? reference.siteCode : undefined,
      };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));

  if (!groups.length) {
    return null;
  }

  const preferredPaymentKey = groups.some((group) => group.paymentTypeKey === RI_PAYMENT_TYPE_KEY)
    ? RI_PAYMENT_TYPE_KEY
    : null;
  const paymentFiltered = preferredPaymentKey
    ? groups.filter((group) => group.paymentTypeKey === preferredPaymentKey)
    : groups;

  const explicitOneYear = paymentFiltered
    .filter((group) => group.explicitPeriodNum === 1)
    .sort((left, right) => right.perPrice - left.perPrice);
  if (explicitOneYear.length) {
    return explicitOneYear[0];
  }

  const untypedGroups = paymentFiltered
    .filter((group) => group.explicitPeriodNum === null)
    .sort((left, right) => right.perPrice - left.perPrice);
  if (untypedGroups.length) {
    return untypedGroups[0];
  }

  return null;
}

function buildRiAddToListProduct(baseLabel: string | undefined, paymentType: string) {
  if (!baseLabel?.trim()) {
    return baseLabel;
  }

  const parts = baseLabel.split("|").map((part) => part.trim()).filter(Boolean);
  const filtered = parts.filter((part) => part !== RI_PAYMENT_TYPE && part !== RI_TIME_TOKEN);
  filtered.push(paymentType, RI_TIME_TOKEN);
  return filtered.join(" | ");
}

function buildRiImageInquiryResult(existingInquiry: Record<string, unknown> | undefined) {
  return {
    ...(existingInquiry ?? {}),
    amount: 0,
    originalAmount: 0,
    discountAmount: 0,
    installNum: RI_INSTALLMENTS,
    perAmount: 0,
    perDiscountAmount: 0,
    perOriginalAmount: 0,
    installAmount: 0,
    installPeriodType: RI_INSTALL_PERIOD_TYPE,
  };
}

function getEcsSystemDiskStepperType(disk: ProductDisk, existingDiskInfo: Record<string, unknown>) {
  if (typeof disk.type === "string" && disk.type.trim()) {
    return disk.type;
  }

  return typeof existingDiskInfo.type === "string" ? existingDiskInfo.type : "";
}

function getEcsSystemDiskPlan(disk: ProductDisk, billingMode: CatalogPricingMode) {
  const plans = [...(disk.bakPlanList ?? []), ...(disk.planList ?? [])];
  const matchedPlan = plans.find((plan) => plan.billingMode === billingMode);
  return matchedPlan ? { ...matchedPlan } : null;
}

function buildEcsFlavorAddToListProduct(flavor: ProductFlavor, existingVmInfo: Record<string, unknown>) {
  const parts = [
    pickPresentString(flavor.arch),
    pickPresentString(flavor.vmType),
    getFlavorDisplaySpec(flavor),
    pickPresentString(flavor.cpu),
    pickPresentString(flavor.mem),
  ].filter(Boolean);

  if (parts.length) {
    return parts.join(" | ");
  }

  return typeof existingVmInfo.addToList_product === "string" ? existingVmInfo.addToList_product : undefined;
}

function buildEcsBuyUrl(options: {
  baseUrl: string;
  region: string;
  flavor: ProductFlavor;
  diskType: string;
  diskSize: number;
  quantity: number;
  pricingMode: CatalogPricingMode;
}) {
  const { baseUrl, region, flavor, diskType, diskSize, quantity, pricingMode } = options;
  const url = new URL(baseUrl);
  url.searchParams.set("region", region);

  if (pricingMode === "RI") {
    for (const param of ["charging", "flavor", "imageId", "sysdisk", "datadisk", "iptype", "ipcharging", "bwsize", "vmcount", "period"]) {
      url.searchParams.delete(param);
    }
    url.hash = "#/ecs/createRi";
    return url.toString();
  }

  url.searchParams.set("flavor", getFlavorDisplaySpec(flavor));
  url.searchParams.set("sysdisk", `${diskType}:${diskSize}`);
  url.searchParams.set("vmcount", String(quantity));
  url.hash = "#/ecs/createVm";
  return url.toString();
}

function replaceDiskAddToListProduct(currentValue: unknown, nextType: string, diskSize: number) {
  const fallbackSuffix = `${diskSize}BSSUNIT.pluralUnit.17`;
  if (typeof currentValue !== "string" || !currentValue.trim()) {
    return `${nextType} | ${fallbackSuffix}`;
  }

  const parts = currentValue.split("|");
  const suffix = parts.length > 1 ? parts.slice(1).join("|").trim() : fallbackSuffix;
  return `${nextType} | ${suffix}`;
}

function buildEcsVmPayload(options: {
  existingVmInfo: Record<string, unknown>;
  flavor: ProductFlavor;
  quantity: number;
  durationValue: number;
  pricingMode: CatalogPricingMode;
  vmRating?: NonNullable<PriceResponseBody["productRatingResult"]>[number];
}) {
  const { existingVmInfo, flavor, quantity, durationValue, pricingMode, vmRating } = options;
  const existingInquiry = (existingVmInfo.inquiryResult as Record<string, unknown> | undefined) ?? {};
  const baseAddToListProduct = buildEcsFlavorAddToListProduct(flavor, existingVmInfo);

  if (pricingMode === "RI") {
    const riPlanGroup = getSelectedFlavorRiPlanGroup(flavor);
    if (!riPlanGroup) {
      throw new Error(`Missing native 1-year RI plan metadata for ${flavor.resourceSpecCode}`);
    }

    const vmAnnualTotal = vmRating?.amount ?? Number((riPlanGroup.perPrice * quantity * RI_INSTALLMENTS).toFixed(5));
    const vmMonthlyTotal = Number((riPlanGroup.perPrice * quantity).toFixed(5));
    return {
      ...existingVmInfo,
      ...flavor,
      resourceType: flavor.resourceType ?? existingVmInfo.resourceType,
      cloudServiceType: flavor.cloudServiceType ?? existingVmInfo.cloudServiceType,
      resourceSpecCode: flavor.resourceSpecCode,
      productSpecSysDesc: flavor.productSpecSysDesc ?? existingVmInfo.productSpecSysDesc,
      addToList_product: buildRiAddToListProduct(baseAddToListProduct, riPlanGroup.paymentType),
      productNum: quantity,
      selfProductNum: typeof existingVmInfo.selfProductNum === "number" ? existingVmInfo.selfProductNum : 1,
      billingMode: "RI",
      siteCode: riPlanGroup.siteCode ?? flavor.siteCode ?? existingVmInfo.siteCode,
      periodList: flavor.periodList ?? existingVmInfo.periodList ?? 2,
      RITime: RI_TIME_TOKEN,
      RIType: RI_TYPE,
      paymentType: riPlanGroup.paymentType,
      productId: riPlanGroup.productId ?? flavor.productId ?? existingVmInfo.productId,
      skuCode: riPlanGroup.skuCode ?? (typeof existingVmInfo.skuCode === "string" ? existingVmInfo.skuCode : undefined),
      planId: riPlanGroup.planId ?? (typeof existingVmInfo.planId === "string" ? existingVmInfo.planId : undefined),
      price: riPlanGroup.price,
      perEffectivePrice: riPlanGroup.perEffectivePrice,
      perPrice: riPlanGroup.perPrice,
      bakPlanList: riPlanGroup.plans,
      planList: undefined,
      inquiryTag: typeof existingVmInfo.inquiryTag === "string" ? existingVmInfo.inquiryTag : "normal",
      usageValue: undefined,
      amount: undefined,
      usageMeasureId: undefined,
      measureUnit: undefined,
      measureUnitStep: undefined,
      usageFactor: undefined,
      billingEvent: undefined,
      periodNum: undefined,
      inquiryResult: {
        ...existingInquiry,
        id: vmRating?.id ?? existingInquiry.id,
        productId: vmRating?.productId ?? riPlanGroup.productId ?? flavor.productId ?? existingVmInfo.productId,
        amount: vmAnnualTotal,
        discountAmount: vmRating?.discountAmount ?? 0,
        originalAmount: vmRating?.originalAmount ?? vmAnnualTotal,
        installNum: RI_INSTALLMENTS,
        perAmount: vmMonthlyTotal,
        perDiscountAmount: 0,
        perOriginalAmount: 0,
        installAmount: 0,
        installPeriodType: RI_INSTALL_PERIOD_TYPE,
      },
    };
  }

  return {
    ...existingVmInfo,
    ...flavor,
    resourceType: flavor.resourceType ?? existingVmInfo.resourceType,
    cloudServiceType: flavor.cloudServiceType ?? existingVmInfo.cloudServiceType,
    resourceSpecCode: flavor.resourceSpecCode,
    productSpecSysDesc: flavor.productSpecSysDesc ?? existingVmInfo.productSpecSysDesc,
    addToList_product: baseAddToListProduct,
    productNum: quantity,
    selfProductNum: quantity,
    billingMode: pricingMode,
    usageValue: durationValue,
    inquiryResult: {
      ...existingInquiry,
      id: vmRating?.id ?? existingInquiry.id,
      productId: vmRating?.productId ?? flavor.productId ?? existingVmInfo.productId,
      amount: vmRating?.amount ?? existingVmInfo.amount,
      discountAmount: vmRating?.discountAmount ?? 0,
      originalAmount: vmRating?.originalAmount ?? existingVmInfo.originalAmount ?? existingVmInfo.amount,
      perAmount: null,
      perDiscountAmount: null,
      perOriginalAmount: null,
      perPeriodType: null,
      measureId: 1,
      extendParams: null,
    },
  };
}

function buildEcsSystemDiskPayload(options: {
  existingDiskInfo: Record<string, unknown>;
  disk: ProductDisk;
  diskSize: number;
  quantity: number;
  durationValue: number;
  pricingMode: CatalogPricingMode;
  diskRating?: NonNullable<PriceResponseBody["productRatingResult"]>[number];
}) {
  const { existingDiskInfo, disk, diskSize, quantity, durationValue, pricingMode, diskRating } = options;
  const diskPricingMode = getEffectiveDiskPricingMode(pricingMode);
  const existingInquiry = (existingDiskInfo.inquiryResult as Record<string, unknown> | undefined) ?? {};
  const selectedPlan = getEcsSystemDiskPlan(disk, diskPricingMode);
  const nextType = getEcsSystemDiskStepperType(disk, existingDiskInfo);
  const nextSkuInfo = Array.isArray(existingDiskInfo._skuInfo)
    ? [...existingDiskInfo._skuInfo]
    : Array.isArray(disk._skuInfo)
      ? [...disk._skuInfo]
      : [];

  if (typeof disk.volumeType === "string" && disk.volumeType.trim()) {
    nextSkuInfo[0] = `Disk Specifications: ${disk.volumeType}`;
  }
  if (!nextSkuInfo[1]) {
    nextSkuInfo[1] = "Disk Size: nullBSSUNIT.unit.17";
  }

  if (pricingMode === "RI") {
    const normalizedRiPlan = selectedPlan
      ? {
          ...selectedPlan,
          usageMeasureId: HUAWEI_HOUR_USAGE_MEASURE_ID,
        }
      : null;
    const diskMonthlyTotal = selectedPlan
      ? Number(((selectedPlan.amount ?? 0) * diskSize * quantity * RI_MONTHLY_HOURS).toFixed(5))
      : 0;
    const diskAnnualTotal = diskRating?.amount
      ?? (selectedPlan ? Number(((selectedPlan.amount ?? 0) * diskSize * quantity * RI_YEARLY_HOURS).toFixed(5)) : 0);

    return {
      ...existingDiskInfo,
      ...disk,
      resourceSpecCode: disk.resourceSpecCode,
      resourceSpecType: typeof disk.resourceSpecType === "string" && disk.resourceSpecType.trim()
        ? disk.resourceSpecType
        : (typeof existingDiskInfo.resourceSpecType === "string" ? existingDiskInfo.resourceSpecType : disk.resourceSpecCode),
      productSpecSysDesc: typeof disk.productSpecSysDesc === "string" && disk.productSpecSysDesc.trim()
        ? disk.productSpecSysDesc
        : existingDiskInfo.productSpecSysDesc,
      volumeType: typeof disk.volumeType === "string" && disk.volumeType.trim()
        ? disk.volumeType
        : existingDiskInfo.volumeType,
      _skuInfo: nextSkuInfo,
      billingItem: disk.billingItem ?? existingDiskInfo.billingItem,
      type: nextType,
      info: disk.info ?? existingDiskInfo.info,
      specifications: disk.specifications ?? existingDiskInfo.specifications,
      tableUnit: disk.tableUnit ?? existingDiskInfo.tableUnit,
      periodList: disk.periodList ?? existingDiskInfo.periodList,
      resourceSize: diskSize,
      addToList_product: replaceDiskAddToListProduct(existingDiskInfo.addToList_product, nextType, diskSize),
      planList: undefined,
      bakPlanList: normalizedRiPlan ? [normalizedRiPlan] : existingDiskInfo.bakPlanList,
      productId: normalizedRiPlan?.productId ?? disk.productId ?? existingDiskInfo.productId,
      productNum: quantity,
      selfProductNum: typeof existingDiskInfo.selfProductNum === "number" ? existingDiskInfo.selfProductNum : 1,
      billingMode: "ONDEMAND",
      inquiryTag: "combine",
      siteCode: normalizedRiPlan?.siteCode ?? disk.siteCode ?? existingDiskInfo.siteCode,
      periodNum: normalizedRiPlan?.periodNum ?? disk.periodNum ?? existingDiskInfo.periodNum ?? null,
      billingEvent: normalizedRiPlan?.billingEvent ?? disk.billingEvent ?? existingDiskInfo.billingEvent,
      measureUnitStep: normalizedRiPlan?.measureUnitStep ?? disk.measureUnitStep ?? existingDiskInfo.measureUnitStep,
      measureUnit: normalizedRiPlan?.measureUnit ?? disk.measureUnit ?? existingDiskInfo.measureUnit,
      usageFactor: normalizedRiPlan?.usageFactor ?? disk.usageFactor ?? existingDiskInfo.usageFactor,
      usageMeasureId: HUAWEI_HOUR_USAGE_MEASURE_ID,
      amount: normalizedRiPlan?.amount ?? (typeof disk.amount === "number" ? disk.amount : existingDiskInfo.amount),
      usageValue: RI_MONTHLY_HOURS,
      cpqPurchaseDuration: RI_YEARLY_HOURS,
      inquiryResult: {
        id: diskRating?.id ?? existingInquiry.id,
        productId: diskRating?.productId ?? normalizedRiPlan?.productId ?? disk.productId ?? existingDiskInfo.productId,
        amount: diskAnnualTotal,
        discountAmount: diskRating?.discountAmount ?? 0,
        originalAmount: diskRating?.originalAmount ?? diskAnnualTotal,
        perAmount: diskMonthlyTotal,
        perDiscountAmount: 0,
        perOriginalAmount: 0,
        installAmount: 0,
      },
    };
  }

  return {
    ...existingDiskInfo,
    ...disk,
    resourceSpecCode: disk.resourceSpecCode,
    resourceSpecType: typeof disk.resourceSpecType === "string" && disk.resourceSpecType.trim()
      ? disk.resourceSpecType
      : (typeof existingDiskInfo.resourceSpecType === "string" ? existingDiskInfo.resourceSpecType : disk.resourceSpecCode),
    productSpecSysDesc: typeof disk.productSpecSysDesc === "string" && disk.productSpecSysDesc.trim()
      ? disk.productSpecSysDesc
      : existingDiskInfo.productSpecSysDesc,
    volumeType: typeof disk.volumeType === "string" && disk.volumeType.trim()
      ? disk.volumeType
      : existingDiskInfo.volumeType,
    _skuInfo: nextSkuInfo,
    billingItem: disk.billingItem ?? existingDiskInfo.billingItem,
    type: nextType,
    info: disk.info ?? existingDiskInfo.info,
    specifications: disk.specifications ?? existingDiskInfo.specifications,
    tableUnit: disk.tableUnit ?? existingDiskInfo.tableUnit,
    periodList: disk.periodList ?? existingDiskInfo.periodList,
    resourceSize: diskSize,
    addToList_product: replaceDiskAddToListProduct(existingDiskInfo.addToList_product, nextType, diskSize),
    planList: undefined,
    bakPlanList: selectedPlan ? [selectedPlan] : existingDiskInfo.bakPlanList,
    productId: selectedPlan?.productId ?? disk.productId ?? existingDiskInfo.productId,
    productNum: quantity,
    selfProductNum: quantity,
    billingMode: diskPricingMode,
    siteCode: selectedPlan?.siteCode ?? disk.siteCode ?? existingDiskInfo.siteCode,
    periodNum: selectedPlan?.periodNum ?? disk.periodNum ?? existingDiskInfo.periodNum ?? null,
    billingEvent: selectedPlan?.billingEvent ?? disk.billingEvent ?? existingDiskInfo.billingEvent,
    measureUnitStep: selectedPlan?.measureUnitStep ?? disk.measureUnitStep ?? existingDiskInfo.measureUnitStep,
    measureUnit: selectedPlan?.measureUnit ?? disk.measureUnit ?? existingDiskInfo.measureUnit,
    usageFactor: selectedPlan?.usageFactor ?? disk.usageFactor ?? existingDiskInfo.usageFactor,
    usageMeasureId: selectedPlan?.usageMeasureId ?? disk.usageMeasureId ?? existingDiskInfo.usageMeasureId,
    amount: selectedPlan?.amount ?? (typeof disk.amount === "number" ? disk.amount : existingDiskInfo.amount),
    usageValue: durationValue,
    inquiryResult: {
      ...existingInquiry,
      id: diskRating?.id ?? existingInquiry.id,
      productId: diskRating?.productId ?? selectedPlan?.productId ?? disk.productId ?? existingDiskInfo.productId,
      amount: diskRating?.amount ?? selectedPlan?.amount ?? (typeof disk.amount === "number" ? disk.amount : existingDiskInfo.amount),
      discountAmount: diskRating?.discountAmount ?? 0,
      originalAmount: diskRating?.originalAmount
        ?? selectedPlan?.amount
        ?? (typeof disk.amount === "number" ? disk.amount : existingDiskInfo.originalAmount ?? existingDiskInfo.amount),
      perAmount: null,
      perDiscountAmount: null,
      perOriginalAmount: null,
      perPeriodType: null,
      measureId: 1,
      extendParams: null,
    },
  };
}

function buildEcsImagePayload(options: {
  existingImageInfo: Record<string, unknown>;
  flavor: ProductFlavor;
  durationValue: number;
  pricingMode: CatalogPricingMode;
  quantity: number;
}) {
  const { existingImageInfo, flavor, durationValue, pricingMode, quantity } = options;
  const family = getFlavorFamily(flavor);
  const nextTypes = family
    ? [family]
    : (Array.isArray(existingImageInfo.type)
        ? existingImageInfo.type.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : []);
  const existingInquiry = (existingImageInfo.inquiryResult as Record<string, unknown> | undefined) ?? undefined;

  if (pricingMode === "RI") {
    return {
      ...existingImageInfo,
      ...(nextTypes.length ? { type: nextTypes } : {}),
      productNum: quantity,
      durationNum: undefined,
      inquiryResult: buildRiImageInquiryResult(existingInquiry),
    };
  }

  return {
    ...existingImageInfo,
    ...(nextTypes.length ? { type: nextTypes } : {}),
    productNum: durationValue,
    durationNum: durationValue,
  };
}

function buildEcsCalculatorItemPayload(
  flavor: ProductFlavor,
  disk: ProductDisk,
  priceResponse: PriceResponseBody,
  config: {
    region: string;
    quantity: number;
    durationValue: number;
    pricingMode: CatalogPricingMode;
    diskType: string;
    diskSize: number;
    title: string;
    description: string;
  },
) {
  const payload = cloneJson(sampleEcsCartItem) as CalculatorCartItemPayload;
  const selectedProduct = (payload.selectedProduct ?? {}) as Record<string, unknown>;
  const rewriteValue = (payload.rewriteValue ?? {}) as Record<string, unknown>;
  const productAllInfos = (Array.isArray(selectedProduct.productAllInfos) ? selectedProduct.productAllInfos : []) as Array<Record<string, unknown>>;
  const vmInfo = productAllInfos[0] ?? {};
  const imageInfo = productAllInfos[1] ?? {};
  const diskInfo = productAllInfos[2] ?? {};
  const vmRating = priceResponse.productRatingResult?.[0];
  const diskRating = priceResponse.productRatingResult?.[1];
  const diskPricingMode = getEffectiveDiskPricingMode(config.pricingMode);
  const durationUnit = config.pricingMode === "MONTHLY" ? "month" : config.pricingMode === "YEARLY" ? "year" : config.pricingMode === "RI" ? "reservation" : "hour";
  const riPlanGroup = config.pricingMode === "RI" ? getSelectedFlavorRiPlanGroup(flavor) : null;
  const diskMonthlyAmount = config.pricingMode === "RI"
    ? Number((((disk.planList ?? []).find((plan) => plan.billingMode === diskPricingMode)?.amount ?? (disk.bakPlanList ?? []).find((plan) => plan.billingMode === diskPricingMode)?.amount ?? 0) * config.diskSize * config.quantity * 730).toFixed(5))
    : 0;

  payload.buyUrl = buildEcsBuyUrl({
    baseUrl: payload.buyUrl ?? sampleEcsCartItem.buyUrl,
    region: config.region,
    flavor,
    diskType: config.diskType,
    diskSize: config.diskSize,
    quantity: config.quantity,
    pricingMode: config.pricingMode,
  });

  rewriteValue.global_DESCRIPTION = config.description;
  rewriteValue.global_REGIONINFO = {
    region: config.region,
    locationType: "commonAZ",
    chargeMode: config.pricingMode,
  };

  const templateRender = (isRecord(rewriteValue.template_RENDER) ? rewriteValue.template_RENDER : {}) as Record<string, unknown>;
  const radio = (isRecord(templateRender.calculator_ecs_radio) ? templateRender.calculator_ecs_radio : {}) as Record<string, unknown>;
  radio.arch = flavor.arch ?? radio.arch;
  radio.vmType = flavor.vmType ?? radio.vmType;
  radio.generation = flavor.generation ?? radio.generation;
  radio.cpu = flavor.cpu ?? radio.cpu;
  radio.mem = flavor.mem ?? radio.mem;
  templateRender.calculator_ecs_radio = radio;

  const evsStepper = (isRecord(templateRender.calculator_evs_stepper) ? templateRender.calculator_evs_stepper : {}) as Record<string, unknown>;
  const evsMain = (isRecord(evsStepper.calculator_evs_stepper_main) ? evsStepper.calculator_evs_stepper_main : {}) as Record<string, unknown>;
  evsMain.type = getEcsSystemDiskStepperType(disk, diskInfo);
  evsMain.UNSET_Stepper_0 = {
    measureId: 17,
    measureValue: config.diskSize,
    measureNameBeforeTrans: "",
    measurePluralNameBeforeTrans: "",
    transRate: "",
    transTarget: "",
  };
  evsStepper.calculator_evs_stepper_main = evsMain;
  templateRender.calculator_evs_stepper = evsStepper;

  if (config.pricingMode === "RI") {
    templateRender.calculator_ecs_RIRadio = {
      paymentType: riPlanGroup?.paymentType ?? RI_PAYMENT_TYPE,
      RITime: RI_TIME_TOKEN,
    };
    delete rewriteValue.global_ONDEMANDTIME;
    delete rewriteValue.global_PRICINGMODE;
    delete rewriteValue.global_DISKPRICINGMODE;
    delete rewriteValue.global_DURATIONUNIT;
  } else {
    rewriteValue.global_PRICINGMODE = config.pricingMode;
    rewriteValue.global_DISKPRICINGMODE = diskPricingMode;
    rewriteValue.global_DURATIONUNIT = durationUnit;
    rewriteValue.global_ONDEMANDTIME = {
      UNSET_Stepper_0: {
        measureId: 4,
        measureValue: config.durationValue,
        measureNameBeforeTrans: "",
        measurePluralNameBeforeTrans: "",
        transRate: "",
        transTarget: "",
      },
    };
    delete templateRender.calculator_ecs_RIRadio;
  }

  rewriteValue.template_RENDER = templateRender;
  rewriteValue.global_QUANTITY = {
    UNSET_Stepper_0: {
      measureId: 41,
      measureValue: config.quantity,
      measureNameBeforeTrans: "calc_29_",
      measurePluralNameBeforeTrans: "calc_30_",
      transRate: "",
      transTarget: "",
    },
  };

  selectedProduct.region = config.region;
  selectedProduct.timeTag = Date.now();
  selectedProduct.description = config.description;
  selectedProduct._customTitle = config.title;
  selectedProduct.chargeMode = config.pricingMode;
  selectedProduct.chargeModeName = config.pricingMode;
  selectedProduct.locationType = "commonAZ";
  selectedProduct.tag = "general.online.portal";
  selectedProduct.serviceCode = "ecs";
  selectedProduct.periodType = config.pricingMode === "RI" ? 3 : 4;
  selectedProduct.periodNum = 1;
  selectedProduct.subscriptionNum = 1;
  selectedProduct.calculatorPricingMode = config.pricingMode;
  selectedProduct.calculatorDiskPricingMode = diskPricingMode;
  selectedProduct.calculatorDurationUnit = durationUnit;
  selectedProduct.amount = priceResponse.amount;
  selectedProduct.discountAmount = priceResponse.discountAmount;
  selectedProduct.originalAmount = priceResponse.originalAmount;
  if (config.pricingMode === "RI") {
    selectedProduct.perAmount = Number((((riPlanGroup?.perPrice ?? 0) * config.quantity) + diskMonthlyAmount).toFixed(5));
    selectedProduct.perDiscountAmount = 0;
    selectedProduct.perOriginalAmount = 0;
    selectedProduct.installAmount = 0;
    delete selectedProduct.purchaseTime;
  } else {
    delete selectedProduct.perAmount;
    delete selectedProduct.perDiscountAmount;
    delete selectedProduct.perOriginalAmount;
    delete selectedProduct.installAmount;
    selectedProduct.purchaseTime = {
      measureValue: config.durationValue,
      measureId: 4,
      measureNameBeforeTrans: "",
      measurePluralNameBeforeTrans: "",
    };
  }
  selectedProduct.purchaseNum = {
    measureValue: config.quantity,
    measureId: 41,
    measureNameBeforeTrans: "calc_29_",
    measurePluralNameBeforeTrans: "calc_30_",
  };

  const nextVmInfo = buildEcsVmPayload({
    existingVmInfo: vmInfo,
    flavor,
    quantity: config.quantity,
    durationValue: config.durationValue,
    pricingMode: config.pricingMode,
    vmRating,
  });
  const nextImageInfo = buildEcsImagePayload({
    existingImageInfo: imageInfo,
    flavor,
    durationValue: config.durationValue,
    pricingMode: config.pricingMode,
    quantity: config.quantity,
  });
  const nextDiskInfo = buildEcsSystemDiskPayload({
    existingDiskInfo: diskInfo,
    disk,
    diskSize: config.diskSize,
    quantity: config.quantity,
    durationValue: config.durationValue,
    pricingMode: config.pricingMode,
    diskRating,
  });

  if (config.pricingMode === "RI") {
    selectedProduct.productAllInfos = [nextImageInfo, nextVmInfo, nextDiskInfo];
  } else {
    productAllInfos[0] = nextVmInfo;
    productAllInfos[1] = nextImageInfo;
    productAllInfos[2] = nextDiskInfo;
    selectedProduct.productAllInfos = productAllInfos;
  }

  payload.selectedProduct = selectedProduct;
  payload.rewriteValue = rewriteValue;

  return payload;
}

async function fetchEcsCatalogBody(regionId: string) {
  const cached = catalogBodyCache.get(regionId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.body;
  }

  const response = await fetch(buildEcsProductInfoUrl(regionId), {
    headers: {
      accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Huawei ECS product info request failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  catalogBodyCache.set(regionId, { expiresAt: Date.now() + 10 * 60_000, body });
  return body;
}

async function getStoredFlavor(regionId: string, resourceSpecCode: string) {
  await ensureRegionCatalogAvailable(regionId);
  const row = db
    .query("SELECT flavor_json FROM ecs_flavor WHERE region_id = ? AND resource_spec_code = ?")
    .get(regionId, resourceSpecCode) as { flavor_json: string } | null;

  if (!row) {
    return null;
  }

  return JSON.parse(row.flavor_json) as ProductFlavor;
}

function mapRegionToCatalogRegionId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  if (value in huaweiRegions) {
    return getCatalogRegionId(value as HuaweiRegionKey);
  }

  return value.trim();
}

function isUiSystemDiskOption(value: string): value is SystemDiskOption {
  return value in systemDiskCodeMap;
}

function toCatalogPricingMode(flavor: ProductFlavor, billingMode: LocalBillingOption): CatalogPricingMode {
  if (billingMode === "Pay-per-use") {
    return "ONDEMAND";
  }

  if (billingMode === "RI") {
    return "RI";
  }

  const monthlyPrice = getItemBasePrice(flavor, "MONTHLY");
  if (Number.isFinite(monthlyPrice)) {
    return "MONTHLY";
  }

  const yearlyPrice = getItemBasePrice(flavor, "YEARLY");
  if (Number.isFinite(yearlyPrice)) {
    return "YEARLY";
  }

  throw new Error(`Monthly or yearly Huawei pricing is unavailable for ${flavor.resourceSpecCode}.`);
}

function buildPriceEstimate(options: {
  flavor: ProductFlavor;
  disk: ProductDisk;
  quantity: number;
  durationValue: number;
  diskSize: number;
  pricingMode: CatalogPricingMode;
}) {
  const { flavor, disk, quantity, durationValue, diskSize, pricingMode } = options;
  const flavorRate = getItemBasePrice(flavor, pricingMode);
  const diskRate = getItemBasePrice(disk, getEffectiveDiskPricingMode(pricingMode));

  if (!Number.isFinite(flavorRate) || !Number.isFinite(diskRate)) {
    return null;
  }

  const flavorAmount = roundMoney(flavorRate * quantity * (pricingMode === "RI" ? 1 : durationValue));
  const diskAmount = roundMoney(
    pricingMode === "RI"
      ? diskRate * diskSize * quantity * RI_YEARLY_HOURS
      : diskRate * diskSize * quantity * durationValue,
  );
  const totalAmount = roundMoney(flavorAmount + diskAmount);

  return {
    amount: totalAmount,
    discountAmount: 0,
    originalAmount: totalAmount,
    currency: "USD",
    productRatingResult: [
      {
        id: flavor.inquiryResult?.id ?? `cached-vm-${flavor.productId ?? flavor.resourceSpecCode}`,
        productId: flavor.productId ?? flavor.inquiryResult?.productId,
        amount: flavorAmount,
        discountAmount: 0,
        originalAmount: flavorAmount,
      },
      {
        id: disk.inquiryResult?.id ?? `cached-disk-${disk.productId ?? disk.resourceSpecCode}`,
        productId: disk.productId ?? disk.inquiryResult?.productId,
        amount: diskAmount,
        discountAmount: 0,
        originalAmount: diskAmount,
      },
    ],
  } satisfies PriceResponseBody;
}

function mapRemotePricingModeToLocal(mode: CatalogPricingMode): LocalBillingOption {
  if (mode === "RI") {
    return "RI";
  }

  if (mode === "ONDEMAND") {
    return "Pay-per-use";
  }

  return "Yearly/Monthly";
}

function resolveLocalRegionKey(regionId: string) {
  return getRegionKeyFromCatalogRegionId(regionId);
}

function extractSystemDiskConfig(config: LocalEcsConfig) {
  const systemDisk = isRecord(config.systemDisk) ? config.systemDisk : {};
  const systemDiskType = pickPresentString(systemDisk.type);
  const systemDiskSize = typeof systemDisk.sizeGiB === "number"
    ? systemDisk.sizeGiB
    : Number(systemDisk.sizeGiB ?? 0);

  return {
    type: systemDiskType,
    sizeGiB: Number.isFinite(systemDiskSize) ? Math.max(0, systemDiskSize) : 0,
  };
}

function buildRawLocalProduct(remoteItem: RemoteCartItem): LocalProductInput {
  return {
    serviceCode: remoteItem.serviceCode,
    serviceName: remoteItem.serviceName,
    productType: "huawei-raw",
    title: remoteItem.title || remoteItem.serviceName,
    quantity: remoteItem.quantity,
    config: {
      huaweiPayload: remoteItem.payload,
      region: remoteItem.region,
      pricingMode: remoteItem.pricingMode,
      resourceCode: remoteItem.resourceCode,
      diskType: remoteItem.diskType,
      diskSizeGiB: remoteItem.diskSize,
      hours: remoteItem.hours,
    },
    pricing: {
      total: formatPriceSummary(remoteItem.pricingMode, remoteItem.amount, remoteItem.hours),
    },
  };
}

function buildImportedEcsProduct(remoteItem: RemoteCartItem): LocalProductInput {
  const localRegion = resolveLocalRegionKey(remoteItem.region);
  const diskLabel = getDiskTypeDisplayName(remoteItem.diskType);
  if (!localRegion || !isUiSystemDiskOption(diskLabel)) {
    return buildRawLocalProduct(remoteItem);
  }

  return {
    serviceCode: DEFAULT_ECS_SERVICE_CODE,
    serviceName: DEFAULT_ECS_SERVICE_NAME,
    productType: "ecs",
    title: remoteItem.title || `${DEFAULT_ECS_SERVICE_NAME} ${remoteItem.resourceCode}`,
    quantity: remoteItem.quantity,
    config: {
      region: localRegion,
      billingMode: mapRemotePricingModeToLocal(remoteItem.pricingMode),
      usageHours: remoteItem.pricingMode === "ONDEMAND" ? remoteItem.hours : null,
      description: remoteItem.description,
      flavor: remoteItem.resourceCode,
      vcpu: remoteItem.vcpus,
      ramGiB: remoteItem.ramGb,
      systemDisk: {
        type: diskLabel,
        sizeGiB: remoteItem.diskSize,
      },
      huaweiPayload: remoteItem.payload,
    },
    pricing: {
      total: formatPriceSummary(remoteItem.pricingMode, remoteItem.amount, remoteItem.hours),
    },
  };
}

export async function listHuaweiCarts(cookieInput: string) {
  const auth = resolveHuaweiAuth(cookieInput);
  const body = await huaweiJsonRequest(HUAWEI_LIST_URL, { method: "GET" }, auth);
  const lists = isRecord(body) && Array.isArray(body.lists) ? body.lists : [];

  return lists
    .map((entry) => {
      const item = isRecord(entry) ? (entry as ShareCartSummary) : {};
      const key = pickPresentString(item.key);
      if (!key) {
        return null;
      }

      return {
        key,
        name: pickPresentString(item.name) || key,
        updateTime: typeof item.updateTime === "number" ? item.updateTime : 0,
        billingMode: pickPresentString(item.billingMode) || null,
        totalAmount: typeof item.totalPrice?.amount === "number" ? item.totalPrice.amount : null,
        originalAmount: typeof item.totalPrice?.originalAmount === "number" ? item.totalPrice.originalAmount : null,
      } satisfies HuaweiRemoteCartSummary;
    })
    .filter((entry): entry is HuaweiRemoteCartSummary => Boolean(entry))
    .sort((left, right) => right.updateTime - left.updateTime);
}

export async function getHuaweiCartDetail(key: string, cookieInput: string) {
  const auth = resolveHuaweiAuth(cookieInput);
  const body = await huaweiJsonRequest(buildDetailUrl(key), { method: "GET" }, auth);
  const detail = isRecord(body) && isRecord(body.data) ? (body.data as ShareCartDetail) : null;
  if (!detail) {
    throw new Error("Huawei cart detail did not return a usable payload.");
  }

  return detail;
}

export async function buildLocalProductsFromHuaweiCart(key: string, cookieInput: string) {
  const detail = await getHuaweiCartDetail(key, cookieInput);
  const items = getRemoteCartItems(detail);

  return {
    detail,
    products: items.map((item) => (item.service === "ecs" ? buildImportedEcsProduct(item) : buildRawLocalProduct(item))),
  };
}

export async function createHuaweiCart(name: string, cookieInput: string) {
  const auth = resolveHuaweiAuth(cookieInput);
  const body = await huaweiJsonRequest(
    HUAWEI_ADD_URL,
    {
      method: "POST",
      body: JSON.stringify({
        billingMode: "cart.shareList.billingModeTotal",
        cartListData: [],
        name: name.trim() || "NeoCalculator cart",
        totalPrice: {
          amount: 0,
          discountAmount: 0,
          originalAmount: 0,
        },
      }),
    },
    auth,
  );

  const key = isRecord(body) && typeof body.data === "string" ? body.data.trim() : "";
  if (!key) {
    throw new Error("Huawei create cart did not return a cart key.");
  }

  return {
    key,
    name: name.trim() || "NeoCalculator cart",
  };
}

async function buildHuaweiPayloadFromLocalProduct(product: LocalProductInput) {
  if (product.productType === "huawei-raw" && isRecord(product.config) && isRecord((product.config as LocalRawConfig).huaweiPayload)) {
    return cloneJson((product.config as LocalRawConfig).huaweiPayload as CalculatorCartItemPayload);
  }

  if (product.productType !== "ecs") {
    throw new Error(`Unsupported product type for Huawei sync: ${product.productType}`);
  }

  if (!isRecord(product.config)) {
    throw new Error(`Product ${product.title} is missing ECS configuration.`);
  }

  const config = product.config as LocalEcsConfig;
  const regionId = mapRegionToCatalogRegionId(config.region);
  if (!regionId) {
    throw new Error(`Product ${product.title} is missing a Huawei region.`);
  }

  const flavorCode = pickPresentString(config.flavor);
  if (!flavorCode) {
    throw new Error(`Product ${product.title} is missing a flavor.`);
  }

  const localBillingMode = isLocalBillingOption(config.billingMode) ? config.billingMode : "Pay-per-use";
  const flavor = await getStoredFlavor(regionId, flavorCode);
  if (!flavor) {
    throw new Error(`Flavor ${flavorCode} is unavailable in ${regionId}.`);
  }

  const catalogBody = await fetchEcsCatalogBody(regionId);
  const disks = getCatalogDisks(catalogBody);
  const systemDisk = extractSystemDiskConfig(config);
  const diskTypeCode = normalizeDiskTypeApiCode(systemDisk.type || "High I/O");
  const disk = disks.find((item) => item.resourceSpecCode === diskTypeCode);
  if (!disk) {
    throw new Error(`System disk ${diskTypeCode} is unavailable in ${regionId}.`);
  }

  const pricingMode = toCatalogPricingMode(flavor, localBillingMode);
  const durationValue = pricingMode === "ONDEMAND"
    ? Math.max(1, typeof config.usageHours === "number" ? Math.floor(config.usageHours) : Number(config.usageHours ?? 744) || 744)
    : 1;
  const diskSize = Math.max(40, Math.floor(systemDisk.sizeGiB || 40));
  const estimate = buildPriceEstimate({
    flavor,
    disk,
    quantity: Math.max(1, product.quantity),
    durationValue,
    diskSize,
    pricingMode,
  });

  if (!estimate) {
    throw new Error(`Unable to estimate Huawei pricing for ${product.title}.`);
  }

  return buildEcsCalculatorItemPayload(flavor, disk, estimate, {
    region: regionId,
    quantity: Math.max(1, product.quantity),
    durationValue,
    pricingMode,
    diskType: diskTypeCode,
    diskSize,
    title: product.title,
    description: extractLocalEcsDescription(product, pickPresentString(flavor.productSpecDesc, flavor.productSpecSysDesc)),
  });
}

export async function buildHuaweiCartPayloadFromLocalProducts(name: string, products: LocalProductInput[]) {
  const cartListData = [];

  for (const product of products) {
    cartListData.push(await buildHuaweiPayloadFromLocalProduct(product));
  }

  return {
    billingMode: "cart.shareList.billingModeTotal",
    cartListData,
    name: name.trim() || "NeoCalculator cart",
    totalPrice: buildCartTotalPrice(cartListData),
  };
}

export async function pushLocalProductsToHuaweiCart(options: {
  huaweiCartKey?: string | null;
  listName: string;
  products: LocalProductInput[];
  cookie: string;
}) {
  const auth = resolveHuaweiAuth(options.cookie);
  const targetCart = options.huaweiCartKey?.trim()
    ? { key: options.huaweiCartKey.trim(), name: options.listName.trim() || "NeoCalculator cart" }
    : await createHuaweiCart(options.listName, options.cookie);
  const payload = await buildHuaweiCartPayloadFromLocalProducts(targetCart.name, options.products);

  await huaweiJsonRequest(
    buildUpdateUrl(targetCart.key),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );

  return targetCart;
}
