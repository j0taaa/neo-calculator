import { fetchRegionSystemDiskPricing, systemDiskCodeMap, type DiskBillingMode, type SystemDiskOption } from "@/lib/evs-disk-pricing";
import { ensureRegionCatalogAvailable, listStoredEcsFlavors, type BillingMode, type StoredEcsFlavor } from "@/lib/ecs-flavor-catalog";
import { getCatalogRegionId, getRegionKeyFromCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export const NEO_BILLING_OPTIONS = ["Pay-per-use", "Yearly/Monthly", "RI"] as const;

export type NeoBillingOption = (typeof NEO_BILLING_OPTIONS)[number];

export type CloneableProduct = {
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
};

type CloneableProductConfig = {
  region?: unknown;
  billingMode?: unknown;
  usageHours?: unknown;
  description?: unknown;
  vcpu?: unknown;
  ramGiB?: unknown;
  systemDisk?: unknown;
  huaweiPayload?: unknown;
  diskType?: unknown;
  diskSizeGiB?: unknown;
};

type CloneablePayload = {
  selectedProduct?: Record<string, unknown>;
  rewriteValue?: Record<string, unknown>;
};

type CloneRequest = {
  name?: string | null;
  targetRegion?: HuaweiRegionKey | null;
  targetBillingMode?: NeoBillingOption | null;
};

type CloneableEcsRequirements = {
  region: HuaweiRegionKey;
  billingMode: NeoBillingOption;
  usageHours: number;
  vcpu: number;
  ramGiB: number;
  systemDiskType: SystemDiskOption;
  systemDiskSizeGiB: number;
};

type CloneDiskSelection = {
  systemDiskType: SystemDiskOption;
  rate: number;
};

type CloneFlavorSelection = {
  flavor: StoredEcsFlavor;
  catalogBillingMode: BillingMode;
  billingMode: NeoBillingOption;
  systemDiskType: SystemDiskOption;
  usageHours: number | null;
  flavorAmount: number;
  diskAmount: number;
  totalAmount: number;
  suffix: string;
  flavorSuffix: string;
  diskSuffix: string;
};

type RegionCatalogSnapshot = {
  flavors: StoredEcsFlavor[];
  diskPricing: Awaited<ReturnType<typeof fetchRegionSystemDiskPricing>>;
};

type CloneListProductsResult = {
  name: string;
  products: CloneableProduct[];
  cloneSummary: {
    totalProducts: number;
    convertedEcsCount: number;
    copiedUnchangedCount: number;
    copiedUnsupportedCount: number;
  };
};

const DEFAULT_USAGE_HOURS = 744;
const DEFAULT_SYSTEM_DISK_SIZE_GIB = 40;
const DEFAULT_CURRENCY = "USD";

const SYSTEM_DISK_OPTIONS = Object.keys(systemDiskCodeMap) as SystemDiskOption[];
const SYSTEM_DISK_CODE_TO_OPTION = Object.fromEntries(
  Object.entries(systemDiskCodeMap).map(([option, code]) => [code, option as SystemDiskOption]),
) as Record<string, SystemDiskOption>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function formatAmount(amount: number, suffix: string) {
  return `${DEFAULT_CURRENCY} ${amount.toFixed(amount < 1 ? 4 : 2)}${suffix}`;
}

function hasNativeFlavorPrice(flavor: StoredEcsFlavor, mode: BillingMode) {
  return !flavor.priceSources?.[mode] || flavor.priceSources[mode] === "catalog_plan";
}

function isNeoBillingOption(value: unknown): value is NeoBillingOption {
  return typeof value === "string" && NEO_BILLING_OPTIONS.includes(value as NeoBillingOption);
}

function pickPresentString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extractCloneableProductDescription(product: CloneableProduct, fallback = "") {
  if (isRecord(product.config)) {
    const description = pickPresentString(
      product.config.description,
      isRecord(product.config.huaweiPayload) && isRecord(product.config.huaweiPayload.selectedProduct)
        ? product.config.huaweiPayload.selectedProduct.description
        : "",
      isRecord(product.config.huaweiPayload) && isRecord(product.config.huaweiPayload.rewriteValue)
        ? product.config.huaweiPayload.rewriteValue.global_DESCRIPTION
        : "",
    );
    if (description) {
      return description;
    }
  }

  return fallback;
}

function toHuaweiRegionKey(value: unknown): HuaweiRegionKey | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  if (value in huaweiRegions) {
    return value as HuaweiRegionKey;
  }

  return getRegionKeyFromCatalogRegionId(value.trim());
}

