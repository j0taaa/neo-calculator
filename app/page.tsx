"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { EcsCalculatorPanel } from "@/components/calculators/ecs-calculator-panel";
import { ObsCalculatorPanel } from "@/components/calculators/obs-calculator-panel";
import { EvsCalculatorPanel } from "@/components/calculators/evs-calculator-panel";
import { FlexusLCalculatorPanel } from "@/components/calculators/flexus-l-calculator-panel";
import { CceCalculatorPanel } from "@/components/calculators/cce-calculator-panel";
import { CciCalculatorPanel } from "@/components/calculators/cci-calculator-panel";
import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";
import { ElbCalculatorPanel } from "@/components/calculators/elb-calculator-panel";
import { EipCalculatorPanel } from "@/components/calculators/eip-calculator-panel";
import { NatCalculatorPanel } from "@/components/calculators/nat-calculator-panel";
import { VpnCalculatorPanel } from "@/components/calculators/vpn-calculator-panel";
import { ServiceBatchAddPanel } from "@/components/calculators/service-batch-add-panel";
import { UnsupportedServicePanel } from "@/components/calculators/unsupported-service-panel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  findServiceCatalogEntry,
  getConfigurableServiceBundleByCode,
  getConfigurableServiceDefinitionByCode,
  getConfiguredBillingOptions,
  isServiceFieldVisible,
  serviceCatalog,
  supportedBatchAddServiceCodes,
  supportedCalculatorServiceCodes,
} from "@/lib/service-config";
import { useSessionContext } from "@/components/session-provider";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { findBestFlexusLPlan, findFlexusLPlan, flexusLPlans, flexusLPricingReference } from "@/lib/flexus-l-catalog";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import {
  buildObsHuaweiPayload,
  convertObsCapacityToGb,
  convertObsRequestCountToInput,
  convertObsRequestInputToCount,
  estimateObsConfiguration,
  isObsCapacityUnit,
  isObsProductType,
  isObsRedundancy,
  isObsRestorationType,
  isObsStorageClass,
  getObsRedundancyOptions,
  getObsStorageClassOptions,
  listObsProductTypes,
  listObsRestorationTypes,
  listObsRedundancies,
  listObsStorageClasses,
  normalizeObsPositiveNumber,
  obsCapacityUnits,
  obsPricingReference,
  obsRequestInputMultiplier,
  shouldShowObsRedundancySelector,
  shouldShowObsPullTraffic,
  type ObsCapacityUnit,
  type ObsEstimateInput,
  type ObsPricingCatalog,
  type ObsProductType,
  type ObsRedundancy,
  type ObsRestorationType,
  type ObsStorageClass,
} from "@/lib/obs-catalog";
import {
  buildListExportPayload,
  buildNamedExportFilename,
  buildProjectExportPayload,
  downloadProjectWorkbookFile,
  downloadTextFile,
} from "@/lib/resource-export";
import {
  cceDefaults,
  ccePricingReference,
  estimateCceConfiguration,
  getFallbackCcePricingCatalog,
  listCceClusterScales,
  listCceMasterNodes,
  type CceClusterScale,
  type CceMasterNodes,
  type CcePricingCatalog,
} from "@/lib/cce-catalog";
import {
  eipDedicatedChargeModeOptions,
  eipDefaults,
  eipPricingReference,
  eipSharedBandwidthMinimumMbit,
  eipSharedChargeModeOptions,
  eipSharedEnhanced95MinimumMbit,
  eipTrafficUnitOptions,
  eipTypeOptions,
  estimateEipConfiguration,
  type EipChargeMode,
  type EipPricingCatalog,
  type EipTrafficUnit,
  type EipType,
} from "@/lib/eip-catalog";
import {
  elbDefaults,
  elbDedicatedProtocolOptions,
  elbFixedLoadBalancingTypeOptions,
  elbFixedSpecOptions,
  elbPricingReference,
  elbTrafficUnitOptions,
  estimateElbConfiguration,
  getElbBillingOptions,
  shouldShowElbSharedBandwidth,
  shouldShowElbSharedChargeMode,
  shouldShowElbSharedTraffic,
  type ElbDedicatedProtocol,
  type ElbEstimateInput,
  type ElbFixedAvailabilityAzCount,
  type ElbFixedLoadBalancingType,
  type ElbFixedSpecName,
  type ElbInternetChargeMode,
  type ElbNetworkType,
  type ElbProtocolSectionInput,
  type ElbPricingCatalog,
  type ElbSpecificationType,
  type ElbSubAz,
  type ElbTrafficUnit,
  type ElbType,
} from "@/lib/elb-catalog";
import {
  estimateNatConfiguration,
  getFallbackNatPricingCatalog,
  listNatGatewaySizes,
  listNatGatewayTypes,
  natDefaults,
  natPricingReference,
  type NatGatewaySize,
  type NatGatewayType,
  type NatPricingCatalog,
} from "@/lib/nat-catalog";
import {
  estimateModelArtsConfiguration,
  isModelArtsDurationMonths,
  isModelArtsResourceType,
  listModelArtsResourceTypes,
  listModelArtsSpecifications,
  modelArtsDefaults,
  modelArtsDurationMonthOptions,
  modelArtsPricingReference,
  type ModelArtsPricingCatalog,
  type ModelArtsResourceType,
} from "@/lib/modelarts-catalog";
import {
  estimateVpnConfiguration,
  getFallbackVpnPricingCatalog,
  getVpnBillingOptions,
  listVpnModes,
  listVpnSpecifications,
  shouldShowVpnPublicBandwidth,
  vpnDefaults,
  vpnDurationMonthOptions,
  vpnEditionOptions,
  vpnNetworkTypeOptions,
  vpnPricingReference,
  type VpnBillingMode,
  type VpnEdition,
  type VpnMode,
  type VpnNetworkType,
  type VpnPricingCatalog,
} from "@/lib/vpn-catalog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronDown, ChevronRight, Copy, Download, Link2, MoreHorizontal, Pencil, RefreshCw, Search, Share2, Trash2, Upload, UserCircle2, X } from "lucide-react";

const services = serviceCatalog;
const evsPilotDefinition = getConfigurableServiceDefinitionByCode("EVS");

const options = {
  billing: ["Pay-per-use", "RI", "Yearly/Monthly"],
} as const;

type BillingOption = (typeof options.billing)[number];

const systemDiskOptions = [
  "High I/O",
  "Ultra-high I/O",
  "Extreme SSD",
  "General Purpose SSD",
  "General Purpose SSD V2",
] as const;

type SystemDiskOption = (typeof systemDiskOptions)[number];

const priceListEntries = [
  { service: "Elastic Cloud Server", sku: "c7.large.2", billing: "Pay-per-use", unit: "per hour", price: "USD 0.122" },
  { service: "Elastic Cloud Server", sku: "c7.xlarge.4", billing: "Yearly/Monthly", unit: "per month", price: "USD 89.11" },
  { service: "Elastic Cloud Server", sku: "c7.2xlarge.8", billing: "RI", unit: "per month", price: "USD 154.63" },
  { service: "Flexus X Instance", sku: "fx1.medium", billing: "Pay-per-use", unit: "per hour", price: "USD 0.094" },
  { service: "Flexus X Instance", sku: "fx1.large", billing: "Yearly/Monthly", unit: "per month", price: "USD 64.20" },
  { service: "Object Storage Service", sku: "Standard Storage", billing: "Pay-per-use", unit: "per GB", price: "USD 0.023" },
  { service: "Object Storage Service", sku: "Infrequent Access", billing: "Pay-per-use", unit: "per GB", price: "USD 0.014" },
  { service: "Elastic Load Balance", sku: "Shared ELB", billing: "Pay-per-use", unit: "per hour", price: "USD 0.031" },
  { service: "Elastic Load Balance", sku: "Dedicated ELB", billing: "Yearly/Monthly", unit: "per month", price: "USD 47.80" },
  { service: "Elastic IP", sku: "Dynamic BGP", billing: "Pay-per-use", unit: "per hour", price: "USD 0.005" },
  { service: "Cloud Container Engine", sku: "Cluster Management", billing: "Pay-per-use", unit: "per hour", price: "USD 0.145" },
  { service: "Cloud Container Engine", sku: "Node Pool", billing: "Yearly/Monthly", unit: "per month", price: "USD 112.40" },
  { service: "DataArts Studio", sku: "Basic Workspace", billing: "Yearly/Monthly", unit: "per month", price: "USD 39.00" },
  { service: "Workspace", sku: "Desktop Standard", billing: "Pay-per-use", unit: "per hour", price: "USD 0.082" },
  { service: "Databases", sku: "Primary DB Instance", billing: "Yearly/Monthly", unit: "per month", price: "USD 129.70" },
  { service: "NAT Gateway", sku: "Small", billing: "Pay-per-use", unit: "per day", price: "USD 2.438" },
  { service: "Virtual Private Network", sku: "Professional 2", billing: "Yearly/Monthly", unit: "per month", price: "USD 409.00" },
  { service: "Analytics", sku: "Data Lake Query", billing: "Pay-per-use", unit: "per query", price: "USD 0.009" },
];

const flavorSortLabels = {
  "price-asc": "Price: Lowest first",
  "price-desc": "Price: Highest first",
  "name-asc": "Name: A to Z",
  "vcpu-asc": "vCPU: Lowest first",
} as const;

const evsBillingOptions = (getConfiguredBillingOptions("EVS") ?? ["Pay-per-use", "Yearly/Monthly"]) as BillingOption[];
const obsBillingOptions: BillingOption[] = ["Pay-per-use"];
const flavorPageSizeOptions = [1, 3, 5, 10, 20] as const;
const flavorPageSizeStorageKey = "neoCalculator.flavorPageSize";
const ecsDiskSizeBounds = { min: 40, max: 1024 } as const;
const evsDiskSizeBounds = { min: 1, max: 1_000_000 } as const;
const obsStorageSizeBounds = { min: 1, max: 1_000_000_000 } as const;
const evsSingleDiskMaxGiB = 32_768;
const gpSsd2IopsBounds = { min: 3_000, max: 128_000 } as const;
const gpSsd2ThroughputBounds = { min: 125, max: 1_000 } as const;

type FlavorBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY" | "RI";
type FlavorPriceSource = "catalog_plan" | "rate_inquiry";

