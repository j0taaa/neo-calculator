type FormatFlavorAmount = (currency: string, amount: number, suffix: string) => string;

type FlavorCardLike = {
  name: string;
  vcpu: string;
  ram: string;
  price: string;
  priceValue: number;
  priceCurrency: string;
  priceSuffix: string;
  flavorPrice: string | null;
  description: string | null;
  productType: "ecs" | "flexus-l";
  includedSystemDiskGiB?: number;
  peakBandwidthMbit?: number;
  dataPackageTiB?: number;
};

type FlexusLPlanLike = {
  title: string;
  systemDiskGiB: number;
  peakBandwidthMbit: number;
  dataPackageTiB: number;
  monthlyPriceUsd: number;
};

type SimplePriceLike = {
  currency: string;
  amount: number;
  suffix: string;
};

type BreakdownPriceLike = SimplePriceLike & {
  monthlyAverageAmount: number;
  notes: string[];
  breakdown: Array<{ label: string; amount: number }>;
};

type NatPricingLike = SimplePriceLike & {
  notes: string[];
  dailyAmount: number | null;
  hourlyAmount: number | null;
  monthlyAmount: number | null;
  yearlyAmount: number | null;
};

type ElbPricingLike = BreakdownPriceLike & {
  estimatedLcus: {
    network: number;
    application: number;
    total: number;
  };
  protocolBreakdowns: Array<{
    protocol: string;
    lcu: number;
    details: string[];
  }>;
};

type CcePricingLike = {
  currency: string;
  amount: number;
  suffix: string;
  hourlyAmount: number | null;
  monthlyAmount: number | null;
  yearlyAmount: number | null;
};

type EstimatePriceEntry = {
  unit: string;
  price: string;
};

type CalculatorEstimateInput = {
  serviceCode: string;
  instanceCountValue: number;
  selectedPrices: EstimatePriceEntry[];
  selectedFlavorCard: FlavorCardLike | null;
  selectedFlexusLPlan: FlexusLPlanLike | null;
  selectedDiskPrice: SimplePriceLike | null;
  selectedObsPricing: BreakdownPriceLike | null;
  selectedEipPricing: BreakdownPriceLike | null;
  selectedElbPricing: ElbPricingLike | null;
  selectedNatPricing: NatPricingLike | null;
  selectedVpnPricing: BreakdownPriceLike | null;
  selectedModelArtsPricing: BreakdownPriceLike | null;
  selectedCcePricing: CcePricingLike | null;
};

