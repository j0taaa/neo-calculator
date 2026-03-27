import { findBestFlexusLPlan, findFlexusLPlan, flexusLPlans, flexusLPricingReference } from "@/lib/flexus-l-catalog";
import {
  formatFlavorAmount,
  getDiskPriceForBillingOption,
  toFlavorCard,
  toFlexusLFlavorCard,
  type BillingOption,
  type CatalogFlavor,
  type DiskPricing,
  type FlavorCard,
  type ProductMutationBody,
} from "@/lib/calculator-page-helpers";
import { type HuaweiRegionKey, huaweiRegions } from "@/lib/huawei-regions";
import {
  ecsDiskSizeBounds,
  getGpSsd2RequestedIops,
  getGpSsd2RequestedThroughput,
  parsePositiveNumber,
  type SystemDiskOption,
} from "@/lib/configurable-runtime-utils";
import {
  getBatchDescription,
  getBatchDiskSize,
  getBatchDiskType,
  hasExplicitBatchDiskConfig,
} from "@/lib/batch-input-utils";
import { buildFlavorAutoSelectKey } from "@/lib/use-custom-ecs-calculator";

type BatchEcsSelection = {
  flavor: CatalogFlavor;
  flavorCard: FlavorCard;
  diskPrice: NonNullable<ReturnType<typeof getDiskPriceForBillingOption<SystemDiskOption>>>;
};

type BatchFlexusLSelection = {
  plan: (typeof flexusLPlans)[number];
  flavorCard: FlavorCard;
};

export type CustomEditHydrationResult = {
  handled: boolean;
  error?: string;
  nextRegion?: HuaweiRegionKey;
  nextBillingMode?: BillingOption;
  nextUsageHours?: string;
  nextInstanceCount?: string;
  nextSelectedFlavor?: string;
  nextVcpuValue?: string;
  nextRamValue?: string;
  nextMinVcpuValue?: string;
  nextMinRamValue?: string;
  nextSystemDiskType?: SystemDiskOption;
  nextSystemDiskSize?: string;
  nextGpSsd2Iops?: string;
  nextGpSsd2Throughput?: string;
  nextFlavorAutoSelectKey?: string;
};

type BuildCustomProductRequestInput = {
  selectedServiceCode: string;
  selectedServiceMetaCode: string;
  selectedService: string;
  selectedEstimate: string;
  quantity: number;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHoursValue: number;
  selectedFlavor: string;
  selectedFlavorCard: FlavorCard | null;
  selectedFlexusLPlan: (typeof flexusLPlans)[number] | null;
  vcpuValue: string;
  ramValue: string;
  systemDiskType: SystemDiskOption;
  systemDiskSizeValue: number;
  isGpSsd2Selected: boolean;
  gpSsd2IopsValue: number | null;
  gpSsd2ThroughputValue: number | null;
  selectedDiskPrice: ReturnType<typeof getDiskPriceForBillingOption<SystemDiskOption>>;
};

type BuildCustomBatchRequestInput = {
  selectedServiceCode: string;
  selectedServiceMetaCode: string;
  selectedService: string;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHoursValue: number;
  catalogFlavors: CatalogFlavor[];
  diskPricing: DiskPricing<SystemDiskOption> | null;
  canShowFlexusLInEcs: boolean;
  showFlexusLInEcs: boolean;
  item: unknown;
};

