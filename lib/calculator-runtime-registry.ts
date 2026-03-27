export type CalculatorRuntimeMeta = {
  quantityLabel: string;
  showGlobalQuantityControl: boolean;
  batchMode: "ecs" | "flexus-l" | "evs" | "obs" | null;
  usesSharedBillingHeader: boolean;
  shouldShowSharedUsageHours: (input: { showEipEnhanced95DurationMonths: boolean }) => boolean;
};

const defaultRuntimeMeta: CalculatorRuntimeMeta = {
  quantityLabel: "Instance",
  showGlobalQuantityControl: true,
  batchMode: null,
  usesSharedBillingHeader: true,
  shouldShowSharedUsageHours: () => true,
};

const calculatorRuntimeRegistry: Record<string, CalculatorRuntimeMeta> = {
  ECS: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    batchMode: "ecs",
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => true,
  },
  "Flexus L": {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    batchMode: "flexus-l",
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => true,
  },
  EVS: {
    quantityLabel: "Volume",
    showGlobalQuantityControl: true,
    batchMode: "evs",
    usesSharedBillingHeader: false,
    shouldShowSharedUsageHours: () => false,
  },
  OBS: {
    quantityLabel: "Bucket",
    showGlobalQuantityControl: true,
    batchMode: "obs",
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => false,
  },
  EIP: {
    quantityLabel: "EIP",
    showGlobalQuantityControl: true,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: ({ showEipEnhanced95DurationMonths }) => !showEipEnhanced95DurationMonths,
  },
  ELB: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => false,
  },
  NAT: {
    quantityLabel: "Gateway",
    showGlobalQuantityControl: true,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => true,
  },
  VPN: {
    quantityLabel: "Gateway",
    showGlobalQuantityControl: true,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => true,
  },
  CCE: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => true,
  },
  CCI: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => true,
  },
  ModelArts: {
    quantityLabel: "Configuration",
    showGlobalQuantityControl: false,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => false,
  },
  Workspace: {
    quantityLabel: "Desktop",
    showGlobalQuantityControl: false,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => false,
  },
  DCS: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    batchMode: null,
    usesSharedBillingHeader: true,
    shouldShowSharedUsageHours: () => false,
  },
};

export function getCalculatorRuntimeMeta(serviceCode: string): CalculatorRuntimeMeta {
  return calculatorRuntimeRegistry[serviceCode] ?? defaultRuntimeMeta;
}
