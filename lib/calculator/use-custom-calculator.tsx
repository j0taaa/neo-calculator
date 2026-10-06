import { useEcsDisk } from "@/lib/calculator/use-ecs-disk";
import { useCallback, useEffect, useMemo, useState } from "react";

import { type CalculatorProductSource } from "@/lib/calculator-cart";
import { formatFlavorAmount } from "@/lib/calculator-page-helpers";
import {
  buildCalculatorEstimate,
  buildCalculatorSelectionNotes,
  buildCalculatorSelectionSummary,
} from "@/lib/calculator-presentation";
import type { AppProduct, BillingOption } from "@/lib/calculator-types";
import { evsSingleDiskMaxGiB } from "@/lib/configurable-runtime-utils";
import {
  buildCustomBatchRequestBodies,
  buildCustomProductRequestBody,
  hydrateCustomProduct,
} from "@/lib/custom-service-calculator";
import type { DashboardUrlState } from "@/lib/dashboard-url-state";
import {
  findFlexusLPlan,
  flexusLPlans,
  flexusLPricingReference,
} from "@/lib/flexus-l-catalog";
import { type HuaweiRegionKey } from "@/lib/huawei-regions";
import { useCustomEcsCalculator } from "@/lib/use-custom-ecs-calculator";

import type { CalculatorPanel } from "@/components/calculators/calculator-panel-router";
const flavorSortLabels = {
  "price-asc": "Price: Lowest first",
  "price-desc": "Price: Highest first",
  "name-asc": "Name: A to Z",
  "vcpu-asc": "vCPU: Lowest first",
} as const;

const flavorPageSizeOptions = [1, 3, 5, 10, 20] as const;
const flavorPageSizeStorageKey = "neoCalculator.flavorPageSize";

function isFlavorSortValue(
  value: unknown,
): value is keyof typeof flavorSortLabels {
  return typeof value === "string" && value in flavorSortLabels;
}

function isFlavorPageSizeValue(
  value: unknown,
): value is (typeof flavorPageSizeOptions)[number] {
  return (
    typeof value === "number" &&
    flavorPageSizeOptions.includes(
      value as (typeof flavorPageSizeOptions)[number],
    )
  );
}

function getCustomBillingOptions(serviceCode: string): BillingOption[] {
  if (serviceCode === "Flexus L") {
    return ["Yearly/Monthly"];
  }

  return ["Pay-per-use", "RI", "Yearly/Monthly"];
}

type Options = {
  enabled?: boolean;
  selectedService: string;
  selectedServiceCode: string;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHoursValue: number;
  instanceCountValue: number;
};