function findBestBatchEcsSelection(
  flavors: CatalogFlavor[],
  diskPricing: DiskPricing<SystemDiskOption> | null,
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

export function hydrateCustomProduct(product: {
  productType: string;
  serviceName: string;
  quantity: number;
  id: string;
  config: unknown;
}, context: {
  regionValue: HuaweiRegionKey;
  flavorQuery: string;
  flavorSort: string;
  minVcpuValue: string;
  minRamValue: string;
  vcpuValue: string;
  ramValue: string;
}): CustomEditHydrationResult {
  if (product.productType === "ecs") {
    if (typeof product.config !== "object" || product.config == null || Array.isArray(product.config)) {
      return { handled: false, error: "This product cannot be edited from the calculator." };
    }

    const config = product.config as Record<string, unknown>;
    const systemDisk = typeof config.systemDisk === "object" && config.systemDisk != null && !Array.isArray(config.systemDisk)
      ? (config.systemDisk as Record<string, unknown>)
      : null;
    const nextRegion = typeof config.region === "string" && config.region in huaweiRegions
      ? (config.region as HuaweiRegionKey)
      : context.regionValue;
    const nextBillingMode = config.billingMode === "Yearly/Monthly" || config.billingMode === "RI"
      ? config.billingMode
      : "Pay-per-use";
    const nextMinVcpuValue = typeof config.vcpu === "number" ? String(config.vcpu) : context.minVcpuValue;
    const nextMinRamValue = typeof config.ramGiB === "number" ? String(config.ramGiB) : context.minRamValue;
    const nextSystemDiskType = typeof config.diskType === "string"
      && ["High I/O", "Ultra-high I/O", "Extreme SSD", "General Purpose SSD", "General Purpose SSD V2"].includes(config.diskType)
      ? (config.diskType as SystemDiskOption)
      : typeof systemDisk?.type === "string"
        && ["High I/O", "Ultra-high I/O", "Extreme SSD", "General Purpose SSD", "General Purpose SSD V2"].includes(systemDisk.type)
        ? (systemDisk.type as SystemDiskOption)
        : "High I/O";
    const nextSystemDiskSize =
      typeof systemDisk?.sizeGiB === "number" && Number.isFinite(systemDisk.sizeGiB)
        ? String(Math.max(ecsDiskSizeBounds.min, Math.floor(systemDisk.sizeGiB)))
        : String(ecsDiskSizeBounds.min);
    const nextUsageHours =
      typeof config.usageHours === "number" && Number.isFinite(config.usageHours)
        ? String(Math.max(1, Math.floor(config.usageHours)))
        : "744";

    return {
      handled: true,
      nextRegion,
      nextBillingMode,
      nextUsageHours,
      nextSelectedFlavor: typeof config.flavor === "string" ? config.flavor : "",
      nextVcpuValue: typeof config.vcpu === "number" ? String(config.vcpu) : context.vcpuValue,
      nextRamValue: typeof config.ramGiB === "number" ? String(config.ramGiB) : context.ramValue,
      nextMinVcpuValue,
      nextMinRamValue,
      nextSystemDiskType,
      nextSystemDiskSize,
      nextGpSsd2Iops: String(getGpSsd2RequestedIops(config, Number(nextSystemDiskSize))),
      nextGpSsd2Throughput: String(
        getGpSsd2RequestedThroughput(
          config,
          getGpSsd2RequestedIops(config, Number(nextSystemDiskSize)),
        ),
      ),
      nextInstanceCount: String(Math.max(1, product.quantity)),
      nextFlavorAutoSelectKey: buildFlavorAutoSelectKey({
        minVcpuValue: nextMinVcpuValue,
        minRamValue: nextMinRamValue,
        flavorQuery: context.flavorQuery,
        flavorSort: context.flavorSort,
        regionValue: nextRegion,
        billingMode: nextBillingMode,
        usageHoursValue: Number(nextUsageHours),
        systemDiskType: nextSystemDiskType,
        systemDiskSizeValue: Number(nextSystemDiskSize),
        includeFlexusL: false,
      }),
    };
  }

  if (product.productType === "flexus-l") {
    if (typeof product.config !== "object" || product.config == null || Array.isArray(product.config)) {
      return { handled: false, error: "This product cannot be edited from the calculator." };
    }

    const config = product.config as Record<string, unknown>;
    const nextRegion = typeof config.region === "string" && config.region in huaweiRegions
      ? (config.region as HuaweiRegionKey)
      : context.regionValue;
    const nextPlanId = typeof config.planId === "string"
      ? config.planId
      : typeof config.flavor === "string"
        ? config.flavor
        : flexusLPlans[0]?.id ?? "";
    const nextPlan = findFlexusLPlan(nextPlanId) ?? flexusLPlans[0] ?? null;

    return {
      handled: true,
      nextRegion,
      nextBillingMode: "Yearly/Monthly",
      nextSelectedFlavor: nextPlan?.id ?? "",
      nextVcpuValue: typeof config.vcpu === "number" ? String(config.vcpu) : nextPlan ? String(nextPlan.vcpu) : "",
      nextRamValue: typeof config.ramGiB === "number" ? String(config.ramGiB) : nextPlan ? String(nextPlan.ramGiB) : "",
    };
  }

  return { handled: false };
}

export function buildCustomProductRequestBody(input: BuildCustomProductRequestInput): ProductMutationBody | null {
  if (input.selectedServiceCode === "ECS") {
    if (!input.selectedFlavorCard) {
      return null;
    }

    if (input.selectedFlavorCard.productType === "flexus-l" && input.selectedFlavorCard.referencePlanId) {
      const selectedPlan = findFlexusLPlan(input.selectedFlavorCard.referencePlanId);
      if (!selectedPlan) {
        throw new Error("Select a Flexus L plan first.");
      }

      return {
        serviceCode: input.selectedFlavorCard.serviceCode,
        serviceName: input.selectedFlavorCard.serviceName,
        productType: "flexus-l",
        title: `${input.selectedFlavorCard.serviceName} ${selectedPlan.title}`,
        quantity: input.quantity,
        config: {
          region: input.regionValue,
          billingMode: input.billingMode,
          description: input.selectedFlavorCard.description ?? input.selectedService,
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
          total: input.selectedEstimate,
          flavor: input.selectedFlavorCard.flavorPrice ?? null,
        },
      };
    }

    return {
      serviceCode: input.selectedServiceMetaCode,
      serviceName: input.selectedService,
      productType: "ecs",
      title: `${input.selectedService} ${input.selectedFlavor}`,
      quantity: input.quantity,
      config: {
        region: input.regionValue,
        billingMode: input.billingMode,
        usageHours: input.billingMode === "Pay-per-use" ? input.usageHoursValue : null,
        description: input.selectedFlavorCard.description ?? input.selectedService,
        flavor: input.selectedFlavor,
        vcpu: Number(input.vcpuValue || "0"),
        ramGiB: Number(input.ramValue || "0"),
        systemDisk: {
          type: input.systemDiskType,
          sizeGiB: input.systemDiskSizeValue,
          ...(input.isGpSsd2Selected && input.gpSsd2IopsValue != null ? { iops: input.gpSsd2IopsValue } : {}),
          ...(input.isGpSsd2Selected && input.gpSsd2ThroughputValue != null ? { throughput: input.gpSsd2ThroughputValue } : {}),
        },
      },
      pricing: {
        total: input.selectedEstimate,
        flavor: input.selectedFlavorCard.flavorPrice ?? null,
        disk: input.selectedDiskPrice ? formatFlavorAmount(input.selectedDiskPrice.currency, input.selectedDiskPrice.amount, input.selectedDiskPrice.suffix) : null,
      },
    };
  }

  if (input.selectedServiceCode === "Flexus L" && input.selectedFlexusLPlan) {
    return {
      serviceCode: input.selectedServiceMetaCode,
      serviceName: input.selectedService,
      productType: "flexus-l",
      title: `${input.selectedService} ${input.selectedFlexusLPlan.title}`,
      quantity: input.quantity,
      config: {
        region: input.regionValue,
        billingMode: "Yearly/Monthly",
        description: input.selectedService,
        planId: input.selectedFlexusLPlan.id,
        planTitle: input.selectedFlexusLPlan.title,
        vcpu: input.selectedFlexusLPlan.vcpu,
        ramGiB: input.selectedFlexusLPlan.ramGiB,
        systemDiskGiB: input.selectedFlexusLPlan.systemDiskGiB,
        peakBandwidthMbit: input.selectedFlexusLPlan.peakBandwidthMbit,
        dataPackageTiB: input.selectedFlexusLPlan.dataPackageTiB,
        referenceRegion: flexusLPricingReference.region,
      },
      pricing: {
        total: input.selectedEstimate,
        flavor: formatFlavorAmount("USD", input.selectedFlexusLPlan.monthlyPriceUsd, "/mo"),
      },
    };
  }

  return null;
}

export function buildCustomBatchRequestBodies(input: BuildCustomBatchRequestInput): ProductMutationBody[] | null {
  const quantity = parseInt(String((input.item as Record<string, unknown>)?.quantity ?? 1), 10);
  const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const description = getBatchDescription(input.item, input.selectedService);

  if (input.selectedServiceCode === "ECS") {
    const requestedVcpu = parsePositiveNumber((input.item as Record<string, unknown>).vcpu);
    const requestedRamGiB = parsePositiveNumber((input.item as Record<string, unknown>).ram);
    if (requestedVcpu == null || requestedRamGiB == null) {
      throw new Error("Batch ECS item must include numeric vcpu and ram values.");
    }

    const diskType = getBatchDiskType(input.item, "High I/O");
    const diskSizeGiB = getBatchDiskSize(input.item, ecsDiskSizeBounds.min, ecsDiskSizeBounds);
    const diskIops = diskType === "General Purpose SSD V2"
      ? getGpSsd2RequestedIops(input.item, diskSizeGiB)
      : null;
    const diskThroughput = diskType === "General Purpose SSD V2" && diskIops != null
      ? getGpSsd2RequestedThroughput(input.item, diskIops)
      : null;
    const selection = findBestBatchEcsSelection(
      input.catalogFlavors,
      input.diskPricing,
      input.billingMode,
      input.usageHoursValue,
      requestedVcpu,
      requestedRamGiB,
      diskType,
      diskSizeGiB,
      description,
    );
    const flexusSelection =
      input.canShowFlexusLInEcs && input.showFlexusLInEcs && !hasExplicitBatchDiskConfig(input.item)
        ? findBestBatchFlexusLSelection(input.billingMode, input.usageHoursValue, requestedVcpu, requestedRamGiB)
        : null;
    const useFlexusSelection = flexusSelection != null
      && (selection == null || flexusSelection.flavorCard.priceValue < selection.flavorCard.priceValue);

    if (!selection && !flexusSelection) {
      throw new Error(
        `Could not find an ECS or Flexus L flavor with at least ${requestedVcpu} vCPUs and ${requestedRamGiB} GiB RAM.`,
      );
    }

    if (useFlexusSelection && flexusSelection) {
      return [{
        serviceCode: flexusSelection.flavorCard.serviceCode,
        serviceName: flexusSelection.flavorCard.serviceName,
        productType: "flexus-l",
        title: `${flexusSelection.flavorCard.serviceName} ${flexusSelection.plan.title}`,
        quantity: normalizedQuantity,
        config: {
          region: input.regionValue,
          billingMode: input.billingMode,
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
            flexusSelection.flavorCard.priceValue * normalizedQuantity,
            flexusSelection.flavorCard.priceSuffix,
          ),
          flavor: flexusSelection.flavorCard.flavorPrice,
        },
      }];
    }

    if (!selection) {
      throw new Error("Could not find an ECS flavor.");
    }

    return [{
      serviceCode: selection.flavorCard.serviceCode,
      serviceName: selection.flavorCard.serviceName,
      productType: "ecs",
      title: `${input.selectedService} ${selection.flavor.resourceSpecCode}`,
      quantity: normalizedQuantity,
      config: {
        region: input.regionValue,
        billingMode: input.billingMode,
        usageHours: input.billingMode === "Pay-per-use" ? input.usageHoursValue : null,
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
          selection.flavorCard.priceValue * normalizedQuantity,
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
  }

  if (input.selectedServiceCode === "Flexus L") {
    const requestedVcpu = parsePositiveNumber((input.item as Record<string, unknown>).vcpu);
    const requestedRamGiB = parsePositiveNumber((input.item as Record<string, unknown>).ram);
    if (requestedVcpu == null || requestedRamGiB == null) {
      throw new Error("Batch Flexus L item must include numeric vcpu and ram values.");
    }

    const plan = findBestFlexusLPlan(requestedVcpu, requestedRamGiB);
    if (!plan) {
      throw new Error(
        `Could not find a Flexus L plan with at least ${requestedVcpu} vCPUs and ${requestedRamGiB} GiB RAM.`,
      );
    }

    return [{
      serviceCode: input.selectedServiceMetaCode,
      serviceName: input.selectedService,
      productType: "flexus-l",
      title: `${input.selectedService} ${plan.title}`,
      quantity: normalizedQuantity,
      config: {
        region: input.regionValue,
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
        total: formatFlavorAmount("USD", plan.monthlyPriceUsd * normalizedQuantity, "/mo"),
        flavor: formatFlavorAmount("USD", plan.monthlyPriceUsd, "/mo"),
      },
    }];
  }

  return null;
}
