import { declarativeRuntimeHelpers } from "@/lib/declarative-runtime-helpers";
import { evaluateDeclarativeDerivedValues, evaluateDeclarativeValue } from "@/lib/declarative-runtime-evaluator";
import { getTypedDeclarativeRuntimeDefinitionByCode } from "@/lib/declarative-service-runtime-registry";
import { getCatalogFetchFn } from "@/lib/catalog-fetch-registry";
import { getConfigurableServiceBundleByCode, getConfigurableServiceDefinitionByCode, serviceCatalog } from "@/lib/service-config";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { formatFlavorAmount, getDiskPriceForBillingOption, getFlavorPriceForBillingOption, toFlavorCard, toFlexusLFlavorCard, type BillingOption, type ProductMutationBody } from "@/lib/calculator-page-helpers";
import { listStoredEcsFlavors, ensureRegionCatalogAvailable } from "@/lib/ecs-flavor-catalog";
import { fetchRegionSystemDiskPricing } from "@/lib/evs-disk-pricing";
import { flexusLPricingReference, findFlexusLPlan } from "@/lib/flexus-l-catalog";
import { ecsDiskSizeBounds } from "@/lib/configurable-runtime-utils";
import type { DeclarativeEstimateRecord } from "@/lib/declarative-service-runtime-types";
import { fetchInquiryPricing, type InquiryPricingResult } from "@/lib/inquiry-pricing";

type ConfigRecord = Record<string, unknown>;

export type ServerPricingResult = {
  pricing: Record<string, unknown>;
  title: string;
  productType: string;
  config: ConfigRecord;
  error?: string;
};

function resolveRegionId(region: string): string {
  const entry = huaweiRegions[region as HuaweiRegionKey];
  return entry?.catalogRegionId ?? region;
}

function flavorListSummary(flavors: Array<{ resourceSpecCode: string }>): string {
  if (flavors.length === 0) return "none loaded";
  const codes = flavors.slice(0, 5).map((f) => f.resourceSpecCode);
  return codes.join(", ") + (flavors.length > 5 ? `, +${flavors.length - 5} more` : "");
}

function buildDefaultValues(definition: { fields: Array<{ id: string }>; defaults: Record<string, unknown> }) {
  const values: Record<string, string> = {};
  for (const field of definition.fields) {
    const val = definition.defaults[field.id];
    values[field.id] = val != null ? String(val) : "";
  }
  return values;
}

function buildScope(input: {
  definition: ConfigRecord;
  selectedServiceCode: string;
  selectedService: string;
  values: Record<string, string>;
  catalog: unknown;
  catalogRegionId: string | null;
  pricingError: string;
  regionValue: string;
  billingMode: BillingOption;
  usageHours: string;
  usageHoursValue: number;
  instanceCountValue: number;
  derived?: unknown;
  estimate?: DeclarativeEstimateRecord | null;
}) {
  return {
    helpers: declarativeRuntimeHelpers,
    definition: input.definition,
    selectedServiceCode: input.selectedServiceCode,
    selectedService: input.selectedService,
    values: input.values,
    catalog: input.catalog,
    catalogRegionId: input.catalogRegionId,
    pricingError: input.pricingError,
    regionValue: input.regionValue,
    billingMode: input.billingMode,
    usageHours: input.usageHours,
    usageHoursValue: input.usageHoursValue,
    instanceCountValue: input.instanceCountValue,
    item: null,
    product: null,
    catalogView: null,
    derived: input.derived ?? null,
    estimate: input.estimate ?? null,
    requestBodiesCount: undefined,
    extraRequestBodiesCount: undefined,
    createdCount: undefined,
    expandedCount: undefined,
    huaweiRegions,
  };
}

function configToValues(config: ConfigRecord, defaults: Record<string, string>): Record<string, string> {
  const values: Record<string, string> = { ...defaults };
  for (const [key, value] of Object.entries(config)) {
    if (value != null) {
      values[key] = String(value);
    }
  }
  return values;
}

const EVS_PRODUCT_IDS: Record<string, Record<string, string>> = {
  "sa-brazil-1": { SSD: "00301-135024-0--0", "High I/O": "00301-135025-0--0", "SAS": "00301-135026-0--0" },
  "ap-southeast-1": { SSD: "00301-133631-0--0", "High I/O": "00301-133632-0--0", "SAS": "00301-133633-0--0" },
  "ap-southeast-2": { SSD: "00301-133631-0--0", "High I/O": "00301-133632-0--0", "SAS": "00301-133633-0--0" },
  "la-south-1": { SSD: "00301-133631-0--0", "High I/O": "00301-133632-0--0", "SAS": "00301-133633-0--0" },
  "af-south-1": { SSD: "00301-133631-0--0", "High I/O": "00301-133632-0--0", "SAS": "00301-133633-0--0" },
};

