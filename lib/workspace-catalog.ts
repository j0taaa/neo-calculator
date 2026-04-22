import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type WorkspaceCpuOption = "2 vCPUs" | "4 vCPUs" | "8 vCPUs";
export type WorkspaceMemoryOption = "4 GB" | "8 GB" | "16 GB" | "32 GB";
export type WorkspaceDiskType = "High I/O" | "Ultra-high I/O" | "General purpose SSD";

export type WorkspaceRateSet = PricingRateSet<"ONDEMAND">;

export interface WorkspaceDesktopTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  architecture: "x86 desktop";
  specification: "Ultimate";
  cpu: WorkspaceCpuOption;
  memory: WorkspaceMemoryOption;
  cpuCount: number;
  memoryGiB: number;
}

export interface WorkspaceDiskTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  diskType: WorkspaceDiskType;
}

export interface WorkspacePricingCatalog extends RegionalPricingCatalog {
  architecture: "x86 desktop";
  specification: "Ultimate";
  desktopTiers: WorkspaceDesktopTier[];
  diskTiers: WorkspaceDiskTier[];
}

export interface WorkspaceEstimateInput {
  architecture: "x86 desktop";
  specification: "Ultimate";
  cpu: WorkspaceCpuOption;
  memory: WorkspaceMemoryOption;
  cpuUsageHours: number;
  diskType: WorkspaceDiskType;
  diskSizeGb: number;
  diskUsageHours: number;
  quantity: number;
}

export interface WorkspaceEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface WorkspaceEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  desktopTier: WorkspaceDesktopTier;
  diskTier: WorkspaceDiskTier;
  desktopHourlyAmount: number;
  diskHourlyAmountPerGb: number;
  breakdown: WorkspaceEstimateBreakdownItem[];
  notes: string[];
}

export const workspaceDefaults = {
  architecture: "x86 desktop" as const,
  specification: "Basic" as const,
  cpu: "2 vCPUs" as WorkspaceCpuOption,
  memory: "4 GB" as WorkspaceMemoryOption,
  cpuUsageHours: 744,
  diskType: "High I/O" as WorkspaceDiskType,
  diskSizeGb: 80,
  diskUsageHours: 744,
  quantity: 1,
} as const;

export const workspacePricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/workspace",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/workspace.html",
} as const;

const cpuOrder: WorkspaceCpuOption[] = ["2 vCPUs", "4 vCPUs", "8 vCPUs"];
const memoryOrder: WorkspaceMemoryOption[] = ["4 GB", "8 GB", "16 GB", "32 GB"];
const diskTypeOrder: WorkspaceDiskType[] = ["High I/O", "Ultra-high I/O", "General purpose SSD"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function isWorkspaceCpuOption(value: unknown): value is WorkspaceCpuOption {
  return typeof value === "string" && cpuOrder.includes(value as WorkspaceCpuOption);
}

export function isWorkspaceMemoryOption(value: unknown): value is WorkspaceMemoryOption {
  return typeof value === "string" && memoryOrder.includes(value as WorkspaceMemoryOption);
}

export function isWorkspaceDiskType(value: unknown): value is WorkspaceDiskType {
  return typeof value === "string" && diskTypeOrder.includes(value as WorkspaceDiskType);
}

export function listWorkspaceCpuOptions(catalog: WorkspacePricingCatalog) {
  const values = new Set<WorkspaceCpuOption>();
  for (const tier of catalog.desktopTiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.cpu);
    }
  }

  return orderedSet(values, cpuOrder);
}

export function listWorkspaceMemoryOptions(catalog: WorkspacePricingCatalog, cpu: WorkspaceCpuOption) {
  const values = new Set<WorkspaceMemoryOption>();
  for (const tier of catalog.desktopTiers) {
    if (tier.cpu === cpu && tier.prices.ONDEMAND != null) {
      values.add(tier.memory);
    }
  }

  return orderedSet(values, memoryOrder);
}

export function listWorkspaceDiskTypes(catalog: WorkspacePricingCatalog) {
  const values = new Set<WorkspaceDiskType>();
  for (const tier of catalog.diskTiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.diskType);
    }
  }

  return orderedSet(values, diskTypeOrder);
}

export function findWorkspaceDesktopTier(catalog: WorkspacePricingCatalog, cpu: WorkspaceCpuOption, memory: WorkspaceMemoryOption) {
  return catalog.desktopTiers.find((tier) => tier.cpu === cpu && tier.memory === memory) ?? null;
}

export function findWorkspaceDiskTier(catalog: WorkspacePricingCatalog, diskType: WorkspaceDiskType) {
  return catalog.diskTiers.find((tier) => tier.diskType === diskType) ?? null;
}

export function estimateWorkspaceConfiguration(catalog: WorkspacePricingCatalog, input: WorkspaceEstimateInput): WorkspaceEstimate | null {
  if (input.architecture !== "x86 desktop" || input.specification !== "Ultimate") {
    return null;
  }

  const desktopTier = findWorkspaceDesktopTier(catalog, input.cpu, input.memory);
  const diskTier = findWorkspaceDiskTier(catalog, input.diskType);
  if (!desktopTier || !diskTier || desktopTier.prices.ONDEMAND == null || diskTier.prices.ONDEMAND == null) {
    return null;
  }

  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }
  if (!Number.isFinite(input.cpuUsageHours) || input.cpuUsageHours < 1) {
    return null;
  }
  if (!Number.isFinite(input.diskUsageHours) || input.diskUsageHours < 1) {
    return null;
  }
  if (!Number.isFinite(input.diskSizeGb) || input.diskSizeGb < 80) {
    return null;
  }

  const quantity = Math.floor(input.quantity);
  const cpuUsageHours = Math.floor(input.cpuUsageHours);
  const diskUsageHours = Math.floor(input.diskUsageHours);
  const diskSizeGb = Math.floor(input.diskSizeGb);
  const desktopAmount = desktopTier.prices.ONDEMAND * cpuUsageHours * quantity;
  const diskAmount = diskTier.prices.ONDEMAND * diskSizeGb * diskUsageHours * quantity;
  const amount = roundAmount(desktopAmount + diskAmount);
  const modeledHours = Math.max(cpuUsageHours, diskUsageHours);
  const monthlyAverageAmount = roundAmount(modeledHours > 0 ? amount / (modeledHours / (24 * 30)) : amount);

  return {
    currency: catalog.currency,
    amount,
    suffix: `/${modeledHours}h`,
    monthlyAverageAmount,
    quantity,
    desktopTier,
    diskTier,
    desktopHourlyAmount: desktopTier.prices.ONDEMAND,
    diskHourlyAmountPerGb: diskTier.prices.ONDEMAND,
    breakdown: [
      {
        label: `${quantity} x ${input.specification} ${input.cpu} ${input.memory} desktop for ${cpuUsageHours}h`,
        amount: roundAmount(desktopAmount),
      },
      {
        label: `${quantity} x ${input.diskType} system disk ${diskSizeGb} GB for ${diskUsageHours}h`,
        amount: roundAmount(diskAmount),
      },
    ],
    notes: [
      `Desktop rate: ${catalog.currency} ${desktopTier.prices.ONDEMAND.toFixed(5)}/desktop/h.`,
      `System disk rate: ${catalog.currency} ${diskTier.prices.ONDEMAND.toFixed(6)}/GB/h.`,
      "Additional EVS data disks are not included in this estimate.",
    ],
  };
}