export function useCustomCalculator({
  enabled = true,
  selectedService,
  selectedServiceCode,
  regionValue,
  billingMode,
  usageHoursValue,
  instanceCountValue,
}: Options) {
  const [vcpuValue, setVcpuValue] = useState("2");
  const [ramValue, setRamValue] = useState("8");
  const [minVcpuValue, setMinVcpuValue] = useState("2");
  const [minRamValue, setMinRamValue] = useState("8");
  const {
    systemDiskType,
    setSystemDiskType,
    systemDiskSize,
    setSystemDiskSize,
    setGpSsd2Iops,
    setGpSsd2Throughput,
    systemDiskSizeValue,
    isGpSsd2Selected,
    gpSsd2IopsValue,
    gpSsd2ThroughputValue,
    activeDiskSizeBounds,
    calculatorDiskConfigProps,
  } = useEcsDisk();

  const [flavorQuery, setFlavorQuery] = useState("");
  const [flavorPage, setFlavorPage] = useState(1);
  const [flavorSort, setFlavorSort] =
    useState<keyof typeof flavorSortLabels>("price-asc");
  const [flavorPageSize, setFlavorPageSize] =
    useState<(typeof flavorPageSizeOptions)[number]>(3);
  const [selectedFlavor, setSelectedFlavor] = useState("");
  const [showFlexusLInEcs, setShowFlexusLInEcs] = useState(false);
  const isEcsCalculator = selectedServiceCode === "ECS";
  const isFlexusLCalculator = selectedServiceCode === "Flexus L";
  const isCustomService = isEcsCalculator || isFlexusLCalculator;
  const canShowFlexusLInEcs =
    isEcsCalculator &&
    (billingMode === "RI" ||
      billingMode === "Yearly/Monthly" ||
      (billingMode === "Pay-per-use" &&
        (usageHoursValue === 730 || usageHoursValue === 744)));

  const customEcsRuntime = useCustomEcsCalculator({
    isEcsCalculator: enabled && isEcsCalculator,
    isFlexusLCalculator,
    canShowFlexusLInEcs,
    showFlexusLInEcs,
    regionValue,
    billingMode,
    usageHoursValue,
    minVcpuValue,
    minRamValue,
    flavorQuery,
    flavorSort,
    flavorPage,
    flavorPageSize,
    systemDiskType,
    systemDiskSizeValue,
    selectedFlavor,
    setSelectedFlavor,
    setVcpuValue,
    setRamValue,
    setFlavorPage,
  });

  const {
    catalogFlavors,
    diskPricing,
    catalogFlavorsLoading,
    catalogFlavorsError,
    catalogFlavorsLastCompletedAt,
    selectedDiskPrice,
    visibleFlavors,
    currentFlavorPage,
    totalFlavorPages,
    selectedFlavorCard,
    selectedFlexusLPlan,
    setCustomSelection,
  } = customEcsRuntime;

  const customCalculatorEstimate = useMemo(
    () =>
      isCustomService
        ? buildCalculatorEstimate(
            {
              serviceCode: selectedServiceCode,
              instanceCountValue,
              selectedFlavorCard,
              selectedFlexusLPlan,
            },
            formatFlavorAmount,
          )
        : {
            selectedEstimate: "USD 0.00",
            quantityLabel: "Instance",
            showGlobalQuantityControl: true,
          },
    [
      instanceCountValue,
      isCustomService,
      selectedFlavorCard,
      selectedFlexusLPlan,
      selectedServiceCode,
    ],
  );

  useEffect(() => {
    const storedPageSize = Number(
      window.localStorage.getItem(flavorPageSizeStorageKey),
    );
    if (isFlavorPageSizeValue(storedPageSize)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser preferences after hydration, preserving the server markup.
      setFlavorPageSize(storedPageSize);
    }
  }, []);

  if (!canShowFlexusLInEcs && showFlexusLInEcs) setShowFlexusLInEcs(false);

  const customCalculatorSelectionSummary = useMemo(
    () =>
      isCustomService
        ? buildCalculatorSelectionSummary(
            {
              serviceCode: selectedServiceCode,
              selectedFlavor,
              selectedFlavorCard,
              selectedFlexusLPlan,
              vcpuValue,
              ramValue,
              systemDiskType,
              systemDiskSize,
              activeDiskSizeMin: activeDiskSizeBounds.min,
              isGpSsd2Selected,
              gpSsd2IopsValue,
              gpSsd2ThroughputValue,
              selectedDiskPrice,
            },
            formatFlavorAmount,
          )
        : "Selected specifications:",
    [
      activeDiskSizeBounds.min,
      gpSsd2IopsValue,
      gpSsd2ThroughputValue,
      isCustomService,
      isGpSsd2Selected,
      ramValue,
      selectedDiskPrice,
      selectedFlavor,
      selectedFlavorCard,
      selectedFlexusLPlan,
      selectedServiceCode,
      systemDiskSize,
      systemDiskType,
      vcpuValue,
    ],
  );

  const customCalculatorSelectionNotes = useMemo(
    () =>
      isCustomService
        ? buildCalculatorSelectionNotes(
            {
              serviceCode: selectedServiceCode,
              selectedFlavorCard,
              selectedDiskPrice,
            },
            formatFlavorAmount,
          )
        : [],
    [
      isCustomService,
      selectedDiskPrice,
      selectedFlavorCard,
      selectedServiceCode,
    ],
  );

  const calculatorSelectionSummary = customCalculatorSelectionSummary;
  const calculatorSelectionNotes = customCalculatorSelectionNotes;

  const flavorSortOptions = useMemo(
    () =>
      Object.entries(flavorSortLabels).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const ecsPanelProps = {
    minVcpuValue,
    onMinVcpuChange: setMinVcpuValue,
    minRamValue,
    onMinRamChange: setMinRamValue,
    flavorQuery,
    onFlavorQueryChange: (value: string) => {
      setFlavorQuery(value);
      setFlavorPage(1);
    },
    flavorSort,
    flavorSortOptions,
    onFlavorSortChange: (value: string) => {
      if (!isFlavorSortValue(value)) {
        return;
      }
      setFlavorSort(value);
      setFlavorPage(1);
    },
    flavorPageSize,
    flavorPageSizeOptions,
    onFlavorPageSizeChange: (value: number) => {
      if (!isFlavorPageSizeValue(value)) {
        return;
      }
      setFlavorPageSize(value);
      setFlavorPage(1);
      window.localStorage.setItem(flavorPageSizeStorageKey, String(value));
    },
    catalogFlavorsError,
    catalogFlavorsLastCompletedAt,
    catalogFlavorsLoading,
    visibleFlavors,
    selectedFlavor,
    onSelectFlavor: (name: string, vcpu: string, ram: string) =>
      setCustomSelection({
        selectedFlavor: name,
        vcpuValue: vcpu,
        ramValue: ram,
      }),
    currentFlavorPage,
    totalFlavorPages,
    onPreviousFlavorPage: () => setFlavorPage((page) => Math.max(1, page - 1)),
    onNextFlavorPage: () =>
      setFlavorPage((page) => Math.min(totalFlavorPages, page + 1)),
    showFlexusLToggleVisible: canShowFlexusLInEcs,
    showFlexusLChecked: showFlexusLInEcs,
    onShowFlexusLChange: setShowFlexusLInEcs,
    diskConfigProps: {
      ...calculatorDiskConfigProps,
      selectionSummary: calculatorSelectionSummary,
      selectionNotes: calculatorSelectionNotes,
    },
  };

  const flexusLPlansMemoized = useMemo(
    () =>
      flexusLPlans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        vcpu: plan.vcpu,
        ramGiB: plan.ramGiB,
        systemDiskGiB: plan.systemDiskGiB,
        peakBandwidthMbit: plan.peakBandwidthMbit,
        dataPackageTiB: plan.dataPackageTiB,
        monthlyPrice: formatFlavorAmount("USD", plan.monthlyPriceUsd, "/mo"),
      })),
    [],
  );

  const flexusLPanelProps = {
    plans: flexusLPlansMemoized,
    selectedPlanId: selectedFlexusLPlan?.id ?? "",
    onSelectPlan: (planId: string) => {
      const plan = findFlexusLPlan(planId);
      if (!plan) {
        return;
      }
      setCustomSelection({
        selectedFlavor: plan.id,
        vcpuValue: String(plan.vcpu),
        ramValue: String(plan.ramGiB),
      });
    },
    selectionSummary: calculatorSelectionSummary,
    selectionNotes: calculatorSelectionNotes,
    referenceNote: `Reference pricing uses Huawei Cloud's public Flexus L monthly catalog for ${flexusLPricingReference.region}.`,
  };

  const hydrateProduct = useCallback(
    (product: AppProduct) => {
      const customHydrated = hydrateCustomProduct(product, {
        regionValue,
        flavorQuery,
        flavorSort,
        minVcpuValue,
        minRamValue,
        vcpuValue,
        ramValue,
      });

      if (customHydrated.handled) {
        if (
          customHydrated.nextSelectedFlavor !== undefined &&
          customHydrated.nextVcpuValue !== undefined &&
          customHydrated.nextRamValue !== undefined
        ) {
          setCustomSelection({
            selectedFlavor: customHydrated.nextSelectedFlavor,
            vcpuValue: customHydrated.nextVcpuValue,
            ramValue: customHydrated.nextRamValue,
            flavorAutoSelectKey: customHydrated.nextFlavorAutoSelectKey,
          });
        }
        if (customHydrated.nextMinVcpuValue !== undefined) {
          setMinVcpuValue(customHydrated.nextMinVcpuValue);
        }
        if (customHydrated.nextMinRamValue !== undefined) {
          setMinRamValue(customHydrated.nextMinRamValue);
        }
        if (customHydrated.nextGpSsd2Iops !== undefined) {
          setGpSsd2Iops(customHydrated.nextGpSsd2Iops);
        }
        if (customHydrated.nextGpSsd2Throughput !== undefined) {
          setGpSsd2Throughput(customHydrated.nextGpSsd2Throughput);
        }
        if (customHydrated.nextSystemDiskType !== undefined) {
          setSystemDiskType(customHydrated.nextSystemDiskType);
        }
        if (customHydrated.nextSystemDiskSize !== undefined) {
          setSystemDiskSize(customHydrated.nextSystemDiskSize);
        }
      }

      return customHydrated;
    },
    [
      regionValue,
      flavorQuery,
      flavorSort,
      minVcpuValue,
      minRamValue,
      vcpuValue,
      ramValue,
      setCustomSelection,
      setGpSsd2Iops,
      setGpSsd2Throughput,
      setSystemDiskType,
      setSystemDiskSize,
    ],
  );

  const applyServiceUrlState = useCallback((state: DashboardUrlState) => {
    if (state.flavorQuery !== undefined) {
      setFlavorQuery(state.flavorQuery);
    }
    if (state.flavorPage != null) {
      setFlavorPage(state.flavorPage);
    }
    if (state.flavorSort && isFlavorSortValue(state.flavorSort)) {
      setFlavorSort(state.flavorSort);
    }
    if (state.flavorPageSize && isFlavorPageSizeValue(state.flavorPageSize)) {
      setFlavorPageSize(state.flavorPageSize);
    }
    if (state.selectedFlavor !== undefined) {
      setSelectedFlavor(state.selectedFlavor);
    }
    if (state.minVcpuValue !== undefined) {
      setMinVcpuValue(state.minVcpuValue);
    }
    if (state.minRamValue !== undefined) {
      setMinRamValue(state.minRamValue);
    }
    if (state.showFlexusLInEcs !== undefined) {
      setShowFlexusLInEcs(state.showFlexusLInEcs);
    }
  }, []);

  const writeServiceUrlState = useCallback(
    (params: URLSearchParams) => {
      if (!isEcsCalculator && !isFlexusLCalculator) {
        return;
      }

      params.set("minVcpu", minVcpuValue);
      params.set("minRam", minRamValue);
      params.set("flavorPage", String(flavorPage));
      params.set("flavorSort", flavorSort);
      params.set("flavorPageSize", String(flavorPageSize));
      params.set("flexusL", showFlexusLInEcs ? "1" : "0");

      if (flavorQuery) {
        params.set("flavorQuery", flavorQuery);
      }
      if (selectedFlavor) {
        params.set("flavor", selectedFlavor);
      }
    },
    [
      flavorPage,
      flavorPageSize,
      flavorQuery,
      flavorSort,
      isEcsCalculator,
      isFlexusLCalculator,
      minRamValue,
      minVcpuValue,
      selectedFlavor,
      showFlexusLInEcs,
    ],
  );

  const productSource: CalculatorProductSource = {
    buildRequestBodies: () =>
      buildCustomProductRequestBody({
        selectedServiceCode,
        selectedServiceMetaCode: selectedServiceCode,
        selectedService,
        selectedEstimate: customCalculatorEstimate.selectedEstimate,
        quantity: instanceCountValue,
        regionValue,
        billingMode,
        usageHoursValue,
        selectedFlavor,
        selectedFlavorCard,
        selectedFlexusLPlan,
        vcpuValue,
        ramValue,
        systemDiskType,
        systemDiskSizeValue,
        isGpSsd2Selected,
        gpSsd2IopsValue,
        gpSsd2ThroughputValue,
        selectedDiskPrice,
      }),
    buildBatchRequestBodies: (item) =>
      buildCustomBatchRequestBodies({
        selectedServiceCode,
        selectedServiceMetaCode: selectedServiceCode,
        selectedService,
        regionValue,
        billingMode,
        usageHoursValue,
        catalogFlavors,
        diskPricing,
        canShowFlexusLInEcs,
        showFlexusLInEcs,
        item,
      }),
  };
  const billingOptions = useMemo(
    () => getCustomBillingOptions(selectedServiceCode),
    [selectedServiceCode],
  );
  const panel: CalculatorPanel | null = isEcsCalculator
    ? { kind: "ecs", props: ecsPanelProps }
    : isFlexusLCalculator
      ? { kind: "flexus-l", props: flexusLPanelProps }
      : null;

  return {
    isCustomService,
    estimate: customCalculatorEstimate,
    billingOptions,
    panel,
    productSource,
    hydrateProduct,
    applyServiceUrlState,
    writeServiceUrlState,
    addToListError: isEcsCalculator
      ? selectedFlavorCard
        ? null
        : "Select a flavor first."
      : isFlexusLCalculator
        ? selectedFlexusLPlan
          ? null
          : "Select a Flexus L plan first."
        : `${selectedService} is not implemented in the calculator yet.`,
    batchError:
      isEcsCalculator && !catalogFlavors.length
        ? "ECS flavors are not loaded yet."
        : null,
    batchPanel: {
      mode: isEcsCalculator ? ("ecs" as const) : ("flexus-l" as const),
      systemDiskType,
      systemDiskSizeValue,
      evsSingleDiskMaxGiB,
      showFlexusLToggleVisible: canShowFlexusLInEcs,
      showFlexusLChecked: showFlexusLInEcs,
      onShowFlexusLChange: setShowFlexusLInEcs,
    },
  };
}
