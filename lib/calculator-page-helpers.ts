import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export type BillingOption = "Pay-per-use" | "RI" | "Yearly/Monthly" | "One-time";
export type FlavorBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY" | "RI" | "ONETIME";
export type FlavorPriceSource = "catalog_plan" | "rate_inquiry";

export type CatalogFlavor = {
  resourceSpecCode: string;
  family: string | null;
  architecture: string | null;
  series: string | null;
  description: string | null;
  cpu: number;
  ramGiB: number;
  prices: Partial<Record<FlavorBillingMode, number>>;
  priceSources?: Partial<Record<FlavorBillingMode, FlavorPriceSource>>;
  currency: string;
  updatedAt: string;
};

export type FlavorCard = {
  name: string;
  vcpu: string;
  ram: string;
  family: string;
  price: string;
  priceValue: number;
  priceCurrency: string;
  priceSuffix: string;
  priceModeLabel: string;
  flavorPrice: string | null;
  description: string | null;
  productType: "ecs" | "flexus-l";
  serviceCode: string;
  serviceName: string;
  referencePlanId?: string;
  includedSystemDiskGiB?: number;
  peakBandwidthMbit?: number;
  dataPackageTiB?: number;
};

export type DiskPricing<SystemDiskOption extends string> = {
  currency: string;
  prices: Record<SystemDiskOption, Partial<Record<FlavorBillingMode, number>>>;
};

export type AppList = {
  id: string;
  name: string;
  ownerUserId: string;
  accessLevel: "owner" | "project_collaborator" | "list_collaborator";
  canShare: boolean;
  huaweiCartKey: string | null;
  huaweiCartName: string | null;
  huaweiLastSyncedAt: string | null;
  huaweiLastError: string | null;
  huaweiLastRemoteUpdatedAt: number | null;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  products: AppProduct[];
};

export type AppProduct = {
  id: string;
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
  createdAt?: string;
  updatedAt: string;
};

export type AppProject = {
  id: string;
  name: string;
  ownerUserId: string;
  accessLevel: "owner" | "project_collaborator" | "list_collaborator";
  canShare: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  lists: AppList[];
};

export type HuaweiCartSummary = {
  key: string;
  name: string;
  updateTime: number;
  billingMode: string | null;
  totalAmount: number | null;
  originalAmount: number | null;
  associatedListId: string | null;
};

export type ProductMutationBody = {
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
};

type FlexusLPlanLike = {
  id: string;
  title: string;
  vcpu: number;
  ramGiB: number;
  systemDiskGiB: number;
  peakBandwidthMbit: number;
  dataPackageTiB: number;
  monthlyPriceUsd: number;
};

const flavorPricePriority: Array<{ mode: FlavorBillingMode; label: string; suffix: string }> = [
  { mode: "ONDEMAND", label: "Pay-per-use", suffix: "/h" },
  { mode: "MONTHLY", label: "Monthly", suffix: "/mo" },
  { mode: "YEARLY", label: "Yearly", suffix: "/yr" },
  { mode: "RI", label: "RI", suffix: "" },
];

const billingOptionConfig: Record<
  BillingOption,
  {
    modes: FlavorBillingMode[];
    label: string;
    suffix: string;
  }
> = {
  "Yearly/Monthly": {
    modes: ["MONTHLY", "YEARLY"],
    label: "Monthly",
    suffix: "/mo",
  },
  "Pay-per-use": {
    modes: ["ONDEMAND"],
    label: "Pay-per-use",
    suffix: "/h",
  },
  RI: {
    modes: ["RI"],
    label: "RI",
    suffix: "",
  },
  "One-time": {
    modes: ["ONETIME"],
    label: "One-time",
    suffix: "",
  },
};

export function formatFlavorAmount(currency: string, amount: number, suffix: string) {
  return `${currency} ${amount.toFixed(amount < 1 ? 4 : 2)}${suffix}`;
}

export function getUsageSuffix(hours: number) {
  return `/${hours}h`;
}

export function getMonthUsageSuffix(months: number) {
  return `/${Math.max(1, Math.floor(months))}mo`;
}