type CalculatorSelectionSummaryInput = {
  serviceCode: string;
  billingMode: string;
  selectedFlavor: string;
  selectedFlavorCard: FlavorCardLike | null;
  selectedFlexusLPlan: FlexusLPlanLike | null;
  vcpuValue: string;
  ramValue: string;
  systemDiskType: string;
  systemDiskSize: string;
  activeDiskSizeMin: number;
  isGpSsd2Selected: boolean;
  gpSsd2IopsValue: number | null;
  gpSsd2ThroughputValue: number | null;
  selectedDiskPrice: SimplePriceLike | null;
  selectedObsPricing: BreakdownPriceLike | null;
  obsProductType: string;
  obsStorageClass: string;
  obsRedundancy: string;
  obsRestorationType: string | null;
  obsStorageSizeValue: number;
  obsStorageUnit: string;
  obsReadTrafficValue: number;
  obsReadTrafficUnit: string;
  obsDurationMonthsValue: number;
  selectedEipPricing: BreakdownPriceLike | null;
  eipType: string;
  eipChargeMode: string;
  showEipBandwidth: boolean;
  eipBandwidthMbitValue: number;
  showEipEnhanced95DurationMonths: boolean;
  eipEnhanced95DurationMonthsValue: number;
  showEipSharedBandwidthQuantity: boolean;
  eipSharedBandwidthQuantityValue: number;
  showEipTraffic: boolean;
  eipTrafficAmountValue: number;
  eipTrafficUnit: string;
  selectedElbPricing: ElbPricingLike | null;
  elbType: string;
  elbSpecificationType: string;
  elbFixedAvailabilityAzCount: number;
  elbFixedSelectedTypes: string[];
  normalizedElbFixedTypeSpecs: Record<string, string>;
  elbSubAz: string;
  elbNetworkType: string;
  showElbSharedChargeMode: boolean;
  elbSharedChargeMode: string;
  showElbSharedBandwidth: boolean;
  elbSharedBandwidthMbitValue: number;
  showElbSharedTraffic: boolean;
  elbSharedTrafficAmountValue: number;
  elbSharedTrafficUnit: string;
  selectedNatPricing: NatPricingLike | null;
  natType: string;
  natSize: string;
  selectedVpnPricing: BreakdownPriceLike | null;
  vpnEdition: string;
  vpnMode: string;
  vpnNetworkType: string;
  vpnSelectedSpecification: string;
  showVpnPublicBandwidth: boolean;
  vpnUseSharedBandwidth: boolean;
  vpnEipBandwidthMbit1: string;
  vpnEipBandwidthMbit2: string;
  vpnDurationMonths: string;
  selectedModelArtsPricing: BreakdownPriceLike | null;
  modelArtsResourceType: string;
  modelArtsSpecification: string;
  modelArtsStorageQuotaValue: number;
  modelArtsQuantityValue: number;
  usageHoursValue: number;
  modelArtsDurationMonthsValue: number;
  selectedCcePricing: CcePricingLike | null;
  cceClusterScale: string;
  cceMasterNodes: string;
  evsDurationMonthsValue: number;
};

type CalculatorSelectionNotesInput = {
  serviceCode: string;
  selectedFlavorCard: FlavorCardLike | null;
  selectedDiskPrice: SimplePriceLike | null;
  selectedObsPricing: BreakdownPriceLike | null;
  obsRestorationType: string | null;
  selectedEipPricing: BreakdownPriceLike | null;
  selectedElbPricing: ElbPricingLike | null;
  elbType: string;
  elbSpecificationType: string;
  elbFixedSelectedTypes: string[];
  normalizedElbFixedTypeSpecs: Record<string, string>;
  elbFixedAvailabilityAzCount: number;
  selectedNatPricing: NatPricingLike | null;
  selectedVpnPricing: BreakdownPriceLike | null;
  selectedModelArtsPricing: BreakdownPriceLike | null;
  selectedCcePricing: CcePricingLike | null;
  isGpSsd2Selected: boolean;
  evsSplitNotice: string | null;
};

