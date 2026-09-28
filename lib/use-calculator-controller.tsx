import { useCallback, useEffect, useMemo, useState, type ComponentProps, type Dispatch, type SetStateAction } from "react";

import type { CalculatorPanelRouter } from "@/components/calculators/calculator-panel-router";
import { ServiceBatchAddPanel } from "@/components/calculators/service-batch-add-panel";
import {
  saveCalculatorProducts,
  addCalculatorBatch,
  applyProductMutation,
  type CalculatorProductSource,
  type MutateListProduct,
  type SavedCartProduct,
  type ProductMutationMethod,
} from "@/lib/calculator-cart";
import type { AppProduct, AppProject, BillingOption } from "@/lib/calculator-types";
import { formatFlavorAmount, splitPriceDisplay } from "@/lib/calculator-page-helpers";
import {
  buildCalculatorEstimate,
  buildCalculatorSelectionNotes,
  buildCalculatorSelectionSummary,
} from "@/lib/calculator-presentation";
import {
  buildCustomBatchRequestBodies,
  buildCustomProductRequestBody,
  hydrateCustomProduct,
} from "@/lib/custom-service-calculator";
import type { DashboardUrlState } from "@/lib/dashboard-url-state";
import { findFlexusLPlan, flexusLPlans, flexusLPricingReference } from "@/lib/flexus-l-catalog";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import {
  getConfigurableServiceBundleByCode,
  freeAlwaysServiceCodes,
  supportedBatchAddServiceCodes,
  supportedCalculatorServiceCodes,
  type ServiceDefinition,
  type ServiceCatalogEntry,
} from "@/lib/service-config";
import { useConfigurableServiceRuntime } from "@/lib/use-configurable-service-runtime";
import { useCustomEcsCalculator } from "@/lib/use-custom-ecs-calculator";
import {
  ecsDiskSizeBounds,
  evsSingleDiskMaxGiB,
  getGpSsd2IopsBounds,
  getGpSsd2ThroughputBounds,
  gpSsd2IopsBounds,
  gpSsd2ThroughputBounds,
  normalizeGpSsd2Iops,
  normalizeGpSsd2Throughput,
  systemDiskOptions,
  type SystemDiskOption,
} from "@/lib/configurable-runtime-utils";

const flavorSortLabels = {
  "price-asc": "Price: Lowest first",
  "price-desc": "Price: Highest first",
  "name-asc": "Name: A to Z",
  "vcpu-asc": "vCPU: Lowest first",
} as const;

const flavorPageSizeOptions = [1, 3, 5, 10, 20] as const;
const flavorPageSizeStorageKey = "neoCalculator.flavorPageSize";

function isFlavorSortValue(value: unknown): value is keyof typeof flavorSortLabels {
  return typeof value === "string" && value in flavorSortLabels;
}

function isFlavorPageSizeValue(value: unknown): value is (typeof flavorPageSizeOptions)[number] {
  return typeof value === "number" && flavorPageSizeOptions.includes(value as (typeof flavorPageSizeOptions)[number]);
}

function getCustomBillingOptions(serviceCode: string): BillingOption[] {
  if (serviceCode === "Flexus L") {
    return ["Yearly/Monthly"];
  }

  return ["Pay-per-use", "RI", "Yearly/Monthly"];
}

export type CalculatorControllerInput = {
  selectedService: string;
  selectedServiceMeta: ServiceCatalogEntry;
  regionValue: HuaweiRegionKey;
  setRegionValue: (value: HuaweiRegionKey) => void;
  billingMode: BillingOption;
  setBillingMode: (value: BillingOption) => void;
  usageHours: string;
  setUsageHours: (value: string) => void;
  selectedListId: string;
  setSelectedListId: (value: string) => void;
  editingProductId: string | null;
  setEditingProductId: (value: string | null) => void;
  editingProductListId: string | null;
  setEditingProductListId: (value: string | null) => void;
  activeTab: string;
  setActiveTab: (value: string) => void;
  session: { user: { id: string } } | null;
  isSignedIn: boolean;
  setProjects: Dispatch<SetStateAction<AppProject[]>>;
  setSelectedService: (value: string) => void;
  setQuery: (value: string) => void;
  mutateListProduct: MutateListProduct;
};