function toSystemDiskOption(value: unknown): SystemDiskOption | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  if (value in systemDiskCodeMap) {
    return value as SystemDiskOption;
  }

  return SYSTEM_DISK_CODE_TO_OPTION[value.trim()] ?? null;
}

function normalizeUsageHours(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : DEFAULT_USAGE_HOURS;
}

function normalizeDiskSize(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(DEFAULT_SYSTEM_DISK_SIZE_GIB, Math.floor(value));
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(DEFAULT_SYSTEM_DISK_SIZE_GIB, Math.floor(parsed)) : DEFAULT_SYSTEM_DISK_SIZE_GIB;
}

function parseCpuCountFromFlavorInfo(flavorInfo: Record<string, unknown>) {
  const sysDesc = pickPresentString(flavorInfo.productSpecSysDesc);
  const sysMatch = sysDesc.match(/vCPUs:(\d+)CORE/i);
  if (sysMatch) {
    return Number.parseInt(sysMatch[1], 10);
  }

  const cpuText = pickPresentString(flavorInfo.cpu);
  const cpuMatch = cpuText.match(/(\d+)/);
  if (cpuMatch) {
    return Number.parseInt(cpuMatch[1], 10);
  }

  const resourceCode = pickPresentString(flavorInfo.resourceSpecCode);
  const resourceMatch = resourceCode.match(/(?:^|\.)(\d+)u\./i);
  return resourceMatch ? Number.parseInt(resourceMatch[1], 10) : 0;
}

function parseRamGiBFromFlavorInfo(flavorInfo: Record<string, unknown>) {
  const sysDesc = pickPresentString(flavorInfo.productSpecSysDesc);
  const mbMatch = sysDesc.match(/Memory:(\d+)MB/i);
  if (mbMatch) {
    return Number.parseInt(mbMatch[1], 10) / 1024;
  }

  const memText = pickPresentString(flavorInfo.mem);
  const memMatch = memText.match(/(\d+(?:\.\d+)?)/);
  if (memMatch) {
    return Number.parseFloat(memMatch[1]);
  }

  const resourceCode = pickPresentString(flavorInfo.resourceSpecCode);
  const resourceMatch = resourceCode.match(/(?:^|\.)(\d+)u\.(\d+(?:\.\d+)?)g/i);
  return resourceMatch ? Number.parseFloat(resourceMatch[2]) : 0;
}

function getPayloadPricingMode(payload: CloneablePayload): NeoBillingOption {
  const selectedProduct = isRecord(payload.selectedProduct) ? payload.selectedProduct : {};
  const rewriteValue = isRecord(payload.rewriteValue) ? payload.rewriteValue : {};
  const globalRegionInfo = isRecord(rewriteValue.global_REGIONINFO) ? rewriteValue.global_REGIONINFO : {};
  const candidate = pickPresentString(
    selectedProduct.calculatorPricingMode,
    selectedProduct.chargeMode,
    rewriteValue.global_PRICINGMODE,
    globalRegionInfo.chargeMode,
  );

  if (candidate === "ONDEMAND") {
    return "Pay-per-use";
  }

  if (candidate === "RI") {
    return "RI";
  }

  return "Yearly/Monthly";
}

function isPayloadEcs(payload: CloneablePayload) {
  const selectedProduct = isRecord(payload.selectedProduct) ? payload.selectedProduct : {};
  const serviceCode = pickPresentString(selectedProduct.serviceCode).toLowerCase();
  if (serviceCode === "ecs") {
    return true;
  }

  const productInfos = Array.isArray(selectedProduct.productAllInfos) ? selectedProduct.productAllInfos : [];
  return productInfos.some((info) => isRecord(info) && pickPresentString(info.resourceType).includes(".vm"));
}