function scalePriceDisplay(summary: string, multiplier: number, formatFlavorAmount: FormatFlavorAmount) {
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

const quantityLabels: Record<string, string> = {
  ModelArts: "Configuration",
  EVS: "Volume",
  OBS: "Bucket",
  EIP: "EIP",
  NAT: "Gateway",
  VPN: "Gateway",
};

export function buildCalculatorEstimate(input: CalculatorEstimateInput, formatFlavorAmount: FormatFlavorAmount) {
  const base =
    (input.serviceCode === "Flexus L" && input.selectedFlexusLPlan
      ? formatFlavorAmount("USD", input.selectedFlexusLPlan.monthlyPriceUsd, "/mo")
      : input.serviceCode === "OBS" && input.selectedObsPricing
      ? formatFlavorAmount(input.selectedObsPricing.currency, input.selectedObsPricing.amount, input.selectedObsPricing.suffix)
      : input.serviceCode === "EIP" && input.selectedEipPricing
      ? formatFlavorAmount(input.selectedEipPricing.currency, input.selectedEipPricing.amount, input.selectedEipPricing.suffix)
      : input.serviceCode === "ELB" && input.selectedElbPricing
      ? formatFlavorAmount(input.selectedElbPricing.currency, input.selectedElbPricing.amount, input.selectedElbPricing.suffix)
      : input.serviceCode === "NAT" && input.selectedNatPricing
      ? formatFlavorAmount(input.selectedNatPricing.currency, input.selectedNatPricing.amount, input.selectedNatPricing.suffix)
      : input.serviceCode === "VPN" && input.selectedVpnPricing
      ? formatFlavorAmount(input.selectedVpnPricing.currency, input.selectedVpnPricing.amount, input.selectedVpnPricing.suffix)
      : input.serviceCode === "ModelArts" && input.selectedModelArtsPricing
      ? formatFlavorAmount(input.selectedModelArtsPricing.currency, input.selectedModelArtsPricing.amount, input.selectedModelArtsPricing.suffix)
      : input.serviceCode === "CCE" && input.selectedCcePricing
      ? formatFlavorAmount(input.selectedCcePricing.currency, input.selectedCcePricing.amount, input.selectedCcePricing.suffix)
      : input.serviceCode === "EVS" && input.selectedDiskPrice
      ? formatFlavorAmount(input.selectedDiskPrice.currency, input.selectedDiskPrice.amount, input.selectedDiskPrice.suffix)
      : input.selectedFlavorCard?.price)
    ?? input.selectedPrices.find((entry) => entry.unit === "per month")?.price
    ?? input.selectedPrices[0]?.price
    ?? "USD 0.00";

  const estimate =
    input.serviceCode === "EVS" && input.selectedDiskPrice
      ? formatFlavorAmount(input.selectedDiskPrice.currency, input.selectedDiskPrice.amount * input.instanceCountValue, input.selectedDiskPrice.suffix)
      : input.serviceCode === "OBS" && input.selectedObsPricing
      ? formatFlavorAmount(input.selectedObsPricing.currency, input.selectedObsPricing.amount * input.instanceCountValue, input.selectedObsPricing.suffix)
      : input.serviceCode === "EIP" && input.selectedEipPricing
      ? formatFlavorAmount(input.selectedEipPricing.currency, input.selectedEipPricing.amount * input.instanceCountValue, input.selectedEipPricing.suffix)
      : input.serviceCode === "ELB" && input.selectedElbPricing
      ? formatFlavorAmount(input.selectedElbPricing.currency, input.selectedElbPricing.amount * input.instanceCountValue, input.selectedElbPricing.suffix)
      : input.serviceCode === "NAT" && input.selectedNatPricing
      ? formatFlavorAmount(input.selectedNatPricing.currency, input.selectedNatPricing.amount * input.instanceCountValue, input.selectedNatPricing.suffix)
      : input.serviceCode === "VPN" && input.selectedVpnPricing
      ? formatFlavorAmount(input.selectedVpnPricing.currency, input.selectedVpnPricing.amount * input.instanceCountValue, input.selectedVpnPricing.suffix)
      : input.serviceCode === "ModelArts" && input.selectedModelArtsPricing
      ? formatFlavorAmount(input.selectedModelArtsPricing.currency, input.selectedModelArtsPricing.amount, input.selectedModelArtsPricing.suffix)
      : input.serviceCode === "CCE" && input.selectedCcePricing
      ? formatFlavorAmount(input.selectedCcePricing.currency, input.selectedCcePricing.amount * input.instanceCountValue, input.selectedCcePricing.suffix)
      : input.serviceCode === "Flexus L" && input.selectedFlexusLPlan
      ? formatFlavorAmount("USD", input.selectedFlexusLPlan.monthlyPriceUsd * input.instanceCountValue, "/mo")
      : input.selectedFlavorCard
      ? formatFlavorAmount(
          input.selectedFlavorCard.priceCurrency,
          input.selectedFlavorCard.priceValue * input.instanceCountValue,
          input.selectedFlavorCard.priceSuffix,
        )
      : scalePriceDisplay(base, input.instanceCountValue, formatFlavorAmount);

  return {
    selectedEstimateBase: base,
    selectedEstimate: estimate,
    quantityLabel: quantityLabels[input.serviceCode] ?? "Instance",
    showGlobalQuantityControl: input.serviceCode !== "ModelArts",
  };
}

const summaryBuilders: Record<string, (input: CalculatorSelectionSummaryInput, formatFlavorAmount: FormatFlavorAmount) => string> = {
  ECS: (input, formatFlavorAmount) =>
    input.selectedFlavorCard?.productType === "flexus-l"
      ? `Selected specifications: ${input.selectedFlavorCard.name} | ${input.selectedFlavorCard.includedSystemDiskGiB ?? "-"} GiB system disk | ${input.selectedFlavorCard.peakBandwidthMbit ?? "-"} Mbit/s | ${input.selectedFlavorCard.dataPackageTiB ?? "-"} TB/month | ${input.selectedFlavorCard.price}`
      : `Selected specifications: ${input.selectedFlavor} | ${input.vcpuValue || "-"} vCPUs | ${input.ramValue || "-"} GiB | ${input.systemDiskType} ${input.systemDiskSize || String(input.activeDiskSizeMin)} GiB${input.isGpSsd2Selected && input.gpSsd2IopsValue != null && input.gpSsd2ThroughputValue != null ? ` | ${input.gpSsd2IopsValue} IOPS | ${input.gpSsd2ThroughputValue} MB/s` : ""}${input.selectedDiskPrice ? ` | Disk ${formatFlavorAmount(input.selectedDiskPrice.currency, input.selectedDiskPrice.amount, input.selectedDiskPrice.suffix)}` : ""}`,
  "Flexus L": (input, formatFlavorAmount) =>
    input.selectedFlexusLPlan
      ? `Selected specifications: ${input.selectedFlexusLPlan.title} | ${input.selectedFlexusLPlan.systemDiskGiB} GiB system disk | ${input.selectedFlexusLPlan.peakBandwidthMbit} Mbit/s | ${input.selectedFlexusLPlan.dataPackageTiB} TB/month | ${formatFlavorAmount("USD", input.selectedFlexusLPlan.monthlyPriceUsd, "/mo")}`
      : "Selected specifications:",
  OBS: (input, formatFlavorAmount) =>
    input.selectedObsPricing
      ? `Selected specifications: ${input.obsProductType} | ${input.obsStorageClass} | ${input.obsRedundancy}${input.obsRestorationType ? ` | ${input.obsRestorationType}` : ""} | ${input.obsStorageSizeValue} ${input.obsStorageUnit}${input.obsReadTrafficValue > 0 ? ` | Read ${input.obsReadTrafficValue} ${input.obsReadTrafficUnit}` : ""} | ${input.obsDurationMonthsValue}mo | ${formatFlavorAmount(input.selectedObsPricing.currency, input.selectedObsPricing.amount, input.selectedObsPricing.suffix)}`
      : "Selected specifications:",
  EIP: (input, formatFlavorAmount) =>
    input.selectedEipPricing
      ? `Selected specifications: ${input.eipType} | Dynamic BGP | ${input.eipChargeMode}${input.showEipBandwidth ? ` | ${input.eipBandwidthMbitValue} Mbit/s` : ""}${input.showEipEnhanced95DurationMonths ? ` | ${input.eipEnhanced95DurationMonthsValue}mo` : ""}${input.showEipSharedBandwidthQuantity ? ` | ${input.eipSharedBandwidthQuantityValue} shared bandwidth${input.eipSharedBandwidthQuantityValue === 1 ? "" : "s"}` : ""}${input.showEipTraffic ? ` | ${input.eipTrafficAmountValue} ${input.eipTrafficUnit}` : ""} | ${formatFlavorAmount(input.selectedEipPricing.currency, input.selectedEipPricing.amount, input.selectedEipPricing.suffix)}`
      : "Selected specifications:",
  ELB: (input, formatFlavorAmount) =>
    input.selectedElbPricing
      ? `Selected specifications: ${input.elbType}${input.elbType === "Dedicated load balancer" ? ` | ${input.elbSpecificationType}` : ""}${input.elbType === "Dedicated load balancer" && input.elbSpecificationType === "Fixed" ? ` | ${input.elbFixedAvailabilityAzCount} AZs | ${input.elbFixedSelectedTypes.map((type) => `${type}: ${input.normalizedElbFixedTypeSpecs[type]}`).join(" | ")}` : ""}${input.elbType === "Dedicated load balancer" && input.elbSpecificationType === "Elastic" ? ` | ${input.elbSubAz}` : ""} | ${input.elbNetworkType}${input.elbType === "Shared load balancer" && input.showElbSharedChargeMode ? ` | ${input.elbSharedChargeMode}${input.showElbSharedBandwidth ? ` | ${input.elbSharedBandwidthMbitValue} Mbit/s` : ""}${input.showElbSharedTraffic ? ` | ${input.elbSharedTrafficAmountValue} ${input.elbSharedTrafficUnit}` : ""}` : ""}${input.elbType === "Dedicated load balancer" ? ` | ${input.selectedElbPricing.estimatedLcus.total} estimated LCU` : ""} | ${formatFlavorAmount(input.selectedElbPricing.currency, input.selectedElbPricing.amount, input.selectedElbPricing.suffix)}`
      : "Selected specifications:",
  NAT: (input, formatFlavorAmount) =>
    input.selectedNatPricing
      ? `Selected specifications: ${input.natType} | ${input.natSize} | ${formatFlavorAmount(input.selectedNatPricing.currency, input.selectedNatPricing.amount, input.selectedNatPricing.suffix)}`
      : "Selected specifications:",
  VPN: (input, formatFlavorAmount) =>
    input.selectedVpnPricing
      ? `Selected specifications: ${input.vpnEdition}${input.vpnEdition === "Enterprise" ? ` | ${input.vpnMode} | ${input.vpnNetworkType} | ${input.vpnSelectedSpecification}${input.showVpnPublicBandwidth ? ` | ${input.vpnUseSharedBandwidth ? "Shared" : "Dedicated"} bandwidth | EIP1 ${Math.max(0, Number(input.vpnEipBandwidthMbit1) || 0)} Mbit/s | EIP2 ${Math.max(0, Number(input.vpnEipBandwidthMbit2) || 0)} Mbit/s` : ""}` : ""}${input.billingMode === "Yearly/Monthly" ? ` | ${input.vpnDurationMonths}mo` : ""} | ${formatFlavorAmount(input.selectedVpnPricing.currency, input.selectedVpnPricing.amount, input.selectedVpnPricing.suffix)}`
      : "Selected specifications:",
  ModelArts: (input, formatFlavorAmount) =>
    `Selected specifications: AI Development Lifecycle | ${input.modelArtsResourceType} | ${input.modelArtsSpecification}${input.modelArtsResourceType === "EVS Storage" ? ` | ${input.modelArtsStorageQuotaValue} GB` : ` | ${input.modelArtsQuantityValue} instance${input.modelArtsQuantityValue === 1 ? "" : "s"}`}${input.billingMode === "Yearly/Monthly" ? ` | ${input.modelArtsDurationMonthsValue === 12 ? "1yr" : `${input.modelArtsDurationMonthsValue}mo`}` : ` | ${input.usageHoursValue}h`}${input.selectedModelArtsPricing ? ` | ${formatFlavorAmount(input.selectedModelArtsPricing.currency, input.selectedModelArtsPricing.amount, input.selectedModelArtsPricing.suffix)}` : ""}`,
  CCE: (input, formatFlavorAmount) =>
    input.selectedCcePricing
      ? `Selected specifications: ${input.cceClusterScale} | ${input.cceMasterNodes} | ${formatFlavorAmount(input.selectedCcePricing.currency, input.selectedCcePricing.amount, input.selectedCcePricing.suffix)}`
      : "Selected specifications:",
  EVS: (input, formatFlavorAmount) =>
    `Selected specifications: ${input.systemDiskType} | ${input.systemDiskSize || String(input.activeDiskSizeMin)} GiB${input.serviceCode === "EVS" ? ` | ${input.billingMode === "Pay-per-use" ? `${input.usageHoursValue}h` : `${input.evsDurationMonthsValue}mo`}` : ""}${input.isGpSsd2Selected && input.gpSsd2IopsValue != null && input.gpSsd2ThroughputValue != null ? ` | ${input.gpSsd2IopsValue} IOPS | ${input.gpSsd2ThroughputValue} MB/s` : ""}${input.selectedDiskPrice ? ` | Disk ${formatFlavorAmount(input.selectedDiskPrice.currency, input.selectedDiskPrice.amount, input.selectedDiskPrice.suffix)}` : ""}`,
};

export function buildCalculatorSelectionSummary(input: CalculatorSelectionSummaryInput, formatFlavorAmount: FormatFlavorAmount) {
  const builder = summaryBuilders[input.serviceCode] ?? summaryBuilders.EVS;
  return builder(input, formatFlavorAmount);
}

const noteBuilders: Record<string, (input: CalculatorSelectionNotesInput, formatFlavorAmount: FormatFlavorAmount) => string[]> = {
  ECS: (input, formatFlavorAmount) =>
    [
      ...(input.selectedFlavorCard?.productType === "flexus-l"
        ? ["Flexus L plans include bundled system disk, bandwidth, and traffic. The ECS disk settings below are ignored for this selection."]
        : []),
      ...(input.selectedFlavorCard?.productType === "ecs" && input.selectedFlavorCard?.flavorPrice && input.selectedDiskPrice
        ? [`Flavor ${input.selectedFlavorCard.flavorPrice} + Disk ${formatFlavorAmount(input.selectedDiskPrice.currency, input.selectedDiskPrice.amount, input.selectedDiskPrice.suffix)}`]
        : []),
    ],
  OBS: (input, formatFlavorAmount) =>
    input.selectedObsPricing
      ? [
          ...input.selectedObsPricing.breakdown.map(
            (entry) => `${entry.label}: ${formatFlavorAmount(input.selectedObsPricing!.currency, entry.amount, input.selectedObsPricing!.suffix)}`,
          ),
          `Monthly average: ${formatFlavorAmount(input.selectedObsPricing!.currency, input.selectedObsPricing!.monthlyAverageAmount, "/mo")}.`,
          ...(input.obsRestorationType
            ? ["Read traffic models the published retrieval or restored-data transfer charges. Separate restoration API request fees are not modeled in this form."]
            : []),
          ...input.selectedObsPricing!.notes,
        ]
      : [],
  EIP: (input, formatFlavorAmount) =>
    input.selectedEipPricing
      ? [
          ...input.selectedEipPricing.breakdown.map(
            (entry) => `${entry.label}: ${formatFlavorAmount(input.selectedEipPricing!.currency, entry.amount, input.selectedEipPricing!.suffix)}`,
          ),
          `Monthly average: ${formatFlavorAmount(input.selectedEipPricing!.currency, input.selectedEipPricing!.monthlyAverageAmount, "/mo")}.`,
          ...input.selectedEipPricing!.notes,
        ]
      : [],
  ELB: (input, formatFlavorAmount) =>
    input.selectedElbPricing
      ? [
          ...input.selectedElbPricing.breakdown.map(
            (entry) => `${entry.label}: ${formatFlavorAmount(input.selectedElbPricing!.currency, entry.amount, input.selectedElbPricing!.suffix)}`,
          ),
          ...(input.elbType === "Dedicated load balancer" && input.elbSpecificationType === "Elastic"
            ? [
                `Estimated LCUs: network ${input.selectedElbPricing!.estimatedLcus.network}, application ${input.selectedElbPricing!.estimatedLcus.application}, total ${input.selectedElbPricing!.estimatedLcus.total}.`,
                ...input.selectedElbPricing!.protocolBreakdowns.map(
                  (entry) => `${entry.protocol}: ${entry.lcu} LCU (${entry.details.join(", ")})`,
                ),
              ]
            : []),
          ...(input.elbType === "Dedicated load balancer" && input.elbSpecificationType === "Fixed"
            ? [
                `Fixed dedicated sizing: ${input.elbFixedSelectedTypes.map((type) => `${type} ${input.normalizedElbFixedTypeSpecs[type]}`).join("; ")} across ${input.elbFixedAvailabilityAzCount} AZs.`,
              ]
            : []),
          ...input.selectedElbPricing!.notes,
        ]
      : [],
  NAT: (input, formatFlavorAmount) =>
    input.selectedNatPricing
      ? [
          ...(input.selectedNatPricing.dailyAmount != null
            ? [`Pay-per-use daily rate: ${formatFlavorAmount(input.selectedNatPricing!.currency, input.selectedNatPricing.dailyAmount, "/day")}.`]
            : []),
          ...(input.selectedNatPricing.hourlyAmount != null
            ? [`Pay-per-use hourly rate: ${formatFlavorAmount(input.selectedNatPricing!.currency, input.selectedNatPricing.hourlyAmount, "/h")}.`]
            : []),
          ...(input.selectedNatPricing.monthlyAmount != null
            ? [`Monthly rate: ${formatFlavorAmount(input.selectedNatPricing!.currency, input.selectedNatPricing.monthlyAmount, "/mo")}.`]
            : []),
          ...(input.selectedNatPricing.yearlyAmount != null
            ? [`Yearly rate: ${formatFlavorAmount(input.selectedNatPricing!.currency, input.selectedNatPricing.yearlyAmount, "/yr")}.`]
            : []),
          ...input.selectedNatPricing!.notes,
        ]
      : [],
  VPN: (input, formatFlavorAmount) =>
    input.selectedVpnPricing
      ? [
          ...input.selectedVpnPricing.breakdown.map(
            (entry) => `${entry.label}: ${formatFlavorAmount(input.selectedVpnPricing!.currency, entry.amount, input.selectedVpnPricing!.suffix)}`,
          ),
          `Monthly average: ${formatFlavorAmount(input.selectedVpnPricing!.currency, input.selectedVpnPricing!.monthlyAverageAmount, "/mo")}.`,
          ...input.selectedVpnPricing!.notes,
        ]
      : [],
  ModelArts: (input, formatFlavorAmount) =>
    input.selectedModelArtsPricing
      ? [
          ...input.selectedModelArtsPricing.breakdown.map(
            (entry) => `${entry.label}: ${formatFlavorAmount(input.selectedModelArtsPricing!.currency, entry.amount, input.selectedModelArtsPricing!.suffix)}`,
          ),
          `Monthly average: ${formatFlavorAmount(input.selectedModelArtsPricing!.currency, input.selectedModelArtsPricing!.monthlyAverageAmount, "/mo")}.`,
          ...input.selectedModelArtsPricing!.notes,
        ]
      : [],
  CCE: (input, formatFlavorAmount) =>
    input.selectedCcePricing
      ? [
          ...(input.selectedCcePricing.hourlyAmount != null
            ? [`Pay-per-use rate: ${formatFlavorAmount(input.selectedCcePricing!.currency, input.selectedCcePricing.hourlyAmount, "/h")}.`]
            : []),
          ...(input.selectedCcePricing.monthlyAmount != null
            ? [`Monthly rate: ${formatFlavorAmount(input.selectedCcePricing!.currency, input.selectedCcePricing.monthlyAmount, "/mo")}.`]
            : []),
          ...(input.selectedCcePricing.yearlyAmount != null
            ? [`Yearly rate: ${formatFlavorAmount(input.selectedCcePricing!.currency, input.selectedCcePricing.yearlyAmount, "/yr")}.`]
            : []),
        ]
      : [],
  EVS: (input) => (input.evsSplitNotice ? [input.evsSplitNotice] : []),
};

export function buildCalculatorSelectionNotes(input: CalculatorSelectionNotesInput, formatFlavorAmount: FormatFlavorAmount) {
  return noteBuilders[input.serviceCode]?.(input, formatFlavorAmount) ?? [];
}