export type CalculatorControllerResult = {
  isSelectedServiceImplemented: boolean;
  isSelectedServiceFree: boolean;
  isSelectedServiceBatchAddImplemented: boolean;
  showBillingHeader: boolean;
  calculatorBillingOptions: BillingOption[];
  showSharedUsageHours: boolean;
  selectedEstimate: string;
  selectedEstimateParts: ReturnType<typeof splitPriceDisplay>;
  quantityLabel: string;
  showGlobalQuantityControl: boolean;
  displayQuantityValue: number;
  instanceCount: string;
  updateInstanceCount: (value: string) => void;
  addToListPending: boolean;
  addToListMessage: string;
  setAddToListMessage: Dispatch<SetStateAction<string>>;
  batchInput: string;
  setBatchInput: Dispatch<SetStateAction<string>>;
  batchAddPending: boolean;
  batchAddMessage: string;
  calculatorPanelProps: ComponentProps<typeof CalculatorPanelRouter>;
  batchPanelProps: ComponentProps<typeof ServiceBatchAddPanel> | null;
  handleAddToList: () => Promise<void>;
  handleBatchAdd: () => Promise<void>;
  handleEditProduct: (product: AppProduct, sourceListId?: string) => void;
  handleCancelEdit: () => void;
  applyServiceUrlState: (state: DashboardUrlState) => void;
  writeServiceUrlState: (params: URLSearchParams) => void;
  resetForServiceCode: (serviceCode: string) => void;
};

function normalizeUsageHours(nextValue: string, setUsageHours: (value: string) => void) {
  if (nextValue === "") {
    setUsageHours("");
    return;
  }

  const parsed = Number(nextValue);
  if (Number.isNaN(parsed)) {
    return;
  }

  setUsageHours(String(Math.min(87600, Math.max(1, parsed))));
}