function extractRequirementsFromPayload(config: CloneableProductConfig): CloneableEcsRequirements | null {
  const payload = isRecord(config.huaweiPayload) ? (config.huaweiPayload as CloneablePayload) : null;
  if (!payload || !isPayloadEcs(payload)) {
    return null;
  }

  const selectedProduct = isRecord(payload.selectedProduct) ? payload.selectedProduct : {};
  const productInfos = Array.isArray(selectedProduct.productAllInfos)
    ? selectedProduct.productAllInfos.filter((info): info is Record<string, unknown> => isRecord(info))
    : [];
  const vmInfo = productInfos.find((info) => pickPresentString(info.resourceType).includes(".vm")) ?? productInfos[0] ?? null;
  const diskInfo = productInfos.find((info) => pickPresentString(info.resourceType).includes(".volume")) ?? productInfos[2] ?? null;

  if (!vmInfo || !diskInfo) {
    return null;
  }

  const region = toHuaweiRegionKey(pickPresentString(config.region, selectedProduct.region));
  const systemDiskType = toSystemDiskOption(pickPresentString(diskInfo.resourceSpecCode, config.diskType));
  const vcpu = parseCpuCountFromFlavorInfo(vmInfo);
  const ramGiB = parseRamGiBFromFlavorInfo(vmInfo);
  if (!region || !systemDiskType || vcpu <= 0 || ramGiB <= 0) {
    return null;
  }

  return {
    region,
    billingMode: getPayloadPricingMode(payload),
    usageHours: normalizeUsageHours(
      isRecord(selectedProduct.purchaseTime) ? selectedProduct.purchaseTime.measureValue : selectedProduct.purchaseTime,
    ),
    vcpu,
    ramGiB,
    systemDiskType,
    systemDiskSizeGiB: normalizeDiskSize(
      typeof diskInfo.resourceSize === "number" ? diskInfo.resourceSize : config.diskSizeGiB,
    ),
  };
}

function extractRequirementsFromLocalEcsConfig(config: CloneableProductConfig): CloneableEcsRequirements | null {
  const region = toHuaweiRegionKey(config.region);
  const billingMode = isNeoBillingOption(config.billingMode) ? config.billingMode : null;
  const systemDisk = isRecord(config.systemDisk) ? config.systemDisk : {};
  const systemDiskType = toSystemDiskOption(pickPresentString(systemDisk.type));
  const vcpu = typeof config.vcpu === "number" ? config.vcpu : Number(config.vcpu ?? 0);
  const ramGiB = typeof config.ramGiB === "number" ? config.ramGiB : Number(config.ramGiB ?? 0);

  if (!region || !billingMode || !systemDiskType || !Number.isFinite(vcpu) || !Number.isFinite(ramGiB) || vcpu <= 0 || ramGiB <= 0) {
    return null;
  }

  return {
    region,
    billingMode,
    usageHours: normalizeUsageHours(config.usageHours),
    vcpu: Math.max(1, vcpu),
    ramGiB: Math.max(1, ramGiB),
    systemDiskType,
    systemDiskSizeGiB: normalizeDiskSize(systemDisk.sizeGiB),
  };
}

function extractCloneableEcsRequirements(product: CloneableProduct): CloneableEcsRequirements | null {
  if (!isRecord(product.config)) {
    return null;
  }

  const config = product.config as CloneableProductConfig;

  if (product.productType === "ecs") {
    return extractRequirementsFromLocalEcsConfig(config) ?? extractRequirementsFromPayload(config);
  }

  return extractRequirementsFromPayload(config);
}

function resolveDiskSelection(
  diskPricing: Awaited<ReturnType<typeof fetchRegionSystemDiskPricing>>,
  preferredType: SystemDiskOption,
  billingMode: DiskBillingMode,
): CloneDiskSelection | null {
  const preferredRate = diskPricing.prices[preferredType]?.[billingMode];
  if (typeof preferredRate === "number" && Number.isFinite(preferredRate)) {
    return {
      systemDiskType: preferredType,
      rate: preferredRate,
    };
  }

  const available = SYSTEM_DISK_OPTIONS
    .map((option) => ({
      systemDiskType: option,
      rate: diskPricing.prices[option]?.[billingMode],
    }))
    .filter((entry): entry is CloneDiskSelection => typeof entry.rate === "number" && Number.isFinite(entry.rate));

  if (!available.length) {
    return null;
  }

  return available.sort((left, right) => left.rate - right.rate || left.systemDiskType.localeCompare(right.systemDiskType))[0];
}

function compareFlavorSelections(left: CloneFlavorSelection, right: CloneFlavorSelection) {
  if (left.totalAmount !== right.totalAmount) {
    return left.totalAmount - right.totalAmount;
  }

  if (left.flavor.cpu !== right.flavor.cpu) {
    return left.flavor.cpu - right.flavor.cpu;
  }

  if (left.flavor.ramGiB !== right.flavor.ramGiB) {
    return left.flavor.ramGiB - right.flavor.ramGiB;
  }

  return left.flavor.resourceSpecCode.localeCompare(right.flavor.resourceSpecCode);
}