export function getYearlyMonthlyDiskAmount(
  monthlyRate: number | undefined,
  yearlyRate: number | undefined,
  systemDiskSizeGiB: number,
  durationMonths: number,
) {
  const normalizedMonths = Math.max(1, Math.floor(durationMonths));
  const normalizedSize = Math.max(1, Math.floor(systemDiskSizeGiB));
  let remainingMonths = normalizedMonths;
  let total = 0;

  if (typeof yearlyRate === "number" && Number.isFinite(yearlyRate) && yearlyRate > 0) {
    const wholeYears = Math.floor(remainingMonths / 12);
    if (wholeYears > 0) {
      total += yearlyRate * normalizedSize * wholeYears;
      remainingMonths -= wholeYears * 12;
    }
  }

  if (remainingMonths > 0) {
    if (typeof monthlyRate === "number" && Number.isFinite(monthlyRate) && monthlyRate > 0) {
      total += monthlyRate * normalizedSize * remainingMonths;
    } else if (typeof yearlyRate === "number" && Number.isFinite(yearlyRate) && yearlyRate > 0) {
      total += (yearlyRate / 12) * normalizedSize * remainingMonths;
    } else {
      return null;
    }
  }

  return total;
}

export function getDiskPriceForBillingOption<SystemDiskOption extends string>(
  diskPricing: DiskPricing<SystemDiskOption> | null,
  systemDiskType: SystemDiskOption,
  systemDiskSizeGiB: number,
  billingOption: BillingOption,
  usageHours: number,
  durationMonths = 1,
) {
  if (!diskPricing || systemDiskSizeGiB <= 0) {
    return null;
  }

  const rates = diskPricing.prices[systemDiskType];
  if (!rates) {
    return null;
  }

  if (billingOption === "Pay-per-use") {
    const rate = rates.ONDEMAND;
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      return null;
    }

    return {
      currency: diskPricing.currency,
      amount: rate * systemDiskSizeGiB * usageHours,
      label: "Disk",
      suffix: getUsageSuffix(usageHours),
    };
  }

  if (billingOption === "Yearly/Monthly") {
    const amount = getYearlyMonthlyDiskAmount(rates.MONTHLY, rates.YEARLY, systemDiskSizeGiB, durationMonths);
    if (amount != null) {
      return {
        currency: diskPricing.currency,
        amount,
        label: "Disk",
        suffix: getMonthUsageSuffix(durationMonths),
      };
    }

    return null;
  }

  const onDemandRate = rates.ONDEMAND;
  if (typeof onDemandRate !== "number" || !Number.isFinite(onDemandRate)) {
    return null;
  }

  return {
    currency: diskPricing.currency,
    amount: onDemandRate * systemDiskSizeGiB * 24 * 365,
    label: "Disk (annualized)",
    suffix: "",
  };
}

export function getFlavorPriceForBillingOption(flavor: CatalogFlavor, billingOption: BillingOption, usageHours: number) {
  const config = billingOptionConfig[billingOption];

  for (const mode of config.modes) {
    if (mode === "ONDEMAND" && flavor.priceSources?.ONDEMAND && flavor.priceSources.ONDEMAND !== "catalog_plan") {
      continue;
    }

    const amount = flavor.prices[mode];
    if (typeof amount === "number" && Number.isFinite(amount)) {
      const modeDetails = flavorPricePriority.find((entry) => entry.mode === mode);
      return {
        amount: billingOption === "Pay-per-use" ? amount * usageHours : amount,
        label: modeDetails?.label ?? config.label,
        suffix: billingOption === "Pay-per-use" ? getUsageSuffix(usageHours) : modeDetails?.suffix ?? config.suffix,
      };
    }
  }

  return null;
}

export function toFlavorCard<SystemDiskOption extends string>(
  flavor: CatalogFlavor,
  billingOption: BillingOption,
  usageHours: number,
  diskPrice: ReturnType<typeof getDiskPriceForBillingOption<SystemDiskOption>>,
): FlavorCard {
  const preferredPrice = getFlavorPriceForBillingOption(flavor, billingOption, usageHours);
  const familyParts = [flavor.family, flavor.architecture].filter(Boolean);
  const totalAmount = preferredPrice ? preferredPrice.amount + (diskPrice?.amount ?? 0) : Number.POSITIVE_INFINITY;

  return {
    name: flavor.resourceSpecCode,
    vcpu: String(flavor.cpu),
    ram: String(Number.isInteger(flavor.ramGiB) ? flavor.ramGiB : Number(flavor.ramGiB.toFixed(1))),
    family: familyParts.join(" · ") || flavor.series || "ECS",
    price: preferredPrice ? formatFlavorAmount(flavor.currency, totalAmount, preferredPrice.suffix) : "Price unavailable",
    priceValue: totalAmount,
    priceCurrency: flavor.currency,
    priceSuffix: preferredPrice?.suffix ?? "",
    priceModeLabel: preferredPrice?.label ?? "Unavailable",
    flavorPrice: preferredPrice ? formatFlavorAmount(flavor.currency, preferredPrice.amount, preferredPrice.suffix) : null,
    description: flavor.description,
    productType: "ecs",
    serviceCode: "ECS",
    serviceName: "Elastic Cloud Server",
  };
}