function getEvsProductId(diskType: string, regionId: string): string | null {
  const regionIds = EVS_PRODUCT_IDS[regionId];
  if (!regionIds) return null;
  const typeMap: Record<string, string> = { SSD: "SSD", "High I/O": "High I/O", SAS: "SAS" };
  const normalizedType = typeMap[diskType] ?? diskType;
  return regionIds[normalizedType] ?? null;
}

function findProductIdInCatalog(catalog: unknown, specCode?: string): string | null {
  if (!catalog || typeof catalog !== "object") return null;

  const cat = catalog as Record<string, unknown>;

  if (cat.instanceTiers && Array.isArray(cat.instanceTiers)) {
    for (const tier of cat.instanceTiers as Array<Record<string, unknown>>) {
      if (specCode && tier.resourceSpecCode !== specCode) continue;
      const productIds = tier.productIds as Record<string, string> | undefined;
      if (productIds?.ONDEMAND) return productIds.ONDEMAND;
      if (productIds?.MONTHLY) return productIds.MONTHLY;
      if (productIds?.productId) return tier.productId as string;
    }
  }

  if (cat.tiers && Array.isArray(cat.tiers)) {
    for (const tier of cat.tiers as Array<Record<string, unknown>>) {
      if (specCode && tier.resourceSpecCode !== specCode) continue;
      const productIds = tier.productIds as Record<string, string> | undefined;
      if (productIds?.ONDEMAND) return productIds.ONDEMAND;
      if (productIds?.productId) return tier.productId as string;
    }
  }

  if (cat.gateways && Array.isArray(cat.gateways)) {
    for (const tier of cat.gateways as Array<Record<string, unknown>>) {
      if (specCode && tier.resourceSpecCode !== specCode) continue;
      const productIds = tier.productIds as Record<string, string> | undefined;
      if (productIds?.ONDEMAND) return productIds.ONDEMAND;
      if (tier.productId) return tier.productId as string;
    }
  }

  for (const [key, value] of Object.entries(cat)) {
    if (Array.isArray(value)) {
      for (const item of value as Array<Record<string, unknown>>) {
        if (specCode && item.resourceSpecCode !== specCode) continue;
        const productIds = item.productIds as Record<string, string> | undefined;
        if (productIds?.ONDEMAND) return productIds.ONDEMAND;
        if (productIds?.productId) return item.productId as string;
        if (item.productId) return item.productId as string;
      }
    }
  }

  if (cat.productIds && typeof cat.productIds === "object") {
    const pids = cat.productIds as Record<string, string>;
    if (pids.ONDEMAND) return pids.ONDEMAND;
    if (pids.MONTHLY) return pids.MONTHLY;
  }

  return null;
}

async function tryInquiryPricing(serviceCode: string, catalog: unknown, regionId: string, usageHours: number, specCode?: string, resourceSize?: number): Promise<InquiryPricingResult | null> {
  const productId = findProductIdInCatalog(catalog, specCode);
  if (!productId) return null;

  try {
    return await fetchWithRetry(() => fetchInquiryPricing({
      serviceCode,
      regionId,
      productId,
      usageValue: usageHours,
      resourceSpecCode: specCode,
      resourceSize,
    }), `${serviceCode} inquiry`);
  } catch {
    return null;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

async function fetchWithRetry<T>(fn: () => Promise<T>, serviceName: string, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    const isRetryable = lower.includes("timeout") || lower.includes("timed out") || lower.includes("econnreset") || lower.includes("econnrefused") || (lower.includes("503") && attempt < 1);
    const shouldRetry = attempt < MAX_RETRIES && isRetryable;

    if (shouldRetry) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      return fetchWithRetry(fn, serviceName, attempt + 1);
    }

    throw new Error(`${serviceName}: ${msg}${attempt > 0 ? ` (after ${attempt + 1} attempts)` : ""}`);
  }
}