function buildSelectionForCatalogMode(
  flavors: StoredEcsFlavor[],
  diskPricing: Awaited<ReturnType<typeof fetchRegionSystemDiskPricing>>,
  requirements: CloneableEcsRequirements,
  mode: BillingMode,
  billingMode: NeoBillingOption,
): CloneFlavorSelection | null {
  const diskMode: DiskBillingMode = mode === "RI" ? "ONDEMAND" : (mode as DiskBillingMode);
  const diskSelection = resolveDiskSelection(diskPricing, requirements.systemDiskType, diskMode);
  if (!diskSelection) {
    return null;
  }

  const candidates: CloneFlavorSelection[] = [];

  for (const flavor of flavors) {
    if (flavor.cpu < requirements.vcpu || flavor.ramGiB < requirements.ramGiB) {
      continue;
    }

    if (mode === "ONDEMAND" && !hasNativeFlavorPrice(flavor, mode)) {
      continue;
    }

    const unitPrice = flavor.prices[mode];
    if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice)) {
      continue;
    }

    if (mode === "ONDEMAND") {
      const flavorAmount = roundAmount(unitPrice * requirements.usageHours);
      const diskAmount = roundAmount(diskSelection.rate * requirements.systemDiskSizeGiB * requirements.usageHours);
      candidates.push({
        flavor,
        billingMode,
        catalogBillingMode: mode,
        systemDiskType: diskSelection.systemDiskType,
        usageHours: requirements.usageHours,
        flavorAmount,
        diskAmount,
        totalAmount: roundAmount(flavorAmount + diskAmount),
        suffix: `/${requirements.usageHours}h`,
        flavorSuffix: `/${requirements.usageHours}h`,
        diskSuffix: `/${requirements.usageHours}h`,
      });
      continue;
    }

    if (mode === "RI") {
      const flavorAmount = roundAmount(unitPrice);
      const diskAmount = roundAmount(diskSelection.rate * requirements.systemDiskSizeGiB * 24 * 365);
      candidates.push({
        flavor,
        billingMode,
        catalogBillingMode: mode,
        systemDiskType: diskSelection.systemDiskType,
        usageHours: null,
        flavorAmount,
        diskAmount,
        totalAmount: roundAmount(flavorAmount + diskAmount),
        suffix: "",
        flavorSuffix: "",
        diskSuffix: "",
      });
      continue;
    }

    const flavorAmount = roundAmount(unitPrice);
    const diskAmount = roundAmount(diskSelection.rate * requirements.systemDiskSizeGiB);
    const suffix = mode === "MONTHLY" ? "/mo" : "/yr";
    candidates.push({
      flavor,
      billingMode,
      catalogBillingMode: mode,
      systemDiskType: diskSelection.systemDiskType,
      usageHours: null,
      flavorAmount,
      diskAmount,
      totalAmount: roundAmount(flavorAmount + diskAmount),
      suffix,
      flavorSuffix: suffix,
      diskSuffix: suffix,
    });
  }

  if (!candidates.length) {
    return null;
  }

  return candidates.sort(compareFlavorSelections)[0];
}

export function selectCheapestFlavorForClone(
  flavors: StoredEcsFlavor[],
  diskPricing: Awaited<ReturnType<typeof fetchRegionSystemDiskPricing>>,
  requirements: CloneableEcsRequirements,
  billingMode: NeoBillingOption,
): CloneFlavorSelection | null {
  if (billingMode === "Pay-per-use") {
    return buildSelectionForCatalogMode(flavors, diskPricing, requirements, "ONDEMAND", billingMode);
  }

  if (billingMode === "RI") {
    return buildSelectionForCatalogMode(flavors, diskPricing, requirements, "RI", billingMode);
  }

  const monthly = buildSelectionForCatalogMode(flavors, diskPricing, requirements, "MONTHLY", billingMode);
  if (monthly) {
    return monthly;
  }

  return buildSelectionForCatalogMode(flavors, diskPricing, requirements, "YEARLY", billingMode);
}

function buildConvertedEcsProduct(
  product: CloneableProduct,
  requirements: CloneableEcsRequirements,
  targetRegion: HuaweiRegionKey,
  billingMode: NeoBillingOption,
  selection: CloneFlavorSelection,
): CloneableProduct {
  const serviceName = product.serviceName.trim() || "Elastic Cloud Server";
  const description = extractCloneableProductDescription(product, selection.flavor.description || serviceName);

  return {
    serviceCode: product.serviceCode || "ECS",
    serviceName,
    productType: "ecs",
    title: `${serviceName} ${selection.flavor.resourceSpecCode}`,
    quantity: product.quantity,
    config: {
      region: targetRegion,
      billingMode,
      usageHours: billingMode === "Pay-per-use" ? selection.usageHours ?? requirements.usageHours : null,
      description,
      flavor: selection.flavor.resourceSpecCode,
      vcpu: selection.flavor.cpu,
      ramGiB: selection.flavor.ramGiB,
      systemDisk: {
        type: selection.systemDiskType,
        sizeGiB: requirements.systemDiskSizeGiB,
      },
    },
    pricing: {
      total: formatAmount(selection.totalAmount, selection.suffix),
      flavor: formatAmount(selection.flavorAmount, selection.flavorSuffix),
      disk: formatAmount(selection.diskAmount, selection.diskSuffix),
    },
  };
}