export function toFlexusLFlavorCard(plan: FlexusLPlanLike, billingOption: BillingOption, usageHours: number): FlavorCard {
  const priceSuffix = billingOption === "Pay-per-use" ? getUsageSuffix(usageHours) : "/mo";
  const priceModeLabel =
    billingOption === "RI" ? "RI reference" : billingOption === "Pay-per-use" ? "Pay-per-use reference" : "Monthly";

  return {
    name: `Flexus L ${plan.title}`,
    vcpu: String(plan.vcpu),
    ram: String(plan.ramGiB),
    family: `Flexus L · ${plan.systemDiskGiB} GiB included · ${plan.dataPackageTiB} TB/month`,
    price: formatFlavorAmount("USD", plan.monthlyPriceUsd, priceSuffix),
    priceValue: plan.monthlyPriceUsd,
    priceCurrency: "USD",
    priceSuffix,
    priceModeLabel,
    flavorPrice: formatFlavorAmount("USD", plan.monthlyPriceUsd, priceSuffix),
    description: `Flexus L bundled plan with ${plan.systemDiskGiB} GiB system disk, ${plan.peakBandwidthMbit} Mbit/s peak bandwidth, and ${plan.dataPackageTiB} TB/month.`,
    productType: "flexus-l",
    serviceCode: "Flexus L",
    serviceName: "Flexus L Instance",
    referencePlanId: plan.id,
    includedSystemDiskGiB: plan.systemDiskGiB,
    peakBandwidthMbit: plan.peakBandwidthMbit,
    dataPackageTiB: plan.dataPackageTiB,
  };
}

export function getFirstListId(projects: AppProject[]) {
  return projects[0]?.lists[0]?.id ?? "";
}

export function getProjectCloneDefaultName(
  projectName: string,
  targetRegion: HuaweiRegionKey | "",
  targetBillingMode: BillingOption | "",
) {
  const base = projectName.trim() || "NeoCalculator project";
  const suffixParts: string[] = [];
  if (targetRegion) {
    suffixParts.push(huaweiRegions[targetRegion].short);
  }
  if (targetBillingMode) {
    suffixParts.push(targetBillingMode);
  }

  return suffixParts.length ? `${base} ${suffixParts.join(" ")}` : `${base} (Copy)`;
}

export function getCartCloneDefaultName(
  listName: string,
  targetRegion: HuaweiRegionKey | "",
  targetBillingMode: BillingOption | "",
) {
  const base = listName.trim() || "NeoCalculator cart";
  const suffixParts: string[] = [];
  if (targetRegion) {
    suffixParts.push(huaweiRegions[targetRegion].short);
  }
  if (targetBillingMode) {
    suffixParts.push(targetBillingMode);
  }

  return suffixParts.length ? `${base} (${suffixParts.join(" · ")})` : `${base} (Copy)`;
}

export async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export async function parseJsonFile(file: File) {
  const text = await file.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Import file is not valid JSON");
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

export function getProductPriceSummary(product: AppProduct): string {
  if (isRecord(product.pricing) && typeof product.pricing.total === "string" && product.pricing.total.trim()) {
    return product.pricing.total.trim();
  }

  return "Price unavailable";
}

export function splitProductPriceSummary(product: AppProduct) {
  const summary = getProductPriceSummary(product);
  const slashIndex = summary.indexOf("/");

  if (slashIndex === -1) {
    return {
      amount: summary,
      timeframe: null,
    };
  }

  return {
    amount: summary.slice(0, slashIndex),
    timeframe: summary.slice(slashIndex + 1),
  };
}

export function splitPriceDisplay(summary: string) {
  const slashIndex = summary.indexOf("/");

  if (slashIndex === -1) {
    return {
      amount: summary,
      timeframe: null,
    };
  }

  return {
    amount: summary.slice(0, slashIndex),
    timeframe: summary.slice(slashIndex + 1),
  };
}