async function computeConfigurablePricing(serviceCode: string, config: ConfigRecord): Promise<ServerPricingResult> {
  const bundle = getConfigurableServiceBundleByCode(serviceCode);
  const definition = getConfigurableServiceDefinitionByCode(serviceCode);
  if (!bundle || !definition) {
    return { pricing: {}, title: "", productType: serviceCode.toLowerCase(), config, error: `No configurable definition for ${serviceCode}` };
  }

  const typedRuntime = getTypedDeclarativeRuntimeDefinitionByCode(serviceCode);
  if (!typedRuntime) {
    return { pricing: {}, title: "", productType: serviceCode.toLowerCase(), config, error: `No runtime definition for ${serviceCode}` };
  }

  const catalogSource = typedRuntime.catalog;
  if (!catalogSource) {
    return { pricing: {}, title: "", productType: serviceCode.toLowerCase(), config, error: `No catalog source for ${serviceCode}` };
  }

  const fetchFn = getCatalogFetchFn(serviceCode);
  if (!fetchFn) {
    return { pricing: {}, title: "", productType: serviceCode.toLowerCase(), config, error: `No catalog fetch function for ${serviceCode}` };
  }

  const region = (config.region as string) || "ap-southeast-1";
  const catalogRegionId = resolveRegionId(region);
  const billingMode = (config.billingMode as BillingOption) || definition.billingOptions[0] || "Pay-per-use";
  const usageHours = Math.max(1, Math.floor(typeof config.usageHours === "number" ? config.usageHours : 744));
  const quantity = Math.max(1, Math.floor(typeof config.quantity === "number" ? config.quantity : 1));

  let catalog: unknown;
  try {
    catalog = await fetchWithRetry(() => fetchFn(catalogRegionId), definition.serviceName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch catalog";
    return { pricing: {}, title: "", productType: serviceCode.toLowerCase(), config, error: msg };
  }

  const defaults = buildDefaultValues(definition);
  const values = configToValues(config, defaults);

  const baseScope = buildScope({
    definition: definition as unknown as ConfigRecord,
    selectedServiceCode: serviceCode,
    selectedService: definition.serviceName,
    values,
    catalog,
    catalogRegionId,
    pricingError: "",
    regionValue: region,
    billingMode,
    usageHours: String(usageHours),
    usageHoursValue: usageHours,
    instanceCountValue: quantity,
  });

  let catalogView: Record<string, unknown> | null = null;
  let derived: Record<string, unknown> | null = null;
  if (typedRuntime.derived) {
    derived = evaluateDeclarativeDerivedValues(typedRuntime.derived, baseScope);
    (baseScope as Record<string, unknown>).derived = derived;
    (baseScope as Record<string, unknown>).catalogView = derived;
    catalogView = derived;
  } else if (typedRuntime.catalogView) {
    catalogView = evaluateDeclarativeValue<Record<string, unknown> | null>(
      typedRuntime.catalogView,
      baseScope,
    );
    derived = catalogView;
    (baseScope as Record<string, unknown>).catalogView = catalogView;
    (baseScope as Record<string, unknown>).derived = catalogView;
  }

  const estimateScope = { ...baseScope, derived, catalogView };
  const estimate = evaluateDeclarativeValue<DeclarativeEstimateRecord | null>(
    typedRuntime.estimate,
    estimateScope,
  );

  const specCode = (config.resourceSpecCode as string) ?? (config.specification as string) ?? (config.flavor as string);
  
  const [, inquiryResult] = await Promise.all([
    Promise.resolve(estimate),
    tryInquiryPricing(serviceCode, catalog, catalogRegionId, usageHours, specCode),
  ]);

  let primaryEstimate = estimate;
  let priceWarning: string | undefined;

  if (inquiryResult && estimate) {
    const catalogAmount = estimate.amount;
    const inquiryAmount = inquiryResult.amount;
    if (Math.abs(catalogAmount - inquiryAmount) > 0.0001) {
      priceWarning = `Catalog price ($${catalogAmount.toFixed(5)}) differs from inquiry API ($${inquiryAmount.toFixed(5)})`;
    }
    primaryEstimate = {
      currency: inquiryResult.currency,
      amount: inquiryResult.amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount: inquiryResult.amount / (usageHours / (24 * 30)),
    };
  } else if (inquiryResult && !estimate) {
    primaryEstimate = {
      currency: inquiryResult.currency,
      amount: inquiryResult.amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount: inquiryResult.amount / (usageHours / (24 * 30)),
    };
  }

  if (!primaryEstimate) {
    return { pricing: {}, title: "", productType: serviceCode.toLowerCase(), config, error: `Could not compute estimate for ${serviceCode}. Check config values.` };
  }

  const requestBodies = evaluateDeclarativeValue<ProductMutationBody | null>(
    typedRuntime.buildRequestBodies,
    { ...estimateScope, estimate },
  );

  const pricingResult: Record<string, unknown> = {
    total: formatFlavorAmount(primaryEstimate.currency, primaryEstimate.amount, primaryEstimate.suffix),
    monthlyAverage: formatFlavorAmount(primaryEstimate.currency, primaryEstimate.monthlyAverageAmount ?? 0, "/mo"),
  };

  if (requestBodies?.pricing && typeof requestBodies.pricing === "object") {
    Object.assign(pricingResult, requestBodies.pricing);
  }

  if (priceWarning) {
    pricingResult.priceWarning = priceWarning;
  }

  const resolvedConfig = (requestBodies?.config as ConfigRecord) ?? config;
  const resolvedTitle = (requestBodies?.title as string) || config.title as string || definition.serviceName;

  return {
    pricing: pricingResult,
    title: resolvedTitle,
    productType: definition.definitionId,
    config: resolvedConfig,
  };
}

async function computeEcsPricing(config: ConfigRecord): Promise<ServerPricingResult> {
  const region = (config.region as string) || "ap-southeast-1";
  const catalogRegionId = resolveRegionId(region);
  const billingMode = (config.billingMode as BillingOption) || "Pay-per-use";
  const flavor = config.flavor as string | undefined;
  const vcpu = typeof config.vcpu === "number" ? config.vcpu : 0;
  const ramGiB = typeof config.ramGiB === "number" ? config.ramGiB : 0;
  const usageHours = Math.max(1, Math.floor(typeof config.usageHours === "number" ? config.usageHours : 744));
  const quantity = Math.max(1, Math.floor(typeof config.quantity === "number" ? config.quantity : 1));
  const systemDisk = config.systemDisk as ConfigRecord | undefined;
  const diskType = (systemDisk?.type as string) || "High I/O";
  const diskSizeGiB = Math.max(ecsDiskSizeBounds.min, Math.floor(typeof systemDisk?.sizeGiB === "number" ? systemDisk.sizeGiB : ecsDiskSizeBounds.min));

  if (!flavor) {
    return { pricing: {}, title: "", productType: "ecs", config, error: "Missing required field: config.flavor" };
  }

  try {
    await fetchWithRetry(() => ensureRegionCatalogAvailable(catalogRegionId), "ECS catalog");
  } catch (err) {
    return { pricing: {}, title: "", productType: "ecs", config, error: `Failed to load ECS catalog for ${region}: ${err instanceof Error ? err.message : "Unknown error"}` };
  }

  const flavors = listStoredEcsFlavors(catalogRegionId);
  const matchedFlavor = flavors.find((f) => f.resourceSpecCode === flavor);

  if (!matchedFlavor) {
    return { pricing: {}, title: "", productType: "ecs", config, error: `Flavor '${flavor}' not found in region ${region}. Available flavors: ${flavorListSummary(flavors)}. The catalog may still be syncing.` };
  }

  let diskPricing = null;
  let inquiryDiskPricing = null;

  const diskProductId = getEvsProductId(diskType, catalogRegionId);
  
  const [catalogDiskResult, inquiryDiskResult] = await Promise.all([
    fetchWithRetry(() => fetchRegionSystemDiskPricing(catalogRegionId), "EVS disk pricing").catch(() => null),
    diskSizeGiB > 0 && diskProductId 
      ? fetchWithRetry(() => fetchInquiryPricing({
          serviceCode: "EVS",
          regionId: catalogRegionId,
          productId: diskProductId,
          resourceSize: diskSizeGiB,
          usageValue: usageHours,
          resourceSpecCode: diskType === "SSD" ? "SSD" : "SAS",
        }), "EVS inquiry").catch(() => null)
      : Promise.resolve(null),
  ]);

  diskPricing = catalogDiskResult;
  inquiryDiskPricing = inquiryDiskResult;

  const diskPrice = getDiskPriceForBillingOption(diskPricing, diskType as "High I/O", diskSizeGiB, billingMode, usageHours);
  const flavorCard = toFlavorCard(matchedFlavor, billingMode, usageHours, diskPrice);

  const totalAmount = flavorCard.priceValue * quantity;
  const flavorAmount = matchedFlavor.prices.ONDEMAND != null && billingMode === "Pay-per-use"
    ? matchedFlavor.prices.ONDEMAND * usageHours * quantity
    : (matchedFlavor.prices.MONTHLY ?? matchedFlavor.prices.YEARLY ?? 0) * quantity;

  const resolvedConfig: ConfigRecord = {
    ...config,
    region,
    billingMode,
    usageHours: billingMode === "Pay-per-use" ? usageHours : null,
    vcpu: matchedFlavor.cpu,
    ramGiB: matchedFlavor.ramGiB,
    systemDisk: {
      type: diskType,
      sizeGiB: diskSizeGiB,
      ...(systemDisk?.iops != null ? { iops: systemDisk.iops } : {}),
      ...(systemDisk?.throughput != null ? { throughput: systemDisk.throughput } : {}),
    },
  };

  const suffix = billingMode === "Pay-per-use" ? `/${usageHours}h` : "/mo";

  let diskAmount = 0;
  let diskFormatted: string | null = null;
  if (inquiryDiskPricing) {
    diskAmount = inquiryDiskPricing.amount;
    diskFormatted = formatFlavorAmount(inquiryDiskPricing.currency, diskAmount, suffix);
  } else if (diskPrice) {
    diskAmount = diskPrice.amount * quantity;
    diskFormatted = formatFlavorAmount(diskPrice.currency, diskAmount, diskPrice.suffix);
  }

  const catalogTotal = flavorCard.priceValue * quantity;
  const inquiryTotal = inquiryDiskPricing
    ? (flavorAmount + inquiryDiskPricing.amount)
    : null;

  let priceWarning: string | undefined;
  if (inquiryTotal && Math.abs(catalogTotal - inquiryTotal) > 0.0001) {
    priceWarning = `Catalog price ($${catalogTotal.toFixed(5)}) differs from inquiry API ($${inquiryTotal.toFixed(5)})`;
  }

  return {
    pricing: {
      total: formatFlavorAmount("USD", inquiryTotal ?? catalogTotal, suffix),
      flavor: formatFlavorAmount("USD", flavorAmount, suffix),
      disk: diskFormatted,
      pricingSource: inquiryDiskPricing ? "inquiry" : "catalog",
      ...(priceWarning ? { priceWarning } : {}),
    },
    title: `Elastic Cloud Server ${flavor}`,
    productType: "ecs",
    config: resolvedConfig,
  };
}

function computeFlexusLPricing(config: ConfigRecord): ServerPricingResult {
  const region = (config.region as string) || "ap-southeast-1";
  const planId = config.planId as string | undefined;
  const quantity = Math.max(1, Math.floor(typeof config.quantity === "number" ? config.quantity : 1));

  if (!planId) {
    return { pricing: {}, title: "", productType: "flexus-l", config, error: "Missing required field: config.planId" };
  }

  const plan = findFlexusLPlan(planId);
  if (!plan) {
    return { pricing: {}, title: "", productType: "flexus-l", config, error: `Unknown Flexus L plan: ${planId}. Valid plans: basic_v3, basic_v4, basic_v5, basic_v6, basic_v7` };
  }

  const totalAmount = plan.monthlyPriceUsd * quantity;
  const resolvedConfig: ConfigRecord = {
    region,
    billingMode: "Yearly/Monthly",
    description: config.description ?? "Flexus L Instance",
    planId: plan.id,
    planTitle: plan.title,
    vcpu: plan.vcpu,
    ramGiB: plan.ramGiB,
    systemDiskGiB: plan.systemDiskGiB,
    peakBandwidthMbit: plan.peakBandwidthMbit,
    dataPackageTiB: plan.dataPackageTiB,
    referenceRegion: flexusLPricingReference.region,
  };

  return {
    pricing: {
      total: formatFlavorAmount("USD", totalAmount, "/mo"),
      flavor: formatFlavorAmount("USD", plan.monthlyPriceUsd, "/mo"),
    },
    title: `Flexus L Instance ${plan.title}`,
    productType: "flexus-l",
    config: resolvedConfig,
  };
}

function isConfigurableService(serviceCode: string): boolean {
  const catalogEntry = serviceCatalog.find((s) => s.code === serviceCode);
  if (!catalogEntry) return false;
  const definition = getConfigurableServiceDefinitionByCode(serviceCode);
  return definition?.implementation === "configurable" || definition?.implementation === "config-pilot";
}

export async function computeServerPricing(serviceCode: string, config: ConfigRecord): Promise<ServerPricingResult> {
  if (serviceCode === "ECS") {
    return computeEcsPricing(config);
  }

  if (serviceCode === "Flexus L") {
    return computeFlexusLPricing(config);
  }

  if (isConfigurableService(serviceCode)) {
    return computeConfigurablePricing(serviceCode, config);
  }

  return { pricing: {}, title: "", productType: "", config, error: `Unknown or unsupported service: ${serviceCode}` };
}