export function useCalculatorController({
  selectedService,
  selectedServiceMeta,
  regionValue,
  setRegionValue,
  billingMode,
  setBillingMode,
  usageHours,
  setUsageHours,
  selectedListId,
  setSelectedListId,
  editingProductId,
  setEditingProductId,
  editingProductListId,
  setEditingProductListId,
  setActiveTab,
  session,
  isSignedIn,
  setProjects,
  setSelectedService,
  setQuery,
  mutateListProduct,
}: CalculatorControllerInput): CalculatorControllerResult {
  const selectedServiceCode = selectedServiceMeta.code;
  const selectedServiceBundle = getConfigurableServiceBundleByCode(selectedServiceCode);
  const selectedServiceDefinition: ServiceDefinition | null = selectedServiceBundle?.service ?? null;
  const isSelectedServiceImplemented = supportedCalculatorServiceCodes.includes(selectedServiceCode);
  const isSelectedServiceFree = freeAlwaysServiceCodes.includes(selectedServiceCode);
  const isSelectedServiceBatchAddImplemented = supportedBatchAddServiceCodes.includes(selectedServiceCode);

  const [instanceCount, setInstanceCount] = useState("1");
  const [vcpuValue, setVcpuValue] = useState("2");
  const [ramValue, setRamValue] = useState("8");
  const [minVcpuValue, setMinVcpuValue] = useState("2");
  const [minRamValue, setMinRamValue] = useState("8");
  const [systemDiskType, setSystemDiskType] = useState<SystemDiskOption>("High I/O");
  const [systemDiskSize, setSystemDiskSize] = useState("40");
  const [gpSsd2Iops, setGpSsd2Iops] = useState("3000");
  const [gpSsd2Throughput, setGpSsd2Throughput] = useState("125");
  const [flavorQuery, setFlavorQuery] = useState("");
  const [flavorPage, setFlavorPage] = useState(1);
  const [flavorSort, setFlavorSort] = useState<keyof typeof flavorSortLabels>("price-asc");
  const [flavorPageSize, setFlavorPageSize] = useState<(typeof flavorPageSizeOptions)[number]>(3);
  const [selectedFlavor, setSelectedFlavor] = useState("");
  const [showFlexusLInEcs, setShowFlexusLInEcs] = useState(false);
  const [addToListPending, setAddToListPending] = useState(false);
  const [addToListMessage, setAddToListMessage] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [batchAddPending, setBatchAddPending] = useState(false);
  const [batchAddMessage, setBatchAddMessage] = useState("");

  const usageHoursValue = Number.isFinite(Number(usageHours)) ? Math.max(1, Number(usageHours)) : 744;
  const instanceCountValue = Number.isFinite(Number(instanceCount)) ? Math.max(1, Number(instanceCount)) : 1;
  const isEcsCalculator = selectedServiceCode === "ECS";
  const isFlexusLCalculator = selectedServiceCode === "Flexus L";
  const isCustomService = isEcsCalculator || isFlexusLCalculator;
  const canShowFlexusLInEcs = isEcsCalculator
    && (billingMode === "RI" || billingMode === "Yearly/Monthly" || (billingMode === "Pay-per-use" && (usageHoursValue === 730 || usageHoursValue === 744)));
  const systemDiskSizeValue = Number.isFinite(Number(systemDiskSize))
    ? Math.max(ecsDiskSizeBounds.min, Number(systemDiskSize))
    : ecsDiskSizeBounds.min;
  const isGpSsd2Selected = systemDiskType === "General Purpose SSD V2";
  const gpSsd2IopsValue = isGpSsd2Selected ? normalizeGpSsd2Iops(gpSsd2Iops, systemDiskSizeValue) : null;
  const gpSsd2IopsRange = isGpSsd2Selected ? getGpSsd2IopsBounds(systemDiskSizeValue) : null;
  const gpSsd2ThroughputValue = isGpSsd2Selected && gpSsd2IopsValue != null
    ? normalizeGpSsd2Throughput(gpSsd2Throughput, gpSsd2IopsValue)
    : null;
  const gpSsd2ThroughputRange = isGpSsd2Selected && gpSsd2IopsValue != null
    ? getGpSsd2ThroughputBounds(gpSsd2IopsValue)
    : null;

  const configurableRuntime = useConfigurableServiceRuntime({
    selectedServiceCode,
    selectedService,
    selectedServiceDefinition,
    regionValue,
    billingMode,
    setBillingMode,
    usageHours,
    usageHoursValue,
    updateUsageHours: (value) => normalizeUsageHours(value, setUsageHours),
    instanceCountValue,
  });

  const customEcsRuntime = useCustomEcsCalculator({
    isEcsCalculator,
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
    activeDiskSizeBounds,
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
    () => (
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
        : { selectedEstimate: "USD 0.00", quantityLabel: "Instance", showGlobalQuantityControl: true }
    ),
    [instanceCountValue, isCustomService, selectedFlavorCard, selectedFlexusLPlan, selectedServiceCode],
  );

  const selectedEstimate = isCustomService ? customCalculatorEstimate.selectedEstimate : configurableRuntime.selectedEstimate;
  const quantityLabel = isCustomService ? customCalculatorEstimate.quantityLabel : configurableRuntime.quantityLabel;
  const showGlobalQuantityControl = isCustomService ? customCalculatorEstimate.showGlobalQuantityControl : configurableRuntime.showGlobalQuantityControl;
  const selectedEstimateParts = splitPriceDisplay(selectedEstimate);
  const displayQuantityValue = showGlobalQuantityControl ? instanceCountValue : 1;
  const calculatorBillingOptions = useMemo(
    () => configurableRuntime.activeBillingOptions ?? getCustomBillingOptions(selectedServiceCode),
    [configurableRuntime.activeBillingOptions, selectedServiceCode],
  );

  useEffect(() => {
    if (!calculatorBillingOptions.includes(billingMode)) {
      setBillingMode(calculatorBillingOptions[0]);
    }
  }, [billingMode, calculatorBillingOptions, setBillingMode]);

  useEffect(() => {
    const storedPageSize = Number(window.localStorage.getItem(flavorPageSizeStorageKey));
    if (isFlavorPageSizeValue(storedPageSize)) {
      setFlavorPageSize(storedPageSize);
    }
  }, []);

  useEffect(() => {
    if (!canShowFlexusLInEcs && showFlexusLInEcs) {
      setShowFlexusLInEcs(false);
    }
  }, [canShowFlexusLInEcs, showFlexusLInEcs]);

  useEffect(() => {
    if (!isGpSsd2Selected || gpSsd2IopsValue == null || gpSsd2ThroughputValue == null) {
      return;
    }
    if (gpSsd2Iops !== String(gpSsd2IopsValue)) {
      setGpSsd2Iops(String(gpSsd2IopsValue));
    }
    if (gpSsd2Throughput !== String(gpSsd2ThroughputValue)) {
      setGpSsd2Throughput(String(gpSsd2ThroughputValue));
    }
  }, [gpSsd2Iops, gpSsd2IopsValue, gpSsd2Throughput, gpSsd2ThroughputValue, isGpSsd2Selected]);

  const updateSystemDiskSize = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setSystemDiskSize("");
      return;
    }
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      return;
    }
    setSystemDiskSize(String(Math.min(activeDiskSizeBounds.max, Math.max(activeDiskSizeBounds.min, parsed))));
  }, [activeDiskSizeBounds.max, activeDiskSizeBounds.min]);

  const updateInstanceCount = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setInstanceCount("");
      return;
    }
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      return;
    }
    setInstanceCount(String(Math.min(999, Math.max(1, parsed))));
  }, []);

  const updateGpSsd2Iops = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setGpSsd2Iops("");
      return;
    }
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      return;
    }
    setGpSsd2Iops(String(normalizeGpSsd2Iops(parsed, systemDiskSizeValue)));
  }, [systemDiskSizeValue]);

  const updateGpSsd2Throughput = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setGpSsd2Throughput("");
      return;
    }
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      return;
    }
    setGpSsd2Throughput(String(normalizeGpSsd2Throughput(parsed, gpSsd2IopsValue ?? gpSsd2IopsBounds.min)));
  }, [gpSsd2IopsValue]);

  const customCalculatorSelectionSummary = useMemo(
    () => (
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
        : "Selected specifications:"
    ),
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
    () => (
      isCustomService
        ? buildCalculatorSelectionNotes(
            {
              serviceCode: selectedServiceCode,
              selectedFlavorCard,
              selectedDiskPrice,
            },
            formatFlavorAmount,
          )
        : []
    ),
    [isCustomService, selectedDiskPrice, selectedFlavorCard, selectedServiceCode],
  );

  const calculatorSelectionSummary = isCustomService
    ? customCalculatorSelectionSummary
    : (configurableRuntime.panelProps?.selectionSummary ?? "Selected specifications:");
  const calculatorSelectionNotes = isCustomService
    ? customCalculatorSelectionNotes
    : (configurableRuntime.panelProps?.selectionNotes ?? []);
  const calculatorDiskNotes = useMemo(
    () => [
      ...(isGpSsd2Selected
        ? ["Current estimate reflects capacity pricing only. Additional GPSSD2 IOPS and throughput charges are not modeled yet."]
        : []),
      `Minimum ${activeDiskSizeBounds.min} GiB, maximum ${activeDiskSizeBounds.max} GiB.`,
    ],
    [activeDiskSizeBounds.max, activeDiskSizeBounds.min, isGpSsd2Selected],
  );

  const calculatorDiskConfigProps = {
    mode: "ecs" as const,
    systemDiskType,
    systemDiskOptions,
    onSystemDiskTypeChange: (value: string) => value && setSystemDiskType(value as SystemDiskOption),
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
    pricingError: undefined,
    pricingLoadingMessage: null,
    notes: calculatorDiskNotes,
    selectionSummary: calculatorSelectionSummary,
    selectionNotes: calculatorSelectionNotes,
  };

  const flavorSortOptions = useMemo(() => Object.entries(flavorSortLabels).map(([value, label]) => ({ value, label })), []);
  const calculatorRegionOptions = useMemo(() => Object.entries(huaweiRegions).map(([value, labels]) => ({ value, label: labels.full })), []);

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
    onSelectFlavor: (name: string, vcpu: string, ram: string) => setCustomSelection({ selectedFlavor: name, vcpuValue: vcpu, ramValue: ram }),
    currentFlavorPage,
    totalFlavorPages,
    onPreviousFlavorPage: () => setFlavorPage((page) => Math.max(1, page - 1)),
    onNextFlavorPage: () => setFlavorPage((page) => Math.min(totalFlavorPages, page + 1)),
    showFlexusLToggleVisible: canShowFlexusLInEcs,
    showFlexusLChecked: showFlexusLInEcs,
    onShowFlexusLChange: setShowFlexusLInEcs,
    diskConfigProps: calculatorDiskConfigProps,
  };

  const flexusLPlansMemoized = useMemo(() => flexusLPlans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    vcpu: plan.vcpu,
    ramGiB: plan.ramGiB,
    systemDiskGiB: plan.systemDiskGiB,
    peakBandwidthMbit: plan.peakBandwidthMbit,
    dataPackageTiB: plan.dataPackageTiB,
    monthlyPrice: formatFlavorAmount("USD", plan.monthlyPriceUsd, "/mo"),
  })), []);

  const flexusLPanelProps = {
    plans: flexusLPlansMemoized,
    selectedPlanId: selectedFlexusLPlan?.id ?? "",
    onSelectPlan: (planId: string) => {
      const plan = findFlexusLPlan(planId);
      if (!plan) {
        return;
      }
      setCustomSelection({ selectedFlavor: plan.id, vcpuValue: String(plan.vcpu), ramValue: String(plan.ramGiB) });
    },
    selectionSummary: calculatorSelectionSummary,
    selectionNotes: calculatorSelectionNotes,
    referenceNote: `Reference pricing uses Huawei Cloud's public Flexus L monthly catalog for ${flexusLPricingReference.region}.`,
  };

  const batchPanelProps = useMemo<ComponentProps<typeof ServiceBatchAddPanel> | null>(() => {
    if (!isSelectedServiceBatchAddImplemented) {
      return null;
    }

    if (isEcsCalculator || isFlexusLCalculator) {
      return {
        mode: isEcsCalculator ? "ecs" : "flexus-l",
        regionValue,
        regionOptions: calculatorRegionOptions,
        onRegionChange: (value: string) => setRegionValue(value as HuaweiRegionKey),
        batchInput,
        onBatchInputChange: setBatchInput,
        batchAddMessage,
        systemDiskType,
        systemDiskSizeValue,
        evsSingleDiskMaxGiB,
        showFlexusLToggleVisible: canShowFlexusLInEcs,
        showFlexusLChecked: showFlexusLInEcs,
        onShowFlexusLChange: setShowFlexusLInEcs,
        onSubmit: () => void 0,
        submitDisabled: true,
        submitLabel: "Add Batch",
      };
    }

    if (configurableRuntime.isConfigurableService && configurableRuntime.batchPanel) {
      return {
        kind: "declarative" as const,
        regionValue,
        regionOptions: calculatorRegionOptions,
        onRegionChange: (value: string) => setRegionValue(value as HuaweiRegionKey),
        batchInput,
        onBatchInputChange: setBatchInput,
        batchAddMessage,
        placeholder: configurableRuntime.batchPanel.placeholder,
        description: configurableRuntime.batchPanel.description,
        defaults: configurableRuntime.batchPanel.defaults,
        validation: configurableRuntime.batchPanel.validation,
        onSubmit: () => void 0,
        submitDisabled: true,
        submitLabel: "Add Batch",
      };
    }

    return null;
  }, [
    batchAddMessage,
    batchInput,
    calculatorRegionOptions,
    canShowFlexusLInEcs,
    isEcsCalculator,
    isFlexusLCalculator,
    isSelectedServiceBatchAddImplemented,
    configurableRuntime.batchPanel,
    configurableRuntime.isConfigurableService,
    regionValue,
    setRegionValue,
    showFlexusLInEcs,
    systemDiskSizeValue,
    systemDiskType,
  ]);

  const handleCancelEdit = useCallback(() => {
    setEditingProductId(null);
    setEditingProductListId(null);
    setAddToListMessage("");
  }, [setEditingProductId, setEditingProductListId]);

  const handleEditProduct = useCallback((product: AppProduct, sourceListId = selectedListId) => {
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
        customHydrated.nextSelectedFlavor !== undefined
        && customHydrated.nextVcpuValue !== undefined
        && customHydrated.nextRamValue !== undefined
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

    const hydrated = customHydrated.handled ? customHydrated : configurableRuntime.hydrateProduct(product);
    if (!hydrated.handled) {
      setAddToListMessage(hydrated.error ?? "This product cannot be edited from the calculator.");
      return;
    }

    setSelectedService(product.serviceName);
    setQuery(product.serviceName);
    if (hydrated.nextRegion) {
      setRegionValue(hydrated.nextRegion);
    }
    if (hydrated.nextBillingMode) {
      setBillingMode(hydrated.nextBillingMode);
    }
    if (hydrated.nextUsageHours) {
      setUsageHours(hydrated.nextUsageHours);
    }
    if (hydrated.nextInstanceCount) {
      setInstanceCount(hydrated.nextInstanceCount);
    }
    setEditingProductId(product.id);
    setSelectedListId(sourceListId);
    setEditingProductListId(sourceListId);
    setActiveTab("calculator");
    setAddToListMessage("Editing item. Save changes when ready.");
  }, [
    configurableRuntime,
    flavorQuery,
    flavorSort,
    minRamValue,
    minVcpuValue,
    ramValue,
    regionValue,
    selectedListId,
    setActiveTab,
    setBillingMode,
    setCustomSelection,
    setEditingProductId,
    setEditingProductListId,
    setQuery,
    setRegionValue,
    setSelectedListId,
    setSelectedService,
    setUsageHours,
    vcpuValue,
  ]);

  const addToListError = configurableRuntime.isConfigurableService
    ? configurableRuntime.addToListError
    : isEcsCalculator
    ? (selectedFlavorCard ? null : "Select a flavor first.")
    : isFlexusLCalculator
    ? (selectedFlexusLPlan ? null : "Select a Flexus L plan first.")
    : `${selectedService} is not implemented in the calculator yet.`;

  const productSource: CalculatorProductSource = configurableRuntime.isConfigurableService
    ? configurableRuntime
    : {
        buildRequestBodies: () => buildCustomProductRequestBody({
          selectedServiceCode,
          selectedServiceMetaCode: selectedServiceCode,
          selectedService,
          selectedEstimate,
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
        buildBatchRequestBodies: (item) => buildCustomBatchRequestBodies({
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
  const cartWriter = {
    mutate: mutateListProduct,
    onSaved: (product: SavedCartProduct, method: ProductMutationMethod) => {
      setProjects((current) => applyProductMutation(current, product, method));
    },
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
    if (addToListError) {
      setAddToListMessage(addToListError);
      return;
    }

    setAddToListPending(true);
    setAddToListMessage("");

    try {
      setAddToListMessage(await saveCalculatorProducts(productSource, {
        listId: selectedListId,
        editing: editingProductId && editingProductListId
          ? { productId: editingProductId, listId: editingProductListId }
          : undefined,
      }, cartWriter));

      setEditingProductId(null);
      setEditingProductListId(null);
    } catch (error) {
      setAddToListMessage(error instanceof Error ? error.message : "Unable to add product to list");
    } finally {
      setAddToListPending(false);
    }
  };

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
    if (isEcsCalculator && !catalogFlavors.length) {
      setBatchAddMessage("ECS flavors are not loaded yet.");
      return;
    }
    setBatchAddPending(true);
    setBatchAddMessage("");
    try {
      setBatchAddMessage(await addCalculatorBatch(productSource, selectedListId, batchInput, cartWriter));
    } catch (error) {
      setBatchAddMessage(error instanceof Error ? error.message : "Batch add failed.");
    } finally {
      setBatchAddPending(false);
    }
  };

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

  const writeServiceUrlState = useCallback((params: URLSearchParams) => {
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
  }, [
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
  ]);

  const resetForServiceCode = useCallback((serviceCode: string) => {
    const bundle = getConfigurableServiceBundleByCode(serviceCode);
    if (bundle) {
      configurableRuntime.applyDefaultsForServiceCode(serviceCode);
    }
  }, [configurableRuntime]);

  return {
    isSelectedServiceImplemented,
    isSelectedServiceFree,
    isSelectedServiceBatchAddImplemented,
    showBillingHeader: configurableRuntime.isConfigurableService ? configurableRuntime.usesSharedBillingHeader : true,
    calculatorBillingOptions,
    showSharedUsageHours: configurableRuntime.showSharedUsageHours,
    selectedEstimate,
    selectedEstimateParts,
    quantityLabel,
    showGlobalQuantityControl,
    displayQuantityValue,
    instanceCount,
    updateInstanceCount,
    addToListPending,
    addToListMessage,
    setAddToListMessage,
    batchInput,
    setBatchInput,
    batchAddPending,
    batchAddMessage,
    calculatorPanelProps: {
      panel: isEcsCalculator ? { kind: "ecs", props: ecsPanelProps }
        : isFlexusLCalculator ? { kind: "flexus-l", props: flexusLPanelProps }
        : configurableRuntime.panelProps ? { kind: "configurable", props: configurableRuntime.panelProps }
        : null,
    },
    batchPanelProps: batchPanelProps
      ? {
          ...batchPanelProps,
          onSubmit: handleBatchAdd,
          submitDisabled: batchAddPending || !selectedListId || !isSignedIn,
          submitLabel: batchAddPending ? "Adding Batch..." : "Add Batch",
        }
      : null,
    handleAddToList,
    handleBatchAdd,
    handleEditProduct,
    handleCancelEdit,
    applyServiceUrlState,
    writeServiceUrlState,
    resetForServiceCode,
  };
}