type CatalogFlavor = {
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

type FlavorCard = {
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

type DiskPricing = {
  currency: string;
  prices: Record<SystemDiskOption, Partial<Record<FlavorBillingMode, number>>>;
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
};

function formatFlavorAmount(currency: string, amount: number, suffix: string) {
  return `${currency} ${amount.toFixed(amount < 1 ? 4 : 2)}${suffix}`;
}

function getUsageSuffix(hours: number) {
  return `/${hours}h`;
}

function getMonthUsageSuffix(months: number) {
  return `/${Math.max(1, Math.floor(months))}mo`;
}

function getYearlyMonthlyDiskAmount(
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

function getDiskPriceForBillingOption(
  diskPricing: DiskPricing | null,
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

function getFlavorPriceForBillingOption(flavor: CatalogFlavor, billingOption: BillingOption, usageHours: number) {
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

function toFlavorCard(
  flavor: CatalogFlavor,
  billingOption: BillingOption,
  usageHours: number,
  diskPrice: ReturnType<typeof getDiskPriceForBillingOption>,
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

function toFlexusLFlavorCard(plan: (typeof flexusLPlans)[number], billingOption: BillingOption, usageHours: number): FlavorCard {
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

type AppList = {
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

type AppProduct = {
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

type AppProject = {
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

type HuaweiCartSummary = {
  key: string;
  name: string;
  updateTime: number;
  billingMode: string | null;
  totalAmount: number | null;
  originalAmount: number | null;
  associatedListId: string | null;
};

type ActionMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

type BatchEcsSelection = {
  flavor: CatalogFlavor;
  flavorCard: FlavorCard;
  diskPrice: NonNullable<ReturnType<typeof getDiskPriceForBillingOption>>;
};

type BatchFlexusLSelection = {
  plan: (typeof flexusLPlans)[number];
  flavorCard: FlavorCard;
};

type ProductMutationBody = {
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
};

type ActiveModal =
  | { kind: "project-huawei"; projectId: string }
  | { kind: "project-clone"; projectId: string }
  | { kind: "project-share"; projectId: string }
  | { kind: "list-link"; listId: string }
  | { kind: "list-clone"; listId: string }
  | { kind: "list-share"; listId: string }
  | null;

type ResourceExportModalState = {
  title: string;
  description: string;
  json: string;
  filename: string;
} | null;

function getFirstListId(projects: AppProject[]) {
  return projects[0]?.lists[0]?.id ?? "";
}

function getProjectCloneDefaultName(
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

function getCartCloneDefaultName(
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

async function copyText(text: string) {
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

async function parseJsonFile(file: File) {
  const text = await file.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Import file is not valid JSON");
  }
}

function ActionMenu({
  open,
  onOpenChange,
  label,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  items: ActionMenuItem[];
}) {
  return (
    <div data-action-menu-root className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                onOpenChange(false);
                item.onSelect();
              }}
            >
              <span className="text-zinc-500">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActionModal({
  title,
  description,
  onClose,
  children,
  panelClassName,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_100px_-40px_rgba(15,23,42,0.55)] ${panelClassName ?? "max-w-lg"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Close ${title}`} onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-4 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function HomeNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
      }`}
    >
      {children}
    </Link>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function getProductPriceSummary(product: AppProduct): string {
  if (isRecord(product.pricing) && typeof product.pricing.total === "string" && product.pricing.total.trim()) {
    return product.pricing.total.trim();
  }

  return "Price unavailable";
}

function splitProductPriceSummary(product: AppProduct) {
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

function splitPriceDisplay(summary: string) {
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

function scalePriceDisplay(summary: string, multiplier: number) {
  const normalizedMultiplier = Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1;
  if (normalizedMultiplier === 1) {
    return summary;
  }

  const match = summary.match(/^([A-Z]{3})\s+([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) {
    return summary;
  }

  const [, currency, rawAmount, suffix] = match;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount)) {
    return summary;
  }

  return formatFlavorAmount(currency, amount * normalizedMultiplier, suffix);
}

function buildFlavorAutoSelectKey({
  minVcpuValue,
  minRamValue,
  flavorQuery,
  flavorSort,
  regionValue,
  billingMode,
  usageHoursValue,
  systemDiskType,
  systemDiskSizeValue,
  includeFlexusL,
}: {
  minVcpuValue: string;
  minRamValue: string;
  flavorQuery: string;
  flavorSort: string;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHoursValue: number;
  systemDiskType: SystemDiskOption;
  systemDiskSizeValue: number;
  includeFlexusL: boolean;
}) {
  return [
    minVcpuValue,
    minRamValue,
    flavorQuery.trim().toLowerCase(),
    flavorSort,
    regionValue,
    billingMode,
    String(usageHoursValue),
    systemDiskType,
    String(systemDiskSizeValue),
    includeFlexusL ? "with-flexus-l" : "ecs-only",
  ].join("|");
}

function getProductConfigSummary(product: AppProduct): string {
  if (!isRecord(product.config)) {
    return product.serviceName;
  }

  if (product.productType === "ecs") {
    const systemDisk = isRecord(product.config.systemDisk) ? product.config.systemDisk : null;
    const diskIops = systemDisk && typeof systemDisk.iops === "number" ? systemDisk.iops : null;
    const diskThroughput = systemDisk && typeof systemDisk.throughput === "number" ? systemDisk.throughput : null;
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.flavor === "string" ? product.config.flavor : null,
      systemDisk && typeof systemDisk.type === "string" ? systemDisk.type : null,
      systemDisk && typeof systemDisk.sizeGiB === "number" ? `${systemDisk.sizeGiB} GiB` : null,
      diskIops ? `${diskIops} IOPS` : null,
      diskThroughput ? `${diskThroughput} MB/s` : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
      typeof product.config.durationMonths === "number" && product.config.billingMode === "Yearly/Monthly"
        ? `${product.config.durationMonths}mo`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "evs") {
    const diskType = typeof product.config.diskType === "string"
      ? product.config.diskType
      : isRecord(product.config.systemDisk) && typeof product.config.systemDisk.type === "string"
        ? product.config.systemDisk.type
        : null;
    const diskSizeGiB = typeof product.config.diskSizeGiB === "number"
      ? product.config.diskSizeGiB
      : isRecord(product.config.systemDisk) && typeof product.config.systemDisk.sizeGiB === "number"
        ? product.config.systemDisk.sizeGiB
        : null;
    const diskIops = typeof product.config.iops === "number"
      ? product.config.iops
      : isRecord(product.config.systemDisk) && typeof product.config.systemDisk.iops === "number"
        ? product.config.systemDisk.iops
        : null;
    const diskThroughput = typeof product.config.throughput === "number"
      ? product.config.throughput
      : isRecord(product.config.systemDisk) && typeof product.config.systemDisk.throughput === "number"
        ? product.config.systemDisk.throughput
        : null;
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      diskType && diskSizeGiB ? `${diskType} ${diskSizeGiB} GiB` : diskType ?? (diskSizeGiB ? `${diskSizeGiB} GiB` : null),
      diskIops ? `${diskIops} IOPS` : null,
      diskThroughput ? `${diskThroughput} MB/s` : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "flexus-l") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.planTitle === "string"
        ? product.config.planTitle
        : typeof product.config.planId === "string"
          ? product.config.planId
          : null,
      typeof product.config.systemDiskGiB === "number" ? `${product.config.systemDiskGiB} GiB system disk` : null,
      typeof product.config.peakBandwidthMbit === "number" ? `${product.config.peakBandwidthMbit} Mbit/s` : null,
      typeof product.config.dataPackageTiB === "number" ? `${product.config.dataPackageTiB} TB/month` : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "obs") {
    const storageAmount = typeof product.config.storageAmount === "number"
      ? product.config.storageAmount
      : typeof product.config.storageGiB === "number"
        ? product.config.storageGiB
        : null;
    const storageUnit = typeof product.config.storageUnit === "string" ? product.config.storageUnit : null;
    const outboundTrafficAmount = typeof product.config.outboundTrafficAmount === "number" ? product.config.outboundTrafficAmount : null;
    const outboundTrafficUnit = typeof product.config.outboundTrafficUnit === "string" ? product.config.outboundTrafficUnit : null;
    const pullTrafficAmount = typeof product.config.pullTrafficAmount === "number" ? product.config.pullTrafficAmount : null;
    const pullTrafficUnit = typeof product.config.pullTrafficUnit === "string" ? product.config.pullTrafficUnit : null;
    const showPullTraffic = typeof product.config.productType === "string"
      ? product.config.productType === "Object storage"
      : true;
    const readTrafficAmount = typeof product.config.readTrafficAmount === "number" ? product.config.readTrafficAmount : null;
    const readTrafficUnit = typeof product.config.readTrafficUnit === "string" ? product.config.readTrafficUnit : null;
    const restorationType = typeof product.config.restorationType === "string" ? product.config.restorationType : null;
    const replicationTrafficAmount = typeof product.config.replicationTrafficAmount === "number" ? product.config.replicationTrafficAmount : null;
    const replicationTrafficUnit = typeof product.config.replicationTrafficUnit === "string" ? product.config.replicationTrafficUnit : null;
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.productType === "string" ? product.config.productType : null,
      typeof product.config.storageClass === "string" ? product.config.storageClass : null,
      typeof product.config.redundancy === "string" ? product.config.redundancy : null,
      storageAmount != null ? `${storageAmount} ${storageUnit ?? "GB"}` : null,
      typeof product.config.durationMonths === "number" ? `${product.config.durationMonths}mo` : null,
      outboundTrafficAmount != null && outboundTrafficAmount > 0 ? `Outbound ${outboundTrafficAmount} ${outboundTrafficUnit ?? "GB"}` : null,
      showPullTraffic && pullTrafficAmount != null && pullTrafficAmount > 0 ? `Pull ${pullTrafficAmount} ${pullTrafficUnit ?? "GB"}` : null,
      restorationType ? restorationType : null,
      readTrafficAmount != null && readTrafficAmount > 0 ? `Read ${readTrafficAmount} ${readTrafficUnit ?? "GB"}` : null,
      replicationTrafficAmount != null && replicationTrafficAmount > 0 ? `CRR ${replicationTrafficAmount} ${replicationTrafficUnit ?? "GB"}` : null,
      typeof product.config.readRequests === "number" ? formatObsRequestSummary(product.config.readRequests, "reads") : null,
      typeof product.config.writeRequests === "number" ? formatObsRequestSummary(product.config.writeRequests, "writes") : null,
      typeof product.config.deleteRequests === "number" ? formatObsRequestSummary(product.config.deleteRequests, "deletes") : null,
      typeof product.config.lifecycleTransitionRequests === "number"
        ? formatObsRequestSummary(product.config.lifecycleTransitionRequests, "lifecycle transitions")
        : null,
      typeof product.config.minimumStorageDays === "number" && product.config.minimumStorageDays > 0
        ? `${product.config.minimumStorageDays}-day minimum`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "huawei-raw") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.resourceCode === "string" ? product.config.resourceCode : null,
      typeof product.config.pricingMode === "string" ? product.config.pricingMode : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "cce") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.clusterScale === "string" ? product.config.clusterScale : null,
      typeof product.config.masterNodes === "string" ? product.config.masterNodes : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "elb") {
    const selectedProtocols = Array.isArray(product.config.selectedProtocols)
      ? product.config.selectedProtocols.filter((value): value is string => typeof value === "string")
      : [];
    const fixedSelectedTypes = Array.isArray(product.config.fixedSelectedTypes)
      ? product.config.fixedSelectedTypes.filter((value): value is string => typeof value === "string")
      : [];
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.type === "string" ? product.config.type : null,
      typeof product.config.specificationType === "string" && product.config.type === "Dedicated load balancer"
        ? product.config.specificationType
        : null,
      typeof product.config.fixedAvailabilityAzCount === "number" && product.config.type === "Dedicated load balancer" && product.config.specificationType === "Fixed"
        ? `${product.config.fixedAvailabilityAzCount} AZs`
        : null,
      fixedSelectedTypes.length > 0 && product.config.type === "Dedicated load balancer" && product.config.specificationType === "Fixed"
        ? fixedSelectedTypes.join(", ")
        : null,
      selectedProtocols.length > 0 && product.config.type === "Dedicated load balancer"
        && product.config.specificationType === "Elastic" ? selectedProtocols.join(", ")
        : null,
      typeof product.config.networkType === "string" ? product.config.networkType : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "eip") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.type === "string" ? product.config.type : null,
      typeof product.config.eipType === "string" ? product.config.eipType : "Dynamic BGP",
      typeof product.config.chargeMode === "string" ? product.config.chargeMode : null,
      typeof product.config.bandwidthMbit === "number" && product.config.chargeMode === "By bandwidth"
        ? `${product.config.bandwidthMbit} Mbit/s`
        : null,
      typeof product.config.bandwidthMbit === "number" && product.config.chargeMode === "Enhanced 95"
        ? `${product.config.bandwidthMbit} Mbit/s`
        : null,
      typeof product.config.durationMonths === "number" && product.config.chargeMode === "Enhanced 95"
        ? `${product.config.durationMonths}mo`
        : null,
      typeof product.config.sharedBandwidthQuantity === "number" && product.config.type === "Shared EIP" && product.config.chargeMode === "By bandwidth"
        ? `${product.config.sharedBandwidthQuantity} shared bandwidth${product.config.sharedBandwidthQuantity === 1 ? "" : "s"}`
        : null,
      typeof product.config.trafficAmount === "number" && product.config.chargeMode === "By traffic"
        ? `${product.config.trafficAmount} ${typeof product.config.trafficUnit === "string" ? product.config.trafficUnit : "GB"}`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.durationMonths === "number" && product.config.chargeMode === "Enhanced 95"
        ? null
        : typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "nat") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.type === "string" ? product.config.type : null,
      typeof product.config.size === "string" ? product.config.size : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.billableDays === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.billableDays}d`
        : typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "vpn") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.edition === "string" ? product.config.edition : null,
      typeof product.config.mode === "string" ? product.config.mode : null,
      typeof product.config.networkType === "string" ? product.config.networkType : null,
      typeof product.config.specification === "string" ? product.config.specification : null,
      typeof product.config.accessViaNonFixedIp === "string" && product.config.mode === "Site-to-Cloud" && product.config.networkType === "Public network"
        ? `Non-fixed IP ${product.config.accessViaNonFixedIp}`
        : null,
      typeof product.config.connectionGroups === "number"
        ? `${product.config.connectionGroups} groups`
        : null,
      typeof product.config.useSharedBandwidth === "boolean" && product.config.networkType === "Public network"
        ? product.config.useSharedBandwidth ? "Shared bandwidth" : "Dedicated bandwidth"
        : null,
      typeof product.config.eipBandwidthMbit1 === "number" && product.config.networkType === "Public network"
        ? `EIP1 ${product.config.eipBandwidthMbit1} Mbit/s`
        : null,
      typeof product.config.eipBandwidthMbit2 === "number" && product.config.networkType === "Public network"
        ? `EIP2 ${product.config.eipBandwidthMbit2} Mbit/s`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.durationMonths === "number" && product.config.billingMode === "Yearly/Monthly"
        ? `${product.config.durationMonths}mo`
        : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "cci") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.cpu === "number" ? `${product.config.cpu} vCPU` : null,
      typeof product.config.memoryGiB === "number" ? `${product.config.memoryGiB} GiB` : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "modelarts") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.serviceType === "string" ? product.config.serviceType : null,
      typeof product.config.resourceType === "string" ? product.config.resourceType : null,
      typeof product.config.specification === "string" ? product.config.specification : null,
      typeof product.config.resourceType === "string" && product.config.resourceType === "EVS Storage"
        && typeof product.config.storageQuotaGb === "number"
        ? `${product.config.storageQuotaGb} GB`
        : typeof product.config.quantity === "number"
        ? `${product.config.quantity} instance${product.config.quantity === 1 ? "" : "s"}`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.durationMonths === "number" && product.config.billingMode === "Yearly/Monthly"
        ? product.config.durationMonths === 12 ? "1yr" : `${product.config.durationMonths}mo`
        : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  return product.serviceName;
}

function getServiceMeta(serviceCode: string, serviceName: string) {
  return findServiceCatalogEntry(serviceCode, serviceName);
}

function isBillingOption(value: unknown): value is BillingOption {
  return typeof value === "string" && (options.billing as readonly string[]).includes(value);
}

function isSystemDiskOption(value: unknown): value is SystemDiskOption {
  return typeof value === "string" && (systemDiskOptions as readonly string[]).includes(value);
}

function getCalculatorBillingOptions(
  serviceCode: string,
  elbTypeValue: ElbType,
  eipTypeValue: EipType,
  eipChargeModeValue: EipChargeMode,
  natTypeValue: NatGatewayType,
  vpnBillingOptionsValue: readonly VpnBillingMode[],
): BillingOption[] {
  if (serviceCode === "EVS") {
    return evsBillingOptions;
  }

  if (serviceCode === "OBS") {
    return obsBillingOptions;
  }

  if (serviceCode === "ELB") {
    return [...getElbBillingOptions(elbTypeValue)];
  }

  if (serviceCode === "EIP") {
    if (eipTypeValue === "Dedicated EIP" && eipChargeModeValue === "By bandwidth") {
      return ["Pay-per-use", "Yearly/Monthly"];
    }

    return ["Pay-per-use"];
  }

  if (serviceCode === "NAT") {
    return natTypeValue === "Public NAT Gateway" ? ["Pay-per-use", "Yearly/Monthly"] : ["Pay-per-use"];
  }

  if (serviceCode === "VPN") {
    return vpnBillingOptionsValue.length > 0 ? [...vpnBillingOptionsValue] : ["Yearly/Monthly"];
  }

  if (serviceCode === "Flexus L") {
    return ["Yearly/Monthly"];
  }

  if (serviceCode === "CCE" || serviceCode === "CCI") {
    return ["Pay-per-use", "Yearly/Monthly"];
  }

  if (serviceCode === "ModelArts") {
    return ["Pay-per-use", "Yearly/Monthly"];
  }

  return [...options.billing];
}

function parsePositiveNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parseNonNegativeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function parseBatchQuantity(value: unknown) {
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}

function getNestedRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

function getBatchDiskType(
  value: unknown,
  fallback: SystemDiskOption,
) {
  const evs = getNestedRecord(value, "evs");
  const candidates = [
    isRecord(value) ? value.type : undefined,
    isRecord(value) ? value.diskType : undefined,
    isRecord(value) ? value.systemDiskType : undefined,
    evs?.type,
    evs?.diskType,
  ];

  for (const candidate of candidates) {
    if (isSystemDiskOption(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function getBatchDiskSize(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
) {
  const evs = getNestedRecord(value, "evs");
  const candidates = [
    isRecord(value) ? value.size : undefined,
    isRecord(value) ? value.sizeGiB : undefined,
    isRecord(value) ? value.diskSizeGiB : undefined,
    isRecord(value) ? value.systemDiskSizeGiB : undefined,
    evs?.size,
    evs?.sizeGiB,
    evs?.diskSizeGiB,
  ];

  for (const candidate of candidates) {
    const parsed = parsePositiveNumber(candidate);
    if (parsed != null) {
      return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
    }
  }

  return fallback;
}

function getBatchObsStorageClass(value: unknown, fallback: ObsStorageClass) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    isRecord(value) ? value.storageClass : undefined,
    isRecord(value) ? value.class : undefined,
    isRecord(value) ? value.tier : undefined,
    obs?.storageClass,
    obs?.class,
    obs?.tier,
  ];

  for (const candidate of candidates) {
    if (isObsStorageClass(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function getBatchObsProductType(value: unknown, fallback: ObsProductType) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    isRecord(value) ? value.productType : undefined,
    isRecord(value) ? value.type : undefined,
    obs?.productType,
    obs?.type,
  ];

  for (const candidate of candidates) {
    if (isObsProductType(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function getBatchObsRedundancy(value: unknown, fallback: ObsRedundancy) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    isRecord(value) ? value.redundancy : undefined,
    isRecord(value) ? value.redundancyPolicy : undefined,
    isRecord(value) ? value.dataRedundancyPolicy : undefined,
    obs?.redundancy,
    obs?.redundancyPolicy,
    obs?.dataRedundancyPolicy,
  ];

  for (const candidate of candidates) {
    if (isObsRedundancy(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function getBatchObsStorageSize(value: unknown, fallback: number) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    isRecord(value) ? value.size : undefined,
    isRecord(value) ? value.sizeGiB : undefined,
    isRecord(value) ? value.storageGiB : undefined,
    isRecord(value) ? value.storageAmount : undefined,
    isRecord(value) ? value.capacityGiB : undefined,
    obs?.size,
    obs?.sizeGiB,
    obs?.storageGiB,
    obs?.storageAmount,
    obs?.capacityGiB,
  ];

  for (const candidate of candidates) {
    const parsed = parsePositiveNumber(candidate);
    if (parsed != null) {
      return Math.min(obsStorageSizeBounds.max, Math.max(obsStorageSizeBounds.min, parsed));
    }
  }

  return fallback;
}

function getBatchObsUnit(value: unknown, fallback: ObsCapacityUnit, keys: string[]) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    ...keys.map((key) => (isRecord(value) ? value[key] : undefined)),
    ...keys.map((key) => obs?.[key]),
  ];

  for (const candidate of candidates) {
    if (isObsCapacityUnit(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function getBatchObsAmount(value: unknown, fallback: number, keys: string[]) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    ...keys.map((key) => (isRecord(value) ? value[key] : undefined)),
    ...keys.map((key) => obs?.[key]),
  ];

  for (const candidate of candidates) {
    const parsed = parseNonNegativeNumber(candidate);
    if (parsed != null) {
      return Math.max(0, parsed);
    }
  }

  return fallback;
}

function getObsRequestUnits(step: number | null | undefined, value: number) {
  return typeof step === "number" && Number.isFinite(step) && step > 0 ? value / step : value;
}

function formatObsRequestInputValue(value: number) {
  const normalized = convertObsRequestCountToInput(value);
  return Number.isInteger(normalized) ? String(normalized) : String(Number(normalized.toFixed(4)));
}

function formatObsRequestSummary(value: number, label: string) {
  const normalized = convertObsRequestCountToInput(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  const displayValue = Number.isInteger(normalized)
    ? formatNumber(normalized)
    : formatNumber(Number(normalized.toFixed(4)));
  return `${displayValue} x 10k ${label}`;
}

function getBatchDescription(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.description === "string" && value.description.trim()) {
    return value.description.trim();
  }

  return fallback;
}

function hasExplicitBatchDiskConfig(value: unknown) {
  const evs = getNestedRecord(value, "evs");
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type !== undefined
    || value.diskType !== undefined
    || value.systemDiskType !== undefined
    || value.size !== undefined
    || value.sizeGiB !== undefined
    || value.diskSizeGiB !== undefined
    || value.systemDiskSizeGiB !== undefined
    || evs != null
  );
}

function getGpSsd2IopsBounds(sizeGiB: number) {
  const max = Math.max(1, Math.min(gpSsd2IopsBounds.max, Math.floor(sizeGiB * 500)));
  return {
    min: Math.min(gpSsd2IopsBounds.min, max),
    max,
  };
}

function normalizeGpSsd2Iops(value: unknown, sizeGiB: number) {
  const bounds = getGpSsd2IopsBounds(sizeGiB);
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return bounds.min;
  }

  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
}

function getGpSsd2ThroughputBounds(iops: number) {
  const max = Math.max(1, Math.min(gpSsd2ThroughputBounds.max, Math.floor(iops / 4)));
  return {
    min: Math.min(gpSsd2ThroughputBounds.min, max),
    max,
  };
}

function normalizeGpSsd2Throughput(value: unknown, iops: number) {
  const bounds = getGpSsd2ThroughputBounds(iops);
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return bounds.min;
  }

  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
}

function getGpSsd2RequestedIops(value: unknown, fallbackSizeGiB: number) {
  const evs = getNestedRecord(value, "evs");
  const systemDisk = getNestedRecord(value, "systemDisk");
  const candidates = [
    isRecord(value) ? value.iops : undefined,
    isRecord(value) ? value.diskIops : undefined,
    evs?.iops,
    evs?.diskIops,
    systemDisk?.iops,
    systemDisk?.diskIops,
  ];

  for (const candidate of candidates) {
    if (parsePositiveNumber(candidate) != null) {
      return normalizeGpSsd2Iops(candidate, fallbackSizeGiB);
    }
  }

  return normalizeGpSsd2Iops(undefined, fallbackSizeGiB);
}

function getGpSsd2RequestedThroughput(value: unknown, fallbackIops: number) {
  const evs = getNestedRecord(value, "evs");
  const systemDisk = getNestedRecord(value, "systemDisk");
  const candidates = [
    isRecord(value) ? value.throughput : undefined,
    isRecord(value) ? value.diskThroughput : undefined,
    evs?.throughput,
    evs?.diskThroughput,
    systemDisk?.throughput,
    systemDisk?.diskThroughput,
  ];

  for (const candidate of candidates) {
    if (parsePositiveNumber(candidate) != null) {
      return normalizeGpSsd2Throughput(candidate, fallbackIops);
    }
  }

  return normalizeGpSsd2Throughput(undefined, fallbackIops);
}

function splitEvsDiskSizes(totalGiB: number) {
  const normalizedTotal = Math.max(1, Math.floor(totalGiB));
  const chunks: number[] = [];
  let remaining = normalizedTotal;

  while (remaining > evsSingleDiskMaxGiB) {
    chunks.push(evsSingleDiskMaxGiB);
    remaining -= evsSingleDiskMaxGiB;
  }

  chunks.push(remaining);
  return chunks;
}

function buildEvsProductMutationBodies(input: {
  serviceCode: string;
  serviceName: string;
  serviceTitle: string;
  region: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHours: number;
  durationMonths: number;
  quantity: number;
  description: string;
  diskType: SystemDiskOption;
  diskSizeGiB: number;
  requestedIops: number | null;
  requestedThroughput: number | null;
  diskPricing: DiskPricing | null;
}) {
  const chunkSizes = splitEvsDiskSizes(input.diskSizeGiB);

  return chunkSizes.map((chunkSizeGiB) => {
    const price = getDiskPriceForBillingOption(
      input.diskPricing,
      input.diskType,
      chunkSizeGiB,
      input.billingMode,
      input.usageHours,
      input.durationMonths,
    );
    const chunkIops = input.diskType === "General Purpose SSD V2" && input.requestedIops != null
      ? normalizeGpSsd2Iops(input.requestedIops, chunkSizeGiB)
      : null;
    const chunkThroughput =
      input.diskType === "General Purpose SSD V2" && input.requestedThroughput != null && chunkIops != null
        ? normalizeGpSsd2Throughput(input.requestedThroughput, chunkIops)
        : null;

    if (!price) {
      throw new Error("Unable to price one of the EVS split disks.");
    }

    return {
      serviceCode: input.serviceCode,
      serviceName: input.serviceName,
      productType: "evs",
      title: `${input.serviceTitle} ${input.diskType} ${chunkSizeGiB} GiB`,
      quantity: input.quantity,
      config: {
        region: input.region,
        billingMode: input.billingMode,
        usageHours: input.billingMode === "Pay-per-use" ? input.usageHours : null,
        durationMonths: input.billingMode === "Yearly/Monthly" ? input.durationMonths : null,
        description: input.description,
        diskType: input.diskType,
        diskSizeGiB: chunkSizeGiB,
        ...(chunkIops != null ? { iops: chunkIops } : {}),
        ...(chunkThroughput != null ? { throughput: chunkThroughput } : {}),
        requestedDiskSizeGiB: input.diskSizeGiB,
        splitDiskCount: chunkSizes.length,
      },
      pricing: {
        total: formatFlavorAmount(price.currency, price.amount * input.quantity, price.suffix),
        disk: formatFlavorAmount(price.currency, price.amount, price.suffix),
      },
    } satisfies ProductMutationBody;
  });
}

function buildEvsSplitNotice(totalGiB: number) {
  if (totalGiB <= evsSingleDiskMaxGiB) {
    return null;
  }

  const chunks = splitEvsDiskSizes(totalGiB);
  return `Totals above ${evsSingleDiskMaxGiB} GiB are saved as multiple disks: ${chunks.join(" GiB + ")} GiB.`;
}

function findBestBatchEcsSelection(
  flavors: CatalogFlavor[],
  diskPricing: DiskPricing | null,
  billingOption: BillingOption,
  usageHours: number,
  vcpu: number,
  ramGiB: number,
  diskType: SystemDiskOption,
  diskSizeGiB: number,
  fallbackDescription: string,
): BatchEcsSelection | null {
  const candidates = flavors
    .filter((flavor) => flavor.cpu >= vcpu && flavor.ramGiB >= ramGiB)
    .map((flavor) => {
      const diskPrice = getDiskPriceForBillingOption(
        diskPricing,
        diskType,
        diskSizeGiB,
        billingOption,
        usageHours,
      );
      const flavorCard = toFlavorCard(
        {
          ...flavor,
          description: flavor.description ?? fallbackDescription,
        },
        billingOption,
        usageHours,
        diskPrice,
      );

      return diskPrice
        ? {
            flavor,
            flavorCard,
            diskPrice,
          }
        : null;
    })
    .filter((candidate): candidate is BatchEcsSelection => candidate != null)
    .sort((left, right) => {
      if (left.flavorCard.priceValue !== right.flavorCard.priceValue) {
        return left.flavorCard.priceValue - right.flavorCard.priceValue;
      }

      if (left.flavor.cpu !== right.flavor.cpu) {
        return left.flavor.cpu - right.flavor.cpu;
      }

      if (left.flavor.ramGiB !== right.flavor.ramGiB) {
        return left.flavor.ramGiB - right.flavor.ramGiB;
      }

      return left.flavor.resourceSpecCode.localeCompare(right.flavor.resourceSpecCode);
    });

  return candidates[0] ?? null;
}

function findBestBatchFlexusLSelection(
  billingOption: BillingOption,
  usageHours: number,
  vcpu: number,
  ramGiB: number,
): BatchFlexusLSelection | null {
  const plan = findBestFlexusLPlan(vcpu, ramGiB);
  if (!plan) {
    return null;
  }

  return {
    plan,
    flavorCard: toFlexusLFlavorCard(plan, billingOption, usageHours),
  };
}

function OptionGrid({
  items,
  value,
  onChange,
}: {
  items: BillingOption[];
  value: BillingOption;
  onChange: (value: BillingOption) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <Button
          key={item}
          type="button"
          variant={item === value ? "default" : "secondary"}
          className="justify-start rounded-md"
          aria-pressed={item === value}
          onClick={() => onChange(item)}
        >
          {item}
        </Button>
      ))}
    </div>
  );
}

export default function Home() {
  const { session, isPending: isSessionPending } = useSessionContext();
  const [hasMounted, setHasMounted] = useState(false);
  const showSessionState = hasMounted && !isSessionPending;
  const isSignedIn = showSessionState && Boolean(session);

  const [query, setQuery] = useState("");
  const [selectedService, setSelectedService] = useState("Elastic Cloud Server");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [cookieValue, setCookieValue] = useState("");
  const [cookieDraft, setCookieDraft] = useState("");
  const [regionValue, setRegionValue] = useState<HuaweiRegionKey>("la-sao-paulo1");
  const [billingMode, setBillingMode] = useState<BillingOption>("Pay-per-use");
  const [usageHours, setUsageHours] = useState("744");
  const [evsDurationMonths, setEvsDurationMonths] = useState(String(Number(evsPilotDefinition?.defaults.durationMonths) || 1));
  const [vcpuValue, setVcpuValue] = useState("2");
  const [ramValue, setRamValue] = useState("8");
  const [minVcpuValue, setMinVcpuValue] = useState("2");
  const [minRamValue, setMinRamValue] = useState("8");
  const [instanceCount, setInstanceCount] = useState("1");
  const [systemDiskType, setSystemDiskType] = useState<SystemDiskOption>("High I/O");
  const [systemDiskSize, setSystemDiskSize] = useState("40");
  const [obsProductType, setObsProductType] = useState<ObsProductType>("Object storage");
  const [obsStorageClass, setObsStorageClass] = useState<ObsStorageClass>("Standard");
  const [obsRedundancy, setObsRedundancy] = useState<ObsRedundancy>("Single-AZ storage");
  const [obsStorageSize, setObsStorageSize] = useState("100");
  const [obsStorageUnit, setObsStorageUnit] = useState<ObsCapacityUnit>("GB");
  const [obsDurationMonths, setObsDurationMonths] = useState("1");
  const [obsOutboundTraffic, setObsOutboundTraffic] = useState("0");
  const [obsOutboundTrafficUnit, setObsOutboundTrafficUnit] = useState<ObsCapacityUnit>("GB");
  const [obsReadRequests, setObsReadRequests] = useState("0");
  const [obsWriteRequests, setObsWriteRequests] = useState("0");
  const [obsDeleteRequests, setObsDeleteRequests] = useState("0");
  const [obsPullTraffic, setObsPullTraffic] = useState("0");
  const [obsPullTrafficUnit, setObsPullTrafficUnit] = useState<ObsCapacityUnit>("GB");
  const [obsRestorationType, setObsRestorationType] = useState<ObsRestorationType | null>(null);
  const [obsReadTraffic, setObsReadTraffic] = useState("0");
  const [obsReadTrafficUnit, setObsReadTrafficUnit] = useState<ObsCapacityUnit>("GB");
  const [obsReplicationTraffic, setObsReplicationTraffic] = useState("0");
  const [obsReplicationTrafficUnit, setObsReplicationTrafficUnit] = useState<ObsCapacityUnit>("GB");
  const [obsLifecycleTransitionRequests, setObsLifecycleTransitionRequests] = useState("0");
  const [obsCatalog, setObsCatalog] = useState<ObsPricingCatalog | null>(null);
  const [obsCatalogRegionId, setObsCatalogRegionId] = useState<string | null>(null);
  const [eipType, setEipType] = useState<EipType>(eipDefaults.type);
  const [eipChargeMode, setEipChargeMode] = useState<EipChargeMode>(eipDefaults.chargeMode);
  const [eipBandwidthMbit, setEipBandwidthMbit] = useState(String(eipDefaults.bandwidthMbit));
  const [eipEnhanced95DurationMonths, setEipEnhanced95DurationMonths] = useState(String(eipDefaults.durationMonths));
  const [eipSharedBandwidthQuantity, setEipSharedBandwidthQuantity] = useState(String(eipDefaults.sharedBandwidthQuantity));
  const [eipTrafficAmount, setEipTrafficAmount] = useState(String(eipDefaults.trafficGb));
  const [eipTrafficUnit, setEipTrafficUnit] = useState<EipTrafficUnit>(eipDefaults.trafficUnit);
  const [eipCatalog, setEipCatalog] = useState<EipPricingCatalog | null>(null);
  const [eipCatalogRegionId, setEipCatalogRegionId] = useState<string | null>(null);
  const [gpSsd2Iops, setGpSsd2Iops] = useState("3000");
  const [gpSsd2Throughput, setGpSsd2Throughput] = useState("125");
  const [elbType, setElbType] = useState<ElbType>(elbDefaults.type);
  const [elbSpecificationType, setElbSpecificationType] = useState<ElbSpecificationType>(elbDefaults.specificationType);
  const [elbSubAz] = useState<ElbSubAz>(elbDefaults.subAz);
  const [elbFixedAvailabilityAzCount, setElbFixedAvailabilityAzCount] = useState<ElbFixedAvailabilityAzCount>(elbDefaults.fixedAvailabilityAzCount);
  const [elbFixedSelectedTypes, setElbFixedSelectedTypes] = useState<ElbFixedLoadBalancingType[]>([...elbDefaults.fixedSelectedTypes]);
  const [elbFixedTypeSpecs, setElbFixedTypeSpecs] = useState<Partial<Record<ElbFixedLoadBalancingType, ElbFixedSpecName>>>({ ...elbDefaults.fixedTypeSpecs });
  const [elbNetworkType, setElbNetworkType] = useState<ElbNetworkType>(elbDefaults.networkType);
  const [elbSharedChargeMode, setElbSharedChargeMode] = useState<ElbInternetChargeMode>(elbDefaults.sharedNetworkChargeMode);
  const [elbSharedBandwidthMbit, setElbSharedBandwidthMbit] = useState(String(elbDefaults.sharedBandwidthMbit));
  const [elbSharedTrafficAmount, setElbSharedTrafficAmount] = useState(String(elbDefaults.sharedTrafficGb));
  const [elbSharedTrafficUnit, setElbSharedTrafficUnit] = useState<ElbTrafficUnit>("GB");
  const [elbSelectedProtocols, setElbSelectedProtocols] = useState<ElbDedicatedProtocol[]>([...elbDefaults.selectedProtocols]);
  const [elbProtocolInputs, setElbProtocolInputs] = useState<Partial<Record<ElbDedicatedProtocol, ElbProtocolSectionInput>>>({});
  const [elbCatalog, setElbCatalog] = useState<ElbPricingCatalog | null>(null);
  const [elbCatalogRegionId, setElbCatalogRegionId] = useState<string | null>(null);
  // CCE states
  const [cceClusterScale, setCceClusterScale] = useState<CceClusterScale>(cceDefaults.scale);
  const [cceMasterNodes, setCceMasterNodes] = useState<CceMasterNodes>(cceDefaults.masterNodes);
  const [cceCatalog, setCceCatalog] = useState<CcePricingCatalog | null>(null);
  const [cceCatalogRegionId, setCceCatalogRegionId] = useState<string | null>(null);
  const [natType, setNatType] = useState<NatGatewayType>(natDefaults.type);
  const [natSize, setNatSize] = useState<NatGatewaySize>(natDefaults.size);
  const [natCatalog, setNatCatalog] = useState<NatPricingCatalog | null>(null);
  const [natCatalogRegionId, setNatCatalogRegionId] = useState<string | null>(null);
  const [vpnEdition, setVpnEdition] = useState<VpnEdition>(vpnDefaults.edition);
  const [vpnMode, setVpnMode] = useState<VpnMode>(vpnDefaults.mode);
  const [vpnNetworkType, setVpnNetworkType] = useState<VpnNetworkType>(vpnDefaults.networkType);
  const [vpnUseSharedBandwidth, setVpnUseSharedBandwidth] = useState<boolean>(vpnDefaults.useSharedBandwidth);
  const [vpnEipBandwidthMbit1, setVpnEipBandwidthMbit1] = useState(String(vpnDefaults.eipBandwidthMbit1));
  const [vpnEipBandwidthMbit2, setVpnEipBandwidthMbit2] = useState(String(vpnDefaults.eipBandwidthMbit2));
  const [vpnDurationMonths, setVpnDurationMonths] = useState(String(vpnDefaults.durationMonths));
  const [vpnCatalog, setVpnCatalog] = useState<VpnPricingCatalog | null>(null);
  const [vpnCatalogRegionId, setVpnCatalogRegionId] = useState<string | null>(null);
  const [modelArtsResourceType, setModelArtsResourceType] = useState<ModelArtsResourceType>(modelArtsDefaults.resourceType);
  const [modelArtsSpecification, setModelArtsSpecification] = useState<string>(modelArtsDefaults.specification);
  const [modelArtsQuantity, setModelArtsQuantity] = useState(String(modelArtsDefaults.quantity));
  const [modelArtsStorageQuotaGb, setModelArtsStorageQuotaGb] = useState(String(modelArtsDefaults.storageQuotaGb));
  const [modelArtsDurationMonths, setModelArtsDurationMonths] = useState(String(modelArtsDefaults.durationMonths));
  const [modelArtsCatalog, setModelArtsCatalog] = useState<ModelArtsPricingCatalog | null>(null);
  const [modelArtsCatalogRegionId, setModelArtsCatalogRegionId] = useState<string | null>(null);
  // CCI states
  const [cciCpu, setCciCpu] = useState("1");
  const [cciMemory, setCciMemory] = useState("1");
  const [flavorQuery, setFlavorQuery] = useState("");
  const [flavorPage, setFlavorPage] = useState(1);
  const [flavorSort, setFlavorSort] = useState("price-asc");
  const [flavorPageSize, setFlavorPageSize] = useState<(typeof flavorPageSizeOptions)[number]>(3);
  const [selectedFlavor, setSelectedFlavor] = useState("");
  const [catalogFlavors, setCatalogFlavors] = useState<CatalogFlavor[]>([]);
  const [diskPricing, setDiskPricing] = useState<DiskPricing | null>(null);
  const [catalogFlavorsLoading, setCatalogFlavorsLoading] = useState(false);
  const [catalogFlavorsError, setCatalogFlavorsError] = useState("");
  const [catalogFlavorsLastCompletedAt, setCatalogFlavorsLastCompletedAt] = useState<string | null>(null);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPending, setNewProjectPending] = useState(false);
  const [importProjectPending, setImportProjectPending] = useState(false);
  const [importProjectMessage, setImportProjectMessage] = useState("");
  const [importProjectMessageIsError, setImportProjectMessageIsError] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectNameDrafts, setProjectNameDrafts] = useState<Record<string, string>>({});
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [listBaseDrafts, setListBaseDrafts] = useState<Record<string, string>>({});
  const [listPendingProjectId, setListPendingProjectId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedHuaweiCartKey, setSelectedHuaweiCartKey] = useState("");
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductListId, setEditingProductListId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("calculator");
  const [resourceExportModal, setResourceExportModal] = useState<ResourceExportModalState>(null);
  const [resourceExportActionMessage, setResourceExportActionMessage] = useState("");
  const [showFlexusLInEcs, setShowFlexusLInEcs] = useState(false);
  const [addToListPending, setAddToListPending] = useState(false);
  const [addToListMessage, setAddToListMessage] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [batchAddPending, setBatchAddPending] = useState(false);
  const [batchAddMessage, setBatchAddMessage] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [huaweiCarts, setHuaweiCarts] = useState<HuaweiCartSummary[]>([]);
  const [huaweiCartsLoading, setHuaweiCartsLoading] = useState(false);
  const [huaweiCartsError, setHuaweiCartsError] = useState("");
  const [huaweiCartsSyncedAt, setHuaweiCartsSyncedAt] = useState<string | null>(null);
  const [linkingHuaweiListId, setLinkingHuaweiListId] = useState<string | null>(null);
  const [syncingHuaweiListId, setSyncingHuaweiListId] = useState<string | null>(null);
  const [huaweiActionMessage, setHuaweiActionMessage] = useState("");
  const [cloneNameDraft, setCloneNameDraft] = useState("");
  const [cloneTargetRegion, setCloneTargetRegion] = useState<HuaweiRegionKey | "">("");
  const [cloneTargetBillingMode, setCloneTargetBillingMode] = useState<BillingOption | "">("");
  const [cloningListId, setCloningListId] = useState<string | null>(null);
  const [cloneActionMessage, setCloneActionMessage] = useState("");
  const [cloneActionIsError, setCloneActionIsError] = useState(false);
  const [projectCloneNameDrafts, setProjectCloneNameDrafts] = useState<Record<string, string>>({});
  const [projectCloneTargetRegions, setProjectCloneTargetRegions] = useState<Record<string, HuaweiRegionKey | "">>({});
  const [projectCloneTargetBillingModes, setProjectCloneTargetBillingModes] = useState<Record<string, BillingOption | "">>({});
  const [cloningProjectId, setCloningProjectId] = useState<string | null>(null);
  const [projectCloneMessages, setProjectCloneMessages] = useState<Record<string, string>>({});
  const [projectCloneMessageErrors, setProjectCloneMessageErrors] = useState<Record<string, boolean>>({});
  const [syncingHuaweiProjectId, setSyncingHuaweiProjectId] = useState<string | null>(null);
  const [projectHuaweiMessages, setProjectHuaweiMessages] = useState<Record<string, string>>({});
  const [projectHuaweiMessageErrors, setProjectHuaweiMessageErrors] = useState<Record<string, boolean>>({});
  const [projectImportMessages, setProjectImportMessages] = useState<Record<string, string>>({});
  const [projectImportMessageErrors, setProjectImportMessageErrors] = useState<Record<string, boolean>>({});
  const [projectExportMessages, setProjectExportMessages] = useState<Record<string, string>>({});
  const [projectExportMessageErrors, setProjectExportMessageErrors] = useState<Record<string, boolean>>({});
  const [sharingProjectKey, setSharingProjectKey] = useState<string | null>(null);
  const [sharingListKey, setSharingListKey] = useState<string | null>(null);
  const [projectShareMessages, setProjectShareMessages] = useState<Record<string, string>>({});
  const [listShareMessages, setListShareMessages] = useState<Record<string, string>>({});
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [isProjectCreateMenuOpen, setIsProjectCreateMenuOpen] = useState(false);
  const [isCartMenuOpen, setIsCartMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [importCartTargetProjectId, setImportCartTargetProjectId] = useState<string | null>(null);
  const [importCartPendingProjectId, setImportCartPendingProjectId] = useState<string | null>(null);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileAreaRef = useRef<HTMLDivElement>(null);
  const projectImportInputRef = useRef<HTMLInputElement>(null);
  const cartImportInputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${useId()}-services`;
  const lastFlavorAutoSelectKeyRef = useRef("");

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = normalizedQuery
    ? services
        .filter((service) =>
          service.name.toLowerCase().includes(normalizedQuery) || service.code.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 8)
    : [];
  const selectedServiceMeta = services.find((service) => service.name === selectedService) ?? services[0];
  const selectedServiceCode = selectedServiceMeta.code;
  const selectedServiceBundle = getConfigurableServiceBundleByCode(selectedServiceCode);
  const selectedServiceDefinition = selectedServiceBundle?.service ?? null;
  const selectedServiceDefinitionStatus = selectedServiceBundle?.metadata.status ?? null;
  const isEcsCalculator = selectedServiceCode === "ECS";
  const isFlexusLCalculator = selectedServiceCode === "Flexus L";
  const isEvsCalculator = selectedServiceCode === "EVS";
  const isConfigurableEvsCalculator = isEvsCalculator && selectedServiceDefinition?.definitionId === "evs";
  const isObsCalculator = selectedServiceCode === "OBS";
  const isConfigurableObsCalculator = isObsCalculator && selectedServiceDefinition?.definitionId === "obs";
  const isEipCalculator = selectedServiceCode === "EIP";
  const isConfigurableEipCalculator = isEipCalculator && selectedServiceDefinition?.definitionId === "eip";
  const isElbCalculator = selectedServiceCode === "ELB";
  const isNatCalculator = selectedServiceCode === "NAT";
  const isConfigurableNatCalculator = isNatCalculator && selectedServiceDefinition?.definitionId === "nat";
  const isVpnCalculator = selectedServiceCode === "VPN";
  const isConfigurableVpnCalculator = isVpnCalculator && selectedServiceDefinition?.definitionId === "vpn";
  const isCceCalculator = selectedServiceCode === "CCE";
  const isConfigurableCceCalculator = isCceCalculator && selectedServiceDefinition?.definitionId === "cce";
  const isCciCalculator = selectedServiceCode === "CCI";
  const isConfigurableCciCalculator = isCciCalculator && selectedServiceDefinition?.definitionId === "cci";
  const isModelArtsCalculator = selectedServiceCode === "ModelArts";
  const isConfigurableModelArtsCalculator = isModelArtsCalculator && selectedServiceDefinition?.definitionId === "modelarts";
  const activeVpnCatalog = vpnCatalog ?? getFallbackVpnPricingCatalog();
  const vpnModeOptions = useMemo(
    () => listVpnModes(activeVpnCatalog, {
      billingMode: billingMode as VpnBillingMode,
      edition: vpnEdition,
    }),
    [activeVpnCatalog, billingMode, vpnEdition],
  );
  const vpnSpecificationOptions = useMemo(() => listVpnSpecifications(vpnMode, activeVpnCatalog), [activeVpnCatalog, vpnMode]);
  const vpnSelectedSpecification = vpnEdition === "Classic"
    ? "Basic"
    : vpnSpecificationOptions[0] ?? (vpnMode === "Point-to-Cloud" ? "Professional 1" : "Professional 2");
  const showVpnPublicBandwidth = shouldShowVpnPublicBandwidth(vpnEdition, vpnNetworkType);
  const vpnDescriptionNote = vpnEdition === "Classic"
    ? "Bandwidth: ≤ 100 Mbit/s | Connection groups: ≤ 10"
    : vpnSelectedSpecification === "Professional 2"
    ? "Bandwidth: ≤ 1 Gbit/s | Connection groups: ≤ 100"
    : "Bandwidth: ≤ 300 Mbit/s | Connection groups: ≤ 100";
  const vpnAvailableBillingOptions = useMemo(
    () =>
      getVpnBillingOptions(activeVpnCatalog, {
        mode: vpnMode,
        networkType: vpnNetworkType,
        specification: vpnSelectedSpecification,
        accessViaNonFixedIp: "Off",
      }),
    [activeVpnCatalog, vpnMode, vpnNetworkType, vpnSelectedSpecification],
  );
  const calculatorBillingOptions = useMemo(
    () => getCalculatorBillingOptions(selectedServiceCode, elbType, eipType, eipChargeMode, natType, vpnAvailableBillingOptions),
    [elbType, eipChargeMode, eipType, natType, selectedServiceCode, vpnAvailableBillingOptions],
  );
  const vpnEditionOptionsToShow = useMemo(
    () => billingMode === "Yearly/Monthly" ? (["Enterprise"] as const) : vpnEditionOptions,
    [billingMode],
  );
  const modelArtsQuantityValue = Number.isFinite(Number(modelArtsQuantity)) ? Math.max(1, Math.floor(Number(modelArtsQuantity))) : 1;
  const modelArtsStorageQuotaValue = normalizeObsPositiveNumber(modelArtsStorageQuotaGb, 1, 1);
  const modelArtsDurationMonthsValue =
    Number.isFinite(Number(modelArtsDurationMonths)) && isModelArtsDurationMonths(Number(modelArtsDurationMonths))
      ? Number(modelArtsDurationMonths)
      : modelArtsDefaults.durationMonths;
  const modelArtsResourceTypeOptions = useMemo(
    () => (modelArtsCatalog ? listModelArtsResourceTypes(modelArtsCatalog, billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use") : (
      billingMode === "Yearly/Monthly"
        ? (["Dedicated Resource Pool"] as ModelArtsResourceType[])
        : (["Public Resource Pool", "Dedicated Resource Pool", "EVS Storage"] as ModelArtsResourceType[])
    )),
    [billingMode, modelArtsCatalog],
  );
  const modelArtsSpecificationOptions = useMemo(
    () => modelArtsCatalog
      ? listModelArtsSpecifications(modelArtsCatalog, {
          billingMode: billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
          resourceType: modelArtsResourceType,
        })
      : modelArtsResourceType === "EVS Storage"
        ? ["Instance storage"]
        : modelArtsResourceType === "Dedicated Resource Pool"
          ? ["Compute CPU dedicated instance (8U)"]
          : ["Compute CPU instance (2U)"],
    [billingMode, modelArtsCatalog, modelArtsResourceType],
  );
  const isSelectedServiceImplemented = supportedCalculatorServiceCodes.includes(selectedServiceCode);
  const isSelectedServiceBatchAddImplemented = supportedBatchAddServiceCodes.includes(selectedServiceCode);
  const selectedPrices = priceListEntries.filter((entry) => entry.service === selectedService);
  const hasSuggestions = isSearchOpen && suggestions.length > 0;
  const activeDescendant = hasSuggestions ? `${listboxId}-${activeSuggestionIndex}` : undefined;
  const totalProjectLists = projects.reduce((sum, project) => sum + project.lists.length, 0);
  const totalProjectProducts = projects.reduce(
    (sum, project) => sum + project.lists.reduce((listSum, list) => listSum + list.productCount, 0),
    0,
  );
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project] as const)), [projects]);
  const listsById = useMemo(
    () => new Map(projects.flatMap((project) => project.lists.map((list) => [list.id, { list, project }] as const))),
    [projects],
  );
  const selectedProject = projects.find((project) => project.lists.some((list) => list.id === selectedListId)) ?? null;
  const selectedList = selectedProject?.lists.find((list) => list.id === selectedListId) ?? null;
  const selectedCartProducts = selectedList?.products ?? [];
  const activeProject =
    activeModal == null
      ? null
      : "projectId" in activeModal
        ? projectsById.get(activeModal.projectId) ?? null
        : listsById.get(activeModal.listId)?.project ?? null;
  const activeList = activeModal != null && "listId" in activeModal ? listsById.get(activeModal.listId)?.list ?? null : null;
  const cloneableRegions = (Object.entries(huaweiRegions) as Array<[HuaweiRegionKey, (typeof huaweiRegions)[HuaweiRegionKey]]>)
    .filter(([, labels]) => Boolean(labels.catalogRegionId));
  const usageHoursValue = Number.isFinite(Number(usageHours)) ? Math.max(1, Number(usageHours)) : 744;
  const evsDurationMonthsValue = Number.isFinite(Number(evsDurationMonths)) ? Math.max(1, Math.floor(Number(evsDurationMonths))) : 1;
  const canShowFlexusLInEcs = isEcsCalculator
    && (billingMode === "RI" || billingMode === "Yearly/Monthly" || (billingMode === "Pay-per-use" && (usageHoursValue === 730 || usageHoursValue === 744)));
  const minVcpuFilter = Number.isFinite(Number(minVcpuValue)) ? Math.max(0, Number(minVcpuValue)) : 0;
  const minRamFilter = Number.isFinite(Number(minRamValue)) ? Math.max(0, Number(minRamValue)) : 0;
  const activeDiskSizeBounds = isEvsCalculator ? evsDiskSizeBounds : ecsDiskSizeBounds;
  const obsStorageSizeValue = normalizeObsPositiveNumber(obsStorageSize, obsStorageSizeBounds.min, obsStorageSizeBounds.min);
  const obsDurationMonthsValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(obsDurationMonths, 1, 1)));
  const obsOutboundTrafficValue = normalizeObsPositiveNumber(obsOutboundTraffic, 0, 0);
  const obsReadRequestsValue = normalizeObsPositiveNumber(obsReadRequests, 0, 0);
  const obsWriteRequestsValue = normalizeObsPositiveNumber(obsWriteRequests, 0, 0);
  const obsDeleteRequestsValue = normalizeObsPositiveNumber(obsDeleteRequests, 0, 0);
  const obsPullTrafficValue = normalizeObsPositiveNumber(obsPullTraffic, 0, 0);
  const obsReadTrafficValue = normalizeObsPositiveNumber(obsReadTraffic, 0, 0);
  const obsReplicationTrafficValue = normalizeObsPositiveNumber(obsReplicationTraffic, 0, 0);
  const obsLifecycleTransitionRequestsValue = normalizeObsPositiveNumber(obsLifecycleTransitionRequests, 0, 0);
  const eipBandwidthMbitRawValue = normalizeObsPositiveNumber(eipBandwidthMbit, 0, 0);
  const eipEnhanced95DurationMonthsValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(eipEnhanced95DurationMonths, 1, 1)));
  const eipSharedBandwidthQuantityValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(eipSharedBandwidthQuantity, 1, 1)));
  const eipTrafficAmountValue = normalizeObsPositiveNumber(eipTrafficAmount, 0, 0);
  const systemDiskSizeValue = Number.isFinite(Number(systemDiskSize))
    ? Math.max(activeDiskSizeBounds.min, Number(systemDiskSize))
    : activeDiskSizeBounds.min;
  const isGpSsd2Selected = systemDiskType === "General Purpose SSD V2";
  const gpSsd2IopsValue = isGpSsd2Selected ? normalizeGpSsd2Iops(gpSsd2Iops, systemDiskSizeValue) : null;
  const gpSsd2IopsRange = isGpSsd2Selected ? getGpSsd2IopsBounds(systemDiskSizeValue) : null;
  const gpSsd2ThroughputValue =
    isGpSsd2Selected && gpSsd2IopsValue != null ? normalizeGpSsd2Throughput(gpSsd2Throughput, gpSsd2IopsValue) : null;
  const gpSsd2ThroughputRange =
    isGpSsd2Selected && gpSsd2IopsValue != null ? getGpSsd2ThroughputBounds(gpSsd2IopsValue) : null;
  const instanceCountValue = Number.isFinite(Number(instanceCount)) ? Math.max(1, Number(instanceCount)) : 1;
  const selectedDiskPrice = getDiskPriceForBillingOption(
    diskPricing,
    systemDiskType,
    systemDiskSizeValue,
    billingMode,
    usageHoursValue,
    isEvsCalculator ? evsDurationMonthsValue : 1,
  );
  const obsProductTypeOptions = useMemo(
    (): ObsProductType[] => (obsCatalog ? listObsProductTypes(obsCatalog) : ["Object storage", "Parallel file system"]),
    [obsCatalog],
  );
  const obsStorageClassOptions = useMemo(
    (): ObsStorageClass[] => (obsCatalog ? listObsStorageClasses(obsCatalog, obsProductType) : getObsStorageClassOptions(obsProductType)),
    [obsCatalog, obsProductType],
  );
  const obsRedundancyOptions = useMemo(
    (): ObsRedundancy[] => (
      obsCatalog
        ? listObsRedundancies(obsCatalog, obsProductType, obsStorageClass)
        : getObsRedundancyOptions(obsProductType, obsStorageClass)
    ),
    [obsCatalog, obsProductType, obsStorageClass],
  );
  const obsRestorationTypeOptions = useMemo(
    (): ObsRestorationType[] => listObsRestorationTypes(obsStorageClass),
    [obsStorageClass],
  );
  const activeCceCatalog = cceCatalog ?? getFallbackCcePricingCatalog();
  const activeNatCatalog = natCatalog ?? getFallbackNatPricingCatalog();
  const cceClusterScaleOptions = useMemo(
    (): CceClusterScale[] => listCceClusterScales(activeCceCatalog),
    [activeCceCatalog],
  );
  const cceMasterNodesOptions = useMemo(
    (): CceMasterNodes[] => listCceMasterNodes(cceClusterScale, activeCceCatalog),
    [activeCceCatalog, cceClusterScale],
  );
  const natTypeOptions = useMemo(
    (): NatGatewayType[] => listNatGatewayTypes(activeNatCatalog),
    [activeNatCatalog],
  );
  const natSizeOptions = useMemo(
    (): NatGatewaySize[] => listNatGatewaySizes(natType, activeNatCatalog),
    [activeNatCatalog, natType],
  );
  const normalizedElbProtocolInputs = useMemo(() => {
    const next: Partial<Record<ElbDedicatedProtocol, ElbProtocolSectionInput>> = {};
    for (const protocol of elbDedicatedProtocolOptions) {
      const current = elbProtocolInputs[protocol];
      next[protocol] = {
        newConnections: normalizeObsPositiveNumber(current?.newConnections, 0, 0),
        maxConcurrentConnections: normalizeObsPositiveNumber(current?.maxConcurrentConnections, 0, 0),
        metricMode: current?.metricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
        processedTrafficGbPerHour: normalizeObsPositiveNumber(current?.processedTrafficGbPerHour, 0, 0),
        averageBandwidthMbit: normalizeObsPositiveNumber(current?.averageBandwidthMbit, 0, 0),
        queriesPerSecond: normalizeObsPositiveNumber(current?.queriesPerSecond, 0, 0),
        forwardingRules: normalizeObsPositiveNumber(current?.forwardingRules, 0, 0),
      };
    }
    return next;
  }, [elbProtocolInputs]);
  const elbSharedBandwidthMbitValue = normalizeObsPositiveNumber(elbSharedBandwidthMbit, 0, 0);
  const elbSharedTrafficAmountValue = normalizeObsPositiveNumber(elbSharedTrafficAmount, 0, 0);
  const normalizedElbFixedTypeSpecs = useMemo(
    () => ({
      "Network load balancing (TCP/UDP/TLS)": elbFixedTypeSpecs["Network load balancing (TCP/UDP/TLS)"] ?? "Small I",
      "Application load balancing (HTTP/HTTPS)": elbFixedTypeSpecs["Application load balancing (HTTP/HTTPS)"] ?? "Small I",
    } satisfies Record<ElbFixedLoadBalancingType, ElbFixedSpecName>),
    [elbFixedTypeSpecs],
  );
  const elbFixedAvailabilityAzCountOptions = useMemo(
    () => {
      const rateSet = elbCatalog?.dedicatedRates.fixed[elbSubAz];
      if (!rateSet) {
        return [String(elbFixedAvailabilityAzCount)];
      }

      const values = Object.keys(rateSet)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b)
        .map(String);

      return values.length > 0 ? values : [String(elbFixedAvailabilityAzCount)];
    },
    [elbCatalog, elbFixedAvailabilityAzCount, elbSubAz],
  );
  const showElbSharedChargeMode = shouldShowElbSharedChargeMode(elbType, elbNetworkType);
  const showElbSharedBandwidth = shouldShowElbSharedBandwidth(elbType, elbNetworkType, elbSharedChargeMode);
  const showElbSharedTraffic = shouldShowElbSharedTraffic(elbType, elbNetworkType, elbSharedChargeMode);
  const showObsRedundancySelector = shouldShowObsRedundancySelector(obsProductType, obsStorageClass);
  const showObsPullTraffic = shouldShowObsPullTraffic(obsProductType);
  const showObsReplicationTraffic = obsProductType === "Object storage" && (obsStorageClass === "Standard" || obsStorageClass === "Infrequent Access");
  const eipChargeModeOptions: readonly EipChargeMode[] = eipType === "Shared EIP" ? eipSharedChargeModeOptions : eipDedicatedChargeModeOptions;
  const showEipBandwidth = eipChargeMode === "By bandwidth" || eipChargeMode === "Enhanced 95";
  const showEipTraffic = eipType === "Dedicated EIP" && eipChargeMode === "By traffic";
  const showEipEnhanced95DurationMonths = eipType === "Shared EIP" && eipChargeMode === "Enhanced 95";
  const showEipSharedBandwidthQuantity = eipType === "Shared EIP" && eipChargeMode === "By bandwidth";
  const eipBandwidthMinimumMbit = eipType === "Shared EIP"
    ? (eipChargeMode === "Enhanced 95" ? eipSharedEnhanced95MinimumMbit : eipSharedBandwidthMinimumMbit)
    : 1;
  const eipBandwidthMbitValue = showEipBandwidth
    ? Math.max(eipBandwidthMinimumMbit, eipBandwidthMbitRawValue)
    : 0;
  const selectedObsPricing = isObsCalculator && obsCatalog
    ? estimateObsConfiguration(obsCatalog, {
        productType: obsProductType,
        storageClass: obsStorageClass,
        redundancy: obsRedundancy,
        storageAmount: obsStorageSizeValue,
        storageUnit: obsStorageUnit,
        durationMonths: obsDurationMonthsValue,
        outboundTrafficAmount: obsOutboundTrafficValue,
        outboundTrafficUnit: obsOutboundTrafficUnit,
        readRequests: convertObsRequestInputToCount(obsReadRequestsValue),
        writeRequests: convertObsRequestInputToCount(obsWriteRequestsValue),
        deleteRequests: convertObsRequestInputToCount(obsDeleteRequestsValue),
        pullTrafficAmount: showObsPullTraffic ? obsPullTrafficValue : 0,
        pullTrafficUnit: obsPullTrafficUnit,
        restorationType: obsRestorationType,
        readTrafficAmount: obsReadTrafficValue,
        readTrafficUnit: obsReadTrafficUnit,
        replicationTrafficAmount: showObsReplicationTraffic ? obsReplicationTrafficValue : 0,
        replicationTrafficUnit: obsReplicationTrafficUnit,
        lifecycleTransitionRequests: convertObsRequestInputToCount(obsLifecycleTransitionRequestsValue),
      } satisfies ObsEstimateInput)
    : null;
  const selectedEipPricing = isEipCalculator && eipCatalog
    ? estimateEipConfiguration(eipCatalog, {
        type: eipType,
        chargeMode: eipChargeMode,
        billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
        durationHours: usageHoursValue,
        durationMonths: showEipEnhanced95DurationMonths ? eipEnhanced95DurationMonthsValue : 1,
        bandwidthMbit: eipBandwidthMbitValue,
        sharedBandwidthQuantity: showEipSharedBandwidthQuantity ? eipSharedBandwidthQuantityValue : 1,
        trafficAmount: showEipTraffic ? eipTrafficAmountValue : 0,
        trafficUnit: eipTrafficUnit,
      })
    : null;
  const selectedElbInput = useMemo(
    (): ElbEstimateInput => ({
      type: elbType,
      specificationType: elbSpecificationType,
      subAz: elbSubAz,
      fixedAvailabilityAzCount: elbFixedAvailabilityAzCount,
      fixedSelectedTypes: elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" ? elbFixedSelectedTypes : [],
      fixedTypeSpecs: normalizedElbFixedTypeSpecs,
      selectedProtocols: elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? elbSelectedProtocols : [],
      protocolInputs: elbType === "Shared load balancer" || elbSpecificationType === "Fixed" ? {} : normalizedElbProtocolInputs,
      networkType: elbNetworkType,
      billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
      sharedDurationHours: usageHoursValue,
      sharedChargeMode: elbSharedChargeMode,
      sharedTrafficAmount: showElbSharedTraffic ? elbSharedTrafficAmountValue : 0,
      sharedTrafficUnit: elbSharedTrafficUnit,
      sharedBandwidthMbit: showElbSharedBandwidth ? elbSharedBandwidthMbitValue : 0,
    }),
    [
      billingMode,
      elbFixedAvailabilityAzCount,
      elbFixedSelectedTypes,
      elbNetworkType,
      normalizedElbFixedTypeSpecs,
      elbSharedBandwidthMbitValue,
      elbSharedChargeMode,
      elbSharedTrafficAmountValue,
      elbSharedTrafficUnit,
      elbSelectedProtocols,
      elbSpecificationType,
      elbSubAz,
      elbType,
      normalizedElbProtocolInputs,
      showElbSharedBandwidth,
      showElbSharedTraffic,
      usageHoursValue,
    ],
  );
  const selectedElbPricing = isElbCalculator && elbCatalog
    ? estimateElbConfiguration(elbCatalog, selectedElbInput)
    : null;
  const elbFixedTypeSections = useMemo(
    () => elbFixedLoadBalancingTypeOptions.map((type) => ({
      type,
      selected: elbFixedSelectedTypes.includes(type),
      onSelectedChange: (checked: boolean) => {
        setElbFixedSelectedTypes((currentSelections) => {
          if (checked) {
            return currentSelections.includes(type) ? currentSelections : [...currentSelections, type];
          }

          const nextSelections = currentSelections.filter((item) => item !== type);
          return nextSelections.length > 0 ? nextSelections : currentSelections;
        });
      },
      spec: normalizedElbFixedTypeSpecs[type],
      specOptions: elbFixedSpecOptions,
      onSpecChange: (value: string) => {
        setElbFixedTypeSpecs((current) => ({
          ...current,
          [type]: (elbFixedSpecOptions.includes(value as ElbFixedSpecName) ? value : "Small I") as ElbFixedSpecName,
        }));
      },
    })),
    [elbFixedSelectedTypes, normalizedElbFixedTypeSpecs],
  );
  const elbProtocolSections = useMemo(
    () => elbDedicatedProtocolOptions.map((protocol) => {
      const current = normalizedElbProtocolInputs[protocol] ?? {
        newConnections: 0,
        maxConcurrentConnections: 0,
        metricMode: "By traffic",
        processedTrafficGbPerHour: 0,
        averageBandwidthMbit: 0,
        queriesPerSecond: 0,
        forwardingRules: 0,
      };
      const lcuBreakdown = selectedElbPricing?.protocolBreakdowns.find((entry) => entry.protocol === protocol);
      return {
        protocol,
        selected: elbSelectedProtocols.includes(protocol),
        onSelectedChange: (checked: boolean) => {
          setElbSelectedProtocols((currentSelections) => {
            if (checked) {
              return currentSelections.includes(protocol) ? currentSelections : [...currentSelections, protocol];
            }

            const nextSelections = currentSelections.filter((item) => item !== protocol);
            return nextSelections.length > 0 ? nextSelections : currentSelections;
          });
        },
        newConnections: String(current.newConnections),
        onNewConnectionsChange: (value: string) => setElbProtocolInputs((existing) => ({
          ...existing,
          [protocol]: { ...(existing[protocol] ?? current), newConnections: Number(value) || 0 },
        })),
        maxConcurrentConnections: String(current.maxConcurrentConnections),
        onMaxConcurrentConnectionsChange: (value: string) => setElbProtocolInputs((existing) => ({
          ...existing,
          [protocol]: { ...(existing[protocol] ?? current), maxConcurrentConnections: Number(value) || 0 },
        })),
        metricMode: current.metricMode,
        onMetricModeChange: (value: string) => setElbProtocolInputs((existing) => ({
          ...existing,
          [protocol]: { ...(existing[protocol] ?? current), metricMode: value === "By bandwidth" ? "By bandwidth" : "By traffic" },
        })),
        processedTrafficGbPerHour: String(current.processedTrafficGbPerHour),
        onProcessedTrafficGbPerHourChange: (value: string) => setElbProtocolInputs((existing) => ({
          ...existing,
          [protocol]: { ...(existing[protocol] ?? current), processedTrafficGbPerHour: Number(value) || 0 },
        })),
        averageBandwidthMbit: String(current.averageBandwidthMbit),
        onAverageBandwidthMbitChange: (value: string) => setElbProtocolInputs((existing) => ({
          ...existing,
          [protocol]: { ...(existing[protocol] ?? current), averageBandwidthMbit: Number(value) || 0 },
        })),
        queriesPerSecond: protocol === "Application load balancing (HTTP/HTTPS)" ? String(current.queriesPerSecond) : undefined,
        onQueriesPerSecondChange: protocol === "Application load balancing (HTTP/HTTPS)"
          ? (value: string) => setElbProtocolInputs((existing) => ({
              ...existing,
              [protocol]: { ...(existing[protocol] ?? current), queriesPerSecond: Number(value) || 0 },
            }))
          : undefined,
        forwardingRules: protocol === "Application load balancing (HTTP/HTTPS)" ? String(current.forwardingRules) : undefined,
        onForwardingRulesChange: protocol === "Application load balancing (HTTP/HTTPS)"
          ? (value: string) => setElbProtocolInputs((existing) => ({
              ...existing,
              [protocol]: { ...(existing[protocol] ?? current), forwardingRules: Number(value) || 0 },
            }))
          : undefined,
        estimatedLcu: lcuBreakdown?.lcu ?? 0,
        details: lcuBreakdown?.details ?? [],
      };
    }),
    [elbSelectedProtocols, normalizedElbProtocolInputs, selectedElbPricing],
  );
  const selectedCcePricing = isCceCalculator
    ? estimateCceConfiguration(activeCceCatalog, {
        scale: cceClusterScale,
        masterNodes: cceMasterNodes,
        billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
        usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
      })
    : null;
  const selectedNatPricing = isNatCalculator
    ? estimateNatConfiguration(activeNatCatalog, {
        type: natType,
        size: natSize,
        billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
        usageHours: usageHoursValue,
      })
    : null;
  const selectedVpnPricing = isVpnCalculator
    ? estimateVpnConfiguration(activeVpnCatalog, {
        mode: vpnMode,
        networkType: vpnNetworkType,
        specification: vpnSelectedSpecification,
        billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
        accessViaNonFixedIp: "Off",
        connectionGroups: 10,
        useSharedBandwidth: vpnUseSharedBandwidth,
        eipBandwidthMbit1: Math.max(0, Number(vpnEipBandwidthMbit1) || 0),
        eipBandwidthMbit2: Math.max(0, Number(vpnEipBandwidthMbit2) || 0),
        usageHours: usageHoursValue,
        durationMonths: Math.max(1, Number(vpnDurationMonths) || vpnDefaults.durationMonths),
      })
    : null;
  const selectedModelArtsPricing = isModelArtsCalculator && modelArtsCatalog
    ? estimateModelArtsConfiguration(modelArtsCatalog, {
        billingMode: billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
        serviceType: "AI Development Lifecycle",
        resourceType: modelArtsResourceType,
        specification: modelArtsSpecification,
        quantity: modelArtsQuantityValue,
        storageQuotaGb: modelArtsStorageQuotaValue,
        usageHours: usageHoursValue,
        durationMonths: modelArtsDurationMonthsValue,
      })
    : null;
  const ecsFlavorCards = catalogFlavors
    .filter((flavor) => getFlavorPriceForBillingOption(flavor, billingMode, usageHoursValue))
    .map((flavor) => toFlavorCard(flavor, billingMode, usageHoursValue, selectedDiskPrice));
  const flexusLFlavorCards =
    isEcsCalculator && canShowFlexusLInEcs && showFlexusLInEcs
      ? flexusLPlans.map((plan) => toFlexusLFlavorCard(plan, billingMode, usageHoursValue))
      : [];
  const billableFlavors = [...ecsFlavorCards, ...flexusLFlavorCards];
  const selectedFlavorCard = billableFlavors.find((flavor) => flavor.name === selectedFlavor) ?? null;
  const selectedFlexusLPlan = isFlexusLCalculator ? findFlexusLPlan(selectedFlavor) ?? flexusLPlans[0] ?? null : null;
  const selectedEstimateBase =
    (isFlexusLCalculator && selectedFlexusLPlan
      ? formatFlavorAmount("USD", selectedFlexusLPlan.monthlyPriceUsd, "/mo")
      : isObsCalculator && selectedObsPricing
      ? formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.amount, selectedObsPricing.suffix)
      : isEipCalculator && selectedEipPricing
      ? formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.amount, selectedEipPricing.suffix)
      : isElbCalculator && selectedElbPricing
      ? formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.amount, selectedElbPricing.suffix)
      : isNatCalculator && selectedNatPricing
      ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.amount, selectedNatPricing.suffix)
      : isVpnCalculator && selectedVpnPricing
      ? formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.amount, selectedVpnPricing.suffix)
      : isModelArtsCalculator && selectedModelArtsPricing
      ? formatFlavorAmount(selectedModelArtsPricing.currency, selectedModelArtsPricing.amount, selectedModelArtsPricing.suffix)
      : isCceCalculator && selectedCcePricing
      ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.amount, selectedCcePricing.suffix)
      : isEvsCalculator && selectedDiskPrice
      ? formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)
      : selectedFlavorCard?.price)
    ?? selectedPrices.find((entry) => entry.unit === "per month")?.price
    ?? selectedPrices[0]?.price
    ?? "USD 0.00";
  const selectedEstimate = isEvsCalculator && selectedDiskPrice
    ? formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount * instanceCountValue, selectedDiskPrice.suffix)
    : isObsCalculator && selectedObsPricing
    ? formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.amount * instanceCountValue, selectedObsPricing.suffix)
    : isEipCalculator && selectedEipPricing
    ? formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.amount * instanceCountValue, selectedEipPricing.suffix)
    : isElbCalculator && selectedElbPricing
    ? formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.amount * instanceCountValue, selectedElbPricing.suffix)
    : isNatCalculator && selectedNatPricing
    ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.amount * instanceCountValue, selectedNatPricing.suffix)
    : isVpnCalculator && selectedVpnPricing
    ? formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.amount * instanceCountValue, selectedVpnPricing.suffix)
    : isModelArtsCalculator && selectedModelArtsPricing
    ? formatFlavorAmount(selectedModelArtsPricing.currency, selectedModelArtsPricing.amount, selectedModelArtsPricing.suffix)
    : isCceCalculator && selectedCcePricing
    ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.amount * instanceCountValue, selectedCcePricing.suffix)
    : isFlexusLCalculator && selectedFlexusLPlan
    ? formatFlavorAmount("USD", selectedFlexusLPlan.monthlyPriceUsd * instanceCountValue, "/mo")
    : selectedFlavorCard
    ? formatFlavorAmount(
        selectedFlavorCard.priceCurrency,
        selectedFlavorCard.priceValue * instanceCountValue,
        selectedFlavorCard.priceSuffix,
      )
    : scalePriceDisplay(selectedEstimateBase, instanceCountValue);
  const selectedEstimateParts = splitPriceDisplay(selectedEstimate);
  const quantityLabel = isModelArtsCalculator ? "Configuration" : isEvsCalculator ? "Volume" : isObsCalculator ? "Bucket" : isEipCalculator ? "EIP" : isNatCalculator || isVpnCalculator ? "Gateway" : "Instance";
  const showGlobalQuantityControl = !isModelArtsCalculator;
  const displayQuantityValue = showGlobalQuantityControl ? instanceCountValue : 1;
  const filteredFlavors = billableFlavors.filter((flavor) => {
    if (Number(flavor.vcpu) < minVcpuFilter || Number(flavor.ram) < minRamFilter) {
      return false;
    }

    const q = flavorQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      flavor.name.toLowerCase().includes(q) ||
      flavor.family.toLowerCase().includes(q) ||
      `${flavor.vcpu} ${flavor.ram}`.includes(q)
    );
  });
  const sortedFlavors = [...filteredFlavors].sort((a, b) => {
    if (flavorSort === "price-desc") return b.priceValue - a.priceValue;
    if (flavorSort === "name-asc") return a.name.localeCompare(b.name);
    if (flavorSort === "vcpu-asc") return Number(a.vcpu) - Number(b.vcpu);
    return a.priceValue - b.priceValue;
  });
  const totalFlavorPages = Math.max(1, Math.ceil(sortedFlavors.length / flavorPageSize));
  const currentFlavorPage = Math.min(flavorPage, totalFlavorPages);
  const visibleFlavors = sortedFlavors.slice((currentFlavorPage - 1) * flavorPageSize, currentFlavorPage * flavorPageSize);
  const flavorAutoSelectKey = buildFlavorAutoSelectKey({
    minVcpuValue,
    minRamValue,
    flavorQuery,
    flavorSort,
    regionValue,
    billingMode,
    usageHoursValue,
    systemDiskType,
    systemDiskSizeValue,
    includeFlexusL: isEcsCalculator && canShowFlexusLInEcs && showFlexusLInEcs,
  });

  const [evsPricingLoading, setEvsPricingLoading] = useState(false);
  const [evsPricingError, setEvsPricingError] = useState("");
  const [obsPricingLoading, setObsPricingLoading] = useState(false);
  const [obsPricingError, setObsPricingError] = useState("");
  const [eipPricingLoading, setEipPricingLoading] = useState(false);
  const [eipPricingError, setEipPricingError] = useState("");
  const [elbPricingLoading, setElbPricingLoading] = useState(false);
  const [elbPricingError, setElbPricingError] = useState("");
  const [natPricingLoading, setNatPricingLoading] = useState(false);
  const [natPricingError, setNatPricingError] = useState("");
  const [vpnPricingLoading, setVpnPricingLoading] = useState(false);
  const [vpnPricingError, setVpnPricingError] = useState("");
  const [modelArtsPricingLoading, setModelArtsPricingLoading] = useState(false);
  const [modelArtsPricingError, setModelArtsPricingError] = useState("");
  const [ccePricingLoading, setCcePricingLoading] = useState(false);
  const [ccePricingError, setCcePricingError] = useState("");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!calculatorBillingOptions.includes(billingMode)) {
      setBillingMode(calculatorBillingOptions[0]);
    }
  }, [billingMode, calculatorBillingOptions]);

  useEffect(() => {
    if (!eipChargeModeOptions.includes(eipChargeMode)) {
      setEipChargeMode(eipChargeModeOptions[0]);
    }
  }, [eipChargeMode, eipChargeModeOptions]);

  useEffect(() => {
    if (!cceClusterScaleOptions.includes(cceClusterScale)) {
      setCceClusterScale(cceClusterScaleOptions[0] ?? cceDefaults.scale);
    }
  }, [cceClusterScale, cceClusterScaleOptions]);

  useEffect(() => {
    if (!isModelArtsCalculator) {
      return;
    }

    if (!modelArtsResourceTypeOptions.includes(modelArtsResourceType)) {
      setModelArtsResourceType(modelArtsResourceTypeOptions[0] ?? modelArtsDefaults.resourceType);
    }
  }, [isModelArtsCalculator, modelArtsResourceType, modelArtsResourceTypeOptions]);

  useEffect(() => {
    if (!isModelArtsCalculator) {
      return;
    }

    if (!modelArtsSpecificationOptions.includes(modelArtsSpecification)) {
      setModelArtsSpecification(modelArtsSpecificationOptions[0] ?? modelArtsDefaults.specification);
    }
  }, [isModelArtsCalculator, modelArtsSpecification, modelArtsSpecificationOptions]);

  useEffect(() => {
    if (!cceMasterNodesOptions.includes(cceMasterNodes)) {
      setCceMasterNodes(cceMasterNodesOptions[0] ?? cceDefaults.masterNodes);
    }
  }, [cceMasterNodes, cceMasterNodesOptions]);

  useEffect(() => {
    if (!natTypeOptions.includes(natType)) {
      setNatType(natTypeOptions[0] ?? natDefaults.type);
    }
  }, [natType, natTypeOptions]);

  useEffect(() => {
    if (!natSizeOptions.includes(natSize)) {
      setNatSize(natSizeOptions[0] ?? natDefaults.size);
    }
  }, [natSize, natSizeOptions]);

  useEffect(() => {
    if (!vpnModeOptions.includes(vpnMode)) {
      setVpnMode(vpnModeOptions[0] ?? vpnDefaults.mode);
    }
  }, [vpnMode, vpnModeOptions]);

  useEffect(() => {
    if (vpnEdition === "Classic" && vpnNetworkType !== "Public network") {
      setVpnNetworkType("Public network");
    }
  }, [vpnEdition, vpnNetworkType]);

  useEffect(() => {
    if (vpnEdition === "Classic" && vpnMode !== "Site-to-Cloud") {
      setVpnMode("Site-to-Cloud");
    }
  }, [vpnEdition, vpnMode]);

  useEffect(() => {
    if (vpnEdition === "Classic") {
      setVpnEipBandwidthMbit1(String(vpnDefaults.eipBandwidthMbit1));
      setVpnEipBandwidthMbit2(String(vpnDefaults.eipBandwidthMbit2));
      setVpnUseSharedBandwidth(vpnDefaults.useSharedBandwidth);
    }
  }, [vpnEdition]);

  useEffect(() => {
    if (billingMode === "Yearly/Monthly" && vpnEdition === "Classic") {
      setVpnEdition("Enterprise");
    }
  }, [billingMode, vpnEdition]);

  useEffect(() => {
    if (!canShowFlexusLInEcs && showFlexusLInEcs) {
      setShowFlexusLInEcs(false);
    }
  }, [canShowFlexusLInEcs, showFlexusLInEcs]);

  useEffect(() => {
    if (!isGpSsd2Selected || gpSsd2IopsValue == null || gpSsd2ThroughputValue == null) {
      return;
    }

    const normalizedIops = String(gpSsd2IopsValue);
    if (gpSsd2Iops !== normalizedIops) {
      setGpSsd2Iops(normalizedIops);
    }

    const normalizedThroughput = String(gpSsd2ThroughputValue);
    if (gpSsd2Throughput !== normalizedThroughput) {
      setGpSsd2Throughput(normalizedThroughput);
    }
  }, [gpSsd2Iops, gpSsd2IopsValue, gpSsd2Throughput, gpSsd2ThroughputValue, isGpSsd2Selected]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalculatorData() {
      if (!isVpnCalculator) {
        setVpnCatalog(null);
        setVpnCatalogRegionId(null);
        setVpnPricingLoading(false);
        setVpnPricingError("");
      }

      if (isEcsCalculator) {
        setCatalogFlavorsLoading(true);
        setCatalogFlavorsError("");
        setEvsPricingLoading(false);
        setEvsPricingError("");
        setObsPricingLoading(false);
        setObsPricingError("");
        setObsCatalog(null);
        setObsCatalogRegionId(null);
        setEipPricingLoading(false);
        setEipPricingError("");
        setEipCatalog(null);
        setEipCatalogRegionId(null);
        setElbPricingLoading(false);
        setElbPricingError("");
        setElbCatalog(null);
        setElbCatalogRegionId(null);
        setNatPricingLoading(false);
        setNatPricingError("");
        setNatCatalog(null);
        setNatCatalogRegionId(null);
        setCcePricingLoading(false);
        setCcePricingError("");
        setCceCatalog(null);
        setCceCatalogRegionId(null);

        try {
          const response = await fetch(`/api/catalog/ecs-flavors?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            flavors?: CatalogFlavor[];
            diskPricing?: DiskPricing;
            error?: string;
            lastCompletedAt?: string | null;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Failed to load ECS flavors");
          }

          if (cancelled) return;

          setCatalogFlavors(payload.flavors ?? []);
          setDiskPricing(payload.diskPricing ?? null);
          setCatalogFlavorsLastCompletedAt(payload.lastCompletedAt ?? null);
          setFlavorPage(1);
          setCatalogFlavorsError(payload.error ?? "");
        } catch (error) {
          if (cancelled) return;
          setCatalogFlavors([]);
          setDiskPricing(null);
          setCatalogFlavorsError(error instanceof Error ? error.message : "Failed to load ECS flavors");
        } finally {
          if (!cancelled) {
            setCatalogFlavorsLoading(false);
          }
        }
        return;
      }

      setCatalogFlavors([]);
      setCatalogFlavorsLastCompletedAt(null);
      setCatalogFlavorsLoading(false);
      setCatalogFlavorsError("");

      if (isObsCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        setObsPricingLoading(true);
        setObsPricingError("");
        setEipPricingLoading(false);
        setEipPricingError("");
        setEipCatalog(null);
        setEipCatalogRegionId(null);
        setElbPricingLoading(false);
        setElbPricingError("");
        setElbCatalog(null);
        setElbCatalogRegionId(null);
        setNatPricingLoading(false);
        setNatPricingError("");
        setNatCatalog(null);
        setNatCatalogRegionId(null);
        setCcePricingLoading(false);
        setCcePricingError("");
        setCceCatalog(null);
        setCceCatalogRegionId(null);

        try {
          const response = await fetch(`/api/catalog/obs-pricing?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            catalog?: ObsPricingCatalog | null;
            catalogRegionId?: string | null;
            error?: string;
          };

          if (!response.ok || !payload.catalog) {
            throw new Error(payload.error ?? "Failed to load OBS pricing");
          }

          if (cancelled) return;

          setObsCatalog(payload.catalog);
          setObsCatalogRegionId(payload.catalogRegionId ?? null);
        } catch (error) {
          if (cancelled) return;
          setObsCatalog(null);
          setObsCatalogRegionId(null);
          setObsPricingError(error instanceof Error ? error.message : "Failed to load OBS pricing");
        } finally {
          if (!cancelled) {
            setObsPricingLoading(false);
          }
        }
        return;
      }

      setObsCatalog(null);
      setObsCatalogRegionId(null);
      setObsPricingLoading(false);
      setObsPricingError("");

      if (isEipCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        setEipPricingLoading(true);
        setEipPricingError("");
        setElbPricingLoading(false);
        setElbPricingError("");
        setElbCatalog(null);
        setElbCatalogRegionId(null);
        setNatPricingLoading(false);
        setNatPricingError("");
        setNatCatalog(null);
        setNatCatalogRegionId(null);
        setCcePricingLoading(false);
        setCcePricingError("");
        setCceCatalog(null);
        setCceCatalogRegionId(null);

        try {
          const response = await fetch(`/api/catalog/eip-pricing?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            catalog?: EipPricingCatalog | null;
            catalogRegionId?: string | null;
            error?: string;
          };

          if (!response.ok || !payload.catalog) {
            throw new Error(payload.error ?? "Failed to load EIP pricing");
          }

          if (cancelled) return;

          setEipCatalog(payload.catalog);
          setEipCatalogRegionId(payload.catalogRegionId ?? null);
        } catch (error) {
          if (cancelled) return;
          setEipCatalog(null);
          setEipCatalogRegionId(null);
          setEipPricingError(error instanceof Error ? error.message : "Failed to load EIP pricing");
        } finally {
          if (!cancelled) {
            setEipPricingLoading(false);
          }
        }
        return;
      }

      setEipCatalog(null);
      setEipCatalogRegionId(null);
      setEipPricingLoading(false);
      setEipPricingError("");

      if (isElbCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        setElbPricingLoading(true);
        setElbPricingError("");
        setCcePricingLoading(false);
        setCcePricingError("");
        setCceCatalog(null);
        setCceCatalogRegionId(null);

        try {
          const response = await fetch(`/api/catalog/elb-pricing?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            catalog?: ElbPricingCatalog | null;
            catalogRegionId?: string | null;
            error?: string;
          };

          if (!response.ok || !payload.catalog) {
            throw new Error(payload.error ?? "Failed to load ELB pricing");
          }

          if (cancelled) return;

          setElbCatalog(payload.catalog);
          setElbCatalogRegionId(payload.catalogRegionId ?? null);
        } catch (error) {
          if (cancelled) return;
          setElbCatalog(null);
          setElbCatalogRegionId(null);
          setElbPricingError(error instanceof Error ? error.message : "Failed to load ELB pricing");
        } finally {
          if (!cancelled) {
            setElbPricingLoading(false);
          }
        }
        return;
      }

      setElbCatalog(null);
      setElbCatalogRegionId(null);
      setElbPricingLoading(false);
      setElbPricingError("");

      if (isNatCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        setNatPricingLoading(true);
        setNatPricingError("");
        setCcePricingLoading(false);
        setCcePricingError("");
        setCceCatalog(null);
        setCceCatalogRegionId(null);

        try {
          const response = await fetch(`/api/catalog/nat-pricing?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            catalog?: NatPricingCatalog | null;
            catalogRegionId?: string | null;
            error?: string;
          };

          if (!response.ok || !payload.catalog) {
            throw new Error(payload.error ?? "Failed to load NAT pricing");
          }

          if (cancelled) return;

          setNatCatalog(payload.catalog);
          setNatCatalogRegionId(payload.catalogRegionId ?? null);
        } catch (error) {
          if (cancelled) return;
          setNatCatalog(null);
          setNatCatalogRegionId(null);
          setNatPricingError(error instanceof Error ? error.message : "Failed to load NAT pricing");
        } finally {
          if (!cancelled) {
            setNatPricingLoading(false);
          }
        }
        return;
      }

      setNatCatalog(null);
      setNatCatalogRegionId(null);
      setNatPricingLoading(false);
      setNatPricingError("");

      if (isVpnCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        setVpnPricingLoading(true);
        setVpnPricingError("");
        setCcePricingLoading(false);
        setCcePricingError("");
        setCceCatalog(null);
        setCceCatalogRegionId(null);

        try {
          const response = await fetch(`/api/catalog/vpn-pricing?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            catalog?: VpnPricingCatalog | null;
            catalogRegionId?: string | null;
            error?: string;
          };

          if (!response.ok || !payload.catalog) {
            throw new Error(payload.error ?? "Failed to load VPN pricing");
          }

          if (cancelled) return;

          setVpnCatalog(payload.catalog);
          setVpnCatalogRegionId(payload.catalogRegionId ?? null);
        } catch (error) {
          if (cancelled) return;
          setVpnCatalog(null);
          setVpnCatalogRegionId(null);
          setVpnPricingError(error instanceof Error ? error.message : "Failed to load VPN pricing");
        } finally {
          if (!cancelled) {
            setVpnPricingLoading(false);
          }
        }
        return;
      }

      setVpnCatalog(null);
      setVpnCatalogRegionId(null);
      setVpnPricingLoading(false);
      setVpnPricingError("");

      if (isModelArtsCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        setModelArtsPricingLoading(true);
        setModelArtsPricingError("");
        setCcePricingLoading(false);
        setCcePricingError("");
        setCceCatalog(null);
        setCceCatalogRegionId(null);

        try {
          const response = await fetch(`/api/catalog/modelarts-pricing?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            catalog?: ModelArtsPricingCatalog | null;
            catalogRegionId?: string | null;
            error?: string;
          };

          if (!response.ok || !payload.catalog) {
            throw new Error(payload.error ?? "Failed to load ModelArts pricing");
          }

          if (cancelled) return;

          setModelArtsCatalog(payload.catalog);
          setModelArtsCatalogRegionId(payload.catalogRegionId ?? null);
        } catch (error) {
          if (cancelled) return;
          setModelArtsCatalog(null);
          setModelArtsCatalogRegionId(null);
          setModelArtsPricingError(error instanceof Error ? error.message : "Failed to load ModelArts pricing");
        } finally {
          if (!cancelled) {
            setModelArtsPricingLoading(false);
          }
        }
        return;
      }

      setModelArtsCatalog(null);
      setModelArtsCatalogRegionId(null);
      setModelArtsPricingLoading(false);
      setModelArtsPricingError("");

      if (isCceCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        setCcePricingLoading(true);
        setCcePricingError("");

        try {
          const response = await fetch(`/api/catalog/cce-pricing?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            catalog?: CcePricingCatalog | null;
            catalogRegionId?: string | null;
            error?: string;
          };

          if (!response.ok || !payload.catalog) {
            throw new Error(payload.error ?? "Failed to load CCE pricing");
          }

          if (cancelled) return;

          setCceCatalog(payload.catalog);
          setCceCatalogRegionId(payload.catalogRegionId ?? null);
        } catch (error) {
          if (cancelled) return;
          setCceCatalog(null);
          setCceCatalogRegionId(null);
          setCcePricingError(error instanceof Error ? error.message : "Failed to load CCE pricing");
        } finally {
          if (!cancelled) {
            setCcePricingLoading(false);
          }
        }
        return;
      }

      setCceCatalog(null);
      setCceCatalogRegionId(null);
      setCcePricingLoading(false);
      setCcePricingError("");

      if (!isEvsCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        return;
      }

      setEvsPricingLoading(true);
      setEvsPricingError("");

      try {
        const response = await fetch(`/api/catalog/evs-pricing?region=${encodeURIComponent(regionValue)}`, {
          cache: "no-store",
        });
        const rawBody = await response.text();
        const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
          diskPricing?: DiskPricing | null;
          error?: string;
        };

        if (!response.ok || !payload.diskPricing) {
          throw new Error(payload.error ?? "Failed to load EVS pricing");
        }

        if (cancelled) return;

        setDiskPricing(payload.diskPricing);
      } catch (error) {
        if (cancelled) return;
        setDiskPricing(null);
        setEvsPricingError(error instanceof Error ? error.message : "Failed to load EVS pricing");
      } finally {
        if (!cancelled) {
          setEvsPricingLoading(false);
        }
      }
    }

    void loadCalculatorData();

    return () => {
      cancelled = true;
    };
  }, [isCceCalculator, isEcsCalculator, isEipCalculator, isElbCalculator, isEvsCalculator, isModelArtsCalculator, isNatCalculator, isObsCalculator, isVpnCalculator, regionValue]);

  useEffect(() => {
    if (!isEcsCalculator) {
      return;
    }

    if (!sortedFlavors.length) {
      if (selectedFlavor !== "") {
        setSelectedFlavor("");
      }
      return;
    }

    const hasSelectedFlavor = sortedFlavors.some((flavor) => flavor.name === selectedFlavor);
    if (lastFlavorAutoSelectKeyRef.current === flavorAutoSelectKey && hasSelectedFlavor) {
      return;
    }

    const nextFlavor = sortedFlavors[0];
    setSelectedFlavor(nextFlavor.name);
    setVcpuValue(nextFlavor.vcpu);
    setRamValue(nextFlavor.ram);
    lastFlavorAutoSelectKeyRef.current = flavorAutoSelectKey;
  }, [flavorAutoSelectKey, isEcsCalculator, selectedFlavor, sortedFlavors]);

  useEffect(() => {
    if (!isFlexusLCalculator || !flexusLPlans.length) {
      return;
    }

    const nextPlan = findFlexusLPlan(selectedFlavor) ?? flexusLPlans[0];
    if (selectedFlavor !== nextPlan.id) {
      setSelectedFlavor(nextPlan.id);
    }
    if (vcpuValue !== String(nextPlan.vcpu)) {
      setVcpuValue(String(nextPlan.vcpu));
    }
    if (ramValue !== String(nextPlan.ramGiB)) {
      setRamValue(String(nextPlan.ramGiB));
    }
  }, [isFlexusLCalculator, ramValue, selectedFlavor, vcpuValue]);

  useEffect(() => {
    if (!isObsCalculator || !obsCatalog) {
      return;
    }

    const nextProductType = obsProductTypeOptions.includes(obsProductType) ? obsProductType : obsProductTypeOptions[0];
    if (nextProductType && nextProductType !== obsProductType) {
      setObsProductType(nextProductType);
      return;
    }

    const nextStorageClass = obsStorageClassOptions.includes(obsStorageClass) ? obsStorageClass : obsStorageClassOptions[0];
    if (nextStorageClass && nextStorageClass !== obsStorageClass) {
      setObsStorageClass(nextStorageClass);
      return;
    }

    const nextRedundancy = obsRedundancyOptions.includes(obsRedundancy) ? obsRedundancy : obsRedundancyOptions[0];
    if (nextRedundancy && nextRedundancy !== obsRedundancy) {
      setObsRedundancy(nextRedundancy);
      return;
    }

    const nextRestorationType = obsRestorationTypeOptions.length === 0
      ? null
      : obsRestorationTypeOptions.includes(obsRestorationType ?? obsRestorationTypeOptions[0])
        ? (obsRestorationType ?? obsRestorationTypeOptions[0])
        : obsRestorationTypeOptions[0];
    if (nextRestorationType !== obsRestorationType) {
      setObsRestorationType(nextRestorationType);
    }
  }, [
    isObsCalculator,
    obsCatalog,
    obsProductType,
    obsProductTypeOptions,
    obsRedundancy,
    obsRedundancyOptions,
    obsRestorationType,
    obsRestorationTypeOptions,
    obsStorageClass,
    obsStorageClassOptions,
  ]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (searchAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsSearchOpen(false);

      if (profileAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsProfileOpen(false);
    };

    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleShortcut);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    if (!openProjectMenuId && !isCartMenuOpen && !isProjectCreateMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-action-menu-root]")) {
        return;
      }

      setOpenProjectMenuId(null);
      setIsProjectCreateMenuOpen(false);
      setIsCartMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isCartMenuOpen, isProjectCreateMenuOpen, openProjectMenuId]);

  useEffect(() => {
    if (!activeModal) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveModal(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeModal]);

  useEffect(() => {
    if (!activeModal) {
      return;
    }

    if ("projectId" in activeModal && !projectsById.has(activeModal.projectId)) {
      setActiveModal(null);
      return;
    }

    if ("listId" in activeModal && !listsById.has(activeModal.listId)) {
      setActiveModal(null);
    }
  }, [activeModal, listsById, projectsById]);

  useEffect(() => {
    if (!session?.user.id) {
      setProjects([]);
      setProjectsError("");
      setProjectsLoading(false);
      setSelectedListId("");
      return;
    }

    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(getResponseError(payload, "Failed to load projects"));
        }

        const payload = (await response.json()) as AppProject[];
        setProjects(payload);
        setSelectedListId((current) => {
          if (current && payload.some((project) => project.lists.some((list) => list.id === current))) {
            return current;
          }

          return getFirstListId(payload);
        });
        setExpandedProjects((current) => {
          const nextState: Record<string, boolean> = {};
          payload.forEach((project, index) => {
            nextState[project.id] = current[project.id] ?? index === 0;
          });
          return nextState;
        });
      } catch (error) {
        setProjectsError(error instanceof Error ? error.message : "Failed to load projects");
      } finally {
        setProjectsLoading(false);
      }
    };

    void loadProjects();
  }, [session?.user.id]);

  useEffect(() => {
    const storedCookie = window.localStorage.getItem("neoCalculator.huaweiCookie") ?? "";
    setCookieValue(storedCookie);
    setCookieDraft(storedCookie);
  }, []);

  useEffect(() => {
    const storedPageSize = Number(window.localStorage.getItem(flavorPageSizeStorageKey));
    if (flavorPageSizeOptions.some((option) => option === storedPageSize)) {
      setFlavorPageSize(storedPageSize as (typeof flavorPageSizeOptions)[number]);
    }
  }, []);

  const loadHuaweiCarts = useCallback(async () => {
    if (!cookieValue.trim()) {
      setHuaweiCarts([]);
      setHuaweiCartsError("");
      setHuaweiCartsSyncedAt(null);
      return;
    }

    setHuaweiCartsLoading(true);
    setHuaweiCartsError("");

    try {
      const response = await fetch("/api/huawei/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { carts?: HuaweiCartSummary[]; syncedAt?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(getResponseError(payload, "Unable to load Huawei carts"));
      }

      setHuaweiCarts(payload?.carts ?? []);
      setHuaweiCartsSyncedAt(payload?.syncedAt ?? new Date().toISOString());
    } catch (error) {
      setHuaweiCarts([]);
      setHuaweiCartsSyncedAt(null);
      setHuaweiCartsError(error instanceof Error ? error.message : "Unable to load Huawei carts");
    } finally {
      setHuaweiCartsLoading(false);
    }
  }, [cookieValue]);

  useEffect(() => {
    void loadHuaweiCarts();
  }, [loadHuaweiCarts, session?.user.id]);

  useEffect(() => {
    setSelectedHuaweiCartKey(selectedList?.huaweiCartKey ?? "");
  }, [selectedList?.huaweiCartKey, selectedList?.id]);

  useEffect(() => {
    setCloneNameDraft("");
    setCloneTargetRegion("");
    setCloneTargetBillingMode("");
  }, [selectedList?.id]);

  const applyConfigurableServiceDefaults = useCallback((serviceName: string) => {
    const serviceMeta = services.find((service) => service.name === serviceName);
    if (!serviceMeta) {
      return;
    }

    const definition = getConfigurableServiceDefinitionByCode(serviceMeta.code);
    if (!definition) {
      return;
    }

    const defaultBillingMode = definition.billingOptions.find((option) => isBillingOption(option));
    if (defaultBillingMode) {
      setBillingMode(defaultBillingMode);
    }

    if (definition.serviceCode === "EVS") {
      const defaultDiskType = isSystemDiskOption(definition.defaults.diskType) ? definition.defaults.diskType : "General Purpose SSD";
      const defaultDiskSize = Number(definition.defaults.diskSizeGiB);
      const normalizedDiskSize = Number.isFinite(defaultDiskSize) ? Math.max(evsDiskSizeBounds.min, Math.floor(defaultDiskSize)) : evsDiskSizeBounds.min;
      const defaultUsageHours = Number(definition.defaults.usageHours);
      const defaultDurationMonths = Number(definition.defaults.durationMonths);
      const defaultIops = Number(definition.defaults.iops);
      const normalizedIops = normalizeGpSsd2Iops(Number.isFinite(defaultIops) ? defaultIops : gpSsd2IopsBounds.min, normalizedDiskSize);
      const defaultThroughput = Number(definition.defaults.throughput);
      const normalizedThroughput = normalizeGpSsd2Throughput(
        Number.isFinite(defaultThroughput) ? defaultThroughput : gpSsd2ThroughputBounds.min,
        normalizedIops,
      );

      setSystemDiskType(defaultDiskType);
      setSystemDiskSize(String(normalizedDiskSize));
      setUsageHours(String(Number.isFinite(defaultUsageHours) ? Math.max(1, Math.floor(defaultUsageHours)) : 744));
      setEvsDurationMonths(String(Number.isFinite(defaultDurationMonths) ? Math.max(1, Math.floor(defaultDurationMonths)) : 1));
      setGpSsd2Iops(String(normalizedIops));
      setGpSsd2Throughput(String(normalizedThroughput));
      return;
    }

    if (definition.serviceCode === "OBS") {
      setObsProductType(isObsProductType(definition.defaults.productType) ? definition.defaults.productType : "Object storage");
      setObsStorageClass(isObsStorageClass(definition.defaults.storageClass) ? definition.defaults.storageClass : "Standard");
      setObsRedundancy(isObsRedundancy(definition.defaults.redundancy) ? definition.defaults.redundancy : "Single-AZ storage");
      setObsStorageSize(String(Math.max(obsStorageSizeBounds.min, Number(definition.defaults.storageAmount) || obsStorageSizeBounds.min)));
      setObsStorageUnit(isObsCapacityUnit(definition.defaults.storageUnit) ? definition.defaults.storageUnit : "GB");
      setObsDurationMonths(String(Math.max(1, Math.floor(Number(definition.defaults.durationMonths) || 1))));
      setObsOutboundTraffic(String(Math.max(0, Number(definition.defaults.outboundTrafficAmount) || 0)));
      setObsOutboundTrafficUnit(isObsCapacityUnit(definition.defaults.outboundTrafficUnit) ? definition.defaults.outboundTrafficUnit : "GB");
      setObsReadRequests(String(Math.max(0, Number(definition.defaults.readRequests) || 0)));
      setObsWriteRequests(String(Math.max(0, Number(definition.defaults.writeRequests) || 0)));
      setObsDeleteRequests(String(Math.max(0, Number(definition.defaults.deleteRequests) || 0)));
      setObsPullTraffic(String(Math.max(0, Number(definition.defaults.pullTrafficAmount) || 0)));
      setObsPullTrafficUnit(isObsCapacityUnit(definition.defaults.pullTrafficUnit) ? definition.defaults.pullTrafficUnit : "GB");
      setObsRestorationType(isObsRestorationType(definition.defaults.restorationType) ? definition.defaults.restorationType : null);
      setObsReadTraffic(String(Math.max(0, Number(definition.defaults.readTrafficAmount) || 0)));
      setObsReadTrafficUnit(isObsCapacityUnit(definition.defaults.readTrafficUnit) ? definition.defaults.readTrafficUnit : "GB");
      setObsReplicationTraffic(String(Math.max(0, Number(definition.defaults.replicationTrafficAmount) || 0)));
      setObsReplicationTrafficUnit(isObsCapacityUnit(definition.defaults.replicationTrafficUnit) ? definition.defaults.replicationTrafficUnit : "GB");
      setObsLifecycleTransitionRequests(String(Math.max(0, Number(definition.defaults.lifecycleTransitionRequests) || 0)));
      return;
    }

    if (definition.serviceCode === "EIP") {
      setEipType(definition.defaults.type === "Shared EIP" ? "Shared EIP" : "Dedicated EIP");
      setEipChargeMode(
        definition.defaults.chargeMode === "By traffic" || definition.defaults.chargeMode === "Enhanced 95" ? definition.defaults.chargeMode : "By bandwidth",
      );
      setEipBandwidthMbit(String(Math.max(0, Number(definition.defaults.bandwidthMbit) || 0)));
      setEipEnhanced95DurationMonths(String(Math.max(1, Math.floor(Number(definition.defaults.enhanced95DurationMonths) || 1))));
      setEipSharedBandwidthQuantity(String(Math.max(1, Math.floor(Number(definition.defaults.sharedBandwidthQuantity) || 1))));
      setEipTrafficAmount(String(Math.max(0, Number(definition.defaults.trafficAmount) || 0)));
      setEipTrafficUnit(definition.defaults.trafficUnit === "TB" ? "TB" : "GB");
      return;
    }

    if (definition.serviceCode === "NAT") {
      setNatType(definition.defaults.natType === "Private NAT Gateway" ? "Private NAT Gateway" : "Public NAT Gateway");
      setNatSize(
        definition.defaults.natSize === "Medium" || definition.defaults.natSize === "Large" || definition.defaults.natSize === "Extra-large"
          ? definition.defaults.natSize
          : "Small",
      );
      return;
    }

    if (definition.serviceCode === "VPN") {
      setVpnEdition(definition.defaults.edition === "Enterprise" ? "Enterprise" : "Classic");
      setVpnMode(definition.defaults.mode === "Point-to-Cloud" ? "Point-to-Cloud" : "Site-to-Cloud");
      setVpnNetworkType(definition.defaults.networkType === "Private network" ? "Private network" : "Public network");
      setVpnUseSharedBandwidth(definition.defaults.useSharedBandwidth === "Yes");
      setVpnEipBandwidthMbit1(String(Math.max(0, Number(definition.defaults.eipBandwidthMbit1) || 0)));
      setVpnEipBandwidthMbit2(String(Math.max(0, Number(definition.defaults.eipBandwidthMbit2) || 0)));
      setVpnDurationMonths(String(Math.max(1, Math.floor(Number(definition.defaults.durationMonths) || 1))));
      return;
    }

    if (definition.serviceCode === "CCE") {
      setCceClusterScale(
        definition.defaults.clusterScale === "200 nodes" || definition.defaults.clusterScale === "1000 nodes" || definition.defaults.clusterScale === "2000 nodes"
          ? definition.defaults.clusterScale
          : "50 nodes",
      );
      setCceMasterNodes(definition.defaults.masterNodes === "Single" ? "Single" : "3 Masters");
      return;
    }

    if (definition.serviceCode === "CCI") {
      setCciCpu(String(Math.max(1, Math.floor(Number(definition.defaults.cpu) || 1))));
      setCciMemory(String(Math.max(1, Math.floor(Number(definition.defaults.memoryGiB) || 1))));
      return;
    }

    if (definition.serviceCode === "ModelArts") {
      setModelArtsResourceType(isModelArtsResourceType(definition.defaults.resourceType) ? definition.defaults.resourceType : modelArtsDefaults.resourceType);
      setModelArtsSpecification(typeof definition.defaults.specification === "string" ? definition.defaults.specification : modelArtsDefaults.specification);
      setModelArtsQuantity(String(Math.max(1, Math.floor(Number(definition.defaults.quantity) || modelArtsDefaults.quantity))));
      setModelArtsStorageQuotaGb(String(Math.max(1, Number(definition.defaults.storageQuotaGb) || modelArtsDefaults.storageQuotaGb)));
      setModelArtsDurationMonths(String(
        isModelArtsDurationMonths(Number(definition.defaults.durationMonths)) ? Number(definition.defaults.durationMonths) : modelArtsDefaults.durationMonths,
      ));
    }
  }, []);

  const handleSelectService = (service: string) => {
    setSelectedService(service);
    setQuery(service);
    setIsSearchOpen(false);
    setActiveSuggestionIndex(0);
    applyConfigurableServiceDefaults(service);
  };

  const handleSaveCookie = () => {
    window.localStorage.setItem("neoCalculator.huaweiCookie", cookieDraft);
    setCookieValue(cookieDraft);
    setIsProfileOpen(false);
    setHuaweiActionMessage("");
  };

  const reloadProjectsSnapshot = async (preferredListId?: string, preferredProjectId?: string) => {
    const response = await fetch("/api/projects", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(getResponseError(payload, "Failed to load projects"));
    }

    const payload = (await response.json()) as AppProject[];
    setProjects(payload);
    setSelectedListId((current) => {
      const nextPreferredListId = preferredListId
        && payload.some((project) => project.lists.some((list) => list.id === preferredListId))
        ? preferredListId
        : null;
      if (nextPreferredListId) {
        return nextPreferredListId;
      }

      if (current && payload.some((project) => project.lists.some((list) => list.id === current))) {
        return current;
      }

      return getFirstListId(payload);
    });
    setExpandedProjects((current) => {
      const nextState: Record<string, boolean> = {};
      payload.forEach((project, index) => {
        nextState[project.id] = project.id === preferredProjectId ? true : (current[project.id] ?? index === 0);
      });
      return nextState;
    });
  };

  const openProjectImportPicker = () => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    setImportProjectMessage("");
    setImportProjectMessageIsError(false);
    if (projectImportInputRef.current) {
      projectImportInputRef.current.value = "";
      projectImportInputRef.current.click();
    }
  };

  const openCartImportPicker = (projectId: string) => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    setImportCartTargetProjectId(projectId);
    setProjectImportMessages((current) => ({ ...current, [projectId]: "" }));
    setProjectImportMessageErrors((current) => ({ ...current, [projectId]: false }));
    if (cartImportInputRef.current) {
      cartImportInputRef.current.value = "";
      cartImportInputRef.current.click();
    }
  };

  const handleImportProjectFile = async (file: File) => {
    setImportProjectPending(true);
    setImportProjectMessage("");
    setImportProjectMessageIsError(false);
    setProjectsError("");

    try {
      const payload = await parseJsonFile(file);
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const result = (await response.json().catch(() => null)) as
        | { projectId: string; firstListId: string | null; name: string; importedListCount: number; importedProductCount: number; error?: never }
        | { error?: string }
        | null;

      if (!response.ok || !result || !("projectId" in result)) {
        throw new Error(getResponseError(result, "Unable to import project"));
      }

      await reloadProjectsSnapshot(result.firstListId ?? undefined, result.projectId);
      setImportProjectMessage(
        `Imported project ${result.name} with ${result.importedListCount} cart(s) and ${result.importedProductCount} product(s).`,
      );
      setImportProjectMessageIsError(false);
    } catch (error) {
      setImportProjectMessage(error instanceof Error ? error.message : "Unable to import project");
      setImportProjectMessageIsError(true);
    } finally {
      setImportProjectPending(false);
    }
  };

  const handleImportCartFile = async (projectId: string, file: File) => {
    setImportCartPendingProjectId(projectId);
    setProjectImportMessages((current) => ({ ...current, [projectId]: "" }));
    setProjectImportMessageErrors((current) => ({ ...current, [projectId]: false }));
    setProjectsError("");

    try {
      const payload = await parseJsonFile(file);
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, targetProjectId: projectId }),
      });
      const result = (await response.json().catch(() => null)) as
        | { projectId: string; listId: string; name: string; importedProductCount: number; error?: never }
        | { error?: string }
        | null;

      if (!response.ok || !result || !("listId" in result)) {
        throw new Error(getResponseError(result, "Unable to import cart"));
      }

      await reloadProjectsSnapshot(result.listId, projectId);
      setProjectImportMessages((current) => ({
        ...current,
        [projectId]: `Imported cart ${result.name} with ${result.importedProductCount} product(s).`,
      }));
      setProjectImportMessageErrors((current) => ({ ...current, [projectId]: false }));
    } catch (error) {
      setProjectImportMessages((current) => ({
        ...current,
        [projectId]: error instanceof Error ? error.message : "Unable to import cart",
      }));
      setProjectImportMessageErrors((current) => ({ ...current, [projectId]: true }));
    } finally {
      setImportCartPendingProjectId(null);
      setImportCartTargetProjectId(null);
    }
  };

  const handleCreateProject = async () => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    const name = newProjectName.trim();
    if (!name) return;

    setNewProjectPending(true);
    setProjectsError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(getResponseError(payload, "Unable to create project"));
      }

      const project = (await response.json()) as Omit<AppProject, "lists">;
      setProjects((current) => [{ ...project, lists: [] }, ...current]);
      setExpandedProjects((current) => ({ ...current, [project.id]: true }));
      setProjectNameDrafts((current) => ({ ...current, [project.id]: project.name }));
      setNewProjectName("");
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create project");
    } finally {
      setNewProjectPending(false);
    }
  };

  const handleCreateShare = async (resourceType: "project" | "list", resourceId: string, mode: "copy" | "collaborate") => {
    const setPending = resourceType === "project" ? setSharingProjectKey : setSharingListKey;
    const setMessages = resourceType === "project" ? setProjectShareMessages : setListShareMessages;

    setPending(`${resourceType}:${resourceId}:${mode}`);
    setMessages((current) => ({ ...current, [resourceId]: "" }));

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, mode }),
      });
      const payload = (await response.json().catch(() => null)) as { shareUrl?: string; error?: string } | null;

      if (!response.ok || !payload?.shareUrl) {
        throw new Error(getResponseError(payload, "Unable to create share link"));
      }

      const shareUrl = new URL(payload.shareUrl, window.location.origin).toString();
      const copied = await copyText(shareUrl);
      setMessages((current) => ({
        ...current,
        [resourceId]: copied
          ? mode === "copy"
            ? "Copy link copied."
            : "Collaborative link copied."
          : `${mode === "copy" ? "Copy" : "Collaborative"} link: ${shareUrl}`,
      }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [resourceId]: error instanceof Error ? error.message : "Unable to create share link",
      }));
    } finally {
      setPending(null);
    }
  };

  const handleCreateList = async (projectId: string) => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    const name = listDrafts[projectId]?.trim();
    const baseCartKey = listBaseDrafts[projectId] ?? "";
    const usingHuaweiBase = Boolean(baseCartKey);
    if (!name && !usingHuaweiBase) return;
    if (usingHuaweiBase && !cookieValue.trim()) {
      setProjectsError("Save a Huawei Cloud cookie before importing a Huawei cart.");
      return;
    }

    setListPendingProjectId(projectId);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          huaweiCartKey: baseCartKey || null,
          cookie: baseCartKey ? cookieValue : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(getResponseError(payload, "Unable to create list"));
      }

      const list = (await response.json()) as AppList & { projectId: string };
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: list.updatedAt,
                lists: [...project.lists, list],
              }
            : project,
        ),
      );
      setSelectedListId((current) => current || list.id);
      setListDrafts((current) => ({ ...current, [projectId]: "" }));
      setListBaseDrafts((current) => ({ ...current, [projectId]: "" }));
      setExpandedProjects((current) => ({ ...current, [projectId]: true }));
      setHuaweiActionMessage(baseCartKey ? `Imported ${list.name} from Huawei Cloud Calculator.` : "");
      if (baseCartKey) {
        await loadHuaweiCarts();
      }
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create list");
    } finally {
      setListPendingProjectId(null);
    }
  };

  const handleLinkSelectedList = async () => {
    if (!selectedListId || !selectedHuaweiCartKey) {
      return;
    }

    const targetCart = huaweiCarts.find((cart) => cart.key === selectedHuaweiCartKey);
    if (!targetCart) {
      setHuaweiActionMessage("Choose a Huawei cart first.");
      return;
    }

    setLinkingHuaweiListId(selectedListId);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          huaweiCartKey: targetCart.key,
          huaweiCartName: targetCart.name,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            id: string;
            projectId: string;
            huaweiCartKey: string | null;
            huaweiCartName: string | null;
            huaweiLastError: string | null;
            updatedAt: string;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to link Huawei cart"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.id
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setHuaweiActionMessage(`Linked ${targetCart.name} to this Neo cart.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to link Huawei cart");
    } finally {
      setLinkingHuaweiListId(null);
    }
  };

  const handleSyncSelectedList = async () => {
    if (!selectedListId) {
      return;
    }

    if (!cookieValue.trim()) {
      setHuaweiActionMessage("Save a Huawei Cloud cookie before syncing.");
      return;
    }

    setSyncingHuaweiListId(selectedListId);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}/huawei-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            listId: string;
            projectId: string;
            huaweiCartKey: string;
            huaweiCartName: string;
            huaweiLastSyncedAt: string;
            huaweiLastError: string | null;
            updatedAt: string;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to sync with Huawei Cloud Calculator"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.listId
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastSyncedAt: payload.huaweiLastSyncedAt,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setSelectedHuaweiCartKey(payload.huaweiCartKey);
      setHuaweiActionMessage(`Synced ${selectedList?.name ?? "cart"} to Huawei Cloud Calculator.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to sync with Huawei Cloud Calculator");
    } finally {
      setSyncingHuaweiListId(null);
    }
  };

  const handleCloneSelectedList = async () => {
    if (!selectedListId || !selectedProject || !selectedList) {
      return;
    }

    setCloningListId(selectedListId);
    setCloneActionMessage("");
    setCloneActionIsError(false);

    try {
      const response = await fetch(`/api/lists/${selectedListId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cloneNameDraft.trim() || undefined,
          targetRegion: cloneTargetRegion || undefined,
          targetBillingMode: cloneTargetBillingMode || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AppList & {
            projectId: string;
            cloneSummary?: {
              totalProducts: number;
              convertedEcsCount: number;
              copiedUnchangedCount: number;
              copiedUnsupportedCount: number;
            };
            error?: never;
          })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to clone cart"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: [...project.lists, payload],
              }
            : project,
        ),
      );
      setSelectedListId(payload.id);
      setCloneNameDraft("");
      setCloneTargetRegion("");
      setCloneTargetBillingMode("");
      setCloneActionMessage(
        `Cloned ${selectedList.name} into ${payload.name}. Converted ${payload.cloneSummary?.convertedEcsCount ?? 0} ECS item(s).`,
      );
    } catch (error) {
      setCloneActionIsError(true);
      setCloneActionMessage(error instanceof Error ? error.message : "Unable to clone cart");
    } finally {
      setCloningListId(null);
    }
  };

  const handleCloneProject = async (project: AppProject) => {
    setCloningProjectId(project.id);
    setProjectCloneMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: false }));

    try {
      const response = await fetch(`/api/projects/${project.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectCloneNameDrafts[project.id]?.trim() || undefined,
          targetRegion: projectCloneTargetRegions[project.id] || undefined,
          targetBillingMode: projectCloneTargetBillingModes[project.id] || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AppProject & {
            cloneSummary?: {
              totalLists: number;
              totalProducts: number;
              convertedEcsCount: number;
              copiedUnchangedCount: number;
              copiedUnsupportedCount: number;
            };
            error?: never;
          })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("lists" in payload)) {
        throw new Error(getResponseError(payload, "Unable to clone project"));
      }

      setProjects((current) => [payload, ...current]);
      setExpandedProjects((current) => ({ ...current, [payload.id]: true }));
      setSelectedListId(payload.lists[0]?.id ?? "");
      setProjectCloneNameDrafts((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneTargetRegions((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneTargetBillingModes((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneMessages((current) => ({
        ...current,
        [project.id]: `Cloned ${project.name} into ${payload.name}. Converted ${payload.cloneSummary?.convertedEcsCount ?? 0} ECS item(s).`,
      }));
      setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: false }));
    } catch (error) {
      setProjectCloneMessages((current) => ({
        ...current,
        [project.id]: error instanceof Error ? error.message : "Unable to clone project",
      }));
      setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: true }));
    } finally {
      setCloningProjectId(null);
    }
  };

  const handleSyncProjectHuawei = async (project: AppProject) => {
    if (!cookieValue.trim()) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: "Save a Huawei Cloud cookie before creating Huawei carts.",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
      return;
    }

    if (project.lists.length === 0) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: "This project does not have carts to sync.",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
      return;
    }

    setSyncingHuaweiProjectId(project.id);
    setProjectHuaweiMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: false }));

    try {
      const response = await fetch(`/api/projects/${project.id}/huawei-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            projectId: string;
            updatedAt: string;
            syncedCount: number;
            failedCount: number;
            lists: Array<{
              id: string;
              huaweiCartKey: string | null;
              huaweiCartName: string | null;
              huaweiLastSyncedAt: string | null;
              huaweiLastError: string | null;
              updatedAt: string;
            }>;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to create Huawei carts for this project"));
      }

      const listUpdates = new Map(payload.lists.map((list) => [list.id, list]));

      setProjects((current) =>
        current.map((item) =>
          item.id === project.id
            ? {
                ...item,
                updatedAt: payload.updatedAt,
                lists: item.lists.map((list) => {
                  const update = listUpdates.get(list.id);
                  if (!update) {
                    return list;
                  }

                  return {
                    ...list,
                    updatedAt: update.updatedAt,
                    huaweiCartKey: update.huaweiCartKey,
                    huaweiCartName: update.huaweiCartName,
                    huaweiLastSyncedAt: update.huaweiLastSyncedAt,
                    huaweiLastError: update.huaweiLastError,
                  };
                }),
              }
            : item,
        ),
      );
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]:
          payload.failedCount > 0
            ? `Created or updated ${payload.syncedCount} Huawei cart(s). ${payload.failedCount} cart(s) failed.`
            : `Created or updated ${payload.syncedCount} Huawei cart(s) for this project.`,
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: payload.failedCount > 0 }));
      await loadHuaweiCarts();
    } catch (error) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: error instanceof Error ? error.message : "Unable to create Huawei carts for this project",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
    } finally {
      setSyncingHuaweiProjectId(null);
    }
  };

  const openActionModal = (modal: Exclude<ActiveModal, null>) => {
    setOpenProjectMenuId(null);
    setIsCartMenuOpen(false);
    setActiveModal(modal);
  };

  const openResourceExportModal = (title: string, description: string, payload: unknown, filename: string) => {
    setResourceExportActionMessage("");
    setResourceExportModal({
      title,
      description,
      json: JSON.stringify(payload, null, 2),
      filename,
    });
  };

  const handleOpenProjectExport = (project: AppProject) => {
    openResourceExportModal(
      "Export Project JSON",
      "This export includes the full project, all carts in it, and every saved product.",
      buildProjectExportPayload(project),
      buildNamedExportFilename("project", project.name, "json"),
    );
  };

  const handleOpenListExport = (project: AppProject, list: AppList) => {
    openResourceExportModal(
      "Export Cart JSON",
      "This export includes the cart, its parent project reference, and every saved product in the cart.",
      buildListExportPayload(project, list),
      buildNamedExportFilename("cart", list.name, "json"),
    );
  };

  const handleExportProjectExcel = async (project: AppProject) => {
    setProjectExportMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectExportMessageErrors((current) => ({ ...current, [project.id]: false }));

    try {
      // First, create a share link for the project
      const shareResponse = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          resourceType: "project", 
          resourceId: project.id, 
          mode: "copy" 
        }),
      });
      const sharePayload = (await shareResponse.json().catch(() => null)) as { shareUrl?: string; error?: string } | null;

      // Get the full share URL or undefined if creation failed
      const shareUrl = shareResponse.ok && sharePayload?.shareUrl
        ? new URL(sharePayload.shareUrl, window.location.origin).toString()
        : undefined;

      const downloaded = await downloadProjectWorkbookFile(project, shareUrl);
      setProjectExportMessages((current) => ({
        ...current,
        [project.id]: downloaded ? "Excel export download started." : "Unable to start the Excel download in this browser.",
      }));
      setProjectExportMessageErrors((current) => ({ ...current, [project.id]: !downloaded }));
    } catch (error) {
      setProjectExportMessages((current) => ({
        ...current,
        [project.id]: error instanceof Error ? error.message : "Unable to export the project as Excel.",
      }));
      setProjectExportMessageErrors((current) => ({ ...current, [project.id]: true }));
    }
  };

  const handleCopyResourceExport = async () => {
    if (!resourceExportModal) {
      return;
    }

    const copied = await copyText(resourceExportModal.json);
    setResourceExportActionMessage(copied ? "JSON copied to clipboard." : "Clipboard access is unavailable in this browser.");
  };

  const handleDownloadResourceExport = () => {
    if (!resourceExportModal) {
      return;
    }

    const downloaded = downloadTextFile(resourceExportModal.filename, resourceExportModal.json, "application/json;charset=utf-8");
    setResourceExportActionMessage(downloaded ? "JSON file download started." : "Unable to start the JSON download in this browser.");
  };

  const toggleProject = (projectName: string) => {
    setExpandedProjects((current) => ({
      ...current,
      [projectName]: !current[projectName],
    }));
  };

  const handleStartProjectRename = (project: AppProject) => {
    setEditingProjectId(project.id);
    setProjectNameDrafts((current) => ({
      ...current,
      [project.id]: current[project.id] ?? project.name,
    }));
    setProjectsError("");
  };

  const handleCancelProjectRename = (project: AppProject) => {
    setEditingProjectId((current) => (current === project.id ? null : current));
    setProjectNameDrafts((current) => ({
      ...current,
      [project.id]: project.name,
    }));
  };

  const handleRenameProject = async (project: AppProject) => {
    const name = (projectNameDrafts[project.id] ?? project.name).trim();
    if (!name) {
      setProjectsError("Project name is required.");
      return;
    }

    if (name === project.name) {
      setEditingProjectId(null);
      return;
    }

    setRenamingProjectId(project.id);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; name: string; description: string | null; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("updatedAt" in payload)) {
        throw new Error(getResponseError(payload, "Unable to rename project"));
      }

      setProjects((current) =>
        current.map((item) =>
          item.id === payload.id
            ? {
                ...item,
                name: payload.name,
                description: payload.description,
                updatedAt: payload.updatedAt,
              }
            : item,
        ),
      );
      setProjectNameDrafts((current) => ({ ...current, [project.id]: payload.name }));
      setEditingProjectId(null);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to rename project");
    } finally {
      setRenamingProjectId(null);
    }
  };

  const handleDeleteProject = async (project: AppProject) => {
    const confirmed = window.confirm(`Delete "${project.name}" and all of its lists and products?`);
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; deleted: true }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("deleted" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete project"));
      }

      setProjects((current) => {
        const nextProjects = current.filter((item) => item.id !== payload.id);
        setSelectedListId((currentListId) => {
          if (!project.lists.some((list) => list.id === currentListId)) {
            return currentListId;
          }

          return getFirstListId(nextProjects);
        });
        return nextProjects;
      });
      setExpandedProjects((current) => {
        const nextState = { ...current };
        delete nextState[project.id];
        return nextState;
      });
      setProjectNameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneNameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneTargetRegions((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneTargetBillingModes((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneMessages((current) => {
        const nextMessages = { ...current };
        delete nextMessages[project.id];
        return nextMessages;
      });
      setProjectCloneMessageErrors((current) => {
        const nextFlags = { ...current };
        delete nextFlags[project.id];
        return nextFlags;
      });
      setEditingProjectId((current) => (current === project.id ? null : current));
      await loadHuaweiCarts();
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to delete project");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleDeleteList = async (list: AppList, projectId: string) => {
    const confirmed = window.confirm(`Delete "${list.name}" and all of its products?`);
    if (!confirmed) {
      return;
    }

    setDeletingListId(list.id);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; projectId: string; deleted: true; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("deleted" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete cart"));
      }

      setProjects((current) => {
        const nextProjects = current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.filter((item) => item.id !== payload.id),
              }
            : project,
        );
        setSelectedListId((currentListId) => {
          if (currentListId !== payload.id) {
            return currentListId;
          }

          return getFirstListId(nextProjects);
        });
        return nextProjects;
      });
      if (editingProductListId === payload.id) {
        handleCancelEdit();
      }
      setHuaweiActionMessage(`Deleted ${list.name}.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to delete cart");
    } finally {
      setDeletingListId(null);
    }
  };

  const updateSystemDiskSize = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setSystemDiskSize("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(activeDiskSizeBounds.max, Math.max(activeDiskSizeBounds.min, parsed));
    setSystemDiskSize(String(bounded));
  }, [activeDiskSizeBounds.max, activeDiskSizeBounds.min]);

  const updateInstanceCount = (nextValue: string) => {
    if (nextValue === "") {
      setInstanceCount("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(999, Math.max(1, parsed));
    setInstanceCount(String(bounded));
  };

  const updateUsageHours = (nextValue: string) => {
    if (nextValue === "") {
      setUsageHours("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(87600, Math.max(1, parsed));
    setUsageHours(String(bounded));
  };

  const updateEvsDurationMonths = (nextValue: string) => {
    if (nextValue === "") {
      setEvsDurationMonths("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      return;
    }

    const bounded = Math.min(360, Math.max(1, Math.floor(parsed)));
    setEvsDurationMonths(String(bounded));
  };

  const handleEditProduct = (product: AppProduct) => {
    if (product.productType !== "ecs" && product.productType !== "evs" && product.productType !== "flexus-l" && product.productType !== "obs") {
      setAddToListMessage("This product cannot be edited from the calculator.");
      return;
    }

    if (!isRecord(product.config)) {
      setAddToListMessage("This product cannot be edited from the calculator.");
      return;
    }

    const nextRegion = typeof product.config.region === "string" && product.config.region in huaweiRegions
      ? (product.config.region as HuaweiRegionKey)
      : regionValue;
    const rawBillingMode = isBillingOption(product.config.billingMode) ? product.config.billingMode : "Pay-per-use";
    const nextBillingMode = product.productType === "evs" && rawBillingMode === "RI"
      ? "Pay-per-use"
      : product.productType === "obs"
        ? "Pay-per-use"
      : product.productType === "flexus-l"
        ? "Yearly/Monthly"
        : rawBillingMode;
    const nextSystemDisk = isRecord(product.config.systemDisk) ? product.config.systemDisk : null;

    setSelectedService(product.serviceName);
    setQuery(product.serviceName);
    setRegionValue(nextRegion);
    setBillingMode(nextBillingMode);
    setUsageHours(
      typeof product.config.usageHours === "number" && Number.isFinite(product.config.usageHours)
        ? String(Math.max(1, Math.floor(product.config.usageHours)))
        : "744",
    );
    setEvsDurationMonths(
      typeof product.config.durationMonths === "number" && Number.isFinite(product.config.durationMonths)
        ? String(Math.max(1, Math.floor(product.config.durationMonths)))
        : String(Number(evsPilotDefinition?.defaults.durationMonths) || 1),
    );
    const nextMinVcpuValue = typeof product.config.vcpu === "number" ? String(product.config.vcpu) : minVcpuValue;
    const nextMinRamValue = typeof product.config.ramGiB === "number" ? String(product.config.ramGiB) : minRamValue;
    const nextSystemDiskType = isSystemDiskOption(product.config.diskType)
      ? product.config.diskType
      : isSystemDiskOption(nextSystemDisk?.type)
        ? nextSystemDisk.type
        : "High I/O";
    const nextSystemDiskSize =
      typeof product.config.diskSizeGiB === "number" && Number.isFinite(product.config.diskSizeGiB)
        ? String(Math.max(evsDiskSizeBounds.min, Math.floor(product.config.diskSizeGiB)))
        : typeof nextSystemDisk?.sizeGiB === "number" && Number.isFinite(nextSystemDisk.sizeGiB)
          ? String(Math.max(ecsDiskSizeBounds.min, Math.floor(nextSystemDisk.sizeGiB)))
          : product.productType === "evs"
            ? String(evsDiskSizeBounds.min)
            : String(ecsDiskSizeBounds.min);
    const nextObsStorageClass = isObsStorageClass(product.config.storageClass) ? product.config.storageClass : "Standard";
    const nextObsProductType = isObsProductType(product.config.productType) ? product.config.productType : "Object storage";
    const nextObsRedundancy = isObsRedundancy(product.config.redundancy) ? product.config.redundancy : "Single-AZ storage";
    const nextObsStorageSize =
      typeof product.config.storageAmount === "number" && Number.isFinite(product.config.storageAmount)
        ? String(Math.max(obsStorageSizeBounds.min, product.config.storageAmount))
        : typeof product.config.storageGiB === "number" && Number.isFinite(product.config.storageGiB)
          ? String(Math.max(obsStorageSizeBounds.min, product.config.storageGiB))
        : String(obsStorageSizeBounds.min);
    const nextObsStorageUnit = isObsCapacityUnit(product.config.storageUnit) ? product.config.storageUnit : "GB";
    const nextObsDurationMonths =
      typeof product.config.durationMonths === "number" && Number.isFinite(product.config.durationMonths)
        ? String(Math.max(1, Math.floor(product.config.durationMonths)))
        : "1";
    const nextObsOutboundTraffic =
      typeof product.config.outboundTrafficAmount === "number" && Number.isFinite(product.config.outboundTrafficAmount)
        ? String(Math.max(0, product.config.outboundTrafficAmount))
        : "0";
    const nextObsOutboundTrafficUnit = isObsCapacityUnit(product.config.outboundTrafficUnit)
      ? product.config.outboundTrafficUnit
      : "GB";
    const nextObsReadRequests =
      typeof product.config.readRequests === "number" && Number.isFinite(product.config.readRequests)
        ? formatObsRequestInputValue(product.config.readRequests)
        : "0";
    const nextObsWriteRequests =
      typeof product.config.writeRequests === "number" && Number.isFinite(product.config.writeRequests)
        ? formatObsRequestInputValue(product.config.writeRequests)
        : "0";
    const nextObsDeleteRequests =
      typeof product.config.deleteRequests === "number" && Number.isFinite(product.config.deleteRequests)
        ? formatObsRequestInputValue(product.config.deleteRequests)
        : "0";
    const nextObsPullTraffic =
      typeof product.config.pullTrafficAmount === "number" && Number.isFinite(product.config.pullTrafficAmount)
        ? String(Math.max(0, product.config.pullTrafficAmount))
        : "0";
    const nextObsPullTrafficUnit = isObsCapacityUnit(product.config.pullTrafficUnit) ? product.config.pullTrafficUnit : "GB";
    const nextObsRestorationType = isObsRestorationType(product.config.restorationType) ? product.config.restorationType : null;
    const nextObsReadTraffic =
      typeof product.config.readTrafficAmount === "number" && Number.isFinite(product.config.readTrafficAmount)
        ? String(Math.max(0, product.config.readTrafficAmount))
        : "0";
    const nextObsReadTrafficUnit = isObsCapacityUnit(product.config.readTrafficUnit) ? product.config.readTrafficUnit : "GB";
    const nextObsReplicationTraffic =
      typeof product.config.replicationTrafficAmount === "number" && Number.isFinite(product.config.replicationTrafficAmount)
        ? String(Math.max(0, product.config.replicationTrafficAmount))
        : "0";
    const nextObsReplicationTrafficUnit = isObsCapacityUnit(product.config.replicationTrafficUnit)
      ? product.config.replicationTrafficUnit
      : "GB";
    const nextObsLifecycleTransitionRequests =
      typeof product.config.lifecycleTransitionRequests === "number" && Number.isFinite(product.config.lifecycleTransitionRequests)
        ? formatObsRequestInputValue(product.config.lifecycleTransitionRequests)
        : "0";
    if (product.productType === "ecs") {
      lastFlavorAutoSelectKeyRef.current = buildFlavorAutoSelectKey({
        minVcpuValue: nextMinVcpuValue,
        minRamValue: nextMinRamValue,
        flavorQuery,
        flavorSort,
        regionValue: nextRegion,
        billingMode: nextBillingMode,
        usageHoursValue:
          typeof product.config.usageHours === "number" && Number.isFinite(product.config.usageHours)
            ? Math.max(1, Math.floor(product.config.usageHours))
            : 744,
        systemDiskType: nextSystemDiskType,
        systemDiskSizeValue: Number(nextSystemDiskSize),
        includeFlexusL: false,
      });
      setSelectedFlavor(typeof product.config.flavor === "string" ? product.config.flavor : "");
      setVcpuValue(typeof product.config.vcpu === "number" ? String(product.config.vcpu) : vcpuValue);
      setRamValue(typeof product.config.ramGiB === "number" ? String(product.config.ramGiB) : ramValue);
      setMinVcpuValue(nextMinVcpuValue);
      setMinRamValue(nextMinRamValue);
    } else if (product.productType === "flexus-l") {
      const nextPlanId = typeof product.config.planId === "string"
        ? product.config.planId
        : typeof product.config.flavor === "string"
          ? product.config.flavor
          : flexusLPlans[0]?.id ?? "";
      const nextPlan = findFlexusLPlan(nextPlanId) ?? flexusLPlans[0] ?? null;
      setSelectedFlavor(nextPlan?.id ?? "");
      setVcpuValue(
        typeof product.config.vcpu === "number"
          ? String(product.config.vcpu)
          : nextPlan
            ? String(nextPlan.vcpu)
            : "",
      );
      setRamValue(
        typeof product.config.ramGiB === "number"
          ? String(product.config.ramGiB)
          : nextPlan
            ? String(nextPlan.ramGiB)
            : "",
      );
      setObsProductType("Object storage");
      setObsRedundancy("Single-AZ storage");
      setObsStorageClass("Standard");
      setObsStorageSize("100");
      setObsStorageUnit("GB");
      setObsDurationMonths("1");
      setObsOutboundTraffic("0");
      setObsOutboundTrafficUnit("GB");
      setObsReadRequests("0");
      setObsWriteRequests("0");
      setObsDeleteRequests("0");
      setObsPullTraffic("0");
      setObsPullTrafficUnit("GB");
      setObsRestorationType(null);
      setObsReadTraffic("0");
      setObsReadTrafficUnit("GB");
      setObsReplicationTraffic("0");
      setObsReplicationTrafficUnit("GB");
      setObsLifecycleTransitionRequests("0");
    } else if (product.productType === "obs") {
      setSelectedFlavor("");
      setVcpuValue("");
      setRamValue("");
      setObsProductType(nextObsProductType);
      setObsStorageClass(nextObsStorageClass);
      setObsRedundancy(nextObsRedundancy);
      setObsStorageSize(nextObsStorageSize);
      setObsStorageUnit(nextObsStorageUnit);
      setObsDurationMonths(nextObsDurationMonths);
      setObsOutboundTraffic(nextObsOutboundTraffic);
      setObsOutboundTrafficUnit(nextObsOutboundTrafficUnit);
      setObsReadRequests(nextObsReadRequests);
      setObsWriteRequests(nextObsWriteRequests);
      setObsDeleteRequests(nextObsDeleteRequests);
      setObsPullTraffic(nextObsPullTraffic);
      setObsPullTrafficUnit(nextObsPullTrafficUnit);
      setObsRestorationType(nextObsRestorationType);
      setObsReadTraffic(nextObsReadTraffic);
      setObsReadTrafficUnit(nextObsReadTrafficUnit);
      setObsReplicationTraffic(nextObsReplicationTraffic);
      setObsReplicationTrafficUnit(nextObsReplicationTrafficUnit);
      setObsLifecycleTransitionRequests(nextObsLifecycleTransitionRequests);
    } else {
      setSelectedFlavor("");
      setVcpuValue("");
      setRamValue("");
      setObsProductType("Object storage");
      setObsRedundancy("Single-AZ storage");
      setObsStorageClass("Standard");
      setObsStorageSize("100");
      setObsStorageUnit("GB");
      setObsDurationMonths("1");
      setObsOutboundTraffic("0");
      setObsOutboundTrafficUnit("GB");
      setObsReadRequests("0");
      setObsWriteRequests("0");
      setObsDeleteRequests("0");
      setObsPullTraffic("0");
      setObsPullTrafficUnit("GB");
      setObsRestorationType(null);
      setObsReadTraffic("0");
      setObsReadTrafficUnit("GB");
      setObsReplicationTraffic("0");
      setObsReplicationTrafficUnit("GB");
      setObsLifecycleTransitionRequests("0");
    }
    const nextGpSsd2Iops = getGpSsd2RequestedIops(product.config, Number(nextSystemDiskSize));
    const nextGpSsd2Throughput = getGpSsd2RequestedThroughput(product.config, nextGpSsd2Iops);
    setGpSsd2Iops(String(nextGpSsd2Iops));
    setGpSsd2Throughput(String(nextGpSsd2Throughput));
    setSystemDiskType(nextSystemDiskType);
    setSystemDiskSize(nextSystemDiskSize);
    setInstanceCount(String(Math.max(1, product.quantity)));
    setEditingProductId(product.id);
    setEditingProductListId(selectedListId);
    setActiveTab("calculator");
    setAddToListMessage("Editing item. Save changes when ready.");
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setEditingProductListId(null);
    setAddToListMessage("");
  };

  const updateObsStorageSize = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setObsStorageSize("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      return;
    }

    const normalized = Math.max(obsStorageSizeBounds.min, Math.min(obsStorageSizeBounds.max, parsed));
    setObsStorageSize(String(normalized));
  }, []);

  const updateGpSsd2Iops = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setGpSsd2Iops("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    setGpSsd2Iops(String(normalizeGpSsd2Iops(parsed, systemDiskSizeValue)));
  }, [systemDiskSizeValue]);

  const updateGpSsd2Throughput = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setGpSsd2Throughput("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    setGpSsd2Throughput(String(normalizeGpSsd2Throughput(parsed, gpSsd2IopsValue ?? gpSsd2IopsBounds.min)));
  }, [gpSsd2IopsValue]);

  const handleDeleteProduct = async (product: AppProduct) => {
    if (!selectedListId) {
      return;
    }

    setDeletingProductId(product.id);
    setAddToListMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}/products/${product.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; listId: string; projectId: string; deleted: true; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete product"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.listId
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        productCount: Math.max(0, list.productCount - 1),
                        products: list.products.filter((item) => item.id !== payload.id),
                      }
                    : list,
                ),
              }
            : project,
        ),
      );

      if (editingProductId === payload.id) {
        handleCancelEdit();
      }

      setAddToListMessage("Product deleted.");
    } catch (error) {
      setAddToListMessage(error instanceof Error ? error.message : "Unable to delete product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const appendProductToState = useCallback((payload: AppProduct & { listId: string; projectId: string }) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === payload.projectId
          ? {
              ...project,
              updatedAt: payload.updatedAt,
              lists: project.lists.map((list) =>
                list.id === payload.listId
                  ? {
                      ...list,
                      updatedAt: payload.updatedAt,
                      productCount: list.productCount + 1,
                      products: [payload, ...list.products],
                    }
                  : list,
              ),
            }
          : project,
      ),
    );
  }, []);

  const mutateListProduct = useCallback(
    async (
      requestUrl: string,
      requestMethod: "POST" | "PATCH",
      requestBody: ProductMutationBody,
      fallbackError: string,
    ) => {
      const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json().catch(() => null)) as
        | (AppProduct & { listId: string; projectId: string; error?: never })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, fallbackError));
      }

      return payload;
    },
    [],
  );

  const handleBatchAdd = async () => {
    if (!session) {
      setBatchAddMessage("Sign in to save carts and projects.");
      return;
    }

    if (!isSelectedServiceBatchAddImplemented) {
      setBatchAddMessage(`${selectedService} does not support batch add yet.`);
      return;
    }

    if (!selectedListId) {
      setBatchAddMessage("Create a list first.");
      return;
    }

    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(batchInput);
    } catch {
      setBatchAddMessage("Batch input must be valid JSON.");
      return;
    }

    if (!Array.isArray(parsedInput) || parsedInput.length === 0) {
      setBatchAddMessage("Batch input must be a non-empty JSON array.");
      return;
    }

    if (isEcsCalculator && !catalogFlavors.length) {
      setBatchAddMessage("ECS flavors are not loaded yet.");
      return;
    }

    if (isEvsCalculator && !diskPricing) {
      setBatchAddMessage("EVS pricing is not loaded yet.");
      return;
    }

    setBatchAddPending(true);
    setBatchAddMessage("");

    let createdCount = 0;
    let splitDiskCount = 0;

    try {
      for (let index = 0; index < parsedInput.length; index += 1) {
        const item = parsedInput[index];

        if (!isRecord(item)) {
          throw new Error(`Item ${index + 1} must be an object.`);
        }

        const quantity = parseBatchQuantity(item.quantity);
        const description = getBatchDescription(item, selectedService);
        const requestBodies = isEcsCalculator
          ? (() => {
              const requestedVcpu = parsePositiveNumber(item.vcpu);
              const requestedRamGiB = parsePositiveNumber(item.ram);
              if (requestedVcpu == null || requestedRamGiB == null) {
                throw new Error(`Item ${index + 1} must include numeric vcpu and ram values.`);
              }

              const diskType = getBatchDiskType(item, "High I/O");
              const diskSizeGiB = getBatchDiskSize(item, ecsDiskSizeBounds.min, ecsDiskSizeBounds);
              const diskIops = diskType === "General Purpose SSD V2"
                ? getGpSsd2RequestedIops(item, diskSizeGiB)
                : null;
              const diskThroughput = diskType === "General Purpose SSD V2" && diskIops != null
                ? getGpSsd2RequestedThroughput(item, diskIops)
                : null;
              const selection = findBestBatchEcsSelection(
                catalogFlavors,
                diskPricing,
                billingMode,
                usageHoursValue,
                requestedVcpu,
                requestedRamGiB,
                diskType,
                diskSizeGiB,
                description,
              );
              const flexusSelection =
                canShowFlexusLInEcs && showFlexusLInEcs && !hasExplicitBatchDiskConfig(item)
                  ? findBestBatchFlexusLSelection(billingMode, usageHoursValue, requestedVcpu, requestedRamGiB)
                  : null;
              const useFlexusSelection = flexusSelection != null
                && (selection == null || flexusSelection.flavorCard.priceValue < selection.flavorCard.priceValue);

              if (!selection && !flexusSelection) {
                throw new Error(
                  `Item ${index + 1} could not find an ECS or Flexus L flavor with at least ${requestedVcpu} vCPUs and ${requestedRamGiB} GiB RAM.`,
                );
              }

              if (useFlexusSelection && flexusSelection) {
                return [{
                  serviceCode: flexusSelection.flavorCard.serviceCode,
                  serviceName: flexusSelection.flavorCard.serviceName,
                  productType: "flexus-l",
                  title: `${flexusSelection.flavorCard.serviceName} ${flexusSelection.plan.title}`,
                  quantity,
                  config: {
                    region: regionValue,
                    billingMode,
                    description,
                    planId: flexusSelection.plan.id,
                    planTitle: flexusSelection.plan.title,
                    vcpu: flexusSelection.plan.vcpu,
                    ramGiB: flexusSelection.plan.ramGiB,
                    systemDiskGiB: flexusSelection.plan.systemDiskGiB,
                    peakBandwidthMbit: flexusSelection.plan.peakBandwidthMbit,
                    dataPackageTiB: flexusSelection.plan.dataPackageTiB,
                    referenceRegion: flexusLPricingReference.region,
                  },
                  pricing: {
                    total: formatFlavorAmount(
                      flexusSelection.flavorCard.priceCurrency,
                      flexusSelection.flavorCard.priceValue * quantity,
                      flexusSelection.flavorCard.priceSuffix,
                    ),
                    flavor: flexusSelection.flavorCard.flavorPrice,
                  },
                }];
              }

              if (!selection) {
                throw new Error(`Item ${index + 1} could not find an ECS flavor.`);
              }

              return [{
                serviceCode: selection.flavorCard.serviceCode,
                serviceName: selection.flavorCard.serviceName,
                productType: "ecs",
                title: `${selectedService} ${selection.flavor.resourceSpecCode}`,
                quantity,
                config: {
                  region: regionValue,
                  billingMode,
                  usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
                  description,
                  flavor: selection.flavor.resourceSpecCode,
                  vcpu: selection.flavor.cpu,
                  ramGiB: selection.flavor.ramGiB,
                  systemDisk: {
                    type: diskType,
                    sizeGiB: diskSizeGiB,
                    ...(diskIops != null ? { iops: diskIops } : {}),
                    ...(diskThroughput != null ? { throughput: diskThroughput } : {}),
                  },
                },
                pricing: {
                  total: formatFlavorAmount(
                    selection.flavorCard.priceCurrency,
                    selection.flavorCard.priceValue * quantity,
                    selection.flavorCard.priceSuffix,
                  ),
                  flavor: selection.flavorCard.flavorPrice,
                  disk: formatFlavorAmount(
                    selection.diskPrice.currency,
                    selection.diskPrice.amount,
                    selection.diskPrice.suffix,
                  ),
                },
              }];
            })()
          : isFlexusLCalculator
          ? (() => {
              const requestedVcpu = parsePositiveNumber(item.vcpu);
              const requestedRamGiB = parsePositiveNumber(item.ram);
              if (requestedVcpu == null || requestedRamGiB == null) {
                throw new Error(`Item ${index + 1} must include numeric vcpu and ram values.`);
              }

              const plan = findBestFlexusLPlan(requestedVcpu, requestedRamGiB);
              if (!plan) {
                throw new Error(
                  `Item ${index + 1} could not find a Flexus L plan with at least ${requestedVcpu} vCPUs and ${requestedRamGiB} GiB RAM.`,
                );
              }

              return [{
                serviceCode: selectedServiceMeta.code,
                serviceName: selectedService,
                productType: "flexus-l",
                title: `${selectedService} ${plan.title}`,
                quantity,
                config: {
                  region: regionValue,
                  billingMode: "Yearly/Monthly",
                  description,
                  planId: plan.id,
                  planTitle: plan.title,
                  vcpu: plan.vcpu,
                  ramGiB: plan.ramGiB,
                  systemDiskGiB: plan.systemDiskGiB,
                  peakBandwidthMbit: plan.peakBandwidthMbit,
                  dataPackageTiB: plan.dataPackageTiB,
                  referenceRegion: flexusLPricingReference.region,
                },
                pricing: {
                  total: formatFlavorAmount("USD", plan.monthlyPriceUsd * quantity, "/mo"),
                  flavor: formatFlavorAmount("USD", plan.monthlyPriceUsd, "/mo"),
                },
              }];
            })()
          : isObsCalculator
          ? (() => {
              if (!obsCatalog) {
                throw new Error("OBS pricing is still loading.");
              }

              const productType = getBatchObsProductType(item, obsProductType);
              const shouldIncludePullTraffic = shouldShowObsPullTraffic(productType);
              const storageClass = getBatchObsStorageClass(item, obsStorageClass);
              const redundancy = getBatchObsRedundancy(item, obsRedundancy);
              const storageAmount = getBatchObsStorageSize(item, obsStorageSizeValue);
              const storageUnit = getBatchObsUnit(item, obsStorageUnit, ["sizeUnit", "storageUnit", "unit"]);
              const durationMonths = Math.max(1, Math.floor(getBatchObsAmount(item, obsDurationMonthsValue, ["durationMonths", "months"])));
              const outboundTrafficAmount = getBatchObsAmount(item, obsOutboundTrafficValue, ["outboundTraffic", "internetOutboundTraffic"]);
              const outboundTrafficUnit = getBatchObsUnit(item, obsOutboundTrafficUnit, ["outboundTrafficUnit", "internetOutboundTrafficUnit"]);
              const readRequestInput = getBatchObsAmount(item, obsReadRequestsValue, ["readRequests", "apiReadRequests"]);
              const writeRequestInput = getBatchObsAmount(item, obsWriteRequestsValue, ["writeRequests", "apiWriteRequests"]);
              const deleteRequestInput = getBatchObsAmount(item, obsDeleteRequestsValue, ["deleteRequests", "apiDeleteRequests"]);
              const readRequests = convertObsRequestInputToCount(readRequestInput);
              const writeRequests = convertObsRequestInputToCount(writeRequestInput);
              const deleteRequests = convertObsRequestInputToCount(deleteRequestInput);
              const pullTrafficAmount = shouldIncludePullTraffic
                ? getBatchObsAmount(item, obsPullTrafficValue, ["pullTraffic"])
                : 0;
              const pullTrafficUnit = getBatchObsUnit(item, obsPullTrafficUnit, ["pullTrafficUnit"]);
              const restorationType = isObsRestorationType(
                getNestedRecord(item, "obs")?.restorationType ?? getNestedRecord(item, "obs")?.restoreType,
              )
                ? (getNestedRecord(item, "obs")?.restorationType ?? getNestedRecord(item, "obs")?.restoreType) as ObsRestorationType
                : obsRestorationType;
              const readTrafficAmount = getBatchObsAmount(item, obsReadTrafficValue, ["readTraffic", "readTrafficAmount", "retrievalTraffic"]);
              const readTrafficUnit = getBatchObsUnit(item, obsReadTrafficUnit, ["readTrafficUnit", "retrievalTrafficUnit"]);
              const replicationTrafficAmount = getBatchObsAmount(item, obsReplicationTrafficValue, ["replicationTraffic", "crossRegionReplicationTraffic"]);
              const replicationTrafficUnit = getBatchObsUnit(item, obsReplicationTrafficUnit, ["replicationTrafficUnit", "crossRegionReplicationTrafficUnit"]);
              const lifecycleTransitionRequestInput = getBatchObsAmount(item, obsLifecycleTransitionRequestsValue, ["lifecycleTransitionRequests"]);
              const estimate = estimateObsConfiguration(obsCatalog, {
                productType,
                storageClass,
                redundancy,
                storageAmount,
                storageUnit,
                durationMonths,
                outboundTrafficAmount,
                outboundTrafficUnit,
                readRequests,
                writeRequests,
                deleteRequests,
                pullTrafficAmount,
                pullTrafficUnit,
                restorationType,
                readTrafficAmount,
                readTrafficUnit,
                replicationTrafficAmount,
                replicationTrafficUnit,
                lifecycleTransitionRequests: convertObsRequestInputToCount(lifecycleTransitionRequestInput),
              });

              if (!estimate) {
                throw new Error(`Item ${index + 1} uses an OBS combination that is not available in ${regionValue}.`);
              }

              const requestRateSet = obsCatalog.requestRates[storageClass];
              const readRequestUnits = getObsRequestUnits(requestRateSet?.read?.measureUnitStep, readRequests);
              const writeRequestUnits = getObsRequestUnits(requestRateSet?.write?.measureUnitStep, writeRequests);
              const deleteRequestUnits = getObsRequestUnits(requestRateSet?.delete?.measureUnitStep, deleteRequests);
              const storageGiB = convertObsCapacityToGb(storageAmount, storageUnit);
              const catalogRegionId = obsCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue;

              return [{
                serviceCode: selectedServiceMeta.code,
                serviceName: selectedService,
                productType: "obs",
                title: `${selectedService} ${productType} ${storageClass} ${storageAmount} ${storageUnit}`,
                quantity,
                config: {
                  region: regionValue,
                  catalogRegionId,
                  billingMode: "Pay-per-use",
                  description,
                  productType,
                  storageClass,
                  redundancy,
                  storageAmount,
                  storageUnit,
                  storageGiB,
                  durationMonths,
                  outboundTrafficAmount,
                  outboundTrafficUnit,
                  readRequests,
                  writeRequests,
                  deleteRequests,
                  pullTrafficAmount,
                  pullTrafficUnit,
                  restorationType,
                  readTrafficAmount,
                  readTrafficUnit,
                  replicationTrafficAmount,
                  replicationTrafficUnit,
                  lifecycleTransitionRequests: convertObsRequestInputToCount(lifecycleTransitionRequestInput),
                  minimumStorageDays: estimate.variant.minimumStorageDays,
                  requestInputMultiplier: obsRequestInputMultiplier,
                  huaweiPayload: buildObsHuaweiPayload({
                    regionId: catalogRegionId,
                    catalog: obsCatalog,
                    input: {
                      productType,
                      storageClass,
                      redundancy,
                      storageAmount,
                      storageUnit,
                      durationMonths,
                      outboundTrafficAmount,
                      outboundTrafficUnit,
                      readRequests,
                      writeRequests,
                      deleteRequests,
                      pullTrafficAmount,
                      pullTrafficUnit,
                      restorationType,
                      readTrafficAmount,
                      readTrafficUnit,
                      replicationTrafficAmount,
                      replicationTrafficUnit,
                      lifecycleTransitionRequests: convertObsRequestInputToCount(lifecycleTransitionRequestInput),
                    },
                    estimate,
                    title: `${selectedService} ${productType} ${storageClass} ${storageAmount} ${storageUnit}`,
                    description: selectedService,
                    storageRequestUnits: {
                      read: readRequestUnits,
                      write: writeRequestUnits,
                      delete: deleteRequestUnits,
                    },
                  }),
                },
                pricing: {
                  total: formatFlavorAmount(estimate.currency, estimate.amount * quantity, estimate.suffix),
                  estimate: formatFlavorAmount(estimate.currency, estimate.amount, estimate.suffix),
                  monthlyAverage: formatFlavorAmount(estimate.currency, estimate.monthlyAverageAmount, "/mo"),
                  breakdown: estimate.breakdown.map((entry) => ({
                    label: entry.label,
                    value: formatFlavorAmount(estimate.currency, entry.amount, estimate.suffix),
                  })),
                },
              }];
            })()
          : (() => {
              const diskType = getBatchDiskType(item, systemDiskType);
              const diskSizeGiB = getBatchDiskSize(item, systemDiskSizeValue, evsDiskSizeBounds);
              const rawDurationMonths =
                getNestedRecord(item, "evs")?.durationMonths
                ?? getNestedRecord(item, "evs")?.months
                ?? item.durationMonths
                ?? item.months;
              const durationMonths = billingMode === "Yearly/Monthly"
                ? Math.max(1, Math.floor(parsePositiveNumber(rawDurationMonths) ?? evsDurationMonthsValue))
                : evsDurationMonthsValue;
              const requestedIops = diskType === "General Purpose SSD V2"
                ? getGpSsd2RequestedIops(item, diskSizeGiB)
                : null;
              const requestedThroughput = diskType === "General Purpose SSD V2" && requestedIops != null
                ? getGpSsd2RequestedThroughput(item, requestedIops)
                : null;
              const requestBodies = buildEvsProductMutationBodies({
                serviceCode: selectedServiceMeta.code,
                serviceName: selectedService,
                serviceTitle: selectedService,
                region: regionValue,
                billingMode,
                usageHours: usageHoursValue,
                durationMonths,
                quantity,
                description,
                diskType,
                diskSizeGiB,
                requestedIops,
                requestedThroughput,
                diskPricing,
              });

              splitDiskCount += Math.max(0, requestBodies.length - 1);
              return requestBodies;
            })();

        for (const [chunkIndex, requestBody] of requestBodies.entries()) {
          const payload = await mutateListProduct(
            `/api/lists/${selectedListId}/products`,
            "POST",
            requestBody,
            `Unable to add item ${index + 1}${requestBodies.length > 1 ? ` chunk ${chunkIndex + 1}` : ""} to the list`,
          );

          appendProductToState(payload);
          createdCount += 1;
        }
      }

      setBatchAddMessage(
        splitDiskCount > 0
          ? `Added ${createdCount} products to the list. ${splitDiskCount} extra EVS split disk${splitDiskCount === 1 ? "" : "s"} were created for sizes above ${evsSingleDiskMaxGiB} GiB.`
          : createdCount === 1
            ? "Added 1 product to the list."
            : `Added ${createdCount} products to the list.`,
      );
    } catch (error) {
      setBatchAddMessage(
        createdCount > 0
          ? `${error instanceof Error ? error.message : "Batch add failed."} ${createdCount} item${createdCount === 1 ? "" : "s"} were added before the error.`
          : error instanceof Error
            ? error.message
            : "Batch add failed.",
      );
    } finally {
      setBatchAddPending(false);
    }
  };

  const handleAddToList = async () => {
    if (!session) {
      setAddToListMessage("Sign in to save carts and projects.");
      return;
    }

    if (!isSelectedServiceImplemented) {
      setAddToListMessage(`${selectedService} is not implemented in the calculator yet.`);
      return;
    }

    if (!selectedListId) {
      setAddToListMessage("Create a list first.");
      return;
    }

    if (isEcsCalculator && !selectedFlavorCard) {
      setAddToListMessage("Select a flavor first.");
      return;
    }

    if (isFlexusLCalculator && !selectedFlexusLPlan) {
      setAddToListMessage("Select a Flexus L plan first.");
      return;
    }

    if (isEvsCalculator && !selectedDiskPrice) {
      setAddToListMessage("Select a volume type first.");
      return;
    }

    if (isObsCalculator && !selectedObsPricing) {
      setAddToListMessage("Select an OBS storage class first.");
      return;
    }

    if (isEipCalculator && !selectedEipPricing) {
      setAddToListMessage(eipPricingError || "EIP pricing is unavailable for the current selection.");
      return;
    }

    if (isElbCalculator && !selectedElbPricing) {
      setAddToListMessage(elbPricingError || "ELB pricing is unavailable for the current selection.");
      return;
    }

    if (isNatCalculator && !selectedNatPricing) {
      setAddToListMessage(natPricingError || "NAT pricing is unavailable for the current selection.");
      return;
    }

    if (isVpnCalculator && !selectedVpnPricing) {
      setAddToListMessage(vpnPricingError || "VPN pricing is unavailable for the current selection.");
      return;
    }

    if (isModelArtsCalculator && !selectedModelArtsPricing) {
      setAddToListMessage(modelArtsPricingError || "ModelArts pricing is unavailable for the current selection.");
      return;
    }

    if (isCceCalculator && !selectedCcePricing) {
      setAddToListMessage(ccePricingError || "CCE pricing is unavailable for the current selection.");
      return;
    }

    if (isCceCalculator && (!cceClusterScale || !cceMasterNodes)) {
      setAddToListMessage("Select cluster scale and master nodes first.");
      return;
    }

    if (isCciCalculator && (!cciCpu || !cciMemory)) {
      setAddToListMessage("Enter CPU and memory values first.");
      return;
    }

    setAddToListPending(true);
    setAddToListMessage("");

    try {
      const quantity = isModelArtsCalculator ? 1 : Math.max(1, Number(instanceCount || "1"));
      const requestBodies = isEcsCalculator
        ? selectedFlavorCard?.productType === "flexus-l" && selectedFlavorCard.referencePlanId
          ? (() => {
              const selectedPlan = findFlexusLPlan(selectedFlavorCard.referencePlanId);
              if (!selectedPlan) {
                throw new Error("Select a Flexus L plan first.");
              }

              return {
                serviceCode: selectedFlavorCard.serviceCode,
                serviceName: selectedFlavorCard.serviceName,
                productType: "flexus-l",
                title: `${selectedFlavorCard.serviceName} ${selectedPlan.title}`,
                quantity,
                config: {
                  region: regionValue,
                  billingMode,
                  description: selectedFlavorCard.description ?? selectedService,
                  planId: selectedPlan.id,
                  planTitle: selectedPlan.title,
                  vcpu: selectedPlan.vcpu,
                  ramGiB: selectedPlan.ramGiB,
                  systemDiskGiB: selectedPlan.systemDiskGiB,
                  peakBandwidthMbit: selectedPlan.peakBandwidthMbit,
                  dataPackageTiB: selectedPlan.dataPackageTiB,
                  referenceRegion: flexusLPricingReference.region,
                },
                pricing: {
                  total: selectedEstimate,
                  flavor: selectedFlavorCard.flavorPrice ?? null,
                },
              } satisfies ProductMutationBody;
            })()
          : {
              serviceCode: selectedServiceMeta.code,
              serviceName: selectedService,
              productType: "ecs",
              title: `${selectedService} ${selectedFlavor}`,
              quantity,
              config: {
                region: regionValue,
                billingMode,
                usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
                description: selectedFlavorCard?.description ?? selectedService,
                flavor: selectedFlavor,
                vcpu: Number(vcpuValue || "0"),
                ramGiB: Number(ramValue || "0"),
                systemDisk: {
                  type: systemDiskType,
                  sizeGiB: systemDiskSizeValue,
                  ...(isGpSsd2Selected && gpSsd2IopsValue != null ? { iops: gpSsd2IopsValue } : {}),
                  ...(isGpSsd2Selected && gpSsd2ThroughputValue != null ? { throughput: gpSsd2ThroughputValue } : {}),
                },
              },
              pricing: {
                total: selectedEstimate,
                flavor: selectedFlavorCard?.flavorPrice ?? null,
                disk: selectedDiskPrice ? formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix) : null,
              },
            }
        : isFlexusLCalculator && selectedFlexusLPlan
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "flexus-l",
            title: `${selectedService} ${selectedFlexusLPlan.title}`,
            quantity,
            config: {
              region: regionValue,
              billingMode: "Yearly/Monthly",
              description: selectedService,
              planId: selectedFlexusLPlan.id,
              planTitle: selectedFlexusLPlan.title,
              vcpu: selectedFlexusLPlan.vcpu,
              ramGiB: selectedFlexusLPlan.ramGiB,
              systemDiskGiB: selectedFlexusLPlan.systemDiskGiB,
              peakBandwidthMbit: selectedFlexusLPlan.peakBandwidthMbit,
              dataPackageTiB: selectedFlexusLPlan.dataPackageTiB,
              referenceRegion: flexusLPricingReference.region,
            },
            pricing: {
              total: selectedEstimate,
              flavor: formatFlavorAmount("USD", selectedFlexusLPlan.monthlyPriceUsd, "/mo"),
            },
          }
        : isElbCalculator && selectedElbPricing
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "elb",
            title: `${selectedService} ${elbType}`,
            quantity,
            config: {
              region: regionValue,
              catalogRegionId: elbCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
              type: elbType,
              specificationType: elbSpecificationType,
              subAz: elbSubAz,
              fixedAvailabilityAzCount: elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" ? elbFixedAvailabilityAzCount : null,
              fixedSelectedTypes: elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" ? elbFixedSelectedTypes : [],
              fixedTypeSpecs: elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" ? normalizedElbFixedTypeSpecs : {},
              networkType: elbNetworkType,
              sharedChargeMode: elbType === "Shared load balancer" ? elbSharedChargeMode : null,
              sharedBandwidthMbit: elbType === "Shared load balancer" && showElbSharedBandwidth ? elbSharedBandwidthMbitValue : null,
              sharedTrafficAmount: elbType === "Shared load balancer" && showElbSharedTraffic ? elbSharedTrafficAmountValue : null,
              sharedTrafficUnit: elbType === "Shared load balancer" && showElbSharedTraffic ? elbSharedTrafficUnit : null,
              selectedProtocols: elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? elbSelectedProtocols : [],
              protocolInputs: elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? normalizedElbProtocolInputs : {},
              estimatedNetworkLcus: selectedElbPricing.estimatedLcus.network,
              estimatedApplicationLcus: selectedElbPricing.estimatedLcus.application,
              estimatedTotalLcus: selectedElbPricing.estimatedLcus.total,
              selectedNetworkSpecLcus: selectedElbPricing.selectedSpecLcus.network,
              selectedApplicationSpecLcus: selectedElbPricing.selectedSpecLcus.application,
              usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
            },
            pricing: {
              total: selectedEstimate,
              estimate: formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.amount, selectedElbPricing.suffix),
              monthlyAverage: formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.monthlyAverageAmount, "/mo"),
              breakdown: selectedElbPricing.breakdown.map((entry) => ({
                label: entry.label,
                value: formatFlavorAmount(selectedElbPricing.currency, entry.amount, selectedElbPricing.suffix),
              })),
            },
          }
        : isEipCalculator && selectedEipPricing
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "eip",
            title: `${selectedService} ${eipType} Dynamic BGP ${eipChargeMode}`,
            quantity,
            config: {
              region: regionValue,
              catalogRegionId: eipCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
              type: eipType,
              eipType: "Dynamic BGP",
              chargeMode: eipChargeMode,
              bandwidthMbit: showEipBandwidth ? eipBandwidthMbitValue : null,
              durationMonths: showEipEnhanced95DurationMonths ? eipEnhanced95DurationMonthsValue : null,
              sharedBandwidthQuantity: showEipSharedBandwidthQuantity ? eipSharedBandwidthQuantityValue : null,
              trafficAmount: showEipTraffic ? eipTrafficAmountValue : null,
              trafficUnit: showEipTraffic ? eipTrafficUnit : null,
              usageHours: billingMode === "Pay-per-use" && !showEipEnhanced95DurationMonths ? usageHoursValue : null,
            },
            pricing: {
              total: selectedEstimate,
              estimate: formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.amount, selectedEipPricing.suffix),
              monthlyAverage: formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.monthlyAverageAmount, "/mo"),
              breakdown: selectedEipPricing.breakdown.map((entry) => ({
                label: entry.label,
                value: formatFlavorAmount(selectedEipPricing.currency, entry.amount, selectedEipPricing.suffix),
              })),
            },
          }
        : isNatCalculator && selectedNatPricing
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "nat",
            title: `${selectedService} ${natType} ${natSize}`,
            quantity,
            config: {
              region: regionValue,
              catalogRegionId: natCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
              type: natType,
              size: natSize,
              resourceSpecCode: selectedNatPricing.tier.resourceSpecCode,
              usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
              billableDays: selectedNatPricing.billableDays,
            },
            pricing: {
              total: selectedEstimate,
              estimate: formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.amount, selectedNatPricing.suffix),
              daily: selectedNatPricing.dailyAmount != null
                ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.dailyAmount, "/day")
                : null,
              hourly: selectedNatPricing.hourlyAmount != null
                ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.hourlyAmount, "/h")
                : null,
              monthly: selectedNatPricing.monthlyAmount != null
                ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.monthlyAmount, "/mo")
                : null,
              yearly: selectedNatPricing.yearlyAmount != null
                ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.yearlyAmount, "/yr")
                : null,
            },
          }
        : isVpnCalculator && selectedVpnPricing
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "vpn",
            title: `${selectedService} ${vpnEdition} ${vpnMode} ${vpnSelectedSpecification}`,
            quantity,
            config: {
              region: regionValue,
              catalogRegionId: vpnCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
              edition: vpnEdition,
              mode: vpnMode,
              networkType: vpnNetworkType,
              specification: vpnSelectedSpecification,
              accessViaNonFixedIp: "Off",
              connectionGroups: 10,
              useSharedBandwidth: showVpnPublicBandwidth ? vpnUseSharedBandwidth : null,
              eipBandwidthMbit1: showVpnPublicBandwidth ? Math.max(0, Number(vpnEipBandwidthMbit1) || 0) : null,
              eipBandwidthMbit2: showVpnPublicBandwidth ? Math.max(0, Number(vpnEipBandwidthMbit2) || 0) : null,
              durationMonths: billingMode === "Yearly/Monthly" ? Math.max(1, Number(vpnDurationMonths) || vpnDefaults.durationMonths) : null,
              usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
              gatewayResourceSpecCode: selectedVpnPricing.gatewayTier.resourceSpecCode,
              bandwidthResourceSpecCode: selectedVpnPricing.bandwidthTier?.resourceSpecCode ?? null,
            },
            pricing: {
              total: selectedEstimate,
              estimate: formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.amount, selectedVpnPricing.suffix),
              monthlyAverage: formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.monthlyAverageAmount, "/mo"),
              breakdown: selectedVpnPricing.breakdown.map((entry) => ({
                label: entry.label,
                value: formatFlavorAmount(selectedVpnPricing.currency, entry.amount, selectedVpnPricing.suffix),
              })),
            },
          }
        : isObsCalculator && selectedObsPricing
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
              productType: "obs",
              title: `${selectedService} ${obsProductType} ${obsStorageClass} ${obsStorageSizeValue} ${obsStorageUnit}`,
              quantity,
              config: {
                region: regionValue,
              catalogRegionId: obsCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode: "Pay-per-use",
              description: selectedService,
                productType: obsProductType,
                storageClass: obsStorageClass,
                redundancy: obsRedundancy,
                storageAmount: obsStorageSizeValue,
                storageUnit: obsStorageUnit,
                storageGiB: convertObsCapacityToGb(obsStorageSizeValue, obsStorageUnit),
              durationMonths: obsDurationMonthsValue,
              outboundTrafficAmount: obsOutboundTrafficValue,
              outboundTrafficUnit: obsOutboundTrafficUnit,
              readRequests: convertObsRequestInputToCount(obsReadRequestsValue),
              writeRequests: convertObsRequestInputToCount(obsWriteRequestsValue),
              deleteRequests: convertObsRequestInputToCount(obsDeleteRequestsValue),
              pullTrafficAmount: showObsPullTraffic ? obsPullTrafficValue : 0,
              pullTrafficUnit: obsPullTrafficUnit,
              restorationType: obsRestorationType,
              readTrafficAmount: obsReadTrafficValue,
              readTrafficUnit: obsReadTrafficUnit,
              replicationTrafficAmount: showObsReplicationTraffic ? obsReplicationTrafficValue : 0,
              replicationTrafficUnit: obsReplicationTrafficUnit,
              lifecycleTransitionRequests: convertObsRequestInputToCount(obsLifecycleTransitionRequestsValue),
              minimumStorageDays: selectedObsPricing.variant.minimumStorageDays,
              requestInputMultiplier: obsRequestInputMultiplier,
              huaweiPayload: buildObsHuaweiPayload({
                regionId: obsCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
                catalog: obsCatalog,
                input: {
                  productType: obsProductType,
                  storageClass: obsStorageClass,
                  redundancy: obsRedundancy,
                  storageAmount: obsStorageSizeValue,
                  storageUnit: obsStorageUnit,
                  durationMonths: obsDurationMonthsValue,
                  outboundTrafficAmount: obsOutboundTrafficValue,
                  outboundTrafficUnit: obsOutboundTrafficUnit,
                  readRequests: convertObsRequestInputToCount(obsReadRequestsValue),
                  writeRequests: convertObsRequestInputToCount(obsWriteRequestsValue),
                  deleteRequests: convertObsRequestInputToCount(obsDeleteRequestsValue),
                  pullTrafficAmount: showObsPullTraffic ? obsPullTrafficValue : 0,
                  pullTrafficUnit: obsPullTrafficUnit,
                  restorationType: obsRestorationType,
                  readTrafficAmount: obsReadTrafficValue,
                  readTrafficUnit: obsReadTrafficUnit,
                  replicationTrafficAmount: showObsReplicationTraffic ? obsReplicationTrafficValue : 0,
                  replicationTrafficUnit: obsReplicationTrafficUnit,
                  lifecycleTransitionRequests: convertObsRequestInputToCount(obsLifecycleTransitionRequestsValue),
                },
                estimate: selectedObsPricing,
                title: `${selectedService} ${obsProductType} ${obsStorageClass} ${obsStorageSizeValue} ${obsStorageUnit}`,
                description: selectedService,
                storageRequestUnits: {
                  read: getObsRequestUnits(obsCatalog?.requestRates[obsStorageClass]?.read?.measureUnitStep, convertObsRequestInputToCount(obsReadRequestsValue)),
                  write: getObsRequestUnits(obsCatalog?.requestRates[obsStorageClass]?.write?.measureUnitStep, convertObsRequestInputToCount(obsWriteRequestsValue)),
                  delete: getObsRequestUnits(obsCatalog?.requestRates[obsStorageClass]?.delete?.measureUnitStep, convertObsRequestInputToCount(obsDeleteRequestsValue)),
                },
              }),
            },
            pricing: {
              total: selectedEstimate,
              estimate: formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.amount, selectedObsPricing.suffix),
              monthlyAverage: formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.monthlyAverageAmount, "/mo"),
              breakdown: selectedObsPricing.breakdown.map((entry) => ({
                label: entry.label,
                value: formatFlavorAmount(selectedObsPricing.currency, entry.amount, selectedObsPricing.suffix),
              })),
            },
          }
        : isCceCalculator
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "cce",
            title: `${selectedService} ${cceClusterScale} ${cceMasterNodes}`,
            quantity,
            config: {
              region: regionValue,
              catalogRegionId: cceCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode,
              clusterScale: cceClusterScale,
              masterNodes: cceMasterNodes,
              usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
              resourceSpecCode: selectedCcePricing?.tier.resourceSpecCode ?? null,
            },
            pricing: {
              total: selectedEstimate,
              estimate: selectedCcePricing ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.amount, selectedCcePricing.suffix) : null,
              hourly: selectedCcePricing?.hourlyAmount != null
                ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.hourlyAmount, "/h")
                : null,
              monthly: selectedCcePricing?.monthlyAmount != null
                ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.monthlyAmount, "/mo")
                : null,
              yearly: selectedCcePricing?.yearlyAmount != null
                ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.yearlyAmount, "/yr")
                : null,
            },
          }
        : isCciCalculator
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "cci",
            title: `${selectedService} ${cciCpu} vCPU ${cciMemory} GiB`,
            quantity,
            config: {
              region: regionValue,
              billingMode,
              cpu: Number(cciCpu),
              memoryGiB: Number(cciMemory),
              usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
            },
            pricing: {
              total: selectedEstimate,
            },
          }
        : isModelArtsCalculator && selectedModelArtsPricing
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "modelarts",
            title: `${selectedService} ${modelArtsResourceType} ${modelArtsSpecification}`,
            quantity,
            config: {
              region: regionValue,
              catalogRegionId: modelArtsCatalogRegionId ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode: billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
              serviceType: "AI Development Lifecycle",
              resourceType: modelArtsResourceType,
              specification: modelArtsSpecification,
              quantity: modelArtsResourceType === "EVS Storage" ? null : modelArtsQuantityValue,
              storageQuotaGb: modelArtsResourceType === "EVS Storage" ? modelArtsStorageQuotaValue : null,
              usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
              durationMonths: billingMode === "Yearly/Monthly" ? modelArtsDurationMonthsValue : null,
              resourceSpecCode: selectedModelArtsPricing.tier.resourceSpecCode,
            },
            pricing: {
              total: selectedEstimate,
              estimate: formatFlavorAmount(selectedModelArtsPricing.currency, selectedModelArtsPricing.amount, selectedModelArtsPricing.suffix),
              monthlyAverage: formatFlavorAmount(selectedModelArtsPricing.currency, selectedModelArtsPricing.monthlyAverageAmount, "/mo"),
              breakdown: selectedModelArtsPricing.breakdown.map((entry) => ({
                label: entry.label,
                value: formatFlavorAmount(selectedModelArtsPricing.currency, entry.amount, selectedModelArtsPricing.suffix),
              })),
            },
          }
        : buildEvsProductMutationBodies({
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            serviceTitle: selectedService,
            region: regionValue,
            billingMode,
            usageHours: usageHoursValue,
            durationMonths: evsDurationMonthsValue,
            quantity,
            description: selectedService,
            diskType: systemDiskType,
            diskSizeGiB: systemDiskSizeValue,
            requestedIops: isGpSsd2Selected ? gpSsd2IopsValue : null,
            requestedThroughput: isGpSsd2Selected ? gpSsd2ThroughputValue : null,
            diskPricing,
          });

      if (editingProductId && editingProductListId) {
        if (Array.isArray(requestBodies)) {
          const [firstBody, ...extraBodies] = requestBodies;
          const updatedPayload = await mutateListProduct(
            `/api/lists/${editingProductListId}/products/${editingProductId}`,
            "PATCH",
            firstBody,
            "Unable to update product",
          );

          setProjects((current) =>
            current.map((project) =>
              project.id === updatedPayload.projectId
                ? {
                    ...project,
                    updatedAt: updatedPayload.updatedAt,
                    lists: project.lists.map((list) =>
                      list.id === updatedPayload.listId
                        ? {
                            ...list,
                            updatedAt: updatedPayload.updatedAt,
                            products: list.products.map((item) => (item.id === updatedPayload.id ? { ...item, ...updatedPayload } : item)),
                          }
                        : list,
                    ),
                  }
                : project,
            ),
          );

          for (const extraBody of extraBodies) {
            const createdPayload = await mutateListProduct(
              `/api/lists/${selectedListId}/products`,
              "POST",
              extraBody,
              "Unable to create one of the EVS split disks",
            );
            appendProductToState(createdPayload);
          }

          setAddToListMessage(
            extraBodies.length > 0
              ? `Product updated and split into ${requestBodies.length} EVS disks because totals above ${evsSingleDiskMaxGiB} GiB are saved in chunks.`
              : "Product updated.",
          );
        } else {
          const updatedPayload = await mutateListProduct(
            `/api/lists/${editingProductListId}/products/${editingProductId}`,
            "PATCH",
            requestBodies,
            "Unable to update product",
          );

          setProjects((current) =>
            current.map((project) =>
              project.id === updatedPayload.projectId
                ? {
                    ...project,
                    updatedAt: updatedPayload.updatedAt,
                    lists: project.lists.map((list) =>
                      list.id === updatedPayload.listId
                        ? {
                            ...list,
                            updatedAt: updatedPayload.updatedAt,
                            products: list.products.map((item) => (item.id === updatedPayload.id ? { ...item, ...updatedPayload } : item)),
                          }
                        : list,
                    ),
                  }
                : project,
            ),
          );

          setAddToListMessage("Product updated.");
        }
      } else if (Array.isArray(requestBodies)) {
        for (const requestBody of requestBodies) {
          const createdPayload = await mutateListProduct(
            `/api/lists/${selectedListId}/products`,
            "POST",
            requestBody,
            "Unable to add product to list",
          );
          appendProductToState(createdPayload);
        }

        setAddToListMessage(
          requestBodies.length > 1
            ? `Added ${requestBodies.length} EVS disks to the list because totals above ${evsSingleDiskMaxGiB} GiB are split into ${evsSingleDiskMaxGiB} GiB chunks plus a final remainder disk.`
            : "Product added to list.",
        );
      } else {
        const createdPayload = await mutateListProduct(
          `/api/lists/${selectedListId}/products`,
          "POST",
          requestBodies,
          "Unable to add product to list",
        );

        appendProductToState(createdPayload);
        setAddToListMessage("Product added to list.");
      }

      setEditingProductId(null);
      setEditingProductListId(null);
    } catch (error) {
      setAddToListMessage(error instanceof Error ? error.message : "Unable to add product to list");
    } finally {
      setAddToListPending(false);
    }
  };

  const activeProjectCloneTargetRegion = activeProject ? projectCloneTargetRegions[activeProject.id] ?? "" : "";
  const activeProjectCloneTargetBillingMode = activeProject ? projectCloneTargetBillingModes[activeProject.id] ?? "" : "";
  const activeProjectCloneMessage = activeProject ? projectCloneMessages[activeProject.id] ?? "" : "";
  const activeProjectCloneMessageIsError = activeProject ? projectCloneMessageErrors[activeProject.id] ?? false : false;
  const activeProjectHuaweiMessage = activeProject ? projectHuaweiMessages[activeProject.id] ?? "" : "";
  const activeProjectHuaweiMessageIsError = activeProject ? projectHuaweiMessageErrors[activeProject.id] ?? false : false;
  const projectCreateMenuItems: ActionMenuItem[] = [
    {
      label: "Import Project",
      icon: <Upload className="size-4" />,
      onSelect: openProjectImportPicker,
      disabled: importProjectPending || !isSignedIn,
    },
  ];
  const activeProjectShareMessage = activeProject ? projectShareMessages[activeProject.id] ?? "" : "";
  const activeSelectedHuaweiCartKey = activeList ? selectedHuaweiCartKey || activeList.huaweiCartKey || "" : "";
  const activeSelectedHuaweiCart = huaweiCarts.find((cart) => cart.key === activeSelectedHuaweiCartKey) ?? null;
  const activeListCloneMessage = activeList ? cloneActionMessage : "";
  const activeListCloneMessageIsError = activeList ? cloneActionIsError : false;
  const activeListHuaweiMessage = activeList ? huaweiActionMessage : "";
  const activeListShareMessage = activeList ? listShareMessages[activeList.id] ?? "" : "";
  const isActiveProjectCloning = activeProject ? cloningProjectId === activeProject.id : false;
  const isActiveProjectSyncing = activeProject ? syncingHuaweiProjectId === activeProject.id : false;
  const isActiveListLinking = activeList ? linkingHuaweiListId === activeList.id : false;
  const isActiveListCloning = activeList ? cloningListId === activeList.id : false;
  const calculatorRegionOptions = Object.entries(huaweiRegions).map(([value, labels]) => ({
    value,
    label: labels.full,
  }));
  const vpnDurationOptions = vpnDurationMonthOptions.map((value) => ({
    value: String(value),
    label: value === 1 ? "1 month" : value === 12 ? "1 year" : value === 24 ? "2 years" : value === 36 ? "3 years" : `${value} months`,
  }));
  const flavorSortOptions = Object.entries(flavorSortLabels).map(([value, label]) => ({
    value,
    label,
  }));
  const evsSplitNotice = isEvsCalculator ? buildEvsSplitNotice(systemDiskSizeValue) : null;
  const calculatorSelectionSummary = isEcsCalculator
    ? selectedFlavorCard?.productType === "flexus-l"
      ? `Selected specifications: ${selectedFlavorCard.name} | ${selectedFlavorCard.includedSystemDiskGiB ?? "-"} GiB system disk | ${selectedFlavorCard.peakBandwidthMbit ?? "-"} Mbit/s | ${selectedFlavorCard.dataPackageTiB ?? "-"} TB/month | ${selectedFlavorCard.price}`
      : `Selected specifications: ${selectedFlavor} | ${vcpuValue || "-"} vCPUs | ${ramValue || "-"} GiB | ${systemDiskType} ${systemDiskSize || String(activeDiskSizeBounds.min)} GiB${isGpSsd2Selected && gpSsd2IopsValue != null && gpSsd2ThroughputValue != null ? ` | ${gpSsd2IopsValue} IOPS | ${gpSsd2ThroughputValue} MB/s` : ""}${selectedDiskPrice ? ` | Disk ${formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}` : ""}`
    : isFlexusLCalculator && selectedFlexusLPlan
    ? `Selected specifications: ${selectedFlexusLPlan.title} | ${selectedFlexusLPlan.systemDiskGiB} GiB system disk | ${selectedFlexusLPlan.peakBandwidthMbit} Mbit/s | ${selectedFlexusLPlan.dataPackageTiB} TB/month | ${formatFlavorAmount("USD", selectedFlexusLPlan.monthlyPriceUsd, "/mo")}`
    : isObsCalculator && selectedObsPricing
    ? `Selected specifications: ${obsProductType} | ${obsStorageClass} | ${obsRedundancy}${obsRestorationType ? ` | ${obsRestorationType}` : ""} | ${obsStorageSizeValue} ${obsStorageUnit}${obsReadTrafficValue > 0 ? ` | Read ${obsReadTrafficValue} ${obsReadTrafficUnit}` : ""} | ${obsDurationMonthsValue}mo | ${formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.amount, selectedObsPricing.suffix)}`
    : isEipCalculator && selectedEipPricing
    ? `Selected specifications: ${eipType} | Dynamic BGP | ${eipChargeMode}${showEipBandwidth ? ` | ${eipBandwidthMbitValue} Mbit/s` : ""}${showEipEnhanced95DurationMonths ? ` | ${eipEnhanced95DurationMonthsValue}mo` : ""}${showEipSharedBandwidthQuantity ? ` | ${eipSharedBandwidthQuantityValue} shared bandwidth${eipSharedBandwidthQuantityValue === 1 ? "" : "s"}` : ""}${showEipTraffic ? ` | ${eipTrafficAmountValue} ${eipTrafficUnit}` : ""} | ${formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.amount, selectedEipPricing.suffix)}`
    : isElbCalculator && selectedElbPricing
    ? `Selected specifications: ${elbType}${elbType === "Dedicated load balancer" ? ` | ${elbSpecificationType}` : ""}${elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" ? ` | ${elbFixedAvailabilityAzCount} AZs | ${elbFixedSelectedTypes.map((type) => `${type}: ${normalizedElbFixedTypeSpecs[type]}`).join(" | ")}` : ""}${elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? ` | ${elbSubAz}` : ""} | ${elbNetworkType}${elbType === "Shared load balancer" && showElbSharedChargeMode ? ` | ${elbSharedChargeMode}${showElbSharedBandwidth ? ` | ${elbSharedBandwidthMbitValue} Mbit/s` : ""}${showElbSharedTraffic ? ` | ${elbSharedTrafficAmountValue} ${elbSharedTrafficUnit}` : ""}` : ""}${elbType === "Dedicated load balancer" ? ` | ${selectedElbPricing.estimatedLcus.total} estimated LCU` : ""} | ${formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.amount, selectedElbPricing.suffix)}`
    : isNatCalculator && selectedNatPricing
    ? `Selected specifications: ${natType} | ${natSize} | ${formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.amount, selectedNatPricing.suffix)}`
    : isVpnCalculator && selectedVpnPricing
    ? `Selected specifications: ${vpnEdition}${vpnEdition === "Enterprise" ? ` | ${vpnMode} | ${vpnNetworkType} | ${vpnSelectedSpecification}${showVpnPublicBandwidth ? ` | ${vpnUseSharedBandwidth ? "Shared" : "Dedicated"} bandwidth | EIP1 ${Math.max(0, Number(vpnEipBandwidthMbit1) || 0)} Mbit/s | EIP2 ${Math.max(0, Number(vpnEipBandwidthMbit2) || 0)} Mbit/s` : ""}` : ""}${billingMode === "Yearly/Monthly" ? ` | ${vpnDurationMonths}mo` : ""} | ${formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.amount, selectedVpnPricing.suffix)}`
    : isModelArtsCalculator
    ? `Selected specifications: AI Development Lifecycle | ${modelArtsResourceType} | ${modelArtsSpecification}${modelArtsResourceType === "EVS Storage" ? ` | ${modelArtsStorageQuotaValue} GB` : ` | ${modelArtsQuantityValue} instance${modelArtsQuantityValue === 1 ? "" : "s"}`}${billingMode === "Yearly/Monthly" ? ` | ${modelArtsDurationMonthsValue === 12 ? "1yr" : `${modelArtsDurationMonthsValue}mo`}` : ` | ${usageHoursValue}h`}${selectedModelArtsPricing ? ` | ${formatFlavorAmount(selectedModelArtsPricing.currency, selectedModelArtsPricing.amount, selectedModelArtsPricing.suffix)}` : ""}`
    : isCceCalculator && selectedCcePricing
    ? `Selected specifications: ${cceClusterScale} | ${cceMasterNodes} | ${formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.amount, selectedCcePricing.suffix)}`
    : `Selected specifications: ${systemDiskType} | ${systemDiskSize || String(activeDiskSizeBounds.min)} GiB${isEvsCalculator ? ` | ${billingMode === "Pay-per-use" ? `${usageHoursValue}h` : `${evsDurationMonthsValue}mo`}` : ""}${isGpSsd2Selected && gpSsd2IopsValue != null && gpSsd2ThroughputValue != null ? ` | ${gpSsd2IopsValue} IOPS | ${gpSsd2ThroughputValue} MB/s` : ""}${selectedDiskPrice ? ` | Disk ${formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}` : ""}`;
  const calculatorSelectionNotes = useMemo(
    () => [
      ...(isEcsCalculator && selectedFlavorCard?.productType === "flexus-l"
        ? ["Flexus L plans include bundled system disk, bandwidth, and traffic. The ECS disk settings below are ignored for this selection."]
        : []),
      ...(isEcsCalculator && selectedFlavorCard?.productType === "ecs" && selectedFlavorCard?.flavorPrice && selectedDiskPrice
        ? [`Flavor ${selectedFlavorCard.flavorPrice} + Disk ${formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}`]
        : []),
      ...(isObsCalculator && selectedObsPricing
        ? [
            ...selectedObsPricing.breakdown.map(
              (entry) => `${entry.label}: ${formatFlavorAmount(selectedObsPricing.currency, entry.amount, selectedObsPricing.suffix)}`,
            ),
            `Monthly average: ${formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.monthlyAverageAmount, "/mo")}.`,
            ...(obsRestorationType
              ? ["Read traffic models the published retrieval or restored-data transfer charges. Separate restoration API request fees are not modeled in this form."]
              : []),
            ...selectedObsPricing.notes,
          ]
        : []),
      ...(isEipCalculator && selectedEipPricing
        ? [
            ...selectedEipPricing.breakdown.map(
              (entry) => `${entry.label}: ${formatFlavorAmount(selectedEipPricing.currency, entry.amount, selectedEipPricing.suffix)}`,
            ),
            `Monthly average: ${formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.monthlyAverageAmount, "/mo")}.`,
            ...selectedEipPricing.notes,
          ]
        : []),
      ...(isElbCalculator && selectedElbPricing
        ? [
            ...selectedElbPricing.breakdown.map(
              (entry) => `${entry.label}: ${formatFlavorAmount(selectedElbPricing.currency, entry.amount, selectedElbPricing.suffix)}`,
            ),
            ...(elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic"
              ? [
                  `Estimated LCUs: network ${selectedElbPricing.estimatedLcus.network}, application ${selectedElbPricing.estimatedLcus.application}, total ${selectedElbPricing.estimatedLcus.total}.`,
                  ...selectedElbPricing.protocolBreakdowns.map(
                    (entry) => `${entry.protocol}: ${entry.lcu} LCU (${entry.details.join(", ")})`,
                  ),
                ]
              : []),
            ...(elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed"
              ? [
                  `Fixed dedicated sizing: ${elbFixedSelectedTypes.map((type) => `${type} ${normalizedElbFixedTypeSpecs[type]}`).join("; ")} across ${elbFixedAvailabilityAzCount} AZs.`,
                ]
              : []),
            ...selectedElbPricing.notes,
          ]
        : []),
      ...(isNatCalculator && selectedNatPricing
        ? [
            ...(selectedNatPricing.dailyAmount != null
              ? [`Pay-per-use daily rate: ${formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.dailyAmount, "/day")}.`]
              : []),
            ...(selectedNatPricing.hourlyAmount != null
              ? [`Pay-per-use hourly rate: ${formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.hourlyAmount, "/h")}.`]
              : []),
            ...(selectedNatPricing.monthlyAmount != null
              ? [`Monthly rate: ${formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.monthlyAmount, "/mo")}.`]
              : []),
            ...(selectedNatPricing.yearlyAmount != null
              ? [`Yearly rate: ${formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.yearlyAmount, "/yr")}.`]
              : []),
            ...selectedNatPricing.notes,
          ]
        : []),
      ...(isVpnCalculator && selectedVpnPricing
        ? [
            ...selectedVpnPricing.breakdown.map(
              (entry) => `${entry.label}: ${formatFlavorAmount(selectedVpnPricing.currency, entry.amount, selectedVpnPricing.suffix)}`,
            ),
            `Monthly average: ${formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.monthlyAverageAmount, "/mo")}.`,
            ...selectedVpnPricing.notes,
          ]
        : []),
      ...(isModelArtsCalculator && selectedModelArtsPricing
        ? [
            ...selectedModelArtsPricing.breakdown.map(
              (entry) => `${entry.label}: ${formatFlavorAmount(selectedModelArtsPricing.currency, entry.amount, selectedModelArtsPricing.suffix)}`,
            ),
            `Monthly average: ${formatFlavorAmount(selectedModelArtsPricing.currency, selectedModelArtsPricing.monthlyAverageAmount, "/mo")}.`,
            ...selectedModelArtsPricing.notes,
          ]
        : []),
      ...(isCceCalculator && selectedCcePricing
        ? [
            ...(selectedCcePricing.hourlyAmount != null
              ? [`Pay-per-use rate: ${formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.hourlyAmount, "/h")}.`]
              : []),
            ...(selectedCcePricing.monthlyAmount != null
              ? [`Monthly rate: ${formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.monthlyAmount, "/mo")}.`]
              : []),
            ...(selectedCcePricing.yearlyAmount != null
              ? [`Yearly rate: ${formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.yearlyAmount, "/yr")}.`]
              : []),
          ]
        : []),
      ...(isEvsCalculator && evsSplitNotice ? [evsSplitNotice] : []),
    ],
    [elbFixedAvailabilityAzCount, elbFixedSelectedTypes, elbSpecificationType, elbType, evsSplitNotice, isCceCalculator, isEcsCalculator, isEipCalculator, isElbCalculator, isEvsCalculator, isModelArtsCalculator, isNatCalculator, isObsCalculator, isVpnCalculator, normalizedElbFixedTypeSpecs, obsRestorationType, selectedCcePricing, selectedDiskPrice, selectedEipPricing, selectedElbPricing, selectedFlavorCard, selectedModelArtsPricing, selectedNatPricing, selectedObsPricing, selectedVpnPricing],
  );
  const calculatorDiskNotes = useMemo(
    () => [
      ...(isGpSsd2Selected
        ? ["Current estimate reflects capacity pricing only. Additional GPSSD2 IOPS and throughput charges are not modeled yet."]
        : []),
      ...(isEvsCalculator
        ? [
            `A single EVS disk can be up to ${evsSingleDiskMaxGiB} GiB. Entering a larger total will save multiple disks: ${evsSingleDiskMaxGiB} GiB chunks plus one final remainder disk.`,
            ...(evsSplitNotice ? [evsSplitNotice] : []),
          ]
        : [`Minimum ${activeDiskSizeBounds.min} GiB, maximum ${activeDiskSizeBounds.max} GiB.`]),
    ],
    [activeDiskSizeBounds.max, activeDiskSizeBounds.min, evsSplitNotice, isEvsCalculator, isGpSsd2Selected],
  );
  const calculatorDiskConfigProps = {
    mode: isEvsCalculator ? ("evs" as const) : ("ecs" as const),
    systemDiskType,
    systemDiskOptions,
    onSystemDiskTypeChange: (value: string) => {
      if (!value) {
        return;
      }
      setSystemDiskType(value as (typeof systemDiskOptions)[number]);
    },
    systemDiskSize,
    onSystemDiskSizeChange: (value: string) => {
      if (value === "") {
        setSystemDiskSize("");
        return;
      }
      updateSystemDiskSize(value);
    },
    onSystemDiskSizeBlur: () => updateSystemDiskSize(systemDiskSize || String(activeDiskSizeBounds.min)),
    onSystemDiskSizeStep: (delta: number) => updateSystemDiskSize(String(Number(systemDiskSize || String(activeDiskSizeBounds.min)) + delta)),
    showGpSsd2Controls: isGpSsd2Selected,
    gpSsd2Iops,
    gpSsd2IopsRange,
    onGpSsd2IopsChange: (value: string) => {
      if (value === "") {
        setGpSsd2Iops("");
        return;
      }
      updateGpSsd2Iops(value);
    },
    onGpSsd2IopsBlur: () => updateGpSsd2Iops(gpSsd2Iops || String(gpSsd2IopsRange?.min ?? gpSsd2IopsBounds.min)),
    gpSsd2Throughput,
    gpSsd2ThroughputRange,
    onGpSsd2ThroughputChange: (value: string) => {
      if (value === "") {
        setGpSsd2Throughput("");
        return;
      }
      updateGpSsd2Throughput(value);
    },
    onGpSsd2ThroughputBlur: () =>
      updateGpSsd2Throughput(gpSsd2Throughput || String(gpSsd2ThroughputRange?.min ?? gpSsd2ThroughputBounds.min)),
    pricingError: evsPricingError,
    pricingLoadingMessage: evsPricingLoading ? "Loading EVS pricing..." : null,
    notes: calculatorDiskNotes,
    selectionSummary: calculatorSelectionSummary,
    selectionNotes: calculatorSelectionNotes,
  };
  const evsFieldRuntimeValues = useMemo(
    () => ({
      billingMode,
      diskType: systemDiskType,
      diskSizeGiB: systemDiskSizeValue,
      usageHours: usageHoursValue,
      durationMonths: evsDurationMonthsValue,
      iops: gpSsd2IopsValue,
      throughput: gpSsd2ThroughputValue,
    }),
    [billingMode, evsDurationMonthsValue, gpSsd2IopsValue, gpSsd2ThroughputValue, systemDiskSizeValue, systemDiskType, usageHoursValue],
  );
  const evsConfiguredFields = useMemo(() => {
    if (!isConfigurableEvsCalculator || !selectedServiceDefinition) {
      return [];
    }

    return selectedServiceDefinition.fields
      .filter((field) => isServiceFieldVisible(field, evsFieldRuntimeValues))
      .map((field) => {
        const onChange = (value: string) => {
          if (field.id === "billingMode" && isBillingOption(value)) {
            setBillingMode(value);
            return;
          }

          if (field.id === "diskType" && isSystemDiskOption(value)) {
            setSystemDiskType(value);
            return;
          }

          if (field.id === "diskSizeGiB") {
            if (value === "") {
              setSystemDiskSize("");
              return;
            }
            updateSystemDiskSize(value);
            return;
          }

          if (field.id === "usageHours") {
            updateUsageHours(value);
            return;
          }

          if (field.id === "durationMonths") {
            updateEvsDurationMonths(value);
            return;
          }

          if (field.id === "iops") {
            updateGpSsd2Iops(value);
            return;
          }

          if (field.id === "throughput") {
            updateGpSsd2Throughput(value);
          }
        };

        const onBlur = () => {
          if (field.id === "diskSizeGiB") {
            updateSystemDiskSize(systemDiskSize || String(evsDiskSizeBounds.min));
            return;
          }

          if (field.id === "usageHours") {
            updateUsageHours(usageHours || String(Number(evsPilotDefinition?.defaults.usageHours) || 744));
            return;
          }

          if (field.id === "durationMonths") {
            updateEvsDurationMonths(evsDurationMonths || String(Number(evsPilotDefinition?.defaults.durationMonths) || 1));
            return;
          }

          if (field.id === "iops") {
            updateGpSsd2Iops(gpSsd2Iops || String(gpSsd2IopsRange?.min ?? gpSsd2IopsBounds.min));
            return;
          }

          if (field.id === "throughput") {
            updateGpSsd2Throughput(gpSsd2Throughput || String(gpSsd2ThroughputRange?.min ?? gpSsd2ThroughputBounds.min));
          }
        };

        const onStep = (delta: number) => {
          if (field.id === "diskSizeGiB") {
            updateSystemDiskSize(String(Number(systemDiskSize || String(evsDiskSizeBounds.min)) + delta));
            return;
          }

          if (field.id === "usageHours") {
            updateUsageHours(String(Number(usageHours || String(Number(evsPilotDefinition?.defaults.usageHours) || 744)) + delta));
            return;
          }

          if (field.id === "durationMonths") {
            updateEvsDurationMonths(String(Number(evsDurationMonths || String(Number(evsPilotDefinition?.defaults.durationMonths) || 1)) + delta));
            return;
          }

          if (field.id === "iops") {
            updateGpSsd2Iops(String(Number(gpSsd2Iops || String(gpSsd2IopsRange?.min ?? gpSsd2IopsBounds.min)) + delta));
            return;
          }

          if (field.id === "throughput") {
            updateGpSsd2Throughput(
              String(Number(gpSsd2Throughput || String(gpSsd2ThroughputRange?.min ?? gpSsd2ThroughputBounds.min)) + delta),
            );
          }
        };

        const options =
          field.id === "billingMode"
            ? selectedServiceDefinition.billingOptions.map((value) => ({ value, label: value }))
            : field.id === "diskType"
            ? systemDiskOptions.map((value) => ({ value, label: value }))
            : field.options?.map((value) => ({ value: String(value), label: String(value) }));

        const min =
          field.id === "diskSizeGiB" ? evsDiskSizeBounds.min
          : field.id === "usageHours" ? 1
          : field.id === "durationMonths" ? 1
          : field.id === "iops" ? gpSsd2IopsRange?.min
          : field.id === "throughput" ? gpSsd2ThroughputRange?.min
          : field.min;
        const max =
          field.id === "diskSizeGiB" ? evsDiskSizeBounds.max
          : field.id === "usageHours" ? 87600
          : field.id === "durationMonths" ? 360
          : field.id === "iops" ? gpSsd2IopsRange?.max
          : field.id === "throughput" ? gpSsd2ThroughputRange?.max
          : field.max;
        const value =
          field.id === "billingMode" ? billingMode
          : field.id === "diskType" ? systemDiskType
          : field.id === "diskSizeGiB" ? systemDiskSize
          : field.id === "usageHours" ? usageHours
          : field.id === "durationMonths" ? evsDurationMonths
          : field.id === "iops" ? gpSsd2Iops
          : field.id === "throughput" ? gpSsd2Throughput
          : "";

        return {
          definition: field,
          value,
          options,
          min,
          max,
          onChange,
          onBlur: field.type === "number" ? onBlur : undefined,
          onStep: field.type === "number" ? onStep : undefined,
        };
      });
  }, [
    billingMode,
    evsDurationMonths,
    evsFieldRuntimeValues,
    gpSsd2Iops,
    gpSsd2IopsRange?.max,
    gpSsd2IopsRange?.min,
    gpSsd2Throughput,
    gpSsd2ThroughputRange?.max,
    gpSsd2ThroughputRange?.min,
    isConfigurableEvsCalculator,
    selectedServiceDefinition,
    systemDiskSize,
    systemDiskType,
    updateGpSsd2Iops,
    updateGpSsd2Throughput,
    updateSystemDiskSize,
    usageHours,
  ]);
  const obsFieldRuntimeValues = useMemo(
    () => ({
      productType: obsProductType,
      storageClass: obsStorageClass,
      redundancy: obsRedundancy,
      showRestorationFields: obsRestorationTypeOptions.length > 0,
      showReplicationTraffic: showObsReplicationTraffic,
    }),
    [obsProductType, obsRedundancy, obsRestorationTypeOptions.length, obsStorageClass, showObsReplicationTraffic],
  );
  const obsConfiguredFields = useMemo(() => {
    if (!isConfigurableObsCalculator || !selectedServiceDefinition) {
      return [];
    }

    return selectedServiceDefinition.fields
      .filter((field) => isServiceFieldVisible(field, obsFieldRuntimeValues))
      .map((field) => {
        const onChange = (value: string) => {
          if (field.id === "productType" && isObsProductType(value)) {
            setObsProductType(value);
            return;
          }
          if (field.id === "storageClass" && isObsStorageClass(value)) {
            setObsStorageClass(value);
            return;
          }
          if (field.id === "redundancy" && isObsRedundancy(value)) {
            setObsRedundancy(value);
            return;
          }
          if (field.id === "storageAmount") {
            if (value === "") {
              setObsStorageSize("");
              return;
            }
            updateObsStorageSize(value);
            return;
          }
          if (field.id === "storageUnit" && isObsCapacityUnit(value)) {
            setObsStorageUnit(value);
            return;
          }
          if (field.id === "durationMonths") {
            setObsDurationMonths(value);
            return;
          }
          if (field.id === "outboundTrafficAmount") {
            setObsOutboundTraffic(value);
            return;
          }
          if (field.id === "outboundTrafficUnit" && isObsCapacityUnit(value)) {
            setObsOutboundTrafficUnit(value);
            return;
          }
          if (field.id === "pullTrafficAmount") {
            setObsPullTraffic(value);
            return;
          }
          if (field.id === "pullTrafficUnit" && isObsCapacityUnit(value)) {
            setObsPullTrafficUnit(value);
            return;
          }
          if (field.id === "restorationType" && isObsRestorationType(value)) {
            setObsRestorationType(value);
            return;
          }
          if (field.id === "readTrafficAmount") {
            setObsReadTraffic(value);
            return;
          }
          if (field.id === "readTrafficUnit" && isObsCapacityUnit(value)) {
            setObsReadTrafficUnit(value);
            return;
          }
          if (field.id === "lifecycleTransitionRequests") {
            setObsLifecycleTransitionRequests(value);
            return;
          }
          if (field.id === "replicationTrafficAmount") {
            setObsReplicationTraffic(value);
            return;
          }
          if (field.id === "replicationTrafficUnit" && isObsCapacityUnit(value)) {
            setObsReplicationTrafficUnit(value);
            return;
          }
          if (field.id === "readRequests") {
            setObsReadRequests(value);
            return;
          }
          if (field.id === "writeRequests") {
            setObsWriteRequests(value);
            return;
          }
          if (field.id === "deleteRequests") {
            setObsDeleteRequests(value);
          }
        };

        const onBlur = () => {
          if (field.id === "storageAmount") {
            updateObsStorageSize(obsStorageSize || String(obsStorageSizeBounds.min));
            return;
          }
          if (field.id === "durationMonths") {
            setObsDurationMonths(String(obsDurationMonthsValue));
            return;
          }
          if (field.id === "outboundTrafficAmount") {
            setObsOutboundTraffic(String(obsOutboundTrafficValue));
            return;
          }
          if (field.id === "pullTrafficAmount") {
            setObsPullTraffic(String(obsPullTrafficValue));
            return;
          }
          if (field.id === "readTrafficAmount") {
            setObsReadTraffic(String(obsReadTrafficValue));
            return;
          }
          if (field.id === "lifecycleTransitionRequests") {
            setObsLifecycleTransitionRequests(String(obsLifecycleTransitionRequestsValue));
            return;
          }
          if (field.id === "replicationTrafficAmount") {
            setObsReplicationTraffic(String(obsReplicationTrafficValue));
            return;
          }
          if (field.id === "readRequests") {
            setObsReadRequests(String(obsReadRequestsValue));
            return;
          }
          if (field.id === "writeRequests") {
            setObsWriteRequests(String(obsWriteRequestsValue));
            return;
          }
          if (field.id === "deleteRequests") {
            setObsDeleteRequests(String(obsDeleteRequestsValue));
          }
        };

        const onStep = (delta: number) => {
          if (field.id === "storageAmount") {
            updateObsStorageSize(String(Number(obsStorageSize || String(obsStorageSizeBounds.min)) + delta));
            return;
          }
          if (field.id === "durationMonths") {
            setObsDurationMonths(String(obsDurationMonthsValue + delta));
            return;
          }
          if (field.id === "outboundTrafficAmount") {
            setObsOutboundTraffic(String(Math.max(0, obsOutboundTrafficValue + delta)));
            return;
          }
          if (field.id === "pullTrafficAmount") {
            setObsPullTraffic(String(Math.max(0, obsPullTrafficValue + delta)));
            return;
          }
          if (field.id === "readTrafficAmount") {
            setObsReadTraffic(String(Math.max(0, obsReadTrafficValue + delta)));
            return;
          }
          if (field.id === "lifecycleTransitionRequests") {
            setObsLifecycleTransitionRequests(String(Math.max(0, obsLifecycleTransitionRequestsValue + delta)));
            return;
          }
          if (field.id === "replicationTrafficAmount") {
            setObsReplicationTraffic(String(Math.max(0, obsReplicationTrafficValue + delta)));
            return;
          }
          if (field.id === "readRequests") {
            setObsReadRequests(String(Math.max(0, obsReadRequestsValue + delta)));
            return;
          }
          if (field.id === "writeRequests") {
            setObsWriteRequests(String(Math.max(0, obsWriteRequestsValue + delta)));
            return;
          }
          if (field.id === "deleteRequests") {
            setObsDeleteRequests(String(Math.max(0, obsDeleteRequestsValue + delta)));
          }
        };

        const options =
          field.id === "productType"
            ? obsProductTypeOptions.map((value) => ({ value, label: value }))
            : field.id === "storageClass"
            ? obsStorageClassOptions.map((value) => ({ value, label: value }))
            : field.id === "redundancy"
            ? obsRedundancyOptions.map((value) => ({ value, label: value }))
            : field.id === "storageUnit" || field.id === "outboundTrafficUnit" || field.id === "pullTrafficUnit" || field.id === "readTrafficUnit" || field.id === "replicationTrafficUnit"
            ? obsCapacityUnits.map((value) => ({ value, label: value }))
            : field.id === "restorationType"
            ? obsRestorationTypeOptions.map((value) => ({ value, label: value }))
            : field.options?.map((value) => ({ value: String(value), label: String(value) }));

        const value =
          field.id === "productType" ? obsProductType
          : field.id === "storageClass" ? obsStorageClass
          : field.id === "redundancy" ? obsRedundancy
          : field.id === "storageAmount" ? obsStorageSize
          : field.id === "storageUnit" ? obsStorageUnit
          : field.id === "durationMonths" ? obsDurationMonths
          : field.id === "outboundTrafficAmount" ? obsOutboundTraffic
          : field.id === "outboundTrafficUnit" ? obsOutboundTrafficUnit
          : field.id === "pullTrafficAmount" ? obsPullTraffic
          : field.id === "pullTrafficUnit" ? obsPullTrafficUnit
          : field.id === "restorationType" ? (obsRestorationType ?? obsRestorationTypeOptions[0] ?? "")
          : field.id === "readTrafficAmount" ? obsReadTraffic
          : field.id === "readTrafficUnit" ? obsReadTrafficUnit
          : field.id === "lifecycleTransitionRequests" ? obsLifecycleTransitionRequests
          : field.id === "replicationTrafficAmount" ? obsReplicationTraffic
          : field.id === "replicationTrafficUnit" ? obsReplicationTrafficUnit
          : field.id === "readRequests" ? obsReadRequests
          : field.id === "writeRequests" ? obsWriteRequests
          : field.id === "deleteRequests" ? obsDeleteRequests
          : "";

        return {
          definition: field,
          value,
          options,
          min: field.id === "storageAmount" ? obsStorageSizeBounds.min : field.min,
          max: field.id === "storageAmount" ? obsStorageSizeBounds.max : field.max,
          onChange,
          onBlur: field.type === "number" ? onBlur : undefined,
          onStep: field.type === "number" ? onStep : undefined,
        };
      });
  }, [
    isConfigurableObsCalculator,
    obsDeleteRequests,
    obsDeleteRequestsValue,
    obsDurationMonths,
    obsDurationMonthsValue,
    obsFieldRuntimeValues,
    obsLifecycleTransitionRequests,
    obsLifecycleTransitionRequestsValue,
    obsOutboundTraffic,
    obsOutboundTrafficUnit,
    obsOutboundTrafficValue,
    obsProductType,
    obsProductTypeOptions,
    obsPullTraffic,
    obsPullTrafficUnit,
    obsPullTrafficValue,
    obsReadRequests,
    obsReadRequestsValue,
    obsReadTraffic,
    obsReadTrafficUnit,
    obsReadTrafficValue,
    obsRedundancy,
    obsRedundancyOptions,
    obsReplicationTraffic,
    obsReplicationTrafficUnit,
    obsReplicationTrafficValue,
    obsRestorationType,
    obsRestorationTypeOptions,
    obsStorageClass,
    obsStorageClassOptions,
    obsStorageSize,
    obsStorageUnit,
    obsWriteRequests,
    obsWriteRequestsValue,
    selectedServiceDefinition,
    updateObsStorageSize,
  ]);
  const eipFieldRuntimeValues = useMemo(
    () => ({
      type: eipType,
      chargeMode: eipChargeMode,
      showBandwidth: showEipBandwidth,
      bandwidthMbit: eipBandwidthMbitValue,
      enhanced95DurationMonths: eipEnhanced95DurationMonthsValue,
      sharedBandwidthQuantity: eipSharedBandwidthQuantityValue,
      trafficAmount: eipTrafficAmountValue,
      trafficUnit: eipTrafficUnit,
    }),
    [
      eipBandwidthMbitValue,
      eipChargeMode,
      eipEnhanced95DurationMonthsValue,
      eipSharedBandwidthQuantityValue,
      eipTrafficAmountValue,
      eipTrafficUnit,
      eipType,
      showEipBandwidth,
    ],
  );
  const eipConfiguredFields = useMemo(() => {
    if (!isConfigurableEipCalculator || !selectedServiceDefinition) {
      return [];
    }

    return selectedServiceDefinition.fields
      .filter((field) => isServiceFieldVisible(field, eipFieldRuntimeValues))
      .map((field) => {
        const onChange = (value: string) => {
          if (field.id === "type" && (value === "Dedicated EIP" || value === "Shared EIP")) {
            setEipType(value);
            return;
          }
          if (field.id === "chargeMode" && (value === "By bandwidth" || value === "By traffic" || value === "Enhanced 95")) {
            setEipChargeMode(value);
            return;
          }
          if (field.id === "bandwidthMbit") {
            setEipBandwidthMbit(value);
            return;
          }
          if (field.id === "enhanced95DurationMonths") {
            setEipEnhanced95DurationMonths(value);
            return;
          }
          if (field.id === "sharedBandwidthQuantity") {
            setEipSharedBandwidthQuantity(value);
            return;
          }
          if (field.id === "trafficAmount") {
            setEipTrafficAmount(value);
            return;
          }
          if (field.id === "trafficUnit" && (value === "GB" || value === "TB")) {
            setEipTrafficUnit(value);
          }
        };

        const onBlur = () => {
          if (field.id === "bandwidthMbit") {
            setEipBandwidthMbit(String(eipBandwidthMbitValue));
            return;
          }
          if (field.id === "enhanced95DurationMonths") {
            setEipEnhanced95DurationMonths(String(eipEnhanced95DurationMonthsValue));
            return;
          }
          if (field.id === "sharedBandwidthQuantity") {
            setEipSharedBandwidthQuantity(String(eipSharedBandwidthQuantityValue));
            return;
          }
          if (field.id === "trafficAmount") {
            setEipTrafficAmount(String(eipTrafficAmountValue));
          }
        };

        const onStep = (delta: number) => {
          if (field.id === "bandwidthMbit") {
            setEipBandwidthMbit(String(Math.max(eipBandwidthMinimumMbit, eipBandwidthMbitValue + delta)));
            return;
          }
          if (field.id === "enhanced95DurationMonths") {
            setEipEnhanced95DurationMonths(String(Math.max(1, eipEnhanced95DurationMonthsValue + delta)));
            return;
          }
          if (field.id === "sharedBandwidthQuantity") {
            setEipSharedBandwidthQuantity(String(Math.max(1, eipSharedBandwidthQuantityValue + delta)));
            return;
          }
          if (field.id === "trafficAmount") {
            setEipTrafficAmount(String(Math.max(0, eipTrafficAmountValue + delta)));
          }
        };

        const options =
          field.id === "type"
            ? eipTypeOptions.map((value) => ({ value, label: value }))
            : field.id === "chargeMode"
            ? eipChargeModeOptions.map((value) => ({ value, label: value }))
            : field.id === "trafficUnit"
            ? eipTrafficUnitOptions.map((value) => ({ value, label: value }))
            : field.options?.map((value) => ({ value: String(value), label: String(value) }));

        const value =
          field.id === "type" ? eipType
          : field.id === "chargeMode" ? eipChargeMode
          : field.id === "bandwidthMbit" ? eipBandwidthMbit
          : field.id === "enhanced95DurationMonths" ? eipEnhanced95DurationMonths
          : field.id === "sharedBandwidthQuantity" ? eipSharedBandwidthQuantity
          : field.id === "trafficAmount" ? eipTrafficAmount
          : field.id === "trafficUnit" ? eipTrafficUnit
          : "";

        return {
          definition: field,
          value,
          options,
          min: field.id === "bandwidthMbit" ? eipBandwidthMinimumMbit : field.min,
          onChange,
          onBlur: field.type === "number" ? onBlur : undefined,
          onStep: field.type === "number" ? onStep : undefined,
        };
      });
  }, [
    eipBandwidthMinimumMbit,
    eipBandwidthMbit,
    eipBandwidthMbitValue,
    eipChargeMode,
    eipChargeModeOptions,
    eipEnhanced95DurationMonths,
    eipEnhanced95DurationMonthsValue,
    eipFieldRuntimeValues,
    eipSharedBandwidthQuantity,
    eipSharedBandwidthQuantityValue,
    eipTrafficAmount,
    eipTrafficAmountValue,
    eipTrafficUnit,
    eipType,
    isConfigurableEipCalculator,
    selectedServiceDefinition,
  ]);
  const natConfiguredFields = useMemo(() => {
    if (!isConfigurableNatCalculator || !selectedServiceDefinition) {
      return [];
    }

    return selectedServiceDefinition.fields.map((field) => ({
      definition: field,
      value: field.id === "natType" ? natType : natSize,
      options:
        field.id === "natType"
          ? natTypeOptions.map((value) => ({ value, label: value }))
          : natSizeOptions.map((value) => ({ value, label: value })),
      onChange: (value: string) => {
        if (field.id === "natType" && (value === "Public NAT Gateway" || value === "Private NAT Gateway")) {
          setNatType(value);
          return;
        }

        if (field.id === "natSize" && (value === "Small" || value === "Medium" || value === "Large" || value === "Extra-large")) {
          setNatSize(value);
        }
      },
    }));
  }, [isConfigurableNatCalculator, natSize, natSizeOptions, natType, natTypeOptions, selectedServiceDefinition]);
  const vpnFieldRuntimeValues = useMemo(
    () => ({
      edition: vpnEdition,
      networkType: vpnNetworkType,
      billingMode,
    }),
    [billingMode, vpnEdition, vpnNetworkType],
  );
  const vpnConfiguredFields = useMemo(() => {
    if (!isConfigurableVpnCalculator || !selectedServiceDefinition) {
      return [];
    }

    return selectedServiceDefinition.fields
      .filter((field) => isServiceFieldVisible(field, vpnFieldRuntimeValues))
      .map((field) => {
        const onChange = (value: string) => {
          if (field.id === "edition" && (value === "Classic" || value === "Enterprise")) {
            setVpnEdition(value);
            return;
          }
          if (field.id === "mode" && (value === "Site-to-Cloud" || value === "Point-to-Cloud")) {
            setVpnMode(value);
            return;
          }
          if (field.id === "networkType" && (value === "Public network" || value === "Private network")) {
            setVpnNetworkType(value);
            return;
          }
          if (field.id === "useSharedBandwidth") {
            setVpnUseSharedBandwidth(value === "Yes");
            return;
          }
          if (field.id === "eipBandwidthMbit1") {
            setVpnEipBandwidthMbit1(value);
            return;
          }
          if (field.id === "eipBandwidthMbit2") {
            setVpnEipBandwidthMbit2(value);
            return;
          }
          if (field.id === "durationMonths") {
            setVpnDurationMonths(value);
          }
        };

        const onBlur = () => {
          if (field.id === "eipBandwidthMbit1") {
            setVpnEipBandwidthMbit1(String(Math.max(0, Number(vpnEipBandwidthMbit1) || 0)));
            return;
          }
          if (field.id === "eipBandwidthMbit2") {
            setVpnEipBandwidthMbit2(String(Math.max(0, Number(vpnEipBandwidthMbit2) || 0)));
          }
        };

        const onStep = (delta: number) => {
          if (field.id === "eipBandwidthMbit1") {
            setVpnEipBandwidthMbit1(String(Math.max(0, (Number(vpnEipBandwidthMbit1) || 0) + delta)));
            return;
          }
          if (field.id === "eipBandwidthMbit2") {
            setVpnEipBandwidthMbit2(String(Math.max(0, (Number(vpnEipBandwidthMbit2) || 0) + delta)));
          }
        };

        const options =
          field.id === "edition"
            ? vpnEditionOptionsToShow.map((value) => ({ value, label: value }))
            : field.id === "mode"
            ? vpnModeOptions.map((value) => ({ value, label: value }))
            : field.id === "networkType"
            ? vpnNetworkTypeOptions.map((value) => ({ value, label: value }))
            : field.id === "specification"
            ? vpnSpecificationOptions.map((value) => ({ value, label: value }))
            : field.id === "useSharedBandwidth"
            ? ["Yes", "No"].map((value) => ({ value, label: value }))
            : field.id === "durationMonths"
            ? vpnDurationOptions
            : field.options?.map((value) => ({ value: String(value), label: String(value) }));
        const value =
          field.id === "edition" ? vpnEdition
          : field.id === "mode" ? vpnMode
          : field.id === "networkType" ? vpnNetworkType
          : field.id === "specification" ? vpnSelectedSpecification
          : field.id === "useSharedBandwidth" ? (vpnUseSharedBandwidth ? "Yes" : "No")
          : field.id === "eipBandwidthMbit1" ? vpnEipBandwidthMbit1
          : field.id === "eipBandwidthMbit2" ? vpnEipBandwidthMbit2
          : field.id === "durationMonths" ? vpnDurationMonths
          : "";

        return {
          definition: field,
          value,
          options,
          disabled: field.id === "specification",
          onChange,
          onBlur: field.type === "number" ? onBlur : undefined,
          onStep: field.type === "number" ? onStep : undefined,
        };
      });
  }, [
    isConfigurableVpnCalculator,
    selectedServiceDefinition,
    vpnDurationMonths,
    vpnDurationOptions,
    vpnEdition,
    vpnEditionOptionsToShow,
    vpnEipBandwidthMbit1,
    vpnEipBandwidthMbit2,
    vpnFieldRuntimeValues,
    vpnMode,
    vpnModeOptions,
    vpnNetworkType,
    vpnSelectedSpecification,
    vpnSpecificationOptions,
    vpnUseSharedBandwidth,
  ]);
  const cceConfiguredFields = useMemo(() => {
    if (!isConfigurableCceCalculator || !selectedServiceDefinition) {
      return [];
    }

    return selectedServiceDefinition.fields.map((field) => ({
      definition: field,
      value: field.id === "clusterScale" ? cceClusterScale : cceMasterNodes,
      options:
        field.id === "clusterScale"
          ? cceClusterScaleOptions.map((value) => ({ value, label: value }))
          : cceMasterNodesOptions.map((value) => ({ value, label: value })),
      onChange: (value: string) => {
        if (field.id === "clusterScale" && (value === "50 nodes" || value === "200 nodes" || value === "1000 nodes" || value === "2000 nodes")) {
          setCceClusterScale(value);
          return;
        }

        if (field.id === "masterNodes" && (value === "3 Masters" || value === "Single")) {
          setCceMasterNodes(value);
        }
      },
    }));
  }, [cceClusterScale, cceClusterScaleOptions, cceMasterNodes, cceMasterNodesOptions, isConfigurableCceCalculator, selectedServiceDefinition]);
  const cciConfiguredFields = useMemo(() => {
    if (!isConfigurableCciCalculator || !selectedServiceDefinition) {
      return [];
    }

    return selectedServiceDefinition.fields.map((field) => ({
      definition: field,
      value: field.id === "cpu" ? cciCpu : cciMemory,
      onChange: field.id === "cpu" ? setCciCpu : setCciMemory,
      onBlur:
        field.id === "cpu"
          ? () => setCciCpu(String(Math.max(1, Number(cciCpu) || 1)))
          : () => setCciMemory(String(Math.max(1, Number(cciMemory) || 1))),
      onStep:
        field.id === "cpu"
          ? (delta: number) => setCciCpu(String(Math.max(1, Number(cciCpu) + delta)))
          : (delta: number) => setCciMemory(String(Math.max(1, Number(cciMemory) + delta))),
    }));
  }, [cciCpu, cciMemory, isConfigurableCciCalculator, selectedServiceDefinition]);
  const modelArtsFieldRuntimeValues = useMemo(
    () => ({
      billingMode,
      resourceType: modelArtsResourceType,
    }),
    [billingMode, modelArtsResourceType],
  );
  const modelArtsConfiguredFields = useMemo(() => {
    if (!isConfigurableModelArtsCalculator || !selectedServiceDefinition) {
      return [];
    }

    return selectedServiceDefinition.fields
      .filter((field) => isServiceFieldVisible(field, modelArtsFieldRuntimeValues))
      .map((field) => {
        const onChange = (value: string) => {
          if (field.id === "serviceType") {
            return;
          }
          if (field.id === "resourceType" && isModelArtsResourceType(value)) {
            setModelArtsResourceType(value);
            return;
          }
          if (field.id === "specification") {
            setModelArtsSpecification(value);
            return;
          }
          if (field.id === "quantity") {
            setModelArtsQuantity(value);
            return;
          }
          if (field.id === "storageQuotaGb") {
            setModelArtsStorageQuotaGb(value);
            return;
          }
          if (field.id === "usageHours") {
            updateUsageHours(value);
            return;
          }
          if (field.id === "durationMonths") {
            setModelArtsDurationMonths(value);
          }
        };

        const onBlur = () => {
          if (field.id === "quantity") {
            setModelArtsQuantity(String(modelArtsQuantityValue));
            return;
          }
          if (field.id === "storageQuotaGb") {
            setModelArtsStorageQuotaGb(String(modelArtsStorageQuotaValue));
            return;
          }
          if (field.id === "usageHours") {
            updateUsageHours(usageHours || String(modelArtsDefaults.usageHours));
          }
        };

        const onStep = (delta: number) => {
          if (field.id === "quantity") {
            setModelArtsQuantity(String(Math.max(1, modelArtsQuantityValue + delta)));
            return;
          }
          if (field.id === "storageQuotaGb") {
            setModelArtsStorageQuotaGb(String(Math.max(1, modelArtsStorageQuotaValue + delta)));
            return;
          }
          if (field.id === "usageHours") {
            updateUsageHours(String(usageHoursValue + delta));
          }
        };

        const options =
          field.id === "serviceType"
            ? [{ value: "AI Development Lifecycle", label: "AI Development Lifecycle" }]
            : field.id === "resourceType"
            ? modelArtsResourceTypeOptions.map((value) => ({ value, label: value }))
            : field.id === "specification"
            ? modelArtsSpecificationOptions.map((value) => ({ value, label: value }))
            : field.id === "durationMonths"
            ? modelArtsDurationMonthOptions.map((value) => ({
                value: String(value),
                label: value === 12 ? "1 year" : value === 1 ? "1 month" : `${value} months`,
              }))
            : field.options?.map((value) => ({ value: String(value), label: String(value) }));
        const value =
          field.id === "serviceType" ? "AI Development Lifecycle"
          : field.id === "resourceType" ? modelArtsResourceType
          : field.id === "specification" ? modelArtsSpecification
          : field.id === "quantity" ? modelArtsQuantity
          : field.id === "storageQuotaGb" ? modelArtsStorageQuotaGb
          : field.id === "usageHours" ? usageHours
          : field.id === "durationMonths" ? modelArtsDurationMonths
          : "";

        return {
          definition: field,
          value,
          options,
          disabled: field.id === "serviceType",
          onChange,
          min: field.id === "quantity" ? 1 : field.id === "storageQuotaGb" ? 1 : field.min,
          onBlur: field.type === "number" ? onBlur : undefined,
          onStep: field.type === "number" ? onStep : undefined,
        };
      });
  }, [
    isConfigurableModelArtsCalculator,
    modelArtsFieldRuntimeValues,
    modelArtsQuantity,
    modelArtsQuantityValue,
    modelArtsResourceType,
    modelArtsResourceTypeOptions,
    modelArtsSpecification,
    modelArtsSpecificationOptions,
    modelArtsStorageQuotaGb,
    modelArtsStorageQuotaValue,
    modelArtsDurationMonths,
    selectedServiceDefinition,
    usageHours,
    usageHoursValue,
  ]);
  const selectedCartMenuItems: ActionMenuItem[] =
    selectedList && selectedProject
      ? [
          {
            label: selectedList.huaweiCartKey ? "Sync Huawei Cart" : "Create Huawei Cart",
            icon: <RefreshCw className="size-4" />,
            onSelect: () => {
              void handleSyncSelectedList();
            },
            disabled: syncingHuaweiListId === selectedList.id,
          },
          {
            label: "Link Huawei Cart",
            icon: <Link2 className="size-4" />,
            onSelect: () => openActionModal({ kind: "list-link", listId: selectedList.id }),
          },
          {
            label: "Export Cart JSON",
            icon: <Download className="size-4" />,
            onSelect: () => handleOpenListExport(selectedProject, selectedList),
          },
          {
            label: "Clone Cart",
            icon: <Copy className="size-4" />,
            onSelect: () => openActionModal({ kind: "list-clone", listId: selectedList.id }),
          },
          ...(selectedList.canShare
            ? [
                {
                  label: "Share Cart",
                  icon: <Share2 className="size-4" />,
                  onSelect: () => openActionModal({ kind: "list-share", listId: selectedList.id }),
                },
              ]
            : []),
          {
            label: "Delete Cart",
            icon: <Trash2 className="size-4" />,
            onSelect: () => {
              void handleDeleteList(selectedList, selectedProject.id);
            },
            disabled: deletingListId === selectedList.id,
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900 lg:p-6">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
        <header className="sticky top-0 z-50 rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div className="justify-self-start">
              <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">NeoCalculator</p>
              <p className="text-sm text-zinc-600">Calculator, carts, and projects.</p>
            </div>
            <nav className="hidden items-center gap-2 lg:flex lg:justify-self-center">
              <HomeNavLink href="/projects" active={false}>
                Projects
              </HomeNavLink>
              <HomeNavLink href="/" active>
                Dashboard
              </HomeNavLink>
            </nav>
            <div className="flex items-center justify-self-end gap-3">
              {isSignedIn ? (
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-zinc-900">{session?.user.name || session?.user.email}</p>
                  <p className="text-xs text-zinc-500">{session?.user.email}</p>
                </div>
              ) : showSessionState ? null : <div className="hidden h-9 w-40 sm:block" aria-hidden="true" />}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10"
                aria-label="Reload Huawei carts"
                onClick={() => void loadHuaweiCarts()}
                disabled={huaweiCartsLoading || !cookieValue.trim()}
              >
                <RefreshCw className={`size-4 ${huaweiCartsLoading ? "animate-spin" : ""}`} />
              </Button>
              <div ref={profileAreaRef} className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-full border border-zinc-200"
                  aria-label="Open Huawei cookie settings"
                  aria-expanded={isProfileOpen}
                  onClick={() => setIsProfileOpen((current) => !current)}
                >
                  <UserCircle2 className="size-5" />
                </Button>

                {isProfileOpen ? (
                  <div className="absolute top-full right-0 z-50 mt-3 w-[min(92vw,380px)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-950">Huawei Cloud Cookie</p>
                      <p className="text-sm text-zinc-500">
                        Paste your website cookie string. It will be saved locally in this browser and works even before you sign in.
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={cookieDraft}
                        onChange={(event) => setCookieDraft(event.target.value)}
                        className="min-h-32 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-3 focus:ring-zinc-200"
                        placeholder="cookie_name=value; other_cookie=value;"
                      />
                      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                        <span>{cookieValue ? "Cookie saved locally" : "No cookie saved yet"}</span>
                        <span>{cookieDraft.length} chars</span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCookieDraft(cookieValue);
                            setIsProfileOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="button" onClick={handleSaveCookie}>
                          Save Cookie
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {isSignedIn ? (
                <Button type="button" variant="outline" onClick={() => authClient.signOut()}>
                  Sign Out
                </Button>
              ) : showSessionState ? (
                <>
                  <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
                    Sign In
                  </Link>
                  <Link href="/sign-up" className={buttonVariants()}>
                    Create Account
                  </Link>
                </>
              ) : (
                <div className="h-8 w-44" aria-hidden="true" />
              )}
            </div>
          </div>
          <nav className="mt-3 flex items-center gap-2 lg:hidden">
            <HomeNavLink href="/projects" active={false}>
              Projects
            </HomeNavLink>
            <HomeNavLink href="/" active>
              Dashboard
            </HomeNavLink>
          </nav>
        </header>

        <div className="relative z-30 px-1 py-1 sm:px-2">
          <div className="flex justify-center">
            <div ref={searchAreaRef} className="relative z-40 w-full max-w-3xl">
              <label htmlFor="service-search" className="sr-only">
                Search services
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-5 z-10 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <Input
                id="service-search"
                ref={searchInputRef}
                value={query}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setIsSearchOpen(true);
                  setActiveSuggestionIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    if (suggestions.length === 0) {
                      return;
                    }

                    event.preventDefault();
                    setIsSearchOpen(true);
                    setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
                  }

                  if (event.key === "ArrowUp") {
                    if (suggestions.length === 0) {
                      return;
                    }

                    event.preventDefault();
                    setIsSearchOpen(true);
                    setActiveSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
                  }

                  if (event.key === "Enter" && suggestions[activeSuggestionIndex]) {
                    event.preventDefault();
                    handleSelectService(suggestions[activeSuggestionIndex].name);
                  }

                  if (event.key === "Escape") {
                    setIsSearchOpen(false);
                  }
                }}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={hasSuggestions}
                aria-activedescendant={activeDescendant}
                className="h-16 rounded-full border-zinc-200 bg-white pr-26 pl-14 text-base shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]"
                placeholder="Search service name"
              />
              <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
                Ctrl K
              </div>

              {isSearchOpen && normalizedQuery ? (
                suggestions.length > 0 ? (
                  <div
                    id={listboxId}
                    role="listbox"
                    className="absolute top-full right-0 left-0 z-50 mt-3 overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]"
                  >
                    <div className="border-b border-zinc-100 px-5 py-3 text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">
                      Suggested services
                    </div>
                    <div className="p-2">
                      {suggestions.map((service, index) => (
                        <button
                          key={service.name}
                          id={`${listboxId}-${index}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeSuggestionIndex}
                          className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                            index === activeSuggestionIndex ? "bg-zinc-950 text-white" : "text-zinc-900 hover:bg-zinc-100"
                          }`}
                          onMouseEnter={() => setActiveSuggestionIndex(index)}
                          onClick={() => handleSelectService(service.name)}
                        >
                          <div className="flex items-center gap-3">
                            <Image src={service.icon} alt="" width={36} height={36} className="size-9 rounded-md object-contain" />
                            <div>
                              <p className="font-medium">{service.name}</p>
                              <p
                                className={`text-sm ${
                                  index === activeSuggestionIndex ? "text-zinc-300" : "text-zinc-500"
                                }`}
                              >
                                {service.code}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                index === activeSuggestionIndex ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {service.code}
                            </p>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                index === activeSuggestionIndex ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              Enter
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="absolute top-full right-0 left-0 z-50 mt-3 rounded-[28px] border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-500 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                    No services matched your search.
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
        <input
          ref={projectImportInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleImportProjectFile(file);
            }
          }}
        />
        <input
          ref={cartImportInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const projectId = importCartTargetProjectId;
            if (file && projectId) {
              void handleImportCartFile(projectId, file);
            }
          }}
        />

        <main className="relative z-0 grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
          <Card className="overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Projects</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    {isSignedIn ? "Projects and lists are scoped to your account." : "Browse anonymously. Sign in when you want to save carts and projects."}
                  </p>
                  {huaweiCartsSyncedAt ? (
                    <p className="mt-1 text-xs text-zinc-400">Huawei carts synced {formatDateTime(huaweiCartsSyncedAt)}</p>
                  ) : null}
                  {huaweiCartsError ? <p className="mt-1 text-xs text-red-600">{huaweiCartsError}</p> : null}
                </div>
                <Badge variant="secondary">{projects.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="New project name"
                    disabled={!isSignedIn}
                  />
                  <Button variant="outline" size="sm" onClick={handleCreateProject} disabled={newProjectPending || !isSignedIn}>
                    {newProjectPending ? "Adding..." : "New Project"}
                  </Button>
                  <ActionMenu
                    open={isProjectCreateMenuOpen}
                    onOpenChange={setIsProjectCreateMenuOpen}
                    label="Open project actions"
                    items={projectCreateMenuItems}
                  />
                </div>
                {projectsError ? <p className="text-sm text-red-600">{projectsError}</p> : null}
                {importProjectMessage ? (
                  <p className={`text-sm ${importProjectMessageIsError ? "text-red-600" : "text-zinc-600"}`}>{importProjectMessage}</p>
                ) : null}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[620px] px-4 xl:h-[calc(100vh-15rem)]">
                <div className="space-y-3 py-3">
                  {!isSignedIn ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      Sign in to save carts and projects. The calculator and Huawei cookie tools still work without an account.
                    </div>
                  ) : null}
                  {projectsLoading ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">Loading projects...</div>
                  ) : null}
                  {projects.map((project) => {
                    const isExpanded = expandedProjects[project.id] ?? false;
                    const isEditingProject = editingProjectId === project.id;
                    const isRenamingProject = renamingProjectId === project.id;
                    const isDeletingProject = deletingProjectId === project.id;
                  const projectCloneMessage = projectCloneMessages[project.id] ?? "";
                  const projectCloneIsError = projectCloneMessageErrors[project.id] ?? false;
                  const projectHuaweiMessage = projectHuaweiMessages[project.id] ?? "";
                  const projectHuaweiMessageIsError = projectHuaweiMessageErrors[project.id] ?? false;
                  const projectImportMessage = projectImportMessages[project.id] ?? "";
                  const projectImportMessageIsError = projectImportMessageErrors[project.id] ?? false;
                  const projectExportMessage = projectExportMessages[project.id] ?? "";
                  const projectExportMessageIsError = projectExportMessageErrors[project.id] ?? false;
                  const projectShareMessage = projectShareMessages[project.id] ?? "";
                    const projectMenuItems: ActionMenuItem[] = [
                      {
                        label: "Rename Project",
                        icon: <Pencil className="size-4" />,
                        onSelect: () => handleStartProjectRename(project),
                        disabled: isDeletingProject,
                      },
                      {
                        label: "Import Cart",
                        icon: <Upload className="size-4" />,
                        onSelect: () => openCartImportPicker(project.id),
                        disabled: importCartPendingProjectId === project.id,
                      },
                      {
                        label: "Create Huawei Carts",
                        icon: <RefreshCw className="size-4" />,
                        onSelect: () => openActionModal({ kind: "project-huawei", projectId: project.id }),
                      },
                      {
                        label: "Clone Project",
                        icon: <Copy className="size-4" />,
                        onSelect: () => openActionModal({ kind: "project-clone", projectId: project.id }),
                      },
                      {
                        label: "Export Project JSON",
                        icon: <Download className="size-4" />,
                        onSelect: () => handleOpenProjectExport(project),
                      },
                      {
                        label: "Export Project Excel",
                        icon: <Download className="size-4" />,
                        onSelect: () => void handleExportProjectExcel(project),
                      },
                      ...(project.canShare
                        ? [
                            {
                              label: "Share Project",
                              icon: <Share2 className="size-4" />,
                              onSelect: () => openActionModal({ kind: "project-share", projectId: project.id }),
                            },
                          ]
                        : []),
                    ];

                    return (
                      <div key={project.id} className="rounded-lg border bg-white">
                        <div className="flex items-start gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            {isEditingProject ? (
                              <div className="space-y-2 pr-2">
                                <Input
                                  value={projectNameDrafts[project.id] ?? project.name}
                                  onChange={(event) =>
                                    setProjectNameDrafts((current) => ({
                                      ...current,
                                      [project.id]: event.target.value,
                                    }))}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleRenameProject(project);
                                    }

                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      handleCancelProjectRename(project);
                                    }
                                  }}
                                  autoFocus
                                  placeholder="Project name"
                                />
                                <p className="text-xs text-zinc-500">Press Enter to save or Escape to cancel.</p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="min-w-0 text-left"
                                onClick={() => toggleProject(project.id)}
                                aria-expanded={isExpanded}
                              >
                                <p className="font-medium">{project.name}</p>
                                <p className="text-sm text-zinc-500">
                                  {project.lists.length} lists · {project.lists.reduce((sum, list) => sum + list.productCount, 0)} products ·{" "}
                                  {formatDate(project.updatedAt)}
                                </p>
                              </button>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isEditingProject ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleRenameProject(project)}
                                  disabled={isRenamingProject}
                                  aria-label="Save project name"
                                >
                                  <Check className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelProjectRename(project)}
                                  disabled={isRenamingProject}
                                  aria-label="Cancel project rename"
                                >
                                  <X className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                {project.canShare ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openActionModal({ kind: "project-share", projectId: project.id })}
                                    aria-label={`Share ${project.name}`}
                                  >
                                    <Share2 className="size-4" />
                                  </Button>
                                ) : null}
                                <ActionMenu
                                  open={openProjectMenuId === project.id}
                                  onOpenChange={(open) => setOpenProjectMenuId(open ? project.id : null)}
                                  label={`Open actions for ${project.name}`}
                                  items={projectMenuItems}
                                />
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleProject(project.id)}
                              aria-label={isExpanded ? "Collapse project" : "Expand project"}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleDeleteProject(project)}
                              disabled={isDeletingProject || isRenamingProject}
                              aria-label="Delete project"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="border-t border-zinc-100 px-3 py-3">
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  value={listDrafts[project.id] ?? ""}
                                  onChange={(event) => setListDrafts((current) => ({ ...current, [project.id]: event.target.value }))}
                                  placeholder="New list name"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCreateList(project.id)}
                                  disabled={listPendingProjectId === project.id}
                                >
                                  {listPendingProjectId === project.id ? "Adding..." : "Add List"}
                                </Button>
                              </div>
                              <Select
                                value={listBaseDrafts[project.id] || "__blank"}
                                onValueChange={(value) => {
                                  const nextValue = value && value !== "__blank" ? value : "";
                                  setListBaseDrafts((current) => ({
                                    ...current,
                                    [project.id]: nextValue,
                                  }));
                                }}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue>
                                    {listBaseDrafts[project.id]
                                      ? `Base: ${huaweiCarts.find((cart) => cart.key === listBaseDrafts[project.id])?.name ?? "Huawei cart"}`
                                      : "Base: Blank Neo cart"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__blank">Blank Neo cart</SelectItem>
                                  {huaweiCarts.map((cart) => {
                                    return (
                                      <SelectItem key={cart.key} value={cart.key} disabled={Boolean(cart.associatedListId)}>
                                        {cart.name}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              {projectHuaweiMessage || projectCloneMessage || projectImportMessage || projectExportMessage || projectShareMessage ? (
                                <div className="rounded-lg border bg-zinc-50 p-3">
                                  <div className="space-y-1 text-xs">
                                    {projectHuaweiMessage ? (
                                      <p className={projectHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectHuaweiMessage}</p>
                                    ) : null}
                                    {projectCloneMessage ? (
                                      <p className={projectCloneIsError ? "text-red-600" : "text-zinc-600"}>{projectCloneMessage}</p>
                                    ) : null}
                                    {projectImportMessage ? (
                                      <p className={projectImportMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectImportMessage}</p>
                                    ) : null}
                                    {projectExportMessage ? (
                                      <p className={projectExportMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectExportMessage}</p>
                                    ) : null}
                                    {projectShareMessage ? <p className="text-zinc-600">{projectShareMessage}</p> : null}
                                  </div>
                                </div>
                              ) : null}
                              {project.lists.map((item) => (
                                <div
                                  key={item.id}
                                  className={`flex items-start gap-2 rounded-lg border p-3 ${
                                    selectedListId === item.id ? "border-zinc-950 bg-white" : "border-zinc-200 bg-zinc-50"
                                  }`}
                                >
                                  <button type="button" onClick={() => setSelectedListId(item.id)} className="min-w-0 flex-1 text-left">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-medium">{item.name}</p>
                                          {item.huaweiCartKey ? <Badge variant="secondary">Huawei linked</Badge> : null}
                                        </div>
                                        <p className="text-sm text-zinc-500">
                                          {item.productCount} products · Created {formatDate(item.createdAt)}
                                        </p>
                                        {item.huaweiCartName ? <p className="text-xs text-zinc-400">{item.huaweiCartName}</p> : null}
                                      </div>
                                      <Badge variant="outline">{item.productCount}</Badge>
                                    </div>
                                  </button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void handleDeleteList(item, project.id)}
                                    disabled={deletingListId === item.id}
                                    aria-label={`Delete ${item.name}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              ))}
                              {project.lists.length === 0 ? (
                                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                                  This project does not have lists yet.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                    {projects.length} projects containing {totalProjectLists} lists and {totalProjectProducts} products.
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Image src={selectedServiceMeta.icon} alt="" width={40} height={40} className="size-10 rounded-lg object-contain" />
                    <div>
                      <CardTitle className="text-2xl">{selectedService}</CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-zinc-500">{selectedServiceMeta.code}</p>
                        {selectedServiceDefinition ? <Badge variant="secondary">{selectedServiceDefinitionStatus === "pilot" ? "JSON Pilot" : "JSON Config"}</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <TabsList>
                    <TabsTrigger value="calculator">Price Calculator</TabsTrigger>
                    <TabsTrigger value="batch-add">Batch add</TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <Separator />

              <TabsContent value="calculator">
                {isSelectedServiceImplemented ? (
                  <>
                    <div className="fixed right-4 bottom-4 left-4 z-40 grid gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)] backdrop-blur xl:left-1/2 xl:w-[min(920px,calc(100vw-48rem))] xl:-translate-x-1/2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                      <div className="min-w-0">
                        <p className="text-[2.125rem] leading-none font-semibold tracking-tight text-zinc-950">{selectedEstimateParts.amount}</p>
                        <p className="mt-0.5 leading-tight text-sm text-zinc-500">
                          {selectedEstimateParts.timeframe ? `${selectedEstimateParts.timeframe} · ` : ""}
                          {displayQuantityValue} {quantityLabel}
                          {displayQuantityValue === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-col justify-center gap-2 xl:items-end">
                        {addToListMessage ? <p className="text-sm text-zinc-500">{addToListMessage}</p> : null}
                        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                          {showGlobalQuantityControl ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-600">{quantityLabel}s</span>
                              <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-10 rounded-none px-3"
                                  onClick={() => updateInstanceCount(String(Number(instanceCount || "1") - 1))}
                                >
                                  -
                                </Button>
                                <Input
                                  value={instanceCount}
                                  onChange={(event) => {
                                    const digitsOnly = event.target.value.replace(/\D/g, "");
                                    if (digitsOnly === "") {
                                      setInstanceCount("");
                                      return;
                                    }
                                    updateInstanceCount(digitsOnly);
                                  }}
                                  onBlur={() => updateInstanceCount(instanceCount || "1")}
                                  inputMode="numeric"
                                  className="h-10 w-16 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-10 rounded-none px-3"
                                  onClick={() => updateInstanceCount(String(Number(instanceCount || "1") + 1))}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          ) : null}
                          {editingProductId ? (
                            <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={addToListPending}>
                              Cancel
                            </Button>
                          ) : null}
                          <Button onClick={handleAddToList} disabled={addToListPending || !selectedListId || !isSignedIn}>
                            {addToListPending ? (editingProductId ? "Saving..." : "Adding...") : editingProductId ? "Save Changes" : "Add to List"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <CardContent className="space-y-6 py-5 pb-44">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm text-zinc-600">Description (Optional)</p>
                          <Input value={selectedService} readOnly className="max-w-sm lg:max-w-none" />
                        </div>

                        <section className="space-y-3">
                          <p className="text-sm font-medium">Region</p>
                          <Select value={regionValue} onValueChange={(value) => setRegionValue(value as HuaweiRegionKey)}>
                            <SelectTrigger className="max-w-sm bg-white lg:max-w-none">
                              <SelectValue>{huaweiRegions[regionValue].full}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(huaweiRegions).map(([value, labels]) => (
                                <SelectItem key={value} value={value}>
                                  {labels.short}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </section>
                      </div>

                      {!isConfigurableEvsCalculator ? (
                        <section className={`grid gap-4 ${billingMode === "Pay-per-use" && !isObsCalculator && !isModelArtsCalculator && !(isEipCalculator && showEipEnhanced95DurationMonths) ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Billing Mode</p>
                            <OptionGrid
                              items={calculatorBillingOptions}
                              value={billingMode}
                              onChange={(value) => {
                                setBillingMode(value);
                                setFlavorPage(1);
                              }}
                            />
                          </div>
                          {billingMode === "Pay-per-use" && !isObsCalculator && !isModelArtsCalculator && !(isEipCalculator && showEipEnhanced95DurationMonths) ? (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Usage Hours</p>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-11 rounded-none px-3"
                                    onClick={() => updateUsageHours(String(Number(usageHours || "744") - 24))}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    value={usageHours}
                                    onChange={(event) => {
                                      const digitsOnly = event.target.value.replace(/\D/g, "");
                                      if (digitsOnly === "") {
                                        setUsageHours("");
                                        return;
                                      }
                                      updateUsageHours(digitsOnly);
                                    }}
                                    onBlur={() => updateUsageHours(usageHours || "744")}
                                    inputMode="numeric"
                                    className="h-11 w-24 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-11 rounded-none px-3"
                                    onClick={() => updateUsageHours(String(Number(usageHours || "744") + 24))}
                                  >
                                    +
                                  </Button>
                                </div>
                                <span className="text-sm font-medium text-zinc-500">hours</span>
                              </div>
                            </div>
                          ) : null}
                        </section>
                      ) : null}
                      {isEcsCalculator ? (
                        <EcsCalculatorPanel
                          minVcpuValue={minVcpuValue}
                          onMinVcpuChange={setMinVcpuValue}
                          minRamValue={minRamValue}
                          onMinRamChange={setMinRamValue}
                          flavorQuery={flavorQuery}
                          onFlavorQueryChange={(value) => {
                            setFlavorQuery(value);
                            setFlavorPage(1);
                          }}
                          flavorSort={flavorSort}
                          flavorSortOptions={flavorSortOptions}
                          onFlavorSortChange={(value) => {
                            if (!value) {
                              return;
                            }
                            setFlavorSort(value);
                            setFlavorPage(1);
                          }}
                          flavorPageSize={flavorPageSize}
                          flavorPageSizeOptions={flavorPageSizeOptions}
                          onFlavorPageSizeChange={(value) => {
                            if (!flavorPageSizeOptions.some((option) => option === value)) {
                              return;
                            }
                            setFlavorPageSize(value as (typeof flavorPageSizeOptions)[number]);
                            setFlavorPage(1);
                            window.localStorage.setItem(flavorPageSizeStorageKey, String(value));
                          }}
                          catalogFlavorsError={catalogFlavorsError}
                          catalogFlavorsLastCompletedAt={catalogFlavorsLastCompletedAt}
                          catalogFlavorsLoading={catalogFlavorsLoading}
                          visibleFlavors={visibleFlavors}
                          selectedFlavor={selectedFlavor}
                          onSelectFlavor={(name, vcpu, ram) => {
                            setSelectedFlavor(name);
                            setVcpuValue(vcpu);
                            setRamValue(ram);
                          }}
                          currentFlavorPage={currentFlavorPage}
                          totalFlavorPages={totalFlavorPages}
                          onPreviousFlavorPage={() => setFlavorPage((page) => Math.max(1, page - 1))}
                          onNextFlavorPage={() => setFlavorPage((page) => Math.min(totalFlavorPages, page + 1))}
                          showFlexusLToggleVisible={canShowFlexusLInEcs}
                          showFlexusLChecked={showFlexusLInEcs}
                          onShowFlexusLChange={setShowFlexusLInEcs}
                          diskConfigProps={calculatorDiskConfigProps}
                        />
                      ) : isFlexusLCalculator ? (
                        <FlexusLCalculatorPanel
                          plans={flexusLPlans.map((plan) => ({
                            id: plan.id,
                            title: plan.title,
                            vcpu: plan.vcpu,
                            ramGiB: plan.ramGiB,
                            systemDiskGiB: plan.systemDiskGiB,
                            peakBandwidthMbit: plan.peakBandwidthMbit,
                            dataPackageTiB: plan.dataPackageTiB,
                            monthlyPrice: formatFlavorAmount("USD", plan.monthlyPriceUsd, "/mo"),
                          }))}
                          selectedPlanId={selectedFlexusLPlan?.id ?? ""}
                          onSelectPlan={(planId) => {
                            const plan = findFlexusLPlan(planId);
                            if (!plan) {
                              return;
                            }
                            setSelectedFlavor(plan.id);
                            setVcpuValue(String(plan.vcpu));
                            setRamValue(String(plan.ramGiB));
                          }}
                          selectionSummary={calculatorSelectionSummary}
                          selectionNotes={calculatorSelectionNotes}
                          referenceNote={`Reference pricing uses Huawei Cloud's public Flexus L monthly catalog for ${flexusLPricingReference.region}.`}
                        />
                      ) : isObsCalculator ? (
                        isConfigurableObsCalculator && selectedServiceDefinition ? (
                          <ConfigurableServicePanel
                            definition={selectedServiceDefinition}
                            fields={obsConfiguredFields}
                            pricingError={obsPricingError}
                            pricingLoadingMessage={obsPricingLoading ? "Loading OBS pricing..." : null}
                            notes={selectedServiceDefinition.summary?.notes ?? []}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud OBS calculator API for ${obsCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Deep Archive storage falls back to Huawei's public pricing page because that storage event is omitted from the productInfo response. Sources: ${obsPricingReference.productUrl}, ${obsPricingReference.billingUrl}, and ${obsPricingReference.packageOverviewUrl}`}
                          />
                        ) : (
                          <ObsCalculatorPanel
                            productType={obsProductType}
                            productTypeOptions={obsProductTypeOptions}
                            onProductTypeChange={(value) => {
                              if (isObsProductType(value)) {
                                setObsProductType(value);
                              }
                            }}
                            storageClass={obsStorageClass}
                            storageClassOptions={obsStorageClassOptions}
                            onStorageClassChange={(value) => {
                              if (isObsStorageClass(value)) {
                                setObsStorageClass(value);
                              }
                            }}
                            redundancy={obsRedundancy}
                            redundancyOptions={obsRedundancyOptions}
                            showRedundancySelector={showObsRedundancySelector}
                            onRedundancyChange={(value) => {
                              if (isObsRedundancy(value)) {
                                setObsRedundancy(value);
                              }
                            }}
                            storageAmount={obsStorageSize}
                            storageUnit={obsStorageUnit}
                            storageUnitOptions={obsCapacityUnits}
                            onStorageAmountChange={(value) => {
                              if (value === "") {
                                setObsStorageSize("");
                                return;
                              }
                              updateObsStorageSize(value);
                            }}
                            onStorageAmountBlur={() => updateObsStorageSize(obsStorageSize || String(obsStorageSizeBounds.min))}
                            onStorageAmountStep={(delta) => updateObsStorageSize(String(Number(obsStorageSize || String(obsStorageSizeBounds.min)) + delta))}
                            onStorageUnitChange={(value) => {
                              if (isObsCapacityUnit(value)) {
                                setObsStorageUnit(value);
                              }
                            }}
                            durationMonths={obsDurationMonths}
                            onDurationMonthsChange={(value) => setObsDurationMonths(value.replace(/[^\d]/g, ""))}
                            onDurationMonthsBlur={() => setObsDurationMonths(String(obsDurationMonthsValue))}
                            outboundTrafficAmount={obsOutboundTraffic}
                            outboundTrafficUnit={obsOutboundTrafficUnit}
                            onOutboundTrafficAmountChange={setObsOutboundTraffic}
                            onOutboundTrafficUnitChange={(value) => {
                              if (isObsCapacityUnit(value)) {
                                setObsOutboundTrafficUnit(value);
                              }
                            }}
                            readRequests={obsReadRequests}
                            onReadRequestsChange={setObsReadRequests}
                            writeRequests={obsWriteRequests}
                            onWriteRequestsChange={setObsWriteRequests}
                            deleteRequests={obsDeleteRequests}
                            onDeleteRequestsChange={setObsDeleteRequests}
                            showPullTraffic={showObsPullTraffic}
                            pullTrafficAmount={obsPullTraffic}
                            pullTrafficUnit={obsPullTrafficUnit}
                            onPullTrafficAmountChange={setObsPullTraffic}
                            onPullTrafficUnitChange={(value) => {
                              if (isObsCapacityUnit(value)) {
                                setObsPullTrafficUnit(value);
                              }
                            }}
                            restorationType={obsRestorationType}
                            restorationTypeOptions={obsRestorationTypeOptions}
                            onRestorationTypeChange={(value) => {
                              if (isObsRestorationType(value)) {
                                setObsRestorationType(value);
                              }
                            }}
                            readTrafficAmount={obsReadTraffic}
                            readTrafficUnit={obsReadTrafficUnit}
                            onReadTrafficAmountChange={setObsReadTraffic}
                            onReadTrafficUnitChange={(value) => {
                              if (isObsCapacityUnit(value)) {
                                setObsReadTrafficUnit(value);
                              }
                            }}
                            showReplicationTraffic={showObsReplicationTraffic}
                            replicationTrafficAmount={obsReplicationTraffic}
                            replicationTrafficUnit={obsReplicationTrafficUnit}
                            onReplicationTrafficAmountChange={setObsReplicationTraffic}
                            onReplicationTrafficUnitChange={(value) => {
                              if (isObsCapacityUnit(value)) {
                                setObsReplicationTrafficUnit(value);
                              }
                            }}
                            lifecycleTransitionRequests={obsLifecycleTransitionRequests}
                            onLifecycleTransitionRequestsChange={setObsLifecycleTransitionRequests}
                            pricingError={obsPricingError}
                            pricingLoadingMessage={obsPricingLoading ? "Loading OBS pricing..." : null}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud OBS calculator API for ${obsCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Deep Archive storage falls back to Huawei's public pricing page because that storage event is omitted from the productInfo response. Sources: ${obsPricingReference.productUrl}, ${obsPricingReference.billingUrl}, and ${obsPricingReference.packageOverviewUrl}`}
                          />
                        )
                      ) : isEvsCalculator ? (
                        isConfigurableEvsCalculator && selectedServiceDefinition ? (
                          <ConfigurableServicePanel
                            definition={selectedServiceDefinition}
                            fields={evsConfiguredFields}
                            pricingError={evsPricingError}
                            pricingLoadingMessage={evsPricingLoading ? "Loading EVS pricing..." : null}
                            notes={[...calculatorDiskNotes, ...(selectedServiceDefinition.summary?.notes ?? [])]}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                          />
                        ) : (
                          <EvsCalculatorPanel diskConfigProps={calculatorDiskConfigProps} />
                        )
                      ) : isEipCalculator ? (
                        isConfigurableEipCalculator && selectedServiceDefinition ? (
                          <ConfigurableServicePanel
                            definition={selectedServiceDefinition}
                            fields={eipConfiguredFields}
                            pricingError={eipPricingError || undefined}
                            pricingLoadingMessage={eipPricingLoading ? "Loading EIP pricing..." : null}
                            notes={selectedServiceDefinition.summary?.notes ?? []}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud EIP calculator API for ${eipCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${eipPricingReference.pricingUrl}`}
                          />
                        ) : (
                          <EipCalculatorPanel
                            type={eipType}
                            typeOptions={eipTypeOptions}
                            onTypeChange={(value) => setEipType(value as EipType)}
                            chargeMode={eipChargeMode}
                            chargeModeOptions={eipChargeModeOptions}
                            onChargeModeChange={(value) => setEipChargeMode(value as EipChargeMode)}
                            bandwidthMbit={eipBandwidthMbit}
                            onBandwidthMbitChange={setEipBandwidthMbit}
                            showBandwidth={showEipBandwidth}
                            bandwidthLabel={eipChargeMode === "Enhanced 95" ? "Bandwidth" : "Bandwidth size"}
                            bandwidthMinimumMbit={showEipBandwidth ? eipBandwidthMinimumMbit : null}
                            bandwidthMinimumLabel={showEipBandwidth ? `Minimum ${eipBandwidthMinimumMbit} Mbit/s` : null}
                            enhanced95DurationMonths={eipEnhanced95DurationMonths}
                            onEnhanced95DurationMonthsChange={setEipEnhanced95DurationMonths}
                            showEnhanced95DurationMonths={showEipEnhanced95DurationMonths}
                            sharedBandwidthQuantity={eipSharedBandwidthQuantity}
                            onSharedBandwidthQuantityChange={setEipSharedBandwidthQuantity}
                            showSharedBandwidthQuantity={showEipSharedBandwidthQuantity}
                            trafficAmount={eipTrafficAmount}
                            trafficUnit={eipTrafficUnit}
                            trafficUnitOptions={eipTrafficUnitOptions}
                            onTrafficAmountChange={setEipTrafficAmount}
                            onTrafficUnitChange={(value) => setEipTrafficUnit(value as EipTrafficUnit)}
                            showTraffic={showEipTraffic}
                            pricingError={eipPricingError || undefined}
                            pricingLoadingMessage={eipPricingLoading ? "Loading EIP pricing..." : null}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud EIP calculator API for ${eipCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${eipPricingReference.pricingUrl}`}
                          />
                        )
                      ) : isElbCalculator ? (
                        <ElbCalculatorPanel
                          type={elbType}
                          typeOptions={["Shared load balancer", "Dedicated load balancer"]}
                          onTypeChange={(value) => setElbType(value as ElbType)}
                          networkType={elbNetworkType}
                          networkTypeOptions={["Public network", "Private network"]}
                          onNetworkTypeChange={(value) => setElbNetworkType(value as ElbNetworkType)}
                          sharedChargeMode={elbSharedChargeMode}
                          sharedChargeModeOptions={["By bandwidth", "By traffic"]}
                          onSharedChargeModeChange={(value) => setElbSharedChargeMode(value as ElbInternetChargeMode)}
                          showSharedChargeMode={showElbSharedChargeMode}
                          sharedBandwidthMbit={elbSharedBandwidthMbit}
                          onSharedBandwidthMbitChange={setElbSharedBandwidthMbit}
                          showSharedBandwidth={showElbSharedBandwidth}
                          sharedTrafficAmount={elbSharedTrafficAmount}
                          sharedTrafficUnit={elbSharedTrafficUnit}
                          sharedTrafficUnitOptions={elbTrafficUnitOptions}
                          onSharedTrafficAmountChange={setElbSharedTrafficAmount}
                          onSharedTrafficUnitChange={(value) => setElbSharedTrafficUnit(value as ElbTrafficUnit)}
                          showSharedTraffic={showElbSharedTraffic}
                          requiredDurationHours={usageHours}
                          onRequiredDurationHoursChange={setUsageHours}
                          showRequiredDuration={elbType === "Shared load balancer"}
                          specificationType={elbSpecificationType}
                          specificationTypeOptions={["Fixed", "Elastic"]}
                          onSpecificationTypeChange={(value) => setElbSpecificationType(value as ElbSpecificationType)}
                          fixedAvailabilityAzCount={String(elbFixedAvailabilityAzCount)}
                          fixedAvailabilityAzCountOptions={elbFixedAvailabilityAzCountOptions}
                          onFixedAvailabilityAzCountChange={(value) => setElbFixedAvailabilityAzCount(Math.max(1, Number(value) || 1))}
                          fixedTypeSections={elbFixedTypeSections}
                          protocolSections={elbProtocolSections}
                          metricModeOptions={["By traffic", "By bandwidth"]}
                          estimatedNetworkLcus={selectedElbPricing?.estimatedLcus.network ?? 0}
                          estimatedApplicationLcus={selectedElbPricing?.estimatedLcus.application ?? 0}
                          estimatedTotalLcus={selectedElbPricing?.estimatedLcus.total ?? 0}
                          selectedNetworkSpecLcus={selectedElbPricing?.selectedSpecLcus.network ?? 0}
                          selectedApplicationSpecLcus={selectedElbPricing?.selectedSpecLcus.application ?? 0}
                          pricingError={elbPricingError || undefined}
                          pricingLoadingMessage={elbPricingLoading ? "Loading ELB pricing..." : null}
                          selectionSummary={calculatorSelectionSummary}
                          selectionNotes={calculatorSelectionNotes}
                          referenceNote={`Pricing sourced from Huawei Cloud ELB calculator API for ${elbCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${elbPricingReference.pricingUrl}, ${elbPricingReference.fixedDrawerNetworkUrl}, and ${elbPricingReference.fixedDrawerAppUrl}`}
                        />
                      ) : isNatCalculator ? (
                        isConfigurableNatCalculator && selectedServiceDefinition ? (
                          <ConfigurableServicePanel
                            definition={selectedServiceDefinition}
                            fields={natConfiguredFields}
                            pricingError={natPricingError || undefined}
                            pricingLoadingMessage={natPricingLoading ? "Loading NAT pricing..." : null}
                            notes={selectedServiceDefinition.summary?.notes ?? []}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud NAT calculator API for ${natCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${natPricingReference.pricingUrl} and ${natPricingReference.specsUrl}`}
                          />
                        ) : (
                          <NatCalculatorPanel
                            natType={natType}
                            natTypeOptions={natTypeOptions}
                            onNatTypeChange={(value) => setNatType(value as NatGatewayType)}
                            natSize={natSize}
                            natSizeOptions={natSizeOptions}
                            onNatSizeChange={(value) => setNatSize(value as NatGatewaySize)}
                            pricingError={natPricingError || undefined}
                            pricingLoadingMessage={natPricingLoading ? "Loading NAT pricing..." : null}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud NAT calculator API for ${natCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${natPricingReference.pricingUrl} and ${natPricingReference.specsUrl}`}
                          />
                        )
                      ) : isVpnCalculator ? (
                        isConfigurableVpnCalculator && selectedServiceDefinition ? (
                          <ConfigurableServicePanel
                            definition={selectedServiceDefinition}
                            fields={vpnConfiguredFields}
                            pricingError={vpnPricingError || undefined}
                            pricingLoadingMessage={vpnPricingLoading ? "Loading VPN pricing..." : null}
                            notes={[vpnDescriptionNote, ...(selectedServiceDefinition.summary?.notes ?? [])]}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud VPN calculator API for ${vpnCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${vpnPricingReference.pricingUrl}, ${vpnPricingReference.productUrl}, and ${vpnPricingReference.specsUrl}`}
                          />
                        ) : (
                          <VpnCalculatorPanel
                            edition={vpnEdition}
                            editionOptions={vpnEditionOptionsToShow}
                            onEditionChange={(value) => setVpnEdition(value as VpnEdition)}
                            showEnterpriseFields={vpnEdition === "Enterprise"}
                            mode={vpnMode}
                            modeOptions={vpnModeOptions}
                            onModeChange={(value) => setVpnMode(value as VpnMode)}
                            networkType={vpnNetworkType}
                            networkTypeOptions={vpnNetworkTypeOptions}
                            onNetworkTypeChange={(value) => setVpnNetworkType(value as VpnNetworkType)}
                            specification={vpnSelectedSpecification}
                            specificationOptions={vpnSpecificationOptions}
                            showEipGroup={showVpnPublicBandwidth}
                            useSharedBandwidth={vpnUseSharedBandwidth}
                            onUseSharedBandwidthChange={setVpnUseSharedBandwidth}
                            eipBandwidthMbit1={vpnEipBandwidthMbit1}
                            onEipBandwidthMbit1Change={setVpnEipBandwidthMbit1}
                            eipBandwidthMbit2={vpnEipBandwidthMbit2}
                            onEipBandwidthMbit2Change={setVpnEipBandwidthMbit2}
                            durationMonths={vpnDurationMonths}
                            durationMonthOptions={vpnDurationOptions}
                            onDurationMonthsChange={setVpnDurationMonths}
                            showDurationMonths={billingMode === "Yearly/Monthly"}
                            pricingError={vpnPricingError || undefined}
                            pricingLoadingMessage={vpnPricingLoading ? "Loading VPN pricing..." : null}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud VPN calculator API for ${vpnCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${vpnPricingReference.pricingUrl}, ${vpnPricingReference.productUrl}, and ${vpnPricingReference.specsUrl}`}
                            descriptionNote={vpnDescriptionNote}
                          />
                        )
                      ) : isModelArtsCalculator ? (
                        isConfigurableModelArtsCalculator && selectedServiceDefinition ? (
                          <ConfigurableServicePanel
                            definition={selectedServiceDefinition}
                            fields={modelArtsConfiguredFields}
                            pricingError={modelArtsPricingError || undefined}
                            pricingLoadingMessage={modelArtsPricingLoading ? "Loading ModelArts pricing..." : null}
                            notes={selectedServiceDefinition.summary?.notes ?? []}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud ModelArts calculator API for ${modelArtsCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${modelArtsPricingReference.pricingUrl} and ${modelArtsPricingReference.productUrl}`}
                          />
                        ) : null
                      ) : isCceCalculator ? (
                        isConfigurableCceCalculator && selectedServiceDefinition ? (
                          <ConfigurableServicePanel
                            definition={selectedServiceDefinition}
                            fields={cceConfiguredFields}
                            pricingError={ccePricingError || undefined}
                            pricingLoadingMessage={ccePricingLoading ? "Loading CCE pricing..." : null}
                            notes={selectedServiceDefinition.summary?.notes ?? []}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud CCE calculator API for ${cceCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${ccePricingReference.pricingUrl}`}
                          />
                        ) : (
                          <CceCalculatorPanel
                            clusterScale={cceClusterScale}
                            clusterScaleOptions={cceClusterScaleOptions}
                            onClusterScaleChange={(value) => setCceClusterScale(value as CceClusterScale)}
                            masterNodes={cceMasterNodes}
                            masterNodesOptions={cceMasterNodesOptions}
                            onMasterNodesChange={(value) => setCceMasterNodes(value as CceMasterNodes)}
                            pricingError={ccePricingError || undefined}
                            pricingLoadingMessage={ccePricingLoading ? "Loading CCE pricing..." : null}
                            selectionSummary={calculatorSelectionSummary}
                            selectionNotes={calculatorSelectionNotes}
                            referenceNote={`Pricing sourced from Huawei Cloud CCE calculator API for ${cceCatalogRegionId ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${ccePricingReference.pricingUrl}`}
                          />
                        )
                      ) : isCciCalculator ? (
                        isConfigurableCciCalculator && selectedServiceDefinition ? (
                          <ConfigurableServicePanel
                            definition={selectedServiceDefinition}
                            fields={cciConfiguredFields}
                            pricingError={undefined}
                            pricingLoadingMessage={null}
                            notes={selectedServiceDefinition.summary?.notes ?? []}
                            selectionSummary={`${cciCpu} vCPU, ${cciMemory} GiB RAM`}
                            selectionNotes={[]}
                            referenceNote="Reference pricing based on Huawei Cloud CCI calculator."
                          />
                        ) : (
                          <CciCalculatorPanel
                            cpu={cciCpu}
                            onCpuChange={setCciCpu}
                            onCpuBlur={() => setCciCpu(String(Math.max(1, Number(cciCpu) || 1)))}
                            onCpuStep={(delta) => setCciCpu(String(Math.max(1, Number(cciCpu) + delta)))}
                            memory={cciMemory}
                            onMemoryChange={setCciMemory}
                            onMemoryBlur={() => setCciMemory(String(Math.max(1, Number(cciMemory) || 1)))}
                            onMemoryStep={(delta) => setCciMemory(String(Math.max(1, Number(cciMemory) + delta)))}
                            pricingError={undefined}
                            pricingLoadingMessage={null}
                            selectionSummary={`${cciCpu} vCPU, ${cciMemory} GiB RAM`}
                            selectionNotes={[]}
                            referenceNote="Reference pricing based on Huawei Cloud CCI calculator."
                          />
                        )
                      ) : null}
                    </CardContent>
                  </>
                ) : (
                  <UnsupportedServicePanel
                    title={`Calculator not implemented yet for ${selectedService}`}
                    description={`This dashboard calculator currently supports ${supportedCalculatorServiceCodes.join(", ")} only. Select Elastic Cloud Server, Flexus L Instance, Elastic Volume Service, Object Storage Service, Elastic IP, NAT Gateway, Virtual Private Network, Elastic Load Balance, Cloud Container Engine, or Cloud Container Instance to use the pricing form and save items.`}
                  />
                )}
              </TabsContent>

              <TabsContent value="batch-add">
                {isSelectedServiceBatchAddImplemented ? (
                  <ServiceBatchAddPanel
                    mode={isEcsCalculator ? "ecs" : isFlexusLCalculator ? "flexus-l" : isObsCalculator ? "obs" : isEvsCalculator ? "evs" : "ecs"}
                    regionValue={regionValue}
                    regionOptions={calculatorRegionOptions}
                    onRegionChange={(value) => setRegionValue(value as HuaweiRegionKey)}
                    batchInput={batchInput}
                    onBatchInputChange={setBatchInput}
                    batchAddMessage={batchAddMessage}
                    systemDiskType={systemDiskType}
                    systemDiskSizeValue={systemDiskSizeValue}
                    evsSingleDiskMaxGiB={evsSingleDiskMaxGiB}
                    obsProductType={obsProductType}
                    obsStorageClass={obsStorageClass}
                    obsRedundancy={obsRedundancy}
                    obsStorageSizeValue={obsStorageSizeValue}
                    obsStorageUnit={obsStorageUnit}
                    obsDurationMonthsValue={obsDurationMonthsValue}
                    showFlexusLToggleVisible={canShowFlexusLInEcs}
                    showFlexusLChecked={showFlexusLInEcs}
                    onShowFlexusLChange={setShowFlexusLInEcs}
                    onSubmit={handleBatchAdd}
                    submitDisabled={batchAddPending || !selectedListId || !isSignedIn}
                    submitLabel={batchAddPending ? "Adding Batch..." : "Add Batch"}
                  />
                ) : (
                  <UnsupportedServicePanel
                    title={`Batch add not implemented yet for ${selectedService}`}
                    description={`Batch input currently supports ${supportedBatchAddServiceCodes.join(", ")} only. Select Elastic Cloud Server, Flexus L Instance, Elastic Volume Service, or Object Storage Service to use it.`}
                  />
                )}
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
            <CardHeader className="pb-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <CardTitle>Cart Contents</CardTitle>
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {selectedList && selectedProject ? `${selectedProject.name} / ${selectedList.name}` : "Select a list to see its saved products."}
                  </p>
                  {selectedList?.huaweiCartKey ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      Linked to Huawei cart {selectedList.huaweiCartName || selectedList.huaweiCartKey}
                    </p>
                  ) : null}
                  {selectedList?.huaweiLastSyncedAt ? (
                    <p className="mt-1 text-xs text-zinc-400">Last Huawei sync: {formatDateTime(selectedList.huaweiLastSyncedAt)}</p>
                  ) : null}
                  {selectedList?.huaweiLastError ? <p className="mt-1 text-xs text-red-600">{selectedList.huaweiLastError}</p> : null}
                  {selectedList && (huaweiActionMessage || cloneActionMessage || listShareMessages[selectedList.id]) ? (
                    <div className="mt-2 space-y-1 text-xs">
                      {huaweiActionMessage ? <p className="text-zinc-500">{huaweiActionMessage}</p> : null}
                      {cloneActionMessage ? (
                        <p className={cloneActionIsError ? "text-red-600" : "text-zinc-500"}>{cloneActionMessage}</p>
                      ) : null}
                      {listShareMessages[selectedList.id] ? <p className="text-zinc-500">{listShareMessages[selectedList.id]}</p> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Badge variant="outline">{selectedCartProducts.length} items</Badge>
                  {selectedList?.huaweiCartKey ? <Badge variant="secondary">Huawei linked</Badge> : null}
                  {selectedList?.canShare ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openActionModal({ kind: "list-share", listId: selectedList.id })}
                      aria-label={`Share ${selectedList.name}`}
                    >
                      <Share2 className="size-4" />
                    </Button>
                  ) : null}
                  {selectedList ? (
                    <ActionMenu
                      open={isCartMenuOpen}
                      onOpenChange={setIsCartMenuOpen}
                      label={`Open actions for ${selectedList.name}`}
                      items={selectedCartMenuItems}
                    />
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[620px] px-4 xl:h-[calc(100vh-15rem)]">
                <div className="space-y-3 py-3">
                  {!selectedList ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      Create a list and select it to use it as the active cart.
                    </div>
                  ) : null}

                  {selectedList && selectedCartProducts.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      This cart is empty.
                    </div>
                  ) : null}

                  {selectedCartProducts.map((product) => {
                    const serviceMeta = getServiceMeta(product.serviceCode, product.serviceName);
                    const priceSummary = splitProductPriceSummary(product);
                    const isEditingProduct = editingProductId === product.id;

                    return (
                      <div
                        key={product.id}
                        className={`rounded-lg border p-4 ${
                          isEditingProduct ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              {serviceMeta ? (
                                <Image
                                  src={serviceMeta.icon}
                                  alt=""
                                  width={28}
                                  height={28}
                                  className="mt-0.5 size-7 rounded-md object-contain"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-medium">{product.title}</p>
                                  {isEditingProduct ? <Badge>Editing</Badge> : null}
                                </div>
                                <p className="mt-1 text-sm text-zinc-500">{getProductConfigSummary(product)}</p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {product.serviceCode} · {product.productType.toUpperCase()} · Qty {product.quantity}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-lg font-semibold text-zinc-950">{priceSummary.amount}</p>
                            <p className="text-sm text-zinc-500">{priceSummary.timeframe ?? "Saved item"}</p>
                            <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
                              {isEditingProduct ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    disabled={addToListPending || deletingProductId === product.id}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAddToList}
                                    disabled={addToListPending || !selectedListId || !isSignedIn || deletingProductId === product.id}
                                  >
                                    {addToListPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEditProduct(product)}
                                  disabled={deletingProductId === product.id}
                                  aria-label={`Edit ${product.title}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteProduct(product)}
                                disabled={deletingProductId === product.id}
                                aria-label={deletingProductId === product.id ? `Deleting ${product.title}` : `Delete ${product.title}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </main>
        {resourceExportModal ? (
          <ActionModal
            title={resourceExportModal.title}
            description={resourceExportModal.description}
            onClose={() => setResourceExportModal(null)}
            panelClassName="max-w-4xl"
          >
            <textarea
              value={resourceExportModal.json}
              readOnly
              spellCheck={false}
              className="h-[26rem] w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-xs leading-6 text-zinc-800 outline-none"
              aria-label="Resource export JSON"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">
                {resourceExportActionMessage || `${formatNumber(resourceExportModal.json.split("\n").length)} lines ready to copy or download.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void handleCopyResourceExport()}>
                  <Copy className="size-4" />
                  Copy JSON
                </Button>
                <Button type="button" variant="outline" onClick={handleDownloadResourceExport}>
                  <Download className="size-4" />
                  Download JSON
                </Button>
              </div>
            </div>
          </ActionModal>
        ) : null}
        {activeModal && activeProject ? (
          <ActionModal
            title={
              activeModal.kind === "project-huawei"
                ? "Create Huawei Carts"
                : activeModal.kind === "project-clone"
                  ? "Clone Project"
                  : activeModal.kind === "project-share"
                    ? "Share Project"
                    : activeModal.kind === "list-link"
                      ? "Link Huawei Cart"
                      : activeModal.kind === "list-clone"
                        ? "Clone Cart"
                        : "Share Cart"
            }
            description={
              activeModal.kind === "project-huawei"
                ? "Create or update one Huawei cart for every NeoCalculator cart in this project."
                : activeModal.kind === "project-clone"
                  ? "Clone every cart in this project into a new project, with optional region and billing conversion."
                  : activeModal.kind === "project-share"
                    ? "Choose whether recipients should import a detached copy or join a collaborative project."
                    : activeModal.kind === "list-link"
                      ? "Link this cart to an existing Huawei calculator cart using the saved Huawei Cloud cookie."
                      : activeModal.kind === "list-clone"
                        ? "Clone this cart with optional region and billing conversion."
                        : "Create a detached copy link or a collaborative cart link for this cart only."
            }
            onClose={() => setActiveModal(null)}
          >
            {activeModal.kind === "project-huawei" ? (
              <>
                {activeProjectHuaweiMessage ? (
                  <p className={`text-sm ${activeProjectHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeProjectHuaweiMessage}
                  </p>
                ) : !cookieValue.trim() ? (
                  <p className="text-sm text-zinc-500">Save a Huawei Cloud cookie on the dashboard to enable project sync.</p>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Existing Huawei-linked carts are updated; unlinked carts will create new Huawei carts.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => void handleSyncProjectHuawei(activeProject)}
                    disabled={isActiveProjectSyncing || activeProject.lists.length === 0 || !cookieValue.trim()}
                  >
                    {isActiveProjectSyncing ? "Creating Huawei Carts..." : "Create Huawei Carts"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeModal.kind === "project-clone" ? (
              <>
                <Input
                  value={projectCloneNameDrafts[activeProject.id] ?? ""}
                  onChange={(event) =>
                    setProjectCloneNameDrafts((current) => ({
                      ...current,
                      [activeProject.id]: event.target.value,
                    }))}
                  placeholder={getProjectCloneDefaultName(
                    activeProject.name,
                    activeProjectCloneTargetRegion,
                    activeProjectCloneTargetBillingMode,
                  )}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={activeProjectCloneTargetRegion || "__keep"}
                    onValueChange={(value) =>
                      setProjectCloneTargetRegions((current) => ({
                        ...current,
                        [activeProject.id]: value && value !== "__keep" ? (value as HuaweiRegionKey) : "",
                      }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {activeProjectCloneTargetRegion
                          ? `Region: ${huaweiRegions[activeProjectCloneTargetRegion].short}`
                          : "Keep current region"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current region</SelectItem>
                      {cloneableRegions.map(([value, labels]) => (
                        <SelectItem key={value} value={value}>
                          {labels.short}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={activeProjectCloneTargetBillingMode || "__keep"}
                    onValueChange={(value) =>
                      setProjectCloneTargetBillingModes((current) => ({
                        ...current,
                        [activeProject.id]: value && value !== "__keep" ? (value as BillingOption) : "",
                      }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {activeProjectCloneTargetBillingMode
                          ? `Billing: ${activeProjectCloneTargetBillingMode}`
                          : "Keep current billing"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current billing</SelectItem>
                      {options.billing.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeProjectCloneMessage ? (
                  <p className={`text-sm ${activeProjectCloneMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeProjectCloneMessage}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">Huawei links are not copied to the cloned project.</p>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => void handleCloneProject(activeProject)} disabled={isActiveProjectCloning}>
                    {isActiveProjectCloning ? "Cloning Project..." : "Clone Project"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeModal.kind === "project-share" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("project", activeProject.id, "copy")}
                    disabled={sharingProjectKey === `project:${activeProject.id}:copy`}
                  >
                    {sharingProjectKey === `project:${activeProject.id}:copy` ? "Sharing..." : "Copy Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("project", activeProject.id, "collaborate")}
                    disabled={sharingProjectKey === `project:${activeProject.id}:collaborate`}
                  >
                    {sharingProjectKey === `project:${activeProject.id}:collaborate` ? "Sharing..." : "Collaborative Link"}
                  </Button>
                </div>
                {activeProjectShareMessage ? <p className="text-sm text-zinc-600">{activeProjectShareMessage}</p> : null}
              </>
            ) : null}

            {activeList && activeModal.kind === "list-link" ? (
              <>
                {activeList.huaweiCartKey ? (
                  <p className="text-sm text-zinc-600">Linked to {activeList.huaweiCartName || activeList.huaweiCartKey}</p>
                ) : null}
                {activeList.huaweiLastSyncedAt ? (
                  <p className="text-sm text-zinc-500">Last Huawei sync: {formatDateTime(activeList.huaweiLastSyncedAt)}</p>
                ) : null}
                {activeList.huaweiLastError ? <p className="text-sm text-red-600">{activeList.huaweiLastError}</p> : null}
                {activeListHuaweiMessage ? (
                  <p className="text-sm text-zinc-600">{activeListHuaweiMessage}</p>
                ) : !cookieValue.trim() ? (
                  <p className="text-sm text-zinc-500">Save a Huawei Cloud cookie on the dashboard to load linkable carts here.</p>
                ) : null}
                <Select
                  value={activeSelectedHuaweiCartKey || "__unlinked"}
                  onValueChange={(value) => setSelectedHuaweiCartKey(value && value !== "__unlinked" ? value : "")}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {activeSelectedHuaweiCartKey
                        ? `Huawei: ${activeSelectedHuaweiCart?.name ?? activeList.huaweiCartName ?? activeSelectedHuaweiCartKey}`
                        : "Choose Huawei cart to link"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unlinked">No Huawei link selected</SelectItem>
                    {activeList.huaweiCartKey && !huaweiCarts.some((cart) => cart.key === activeList.huaweiCartKey) ? (
                      <SelectItem value={activeList.huaweiCartKey}>
                        {activeList.huaweiCartName ?? activeList.huaweiCartKey}
                      </SelectItem>
                    ) : null}
                    {huaweiCarts.map((cart) => {
                      const linkedElsewhere = Boolean(cart.associatedListId && cart.associatedListId !== activeList.id);
                      return (
                        <SelectItem key={cart.key} value={cart.key} disabled={linkedElsewhere}>
                          {cart.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={handleLinkSelectedList}
                    disabled={!activeSelectedHuaweiCartKey || isActiveListLinking}
                  >
                    {isActiveListLinking ? "Linking..." : "Link Huawei Cart"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeList && activeModal.kind === "list-clone" ? (
              <>
                <Input
                  value={cloneNameDraft}
                  onChange={(event) => setCloneNameDraft(event.target.value)}
                  placeholder={getCartCloneDefaultName(activeList.name, cloneTargetRegion, cloneTargetBillingMode)}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={cloneTargetRegion || "__keep"}
                    onValueChange={(value) => setCloneTargetRegion(value && value !== "__keep" ? (value as HuaweiRegionKey) : "")}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {cloneTargetRegion ? `Region: ${huaweiRegions[cloneTargetRegion].short}` : "Keep current region"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current region</SelectItem>
                      {cloneableRegions.map(([value, labels]) => (
                        <SelectItem key={value} value={value}>
                          {labels.short}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={cloneTargetBillingMode || "__keep"}
                    onValueChange={(value) => setCloneTargetBillingMode(value && value !== "__keep" ? (value as BillingOption) : "")}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {cloneTargetBillingMode ? `Billing: ${cloneTargetBillingMode}` : "Keep current billing"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current billing</SelectItem>
                      {options.billing.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeListCloneMessage ? (
                  <p className={`text-sm ${activeListCloneMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeListCloneMessage}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">ECS items are reselected by the cheapest flavor that meets or exceeds the current vCPU and RAM.</p>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleCloneSelectedList} disabled={isActiveListCloning}>
                    {isActiveListCloning ? "Cloning..." : "Clone Cart"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeList && activeModal.kind === "list-share" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("list", activeList.id, "copy")}
                    disabled={sharingListKey === `list:${activeList.id}:copy`}
                  >
                    {sharingListKey === `list:${activeList.id}:copy` ? "Sharing..." : "Copy Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("list", activeList.id, "collaborate")}
                    disabled={sharingListKey === `list:${activeList.id}:collaborate`}
                  >
                    {sharingListKey === `list:${activeList.id}:collaborate` ? "Sharing..." : "Collaborative Link"}
                  </Button>
                </div>
                {activeListShareMessage ? <p className="text-sm text-zinc-600">{activeListShareMessage}</p> : null}
              </>
            ) : null}
          </ActionModal>
        ) : null}
      </div>
    </div>
  );
}
