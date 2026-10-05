import type { FlavorCard } from "@/lib/calculator-types";
import type { FlexusLPlan } from "@/lib/flexus-l-catalog";

type FormatFlavorAmount = (currency: string, amount: number, suffix: string) => string;

type SimplePriceLike = {
  currency: string;
  amount: number;
  suffix: string;
};

type CalculatorSelectionSummaryInput = {
  serviceCode: string;
  selectedFlavor: string;
  selectedFlavorCard: FlavorCard | null;
  selectedFlexusLPlan: FlexusLPlan | null;
  vcpuValue: string;
  ramValue: string;
  systemDiskType: string;
  systemDiskSize: string;
  activeDiskSizeMin: number;
  isGpSsd2Selected: boolean;
  gpSsd2IopsValue: number | null;
  gpSsd2ThroughputValue: number | null;
  selectedDiskPrice: SimplePriceLike | null;
};

type CalculatorSelectionNotesInput = {
  serviceCode: string;
  selectedFlavorCard: FlavorCard | null;
  selectedDiskPrice: SimplePriceLike | null;
};

type CalculatorEstimateInput = {
  serviceCode: string;
  instanceCountValue: number;
  selectedFlavorCard: FlavorCard | null;
  selectedFlexusLPlan: FlexusLPlan | null;
};

export function buildCalculatorEstimate(input: CalculatorEstimateInput, formatFlavorAmount: FormatFlavorAmount) {
  const plan = input.serviceCode === "Flexus L" ? input.selectedFlexusLPlan : null;
  const card = input.selectedFlavorCard;
  const amount = plan?.monthlyPriceUsd ?? card?.priceValue ?? 0;
  const currency = plan ? "USD" : card?.priceCurrency ?? "USD";
  const suffix = plan ? "/mo" : card?.priceSuffix ?? "";
  return {
    selectedEstimateBase: formatFlavorAmount(currency, amount, suffix),
    selectedEstimate: formatFlavorAmount(currency, amount * input.instanceCountValue, suffix),
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
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
};

export function buildCalculatorSelectionSummary(input: CalculatorSelectionSummaryInput, formatFlavorAmount: FormatFlavorAmount) {
  return summaryBuilders[input.serviceCode]?.(input, formatFlavorAmount) ?? "Selected specifications:";
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
};

export function buildCalculatorSelectionNotes(input: CalculatorSelectionNotesInput, formatFlavorAmount: FormatFlavorAmount) {
  return noteBuilders[input.serviceCode]?.(input, formatFlavorAmount) ?? [];
}