function buildConversionErrorMessage(
  product: CloneableProduct,
  region: HuaweiRegionKey,
  billingMode: NeoBillingOption,
  requirements: CloneableEcsRequirements,
) {
  return [
    `Unable to clone ${product.title} to ${huaweiRegions[region].short}.`,
    `No available ${billingMode} flavor meets at least ${requirements.vcpu} vCPUs and ${requirements.ramGiB} GiB RAM.`,
  ].join(" ");
}

async function loadRegionCatalogSnapshot(
  region: HuaweiRegionKey,
  cache: Map<HuaweiRegionKey, Promise<RegionCatalogSnapshot>>,
) {
  const cached = cache.get(region);
  if (cached) {
    return cached;
  }

  const catalogRegionId = getCatalogRegionId(region);
  if (!catalogRegionId) {
    throw new Error(`Cloning is not supported for ${huaweiRegions[region].short} because its ECS catalog region is unavailable.`);
  }

  const pending = (async () => {
    await ensureRegionCatalogAvailable(catalogRegionId);
    const [diskPricing, flavors] = await Promise.all([
      fetchRegionSystemDiskPricing(catalogRegionId),
      Promise.resolve(listStoredEcsFlavors(catalogRegionId)),
    ]);

    return {
      diskPricing,
      flavors,
    } satisfies RegionCatalogSnapshot;
  })();

  cache.set(region, pending);
  return pending;
}

export function buildClonedListName(sourceName: string, request: CloneRequest) {
  const explicitName = request.name?.trim();
  if (explicitName) {
    return explicitName;
  }

  const base = sourceName.trim() || "NeoCalculator cart";
  const suffixParts: string[] = [];
  if (request.targetRegion) {
    suffixParts.push(huaweiRegions[request.targetRegion].short);
  }
  if (request.targetBillingMode) {
    suffixParts.push(request.targetBillingMode);
  }

  return suffixParts.length ? `${base} (${suffixParts.join(" · ")})` : `${base} (Copy)`;
}

export async function cloneListProducts(
  sourceName: string,
  products: CloneableProduct[],
  request: CloneRequest,
): Promise<CloneListProductsResult> {
  const regionCache = new Map<HuaweiRegionKey, Promise<RegionCatalogSnapshot>>();
  const nextProducts: CloneableProduct[] = [];
  let convertedEcsCount = 0;
  let copiedUnchangedCount = 0;
  let copiedUnsupportedCount = 0;

  for (const product of products) {
    const requirements = extractCloneableEcsRequirements(product);
    const targetRegion = request.targetRegion ?? requirements?.region ?? null;
    const targetBillingMode = request.targetBillingMode ?? requirements?.billingMode ?? null;
    const requestedConversion = Boolean(request.targetRegion || request.targetBillingMode);
    const needsConversion = Boolean(
      requirements
      && targetRegion
      && targetBillingMode
      && (targetRegion !== requirements.region || targetBillingMode !== requirements.billingMode),
    );

    if (!requirements || !targetRegion || !targetBillingMode) {
      nextProducts.push(cloneJson(product));
      if (requestedConversion) {
        copiedUnsupportedCount += 1;
      } else {
        copiedUnchangedCount += 1;
      }
      continue;
    }

    if (!needsConversion) {
      nextProducts.push(cloneJson(product));
      copiedUnchangedCount += 1;
      continue;
    }

    const snapshot = await loadRegionCatalogSnapshot(targetRegion, regionCache);
    const selection = selectCheapestFlavorForClone(snapshot.flavors, snapshot.diskPricing, requirements, targetBillingMode);
    if (!selection) {
      throw new Error(buildConversionErrorMessage(product, targetRegion, targetBillingMode, requirements));
    }

    nextProducts.push(buildConvertedEcsProduct(product, requirements, targetRegion, targetBillingMode, selection));
    convertedEcsCount += 1;
  }

  return {
    name: buildClonedListName(sourceName, request),
    products: nextProducts,
    cloneSummary: {
      totalProducts: nextProducts.length,
      convertedEcsCount,
      copiedUnchangedCount,
      copiedUnsupportedCount,
    },
  };
}
