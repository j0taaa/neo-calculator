import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";

import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";
import { buildConfiguredFields } from "@/lib/configurable-service-fields";
import {
  buildObsHuaweiPayload,
  convertObsCapacityToGb,
  convertObsRequestInputToCount,
  estimateObsConfiguration,
  getObsRedundancyOptions,
  getObsStorageClassOptions,
  isObsCapacityUnit,
  isObsProductType,
  isObsRedundancy,
  isObsRestorationType,
  isObsStorageClass,
  listObsProductTypes,
  listObsRedundancies,
  listObsRestorationTypes,
  listObsStorageClasses,
  normalizeObsPositiveNumber,
  obsCapacityUnits,
  obsPricingReference,
  obsRequestInputMultiplier,
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
  eipDedicatedChargeModeOptions,
  eipDefaults,
  eipPricingReference,
  eipSharedBandwidthMinimumMbit,
  eipSharedChargeModeOptions,
  eipSharedEnhanced95MinimumMbit,
  eipTrafficUnitOptions,
  estimateEipConfiguration,
  type EipChargeMode,
  type EipPricingCatalog,
} from "@/lib/eip-catalog";
import {
  elbDefaults,
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
  type ElbFixedSpecName,
  type ElbPricingCatalog,
  type ElbProtocolSectionInput,
} from "@/lib/elb-catalog";
import {
  cceDefaults,
  ccePricingReference,
  estimateCceConfiguration,
  getFallbackCcePricingCatalog,
  listCceClusterScales,
  listCceMasterNodes,
  type CcePricingCatalog,
} from "@/lib/cce-catalog";
import {
  dcsDefaults,
  dcsPricingReference,
  estimateDcsConfiguration,
  isDcsArchitecture,
  isDcsBandwidthMode,
  isDcsInstanceType,
  isDcsVersion,
  listDcsArchitectures,
  listDcsInstanceTypes,
  listDcsReplicas,
  listDcsSpecifications,
  listDcsVersions,
  type DcsArchitecture,
  type DcsInstanceType,
  type DcsPricingCatalog,
  type DcsVersion,
} from "@/lib/dcs-catalog";
import {
  estimateNatConfiguration,
  getFallbackNatPricingCatalog,
  listNatGatewaySizes,
  listNatGatewayTypes,
  natDefaults,
  natPricingReference,
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
  type VpnPricingCatalog,
} from "@/lib/vpn-catalog";
import {
  estimateWorkspaceConfiguration,
  isWorkspaceCpuOption,
  isWorkspaceDiskType,
  isWorkspaceMemoryOption,
  listWorkspaceCpuOptions,
  listWorkspaceDiskTypes,
  listWorkspaceMemoryOptions,
  workspaceDefaults,
  workspacePricingReference,
  type WorkspaceCpuOption,
  type WorkspaceDiskType,
  type WorkspaceMemoryOption,
  type WorkspacePricingCatalog,
} from "@/lib/workspace-catalog";
import { getCalculatorRuntimeMeta } from "@/lib/calculator-runtime-registry";
import {
  formatFlavorAmount,
  getDiskPriceForBillingOption,
  type AppProduct,
  type BillingOption,
  type DiskPricing,
  type ProductMutationBody,
} from "@/lib/calculator-page-helpers";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import {
  getConfigurableServiceDefinitionByCode,
  type ServiceDefinition,
} from "@/lib/service-config";
import {
  buildEvsProductMutationBodies,
  buildEvsSplitNotice,
  ecsDiskSizeBounds,
  evsDiskSizeBounds,
  formatObsRequestInputValue,
  getGpSsd2IopsBounds,
  getGpSsd2RequestedIops,
  getGpSsd2RequestedThroughput,
  getGpSsd2ThroughputBounds,
  getObsRequestUnits,
  gpSsd2IopsBounds,
  normalizeGpSsd2Iops,
  normalizeGpSsd2Throughput,
  normalizeObsDefinitionDefaults,
  normalizeObsFieldDependencies,
  obsStorageSizeBounds,
  systemDiskOptions,
  type SystemDiskOption,
} from "@/lib/configurable-runtime-utils";

type ConfigurablePanelProps = ComponentProps<typeof ConfigurableServicePanel>;

type CatalogDataByService = Partial<{
  EVS: DiskPricing<SystemDiskOption> | null;
  OBS: ObsPricingCatalog | null;
  EIP: EipPricingCatalog | null;
  ELB: ElbPricingCatalog | null;
  DCS: DcsPricingCatalog | null;
  NAT: NatPricingCatalog | null;
  VPN: VpnPricingCatalog | null;
  CCE: CcePricingCatalog | null;
  ModelArts: ModelArtsPricingCatalog | null;
  Workspace: WorkspacePricingCatalog | null;
}>;

type UseConfigurableServiceRuntimeInput = {
  selectedServiceCode: string;
  selectedService: string;
  selectedServiceDefinition: ServiceDefinition | null;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  setBillingMode: (value: BillingOption) => void;
  usageHours: string;
  usageHoursValue: number;
  updateUsageHours: (value: string) => void;
  instanceCountValue: number;
};

type EditHydrationResult = {
  handled: boolean;
  error?: string;
  nextRegion?: HuaweiRegionKey;
  nextBillingMode?: BillingOption;
  nextUsageHours?: string;
  nextInstanceCount?: string;
};

type BatchSnapshot = {
  obs: {
    catalog: ObsPricingCatalog | null;
    catalogRegionId: string | null;
    productType: ObsProductType;
    storageClass: ObsStorageClass;
    redundancy: ObsRedundancy;
    storageSizeValue: number;
    storageUnit: ObsCapacityUnit;
    durationMonthsValue: number;
    outboundTrafficValue: number;
    outboundTrafficUnit: ObsCapacityUnit;
    readRequestsValue: number;
    writeRequestsValue: number;
    deleteRequestsValue: number;
    pullTrafficValue: number;
    pullTrafficUnit: ObsCapacityUnit;
    restorationType: ObsRestorationType | null;
    readTrafficValue: number;
    readTrafficUnit: ObsCapacityUnit;
    replicationTrafficValue: number;
    replicationTrafficUnit: ObsCapacityUnit;
    lifecycleTransitionRequestsValue: number;
  };
  evs: {
    diskPricing: DiskPricing<SystemDiskOption> | null;
    diskType: SystemDiskOption;
    diskSizeValue: number;
    durationMonthsValue: number;
    requestedIops: number | null;
    requestedThroughput: number | null;
  };
};

type UseConfigurableServiceRuntimeResult = {
  isConfigurableService: boolean;
  activeBillingOptions: BillingOption[] | null;
  panelProps: ConfigurablePanelProps | null;
  selectedEstimate: string;
  quantityLabel: string;
  showGlobalQuantityControl: boolean;
  showSharedUsageHours: boolean;
  addToListError: string | null;
  buildRequestBodies: () => ProductMutationBody | ProductMutationBody[] | null;
  applyDefaultsForServiceCode: (serviceCode: string) => void;
  hydrateProduct: (product: AppProduct) => EditHydrationResult;
  batchSnapshot: BatchSnapshot;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyConfigValue(value: unknown) {
  if (value == null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function isCheckedFieldValue(value: unknown) {
  return value === true || value === "true" || value === "Enabled";
}

function clampNumberString(value: string, minimum: number, maximum?: number, integer = false) {
  if (value === "") {
    return "";
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(minimum);
  }

  const rounded = integer ? Math.floor(parsed) : parsed;
  const bounded = maximum != null ? Math.min(maximum, Math.max(minimum, rounded)) : Math.max(minimum, rounded);
  return String(bounded);
}

function toBillingMode(value: unknown, fallback: BillingOption): BillingOption {
  return value === "RI" || value === "Yearly/Monthly" || value === "Pay-per-use" ? value : fallback;
}

function buildDefaultValues(definition: ServiceDefinition) {
  const values: Record<string, string> = {};
  for (const field of definition.fields) {
    values[field.id] = stringifyConfigValue(definition.defaults[field.id]);
  }

  switch (definition.serviceCode) {
    case "EVS": {
      const diskSize = Number(definition.defaults.diskSizeGiB);
      const normalizedDiskSize = Number.isFinite(diskSize) ? Math.max(evsDiskSizeBounds.min, Math.floor(diskSize)) : evsDiskSizeBounds.min;
      const iops = normalizeGpSsd2Iops(definition.defaults.iops, normalizedDiskSize);
      values.billingMode = stringifyConfigValue(definition.defaults.billingMode || definition.billingOptions[0] || "Pay-per-use");
      values.diskType = typeof definition.defaults.diskType === "string" ? definition.defaults.diskType : "General Purpose SSD";
      values.diskSizeGiB = String(normalizedDiskSize);
      values.usageHours = clampNumberString(stringifyConfigValue(definition.defaults.usageHours), 1, 87600, true) || "744";
      values.durationMonths = clampNumberString(stringifyConfigValue(definition.defaults.durationMonths), 1, 360, true) || "1";
      values.iops = String(iops);
      values.throughput = String(normalizeGpSsd2Throughput(definition.defaults.throughput, iops));
      break;
    }
    case "OBS": {
      const normalized = normalizeObsDefinitionDefaults(definition.defaults);
      values.productType = normalized.productType;
      values.storageClass = normalized.storageClass;
      values.redundancy = normalized.redundancy;
      values.storageAmount = String(Math.max(obsStorageSizeBounds.min, Number(definition.defaults.storageAmount) || obsStorageSizeBounds.min));
      values.storageUnit = normalized.storageUnit;
      values.durationMonths = clampNumberString(stringifyConfigValue(definition.defaults.durationMonths), 1, undefined, true) || "1";
      values.outboundTrafficAmount = String(Math.max(0, Number(definition.defaults.outboundTrafficAmount) || 0));
      values.outboundTrafficUnit = normalized.outboundTrafficUnit;
      values.readRequests = String(Math.max(0, Number(definition.defaults.readRequests) || 0));
      values.writeRequests = String(Math.max(0, Number(definition.defaults.writeRequests) || 0));
      values.deleteRequests = String(Math.max(0, Number(definition.defaults.deleteRequests) || 0));
      values.pullTrafficAmount = String(Math.max(0, Number(definition.defaults.pullTrafficAmount) || 0));
      values.pullTrafficUnit = normalized.pullTrafficUnit;
      values.restorationType = normalized.restorationType ?? "";
      values.readTrafficAmount = String(Math.max(0, Number(definition.defaults.readTrafficAmount) || 0));
      values.readTrafficUnit = normalized.readTrafficUnit;
      values.replicationTrafficAmount = String(Math.max(0, Number(definition.defaults.replicationTrafficAmount) || 0));
      values.replicationTrafficUnit = normalized.replicationTrafficUnit;
      values.lifecycleTransitionRequests = String(Math.max(0, Number(definition.defaults.lifecycleTransitionRequests) || 0));
      break;
    }
    case "EIP":
      values.type = definition.defaults.type === "Shared EIP" ? "Shared EIP" : "Dedicated EIP";
      values.chargeMode =
        definition.defaults.chargeMode === "By traffic" || definition.defaults.chargeMode === "Enhanced 95"
          ? definition.defaults.chargeMode
          : "By bandwidth";
      values.bandwidthMbit = String(Math.max(0, Number(definition.defaults.bandwidthMbit) || eipDefaults.bandwidthMbit));
      values.enhanced95DurationMonths = clampNumberString(stringifyConfigValue(definition.defaults.enhanced95DurationMonths), 1, undefined, true) || "1";
      values.sharedBandwidthQuantity = clampNumberString(stringifyConfigValue(definition.defaults.sharedBandwidthQuantity), 1, undefined, true) || "1";
      values.trafficAmount = String(Math.max(0, Number(definition.defaults.trafficAmount) || 0));
      values.trafficUnit = definition.defaults.trafficUnit === "TB" ? "TB" : "GB";
      break;
    case "ELB":
      values.type = definition.defaults.type === "Dedicated load balancer" ? "Dedicated load balancer" : "Shared load balancer";
      values.networkType = definition.defaults.networkType === "Private network" ? "Private network" : "Public network";
      values.sharedChargeMode = definition.defaults.sharedChargeMode === "By bandwidth" ? "By bandwidth" : "By traffic";
      values.usageHours = clampNumberString(stringifyConfigValue(definition.defaults.usageHours), 1, 87600, true) || "744";
      values.sharedBandwidthMbit = clampNumberString(stringifyConfigValue(definition.defaults.sharedBandwidthMbit), 0) || String(elbDefaults.sharedBandwidthMbit);
      values.sharedTrafficAmount = clampNumberString(stringifyConfigValue(definition.defaults.sharedTrafficAmount), 0) || String(elbDefaults.sharedTrafficGb);
      values.sharedTrafficUnit = definition.defaults.sharedTrafficUnit === "TB" ? "TB" : "GB";
      values.specificationType = definition.defaults.specificationType === "Elastic" ? "Elastic" : "Fixed";
      values.fixedAvailabilityAzCount = clampNumberString(stringifyConfigValue(definition.defaults.fixedAvailabilityAzCount), 1, undefined, true) || String(elbDefaults.fixedAvailabilityAzCount);
      values.fixedNetworkEnabled = isCheckedFieldValue(definition.defaults.fixedNetworkEnabled) ? "true" : "false";
      values.fixedNetworkSpec =
        typeof definition.defaults.fixedNetworkSpec === "string" && (elbFixedSpecOptions as readonly string[]).includes(definition.defaults.fixedNetworkSpec)
          ? definition.defaults.fixedNetworkSpec
          : "Small I";
      values.fixedApplicationEnabled = isCheckedFieldValue(definition.defaults.fixedApplicationEnabled) ? "true" : "false";
      values.fixedApplicationSpec =
        typeof definition.defaults.fixedApplicationSpec === "string" && (elbFixedSpecOptions as readonly string[]).includes(definition.defaults.fixedApplicationSpec)
          ? definition.defaults.fixedApplicationSpec
          : "Small I";

      for (const protocol of ["tcp", "udp", "tls", "http"] as const) {
        values[`${protocol}Enabled`] = isCheckedFieldValue(definition.defaults[`${protocol}Enabled`]) ? "true" : "false";
        values[`${protocol}NewConnections`] = clampNumberString(stringifyConfigValue(definition.defaults[`${protocol}NewConnections`]), 0) || "0";
        values[`${protocol}MaxConcurrentConnections`] = clampNumberString(stringifyConfigValue(definition.defaults[`${protocol}MaxConcurrentConnections`]), 0) || "0";
        values[`${protocol}MetricMode`] = definition.defaults[`${protocol}MetricMode`] === "By bandwidth" ? "By bandwidth" : "By traffic";
        values[`${protocol}ProcessedTrafficGbPerHour`] = clampNumberString(stringifyConfigValue(definition.defaults[`${protocol}ProcessedTrafficGbPerHour`]), 0) || "0";
        values[`${protocol}AverageBandwidthMbit`] = clampNumberString(stringifyConfigValue(definition.defaults[`${protocol}AverageBandwidthMbit`]), 0) || "0";
      }
      values.httpQueriesPerSecond = clampNumberString(stringifyConfigValue(definition.defaults.httpQueriesPerSecond), 0) || "0";
      values.httpForwardingRules = clampNumberString(stringifyConfigValue(definition.defaults.httpForwardingRules), 0) || "0";
      break;
    case "NAT":
      values.natType = definition.defaults.natType === "Private NAT Gateway" ? "Private NAT Gateway" : "Public NAT Gateway";
      values.natSize =
        definition.defaults.natSize === "Medium"
          || definition.defaults.natSize === "Large"
          || definition.defaults.natSize === "Extra-large"
          ? definition.defaults.natSize
          : "Small";
      break;
    case "VPN":
      values.edition = definition.defaults.edition === "Enterprise" ? "Enterprise" : "Classic";
      values.mode = definition.defaults.mode === "Point-to-Cloud" ? "Point-to-Cloud" : "Site-to-Cloud";
      values.networkType = definition.defaults.networkType === "Private network" ? "Private network" : "Public network";
      values.useSharedBandwidth = definition.defaults.useSharedBandwidth === "Yes" ? "Yes" : "No";
      values.eipBandwidthMbit1 = String(Math.max(0, Number(definition.defaults.eipBandwidthMbit1) || vpnDefaults.eipBandwidthMbit1));
      values.eipBandwidthMbit2 = String(Math.max(0, Number(definition.defaults.eipBandwidthMbit2) || vpnDefaults.eipBandwidthMbit2));
      values.durationMonths = clampNumberString(stringifyConfigValue(definition.defaults.durationMonths), 1, undefined, true) || "1";
      values.specification = typeof definition.defaults.specification === "string" ? definition.defaults.specification : "Basic";
      break;
    case "CCE":
      values.clusterScale =
        definition.defaults.clusterScale === "200 nodes"
          || definition.defaults.clusterScale === "1000 nodes"
          || definition.defaults.clusterScale === "2000 nodes"
          ? definition.defaults.clusterScale
          : "50 nodes";
      values.masterNodes = definition.defaults.masterNodes === "Single" ? "Single" : "3 Masters";
      break;
    case "CCI":
      values.cpu = clampNumberString(stringifyConfigValue(definition.defaults.cpu), 1, undefined, true) || "1";
      values.memoryGiB = clampNumberString(stringifyConfigValue(definition.defaults.memoryGiB), 1, undefined, true) || "1";
      break;
    case "ModelArts":
      values.serviceType = "AI Development Lifecycle";
      values.resourceType = isModelArtsResourceType(definition.defaults.resourceType) ? definition.defaults.resourceType : modelArtsDefaults.resourceType;
      values.specification = typeof definition.defaults.specification === "string" ? definition.defaults.specification : modelArtsDefaults.specification;
      values.quantity = clampNumberString(stringifyConfigValue(definition.defaults.quantity), 1, undefined, true) || String(modelArtsDefaults.quantity);
      values.storageQuotaGb = clampNumberString(stringifyConfigValue(definition.defaults.storageQuotaGb), 1) || String(modelArtsDefaults.storageQuotaGb);
      values.usageHours = clampNumberString(stringifyConfigValue(definition.defaults.usageHours), 1, 87600, true) || String(modelArtsDefaults.usageHours);
      values.durationMonths = String(
        isModelArtsDurationMonths(Number(definition.defaults.durationMonths)) ? Number(definition.defaults.durationMonths) : modelArtsDefaults.durationMonths,
      );
      break;
    case "Workspace":
      values.architecture = "x86 desktop";
      values.specification = "Ultimate";
      values.cpu = isWorkspaceCpuOption(definition.defaults.cpu) ? definition.defaults.cpu : workspaceDefaults.cpu;
      values.memory = isWorkspaceMemoryOption(definition.defaults.memory) ? definition.defaults.memory : workspaceDefaults.memory;
      values.cpuUsageHours = clampNumberString(stringifyConfigValue(definition.defaults.cpuUsageHours), 1, 87600, true) || String(workspaceDefaults.cpuUsageHours);
      values.diskType = isWorkspaceDiskType(definition.defaults.diskType) ? definition.defaults.diskType : workspaceDefaults.diskType;
      values.diskSizeGb = clampNumberString(stringifyConfigValue(definition.defaults.diskSizeGb), 80, 32760, true) || String(workspaceDefaults.diskSizeGb);
      values.diskUsageHours = clampNumberString(stringifyConfigValue(definition.defaults.diskUsageHours), 1, 87600, true) || String(workspaceDefaults.diskUsageHours);
      values.quantity = clampNumberString(stringifyConfigValue(definition.defaults.quantity), 1, undefined, true) || String(workspaceDefaults.quantity);
      break;
    case "DCS":
      values.edition = "Basic";
      values.version = isDcsVersion(definition.defaults.version) ? definition.defaults.version : dcsDefaults.version;
      values.instanceType = isDcsInstanceType(definition.defaults.instanceType) ? definition.defaults.instanceType : dcsDefaults.instanceType;
      values.architecture = isDcsArchitecture(definition.defaults.architecture) ? definition.defaults.architecture : dcsDefaults.architecture;
      values.replicas = clampNumberString(stringifyConfigValue(definition.defaults.replicas), 1, undefined, true) || String(dcsDefaults.replicas);
      values.specification = typeof definition.defaults.specification === "string" ? definition.defaults.specification : dcsDefaults.specification;
      values.quantity = clampNumberString(stringifyConfigValue(definition.defaults.quantity), 1, undefined, true) || String(dcsDefaults.quantity);
      values.elasticBandwidth = isDcsBandwidthMode(definition.defaults.elasticBandwidth) ? definition.defaults.elasticBandwidth : dcsDefaults.elasticBandwidth;
      values.bandwidthMbit = clampNumberString(stringifyConfigValue(definition.defaults.bandwidthMbit), 1, undefined, true) || String(dcsDefaults.bandwidthMbit);
      values.usageHours = clampNumberString(stringifyConfigValue(definition.defaults.usageHours), 1, 87600, true) || String(dcsDefaults.usageHours);
      break;
  }

  return values;
}

function readProductRegion(product: AppProduct, fallback: HuaweiRegionKey) {
  if (!isRecord(product.config)) {
    return fallback;
  }
  return typeof product.config.region === "string" && product.config.region in huaweiRegions
    ? (product.config.region as HuaweiRegionKey)
    : fallback;
}

export function useConfigurableServiceRuntime({
  selectedServiceCode,
  selectedService,
  selectedServiceDefinition,
  regionValue,
  billingMode,
  setBillingMode,
  usageHours,
  usageHoursValue,
  updateUsageHours,
  instanceCountValue,
}: UseConfigurableServiceRuntimeInput): UseConfigurableServiceRuntimeResult {
  const [serviceValuesByCode, setServiceValuesByCode] = useState<Record<string, Record<string, string>>>({});
  const [catalogDataByService, setCatalogDataByService] = useState<CatalogDataByService>({});
  const [catalogRegionIdByService, setCatalogRegionIdByService] = useState<Partial<Record<string, string | null>>>({});
  const [pricingLoadingByService, setPricingLoadingByService] = useState<Partial<Record<string, boolean>>>({});
  const [pricingErrorByService, setPricingErrorByService] = useState<Partial<Record<string, string>>>({});

  const runtimeMeta = getCalculatorRuntimeMeta(selectedServiceCode);
  const isConfigurableService = selectedServiceDefinition?.implementation === "configurable" || selectedServiceDefinition?.implementation === "config-pilot";

  const replaceServiceValues = useCallback((serviceCode: string, values: Record<string, string>) => {
    setServiceValuesByCode((current) => ({ ...current, [serviceCode]: values }));
  }, []);

  const updateSelectedServiceValues = useCallback((updater: (current: Record<string, string>) => Record<string, string>) => {
    if (!selectedServiceDefinition) {
      return;
    }

    setServiceValuesByCode((current) => {
      const existing = current[selectedServiceCode] ?? buildDefaultValues(selectedServiceDefinition);
      const next = updater(existing);
      if (Object.keys(next).every((key) => next[key] === existing[key]) && Object.keys(existing).every((key) => existing[key] === next[key])) {
        return current;
      }
      return { ...current, [selectedServiceCode]: next };
    });
  }, [selectedServiceCode, selectedServiceDefinition]);

  useEffect(() => {
    if (!selectedServiceDefinition) {
      return;
    }

    setServiceValuesByCode((current) => {
      if (current[selectedServiceCode]) {
        return current;
      }
      return { ...current, [selectedServiceCode]: buildDefaultValues(selectedServiceDefinition) };
    });
  }, [selectedServiceCode, selectedServiceDefinition]);

  const activeValues = useMemo(
    () => selectedServiceDefinition ? (serviceValuesByCode[selectedServiceCode] ?? buildDefaultValues(selectedServiceDefinition)) : {},
    [selectedServiceCode, selectedServiceDefinition, serviceValuesByCode],
  );

  const applyDefaultsForServiceCode = useCallback((serviceCode: string) => {
    const definition = getConfigurableServiceDefinitionByCode(serviceCode);
    if (!definition) {
      return;
    }

    const nextValues = buildDefaultValues(definition);
    replaceServiceValues(serviceCode, nextValues);
    const nextBillingMode = toBillingMode(nextValues.billingMode || definition.billingOptions[0], definition.billingOptions[0] ?? "Pay-per-use");
    setBillingMode(nextBillingMode);
    if (typeof nextValues.usageHours === "string" && nextValues.usageHours) {
      updateUsageHours(nextValues.usageHours);
    } else if (nextBillingMode === "Pay-per-use") {
      updateUsageHours("744");
    }
  }, [replaceServiceValues, setBillingMode, updateUsageHours]);

  const evsDiskPricing = (catalogDataByService.EVS as DiskPricing<SystemDiskOption> | null | undefined) ?? null;
  const obsCatalog = (catalogDataByService.OBS as ObsPricingCatalog | null | undefined) ?? null;
  const eipCatalog = (catalogDataByService.EIP as EipPricingCatalog | null | undefined) ?? null;
  const elbCatalog = (catalogDataByService.ELB as ElbPricingCatalog | null | undefined) ?? null;
  const natCatalog = (catalogDataByService.NAT as NatPricingCatalog | null | undefined) ?? null;
  const vpnCatalog = (catalogDataByService.VPN as VpnPricingCatalog | null | undefined) ?? null;
  const cceCatalog = (catalogDataByService.CCE as CcePricingCatalog | null | undefined) ?? null;
  const modelArtsCatalog = (catalogDataByService.ModelArts as ModelArtsPricingCatalog | null | undefined) ?? null;
  const workspaceCatalog = (catalogDataByService.Workspace as WorkspacePricingCatalog | null | undefined) ?? null;
  const dcsCatalog = (catalogDataByService.DCS as DcsPricingCatalog | null | undefined) ?? null;

  useEffect(() => {
    if (!isConfigurableService) {
      return;
    }

    let cancelled = false;

    async function loadCatalog() {
      const setLoading = (value: boolean) => setPricingLoadingByService((current) => ({ ...current, [selectedServiceCode]: value }));
      const setError = (value: string) => setPricingErrorByService((current) => ({ ...current, [selectedServiceCode]: value }));
      const setCatalogRegionId = (value: string | null) => setCatalogRegionIdByService((current) => ({ ...current, [selectedServiceCode]: value }));
      const setCatalogData = (value: unknown) => setCatalogDataByService((current) => ({ ...current, [selectedServiceCode]: value }));

      if (selectedServiceCode === "CCI") {
        setLoading(false);
        setError("");
        setCatalogRegionId(null);
        return;
      }

      setLoading(true);
      setError("");

      try {
        if (selectedServiceCode === "EVS") {
          const response = await fetch(`/api/catalog/evs-pricing?region=${encodeURIComponent(regionValue)}`, { cache: "no-store" });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as { diskPricing?: DiskPricing<SystemDiskOption> | null; error?: string };
          if (!response.ok || !payload.diskPricing) {
            throw new Error(payload.error ?? "Failed to load EVS pricing");
          }
          if (cancelled) return;
          setCatalogData(payload.diskPricing);
          setCatalogRegionId(null);
          return;
        }

        const routeByService: Partial<Record<string, string>> = {
          OBS: "obs-pricing",
          EIP: "eip-pricing",
          ELB: "elb-pricing",
          DCS: "dcs-pricing",
          NAT: "nat-pricing",
          VPN: "vpn-pricing",
          CCE: "cce-pricing",
          ModelArts: "modelarts-pricing",
          Workspace: "workspace-pricing",
        };
        const route = routeByService[selectedServiceCode];
        if (!route) {
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/catalog/${route}?region=${encodeURIComponent(regionValue)}`, { cache: "no-store" });
        const rawBody = await response.text();
        const payload = (rawBody ? JSON.parse(rawBody) : {}) as { catalog?: unknown; catalogRegionId?: string | null; error?: string };

        if (!response.ok || !payload.catalog) {
          throw new Error(payload.error ?? `Failed to load ${selectedServiceCode} pricing`);
        }

        if (cancelled) return;
        setCatalogData(payload.catalog);
        setCatalogRegionId(payload.catalogRegionId ?? null);
      } catch (error) {
        if (cancelled) return;
        setCatalogData(null);
        setCatalogRegionId(null);
        setError(error instanceof Error ? error.message : `Failed to load ${selectedServiceCode} pricing`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [isConfigurableService, regionValue, selectedServiceCode]);

  const obsProductType = isObsProductType(activeValues.productType) ? activeValues.productType : "Object storage";
  const obsStorageClass = isObsStorageClass(activeValues.storageClass) ? activeValues.storageClass : "Standard";
  const obsRedundancy = isObsRedundancy(activeValues.redundancy) ? activeValues.redundancy : "Single-AZ storage";
  const obsStorageSizeValue = normalizeObsPositiveNumber(activeValues.storageAmount, obsStorageSizeBounds.min, obsStorageSizeBounds.min);
  const obsStorageUnit = isObsCapacityUnit(activeValues.storageUnit) ? activeValues.storageUnit : "GB";
  const obsDurationMonthsValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.durationMonths, 1, 1)));
  const obsOutboundTrafficValue = normalizeObsPositiveNumber(activeValues.outboundTrafficAmount, 0, 0);
  const obsOutboundTrafficUnit = isObsCapacityUnit(activeValues.outboundTrafficUnit) ? activeValues.outboundTrafficUnit : "GB";
  const obsReadRequestsValue = normalizeObsPositiveNumber(activeValues.readRequests, 0, 0);
  const obsWriteRequestsValue = normalizeObsPositiveNumber(activeValues.writeRequests, 0, 0);
  const obsDeleteRequestsValue = normalizeObsPositiveNumber(activeValues.deleteRequests, 0, 0);
  const obsPullTrafficValue = normalizeObsPositiveNumber(activeValues.pullTrafficAmount, 0, 0);
  const obsPullTrafficUnit = isObsCapacityUnit(activeValues.pullTrafficUnit) ? activeValues.pullTrafficUnit : "GB";
  const obsRestorationType = isObsRestorationType(activeValues.restorationType) ? activeValues.restorationType : null;
  const obsReadTrafficValue = normalizeObsPositiveNumber(activeValues.readTrafficAmount, 0, 0);
  const obsReadTrafficUnit = isObsCapacityUnit(activeValues.readTrafficUnit) ? activeValues.readTrafficUnit : "GB";
  const obsReplicationTrafficValue = normalizeObsPositiveNumber(activeValues.replicationTrafficAmount, 0, 0);
  const obsReplicationTrafficUnit = isObsCapacityUnit(activeValues.replicationTrafficUnit) ? activeValues.replicationTrafficUnit : "GB";
  const obsLifecycleTransitionRequestsValue = normalizeObsPositiveNumber(activeValues.lifecycleTransitionRequests, 0, 0);
  const obsProductTypeOptions = useMemo(
    () => (obsCatalog ? listObsProductTypes(obsCatalog) : (["Object storage", "Parallel file system"] as ObsProductType[])),
    [obsCatalog],
  );
  const obsStorageClassOptions = useMemo(
    () => (obsCatalog ? listObsStorageClasses(obsCatalog, obsProductType) : getObsStorageClassOptions(obsProductType)),
    [obsCatalog, obsProductType],
  );
  const obsRedundancyOptions = useMemo(
    () => (obsCatalog ? listObsRedundancies(obsCatalog, obsProductType, obsStorageClass) : getObsRedundancyOptions(obsProductType, obsStorageClass)),
    [obsCatalog, obsProductType, obsStorageClass],
  );
  const obsRestorationTypeOptions = useMemo(() => listObsRestorationTypes(obsStorageClass), [obsStorageClass]);
  const showObsReplicationTraffic =
    obsProductType === "Object storage" && (obsStorageClass === "Standard" || obsStorageClass === "Infrequent Access");
  const showObsPullTraffic = shouldShowObsPullTraffic(obsProductType);
  const normalizedObsDependencies = useMemo(
    () => normalizeObsFieldDependencies({ productType: obsProductType, storageClass: obsStorageClass, redundancy: obsRedundancy, restorationType: obsRestorationType }),
    [obsProductType, obsRedundancy, obsRestorationType, obsStorageClass],
  );

  const eipType = activeValues.type === "Shared EIP" ? "Shared EIP" : "Dedicated EIP";
  const eipChargeModeOptions: readonly EipChargeMode[] = eipType === "Shared EIP" ? eipSharedChargeModeOptions : eipDedicatedChargeModeOptions;
  const eipChargeMode =
    activeValues.chargeMode === "By traffic" || activeValues.chargeMode === "Enhanced 95"
      ? activeValues.chargeMode
      : "By bandwidth";
  const showEipBandwidth = eipChargeMode === "By bandwidth" || eipChargeMode === "Enhanced 95";
  const showEipTraffic = eipType === "Dedicated EIP" && eipChargeMode === "By traffic";
  const showEipEnhanced95DurationMonths = eipType === "Shared EIP" && eipChargeMode === "Enhanced 95";
  const showEipSharedBandwidthQuantity = eipType === "Shared EIP" && eipChargeMode === "By bandwidth";
  const eipBandwidthMinimumMbit = eipType === "Shared EIP"
    ? (eipChargeMode === "Enhanced 95" ? eipSharedEnhanced95MinimumMbit : eipSharedBandwidthMinimumMbit)
    : 1;
  const eipBandwidthMbitValue = showEipBandwidth
    ? Math.max(eipBandwidthMinimumMbit, normalizeObsPositiveNumber(activeValues.bandwidthMbit, eipBandwidthMinimumMbit, 0))
    : 0;
  const eipEnhanced95DurationMonthsValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.enhanced95DurationMonths, 1, 1)));
  const eipSharedBandwidthQuantityValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.sharedBandwidthQuantity, 1, 1)));
  const eipTrafficAmountValue = normalizeObsPositiveNumber(activeValues.trafficAmount, 0, 0);
  const eipTrafficUnit = activeValues.trafficUnit === "TB" ? "TB" : "GB";

  const elbType = activeValues.type === "Dedicated load balancer" ? "Dedicated load balancer" : "Shared load balancer";
  const elbSpecificationType = activeValues.specificationType === "Elastic" ? "Elastic" : "Fixed";
  const elbNetworkType = activeValues.networkType === "Private network" ? "Private network" : "Public network";
  const elbSharedChargeMode = activeValues.sharedChargeMode === "By bandwidth" ? "By bandwidth" : "By traffic";
  const elbSharedBandwidthMbitValue = normalizeObsPositiveNumber(activeValues.sharedBandwidthMbit, 0, 0);
  const elbSharedTrafficAmountValue = normalizeObsPositiveNumber(activeValues.sharedTrafficAmount, 0, 0);
  const elbSharedTrafficUnit = activeValues.sharedTrafficUnit === "TB" ? "TB" : "GB";
  const elbFixedAvailabilityAzCountOptions = useMemo(() => {
    const rateSet = elbCatalog?.dedicatedRates.fixed[elbDefaults.subAz];
    if (!rateSet) {
      return [String(elbDefaults.fixedAvailabilityAzCount)];
    }

    const values = Object.keys(rateSet)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right)
      .map(String);

    return values.length > 0 ? values : [String(elbDefaults.fixedAvailabilityAzCount)];
  }, [elbCatalog]);
  const elbFixedAvailabilityAzCount = Number.isFinite(Number(activeValues.fixedAvailabilityAzCount))
    ? Math.max(1, Math.floor(Number(activeValues.fixedAvailabilityAzCount)))
    : Number(elbFixedAvailabilityAzCountOptions[0] ?? elbDefaults.fixedAvailabilityAzCount);
  const elbFixedNetworkEnabled = isCheckedFieldValue(activeValues.fixedNetworkEnabled);
  const elbFixedApplicationEnabled = isCheckedFieldValue(activeValues.fixedApplicationEnabled);
  const elbFixedNetworkSpec: ElbFixedSpecName =
    typeof activeValues.fixedNetworkSpec === "string" && (elbFixedSpecOptions as readonly string[]).includes(activeValues.fixedNetworkSpec)
      ? (activeValues.fixedNetworkSpec as ElbFixedSpecName)
      : elbDefaults.fixedTypeSpecs["Network load balancing (TCP/UDP/TLS)"];
  const elbFixedApplicationSpec: ElbFixedSpecName =
    typeof activeValues.fixedApplicationSpec === "string" && (elbFixedSpecOptions as readonly string[]).includes(activeValues.fixedApplicationSpec)
      ? (activeValues.fixedApplicationSpec as ElbFixedSpecName)
      : elbDefaults.fixedTypeSpecs["Application load balancing (HTTP/HTTPS)"];
  const showElbSharedChargeMode = shouldShowElbSharedChargeMode(elbType, elbNetworkType);
  const showElbSharedBandwidth = shouldShowElbSharedBandwidth(elbType, elbNetworkType, elbSharedChargeMode);
  const showElbSharedTraffic = shouldShowElbSharedTraffic(elbType, elbNetworkType, elbSharedChargeMode);
  const elbProtocols = useMemo(() => {
    const protocolFieldIds: Array<{ protocol: ElbDedicatedProtocol; prefix: "tcp" | "udp" | "tls" | "http" }> = [
      { protocol: "Network load balancing (TCP)", prefix: "tcp" },
      { protocol: "Network load balancing (UDP)", prefix: "udp" },
      { protocol: "Network load balancing (TLS)", prefix: "tls" },
      { protocol: "Application load balancing (HTTP/HTTPS)", prefix: "http" },
    ];

    return protocolFieldIds.map(({ protocol, prefix }) => {
      const enabled = isCheckedFieldValue(activeValues[`${prefix}Enabled`]);
      const metricMode = activeValues[`${prefix}MetricMode`] === "By bandwidth" ? "By bandwidth" : "By traffic";
      const input: ElbProtocolSectionInput = {
        newConnections: normalizeObsPositiveNumber(activeValues[`${prefix}NewConnections`], 0, 0),
        maxConcurrentConnections: normalizeObsPositiveNumber(activeValues[`${prefix}MaxConcurrentConnections`], 0, 0),
        metricMode,
        processedTrafficGbPerHour: normalizeObsPositiveNumber(activeValues[`${prefix}ProcessedTrafficGbPerHour`], 0, 0),
        averageBandwidthMbit: normalizeObsPositiveNumber(activeValues[`${prefix}AverageBandwidthMbit`], 0, 0),
        queriesPerSecond: prefix === "http" ? normalizeObsPositiveNumber(activeValues.httpQueriesPerSecond, 0, 0) : 0,
        forwardingRules: prefix === "http" ? normalizeObsPositiveNumber(activeValues.httpForwardingRules, 0, 0) : 0,
      };

      return { protocol, prefix, enabled, input };
    });
  }, [activeValues]);
  const elbSelectedProtocols = useMemo(
    () => elbProtocols.filter((entry) => entry.enabled).map((entry) => entry.protocol),
    [elbProtocols],
  );
  const elbProtocolInputs = useMemo(
    () =>
      Object.fromEntries(elbProtocols.map((entry) => [entry.protocol, entry.input])) as Partial<Record<ElbDedicatedProtocol, ElbProtocolSectionInput>>,
    [elbProtocols],
  );
  const selectedElbInput = useMemo(
    () => ({
      type: elbType,
      specificationType: elbSpecificationType,
      subAz: elbDefaults.subAz,
      fixedAvailabilityAzCount: elbFixedAvailabilityAzCount,
      fixedSelectedTypes: elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed"
        ? [
            ...(elbFixedNetworkEnabled ? (["Network load balancing (TCP/UDP/TLS)"] as const) : []),
            ...(elbFixedApplicationEnabled ? (["Application load balancing (HTTP/HTTPS)"] as const) : []),
          ]
        : [],
      fixedTypeSpecs: {
        "Network load balancing (TCP/UDP/TLS)": elbFixedNetworkSpec,
        "Application load balancing (HTTP/HTTPS)": elbFixedApplicationSpec,
      },
      selectedProtocols: elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? elbSelectedProtocols : [],
      protocolInputs: elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? elbProtocolInputs : {},
      networkType: elbNetworkType,
      billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
      sharedDurationHours: usageHoursValue,
      sharedChargeMode: elbSharedChargeMode,
      sharedTrafficAmount: showElbSharedTraffic ? elbSharedTrafficAmountValue : 0,
      sharedTrafficUnit: elbSharedTrafficUnit,
      sharedBandwidthMbit: showElbSharedBandwidth ? elbSharedBandwidthMbitValue : 0,
    } satisfies ElbEstimateInput),
    [
      billingMode,
      elbFixedApplicationEnabled,
      elbFixedApplicationSpec,
      elbFixedAvailabilityAzCount,
      elbFixedNetworkEnabled,
      elbFixedNetworkSpec,
      elbNetworkType,
      elbProtocolInputs,
      elbSelectedProtocols,
      elbSharedBandwidthMbitValue,
      elbSharedChargeMode,
      elbSharedTrafficAmountValue,
      elbSharedTrafficUnit,
      elbSpecificationType,
      elbType,
      showElbSharedBandwidth,
      showElbSharedTraffic,
      usageHoursValue,
    ],
  );

  const activeNatCatalog = natCatalog ?? getFallbackNatPricingCatalog();
  const natTypeOptions = useMemo(() => listNatGatewayTypes(activeNatCatalog), [activeNatCatalog]);
  const natType = activeValues.natType === "Private NAT Gateway" ? "Private NAT Gateway" : "Public NAT Gateway";
  const natSizeOptions = useMemo(() => listNatGatewaySizes(natType, activeNatCatalog), [activeNatCatalog, natType]);
  const natSize =
    activeValues.natSize === "Medium" || activeValues.natSize === "Large" || activeValues.natSize === "Extra-large"
      ? activeValues.natSize
      : "Small";

  const activeVpnCatalog = vpnCatalog ?? getFallbackVpnPricingCatalog();
  const vpnEditionOptionsToShow = useMemo(
    () => billingMode === "Yearly/Monthly" ? (["Enterprise"] as const) : vpnEditionOptions,
    [billingMode],
  );
  const vpnEdition = activeValues.edition === "Enterprise" ? "Enterprise" : "Classic";
  const vpnModeOptions = useMemo(
    () => listVpnModes(activeVpnCatalog, { billingMode: billingMode as VpnBillingMode, edition: vpnEdition }),
    [activeVpnCatalog, billingMode, vpnEdition],
  );
  const vpnMode = activeValues.mode === "Point-to-Cloud" ? "Point-to-Cloud" : "Site-to-Cloud";
  const vpnNetworkType = activeValues.networkType === "Private network" ? "Private network" : "Public network";
  const vpnSpecificationOptions = useMemo(() => listVpnSpecifications(vpnMode, activeVpnCatalog), [activeVpnCatalog, vpnMode]);
  const vpnSelectedSpecification = vpnEdition === "Classic"
    ? "Basic"
    : vpnSpecificationOptions[0] ?? (vpnMode === "Point-to-Cloud" ? "Professional 1" : "Professional 2");
  const showVpnPublicBandwidth = shouldShowVpnPublicBandwidth(vpnEdition, vpnNetworkType);
  const vpnUseSharedBandwidth = activeValues.useSharedBandwidth === "Yes";
  const vpnEipBandwidthMbit1 = activeValues.eipBandwidthMbit1 ?? String(vpnDefaults.eipBandwidthMbit1);
  const vpnEipBandwidthMbit2 = activeValues.eipBandwidthMbit2 ?? String(vpnDefaults.eipBandwidthMbit2);
  const vpnDurationMonths = activeValues.durationMonths ?? String(vpnDefaults.durationMonths);
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
  const vpnDescriptionNote = vpnEdition === "Classic"
    ? "Bandwidth: ≤ 100 Mbit/s | Connection groups: ≤ 10"
    : vpnSelectedSpecification === "Professional 2"
    ? "Bandwidth: ≤ 1 Gbit/s | Connection groups: ≤ 100"
    : "Bandwidth: ≤ 300 Mbit/s | Connection groups: ≤ 100";

  const activeCceCatalog = cceCatalog ?? getFallbackCcePricingCatalog();
  const cceClusterScaleOptions = useMemo(() => listCceClusterScales(activeCceCatalog), [activeCceCatalog]);
  const cceClusterScale =
    activeValues.clusterScale === "200 nodes" || activeValues.clusterScale === "1000 nodes" || activeValues.clusterScale === "2000 nodes"
      ? activeValues.clusterScale
      : "50 nodes";
  const cceMasterNodesOptions = useMemo(() => listCceMasterNodes(cceClusterScale, activeCceCatalog), [activeCceCatalog, cceClusterScale]);
  const cceMasterNodes = activeValues.masterNodes === "Single" ? "Single" : "3 Masters";

  const cciCpu = clampNumberString(activeValues.cpu ?? "1", 1, undefined, true) || "1";
  const cciMemory = clampNumberString(activeValues.memoryGiB ?? "1", 1, undefined, true) || "1";

  const modelArtsResourceTypeOptions = useMemo(
    () =>
      modelArtsCatalog
        ? listModelArtsResourceTypes(modelArtsCatalog, billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use")
        : billingMode === "Yearly/Monthly"
        ? (["Dedicated Resource Pool"] as ModelArtsResourceType[])
        : (["Public Resource Pool", "Dedicated Resource Pool", "EVS Storage"] as ModelArtsResourceType[]),
    [billingMode, modelArtsCatalog],
  );
  const modelArtsResourceType = isModelArtsResourceType(activeValues.resourceType) ? activeValues.resourceType : modelArtsDefaults.resourceType;
  const modelArtsSpecificationOptions = useMemo(
    () =>
      modelArtsCatalog
        ? listModelArtsSpecifications(
            modelArtsCatalog,
            {
              billingMode: billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
              resourceType: modelArtsResourceType,
            },
          )
        : [modelArtsDefaults.specification],
    [billingMode, modelArtsCatalog, modelArtsResourceType],
  );
  const modelArtsSpecification =
    typeof activeValues.specification === "string" && activeValues.specification.trim()
      ? activeValues.specification
      : modelArtsDefaults.specification;
  const modelArtsQuantityValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.quantity, 1, 1)));
  const modelArtsStorageQuotaValue = Math.max(1, normalizeObsPositiveNumber(activeValues.storageQuotaGb, 1, 1));
  const modelArtsDurationMonthsValue =
    Number.isFinite(Number(activeValues.durationMonths)) && isModelArtsDurationMonths(Number(activeValues.durationMonths))
      ? Number(activeValues.durationMonths)
      : modelArtsDefaults.durationMonths;

  const workspaceCpuOptions = useMemo(
    () => (workspaceCatalog ? listWorkspaceCpuOptions(workspaceCatalog) : (["2 vCPUs", "4 vCPUs", "8 vCPUs"] as WorkspaceCpuOption[])),
    [workspaceCatalog],
  );
  const workspaceCpu = isWorkspaceCpuOption(activeValues.cpu) ? activeValues.cpu : workspaceDefaults.cpu;
  const workspaceMemoryOptions = useMemo(
    () => (workspaceCatalog ? listWorkspaceMemoryOptions(workspaceCatalog, workspaceCpu) : workspaceCpu === "2 vCPUs"
      ? (["4 GB", "8 GB"] as WorkspaceMemoryOption[])
      : workspaceCpu === "4 vCPUs"
      ? (["8 GB", "16 GB"] as WorkspaceMemoryOption[])
      : (["16 GB", "32 GB"] as WorkspaceMemoryOption[])),
    [workspaceCatalog, workspaceCpu],
  );
  const workspaceMemory = isWorkspaceMemoryOption(activeValues.memory) ? activeValues.memory : workspaceDefaults.memory;
  const workspaceDiskTypeOptions = useMemo(
    () => (workspaceCatalog ? listWorkspaceDiskTypes(workspaceCatalog) : (["High I/O", "Ultra-high I/O", "General purpose SSD"] as WorkspaceDiskType[])),
    [workspaceCatalog],
  );
  const workspaceDiskType = isWorkspaceDiskType(activeValues.diskType) ? activeValues.diskType : workspaceDefaults.diskType;
  const workspaceCpuUsageHoursValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.cpuUsageHours, 1, 1)));
  const workspaceDiskSizeGbValue = Math.max(80, Math.floor(normalizeObsPositiveNumber(activeValues.diskSizeGb, 80, 80)));
  const workspaceDiskUsageHoursValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.diskUsageHours, 1, 1)));
  const workspaceQuantityValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.quantity, 1, 1)));
  const dcsVersionOptions = useMemo(
    () => (dcsCatalog ? listDcsVersions(dcsCatalog) : (["7.0", "6.0", "5.0", "4.0"] as DcsVersion[])),
    [dcsCatalog],
  );
  const dcsVersion = isDcsVersion(activeValues.version) ? activeValues.version : dcsDefaults.version;
  const dcsInstanceTypeOptions = useMemo(
    () => (dcsCatalog ? listDcsInstanceTypes(dcsCatalog, dcsVersion) : (["Single-node", "Master/Standby", "Redis Cluster"] as DcsInstanceType[])),
    [dcsCatalog, dcsVersion],
  );
  const dcsInstanceType = isDcsInstanceType(activeValues.instanceType) ? activeValues.instanceType : dcsDefaults.instanceType;
  const dcsArchitectureOptions = useMemo(
    () => (dcsCatalog ? listDcsArchitectures(dcsCatalog, { version: dcsVersion, instanceType: dcsInstanceType }) : (["x86 | DRAM", "ARM | DRAM"] as DcsArchitecture[])),
    [dcsCatalog, dcsInstanceType, dcsVersion],
  );
  const dcsArchitecture = isDcsArchitecture(activeValues.architecture) ? activeValues.architecture : dcsDefaults.architecture;
  const dcsShowReplicas = dcsInstanceType !== "Single-node";
  const dcsReplicaOptions = useMemo(
    () =>
      dcsCatalog
        ? listDcsReplicas(dcsCatalog, {
            version: dcsVersion,
            instanceType: dcsInstanceType,
            architecture: dcsArchitecture,
          })
        : dcsInstanceType === "Master/Standby"
        ? [2, 3, 4, 5]
        : dcsInstanceType === "Redis Cluster"
        ? [1, 2, 3, 4, 6]
        : [],
    [dcsArchitecture, dcsCatalog, dcsInstanceType, dcsVersion],
  );
  const dcsReplicasValue = dcsShowReplicas
    ? (dcsReplicaOptions.includes(Number(activeValues.replicas))
        ? Number(activeValues.replicas)
        : (dcsReplicaOptions[0] ?? dcsDefaults.replicas))
    : null;
  const dcsSpecificationOptions = useMemo(
    () =>
      dcsCatalog
        ? listDcsSpecifications(dcsCatalog, {
            version: dcsVersion,
            instanceType: dcsInstanceType,
            architecture: dcsArchitecture,
            replicas: dcsShowReplicas ? dcsReplicasValue : null,
          })
        : dcsInstanceType === "Redis Cluster"
        ? ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1024 GB"]
        : ["0.125 GB", "0.25 GB", "0.5 GB", "1 GB", "2 GB", "4 GB", "8 GB", "16 GB", "32 GB", "64 GB"],
    [dcsArchitecture, dcsCatalog, dcsInstanceType, dcsReplicasValue, dcsShowReplicas, dcsVersion],
  );
  const dcsSpecification =
    typeof activeValues.specification === "string" && dcsSpecificationOptions.includes(activeValues.specification)
      ? activeValues.specification
      : (dcsSpecificationOptions[0] ?? dcsDefaults.specification);
  const dcsQuantityValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.quantity, 1, 1)));
  const dcsElasticBandwidth = isDcsBandwidthMode(activeValues.elasticBandwidth) ? activeValues.elasticBandwidth : dcsDefaults.elasticBandwidth;
  const dcsBandwidthMbitValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.bandwidthMbit, 1, 1)));
  const dcsUsageHoursValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.usageHours, 1, 1)));

  const evsDiskType = (systemDiskOptions as readonly string[]).includes(activeValues.diskType) ? (activeValues.diskType as SystemDiskOption) : "General Purpose SSD";
  const evsBillingMode = toBillingMode(activeValues.billingMode, billingMode);
  const evsDiskSizeValue = Number.isFinite(Number(activeValues.diskSizeGiB))
    ? Math.max(evsDiskSizeBounds.min, Number(activeValues.diskSizeGiB))
    : evsDiskSizeBounds.min;
  const isGpSsd2Selected = evsDiskType === "General Purpose SSD V2";
  const gpSsd2IopsValue = isGpSsd2Selected ? normalizeGpSsd2Iops(activeValues.iops, evsDiskSizeValue) : null;
  const gpSsd2IopsRange = isGpSsd2Selected ? getGpSsd2IopsBounds(evsDiskSizeValue) : null;
  const gpSsd2ThroughputValue =
    isGpSsd2Selected && gpSsd2IopsValue != null ? normalizeGpSsd2Throughput(activeValues.throughput, gpSsd2IopsValue) : null;
  const gpSsd2ThroughputRange =
    isGpSsd2Selected && gpSsd2IopsValue != null ? getGpSsd2ThroughputBounds(gpSsd2IopsValue) : null;
  const evsDurationMonthsValue = Math.max(1, Math.floor(normalizeObsPositiveNumber(activeValues.durationMonths, 1, 1)));

  useEffect(() => {
    if (selectedServiceCode !== "OBS") {
      return;
    }
    const next = normalizedObsDependencies;
    updateSelectedServiceValues((current) => {
      const merged = {
        ...current,
        storageClass: next.storageClass,
        redundancy: next.redundancy,
        restorationType: next.restorationType ?? "",
      };
      return merged;
    });
  }, [normalizedObsDependencies, selectedServiceCode, updateSelectedServiceValues]);

  useEffect(() => {
    if (selectedServiceCode !== "EIP") {
      return;
    }
    if (!eipChargeModeOptions.includes(eipChargeMode)) {
      updateSelectedServiceValues((current) => ({ ...current, chargeMode: eipChargeModeOptions[0] ?? "By bandwidth" }));
    }
  }, [eipChargeMode, eipChargeModeOptions, selectedServiceCode, updateSelectedServiceValues]);

  useEffect(() => {
    if (selectedServiceCode !== "ELB") {
      return;
    }

    const nextBillingMode = getElbBillingOptions(elbType).includes(billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly")
      ? billingMode
      : getElbBillingOptions(elbType)[0] ?? "Pay-per-use";
    const nextFixedAz = elbFixedAvailabilityAzCountOptions.includes(String(elbFixedAvailabilityAzCount))
      ? String(elbFixedAvailabilityAzCount)
      : (elbFixedAvailabilityAzCountOptions[0] ?? String(elbDefaults.fixedAvailabilityAzCount));
    const enabledProtocolPrefixes = elbProtocols.filter((entry) => entry.enabled).map((entry) => entry.prefix);

    updateSelectedServiceValues((current) => ({
      ...current,
      type: elbType,
      networkType: elbNetworkType,
      sharedChargeMode: elbSharedChargeMode,
      specificationType: elbSpecificationType,
      fixedAvailabilityAzCount: nextFixedAz,
      fixedNetworkEnabled:
        elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" && !elbFixedNetworkEnabled && !elbFixedApplicationEnabled
          ? "true"
          : (elbFixedNetworkEnabled ? "true" : "false"),
      fixedApplicationEnabled:
        elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" && !elbFixedNetworkEnabled && !elbFixedApplicationEnabled
          ? "false"
          : (elbFixedApplicationEnabled ? "true" : "false"),
      fixedNetworkSpec: elbFixedNetworkSpec,
      fixedApplicationSpec: elbFixedApplicationSpec,
      tcpEnabled:
        elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" && enabledProtocolPrefixes.length === 0
          ? "true"
          : (isCheckedFieldValue(current.tcpEnabled) ? "true" : "false"),
      udpEnabled: isCheckedFieldValue(current.udpEnabled) ? "true" : "false",
      tlsEnabled: isCheckedFieldValue(current.tlsEnabled) ? "true" : "false",
      httpEnabled: isCheckedFieldValue(current.httpEnabled) ? "true" : "false",
    }));

    if (nextBillingMode !== billingMode) {
      setBillingMode(nextBillingMode);
    }
  }, [
    billingMode,
    elbFixedApplicationEnabled,
    elbFixedApplicationSpec,
    elbFixedAvailabilityAzCount,
    elbFixedAvailabilityAzCountOptions,
    elbFixedNetworkEnabled,
    elbFixedNetworkSpec,
    elbProtocols,
    elbSharedChargeMode,
    elbSpecificationType,
    elbType,
    elbNetworkType,
    selectedServiceCode,
    setBillingMode,
    updateSelectedServiceValues,
  ]);

  useEffect(() => {
    if (selectedServiceCode !== "NAT") {
      return;
    }
    if (!natSizeOptions.includes(natSize)) {
      updateSelectedServiceValues((current) => ({ ...current, natSize: natSizeOptions[0] ?? natDefaults.size }));
    }
  }, [natSize, natSizeOptions, selectedServiceCode, updateSelectedServiceValues]);

  useEffect(() => {
    if (selectedServiceCode !== "CCE") {
      return;
    }
    if (!cceMasterNodesOptions.includes(cceMasterNodes)) {
      updateSelectedServiceValues((current) => ({ ...current, masterNodes: cceMasterNodesOptions[0] ?? cceDefaults.masterNodes }));
    }
  }, [cceMasterNodes, cceMasterNodesOptions, selectedServiceCode, updateSelectedServiceValues]);

  useEffect(() => {
    if (selectedServiceCode !== "VPN") {
      return;
    }

    const nextEdition = billingMode === "Yearly/Monthly" ? "Enterprise" : vpnEdition;
    const nextMode = nextEdition === "Classic" ? "Site-to-Cloud" : (vpnModeOptions.includes(vpnMode) ? vpnMode : vpnModeOptions[0] ?? vpnDefaults.mode);
    const nextNetworkType = nextEdition === "Classic" ? "Public network" : vpnNetworkType;
    const nextShared = nextEdition === "Classic" ? "No" : (activeValues.useSharedBandwidth === "Yes" ? "Yes" : "No");
    const nextSpec = nextEdition === "Classic"
      ? "Basic"
      : vpnSpecificationOptions[0] ?? (nextMode === "Point-to-Cloud" ? "Professional 1" : "Professional 2");

    updateSelectedServiceValues((current) => ({
      ...current,
      edition: nextEdition,
      mode: nextMode,
      networkType: nextNetworkType,
      useSharedBandwidth: nextShared,
      specification: nextSpec,
      eipBandwidthMbit1: current.eipBandwidthMbit1 || String(vpnDefaults.eipBandwidthMbit1),
      eipBandwidthMbit2: current.eipBandwidthMbit2 || String(vpnDefaults.eipBandwidthMbit2),
    }));
  }, [activeValues.useSharedBandwidth, billingMode, selectedServiceCode, updateSelectedServiceValues, vpnEdition, vpnMode, vpnModeOptions, vpnNetworkType, vpnSpecificationOptions]);

  useEffect(() => {
    if (selectedServiceCode !== "ModelArts") {
      return;
    }

    const nextResourceType = modelArtsResourceTypeOptions.includes(modelArtsResourceType)
      ? modelArtsResourceType
      : modelArtsResourceTypeOptions[0] ?? modelArtsDefaults.resourceType;
    const nextSpecification = modelArtsSpecificationOptions.includes(modelArtsSpecification)
      ? modelArtsSpecification
      : modelArtsSpecificationOptions[0] ?? modelArtsDefaults.specification;

    updateSelectedServiceValues((current) => ({
      ...current,
      serviceType: "AI Development Lifecycle",
      resourceType: nextResourceType,
      specification: nextSpecification,
    }));
  }, [
    modelArtsResourceType,
    modelArtsResourceTypeOptions,
    modelArtsSpecification,
    modelArtsSpecificationOptions,
    selectedServiceCode,
    updateSelectedServiceValues,
  ]);

  useEffect(() => {
    if (selectedServiceCode !== "Workspace") {
      return;
    }

    const nextCpu = workspaceCpuOptions.includes(workspaceCpu)
      ? workspaceCpu
      : workspaceCpuOptions[0] ?? workspaceDefaults.cpu;
    const nextMemoryOptions = workspaceCatalog
      ? listWorkspaceMemoryOptions(workspaceCatalog, nextCpu)
      : nextCpu === "2 vCPUs"
      ? (["4 GB", "8 GB"] as WorkspaceMemoryOption[])
      : nextCpu === "4 vCPUs"
      ? (["8 GB", "16 GB"] as WorkspaceMemoryOption[])
      : (["16 GB", "32 GB"] as WorkspaceMemoryOption[]);
    const nextMemory = nextMemoryOptions.includes(workspaceMemory)
      ? workspaceMemory
      : nextMemoryOptions[0] ?? workspaceDefaults.memory;
    const nextDiskType = workspaceDiskTypeOptions.includes(workspaceDiskType)
      ? workspaceDiskType
      : workspaceDiskTypeOptions[0] ?? workspaceDefaults.diskType;

    updateSelectedServiceValues((current) => ({
      ...current,
      architecture: "x86 desktop",
      specification: "Ultimate",
      cpu: nextCpu,
      memory: nextMemory,
      diskType: nextDiskType,
    }));
  }, [
    selectedServiceCode,
    updateSelectedServiceValues,
    workspaceCatalog,
    workspaceCpu,
    workspaceCpuOptions,
    workspaceDiskType,
    workspaceDiskTypeOptions,
    workspaceMemory,
  ]);

  useEffect(() => {
    if (selectedServiceCode !== "DCS") {
      return;
    }

    const nextVersion = dcsVersionOptions.includes(dcsVersion)
      ? dcsVersion
      : dcsVersionOptions[0] ?? dcsDefaults.version;
    const nextInstanceTypeOptions = dcsCatalog
      ? listDcsInstanceTypes(dcsCatalog, nextVersion)
      : (["Single-node", "Master/Standby", "Redis Cluster"] as DcsInstanceType[]);
    const nextInstanceType = nextInstanceTypeOptions.includes(dcsInstanceType)
      ? dcsInstanceType
      : nextInstanceTypeOptions[0] ?? dcsDefaults.instanceType;
    const nextArchitectureOptions = dcsCatalog
      ? listDcsArchitectures(dcsCatalog, { version: nextVersion, instanceType: nextInstanceType })
      : (["x86 | DRAM", "ARM | DRAM"] as DcsArchitecture[]);
    const nextArchitecture = nextArchitectureOptions.includes(dcsArchitecture)
      ? dcsArchitecture
      : nextArchitectureOptions[0] ?? dcsDefaults.architecture;
    const nextShowReplicas = nextInstanceType !== "Single-node";
    const nextReplicaOptions = dcsCatalog
      ? listDcsReplicas(dcsCatalog, {
          version: nextVersion,
          instanceType: nextInstanceType,
          architecture: nextArchitecture,
        })
      : nextInstanceType === "Master/Standby"
      ? [2, 3, 4, 5]
      : nextInstanceType === "Redis Cluster"
      ? [1, 2, 3, 4, 6]
      : [];
    const nextReplicas = nextShowReplicas
      ? (nextReplicaOptions.includes(Number(activeValues.replicas))
          ? Number(activeValues.replicas)
          : (nextReplicaOptions[0] ?? dcsDefaults.replicas))
      : dcsDefaults.replicas;
    const nextSpecificationOptions = dcsCatalog
      ? listDcsSpecifications(dcsCatalog, {
          version: nextVersion,
          instanceType: nextInstanceType,
          architecture: nextArchitecture,
          replicas: nextShowReplicas ? nextReplicas : null,
        })
      : nextInstanceType === "Redis Cluster"
      ? ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1024 GB"]
      : ["0.125 GB", "0.25 GB", "0.5 GB", "1 GB", "2 GB", "4 GB", "8 GB", "16 GB", "32 GB", "64 GB"];
    const nextSpecification =
      nextSpecificationOptions.includes(String(activeValues.specification))
        ? String(activeValues.specification)
        : nextSpecificationOptions[0] ?? dcsDefaults.specification;

    updateSelectedServiceValues((current) => ({
      ...current,
      edition: "Basic",
      version: nextVersion,
      instanceType: nextInstanceType,
      architecture: nextArchitecture,
      replicas: String(nextReplicas),
      specification: nextSpecification,
      elasticBandwidth: dcsElasticBandwidth,
    }));
  }, [
    activeValues.replicas,
    activeValues.specification,
    dcsArchitecture,
    dcsCatalog,
    dcsElasticBandwidth,
    dcsInstanceType,
    dcsVersion,
    dcsVersionOptions,
    selectedServiceCode,
    updateSelectedServiceValues,
  ]);

  useEffect(() => {
    if (selectedServiceCode === "EVS" && activeValues.billingMode !== billingMode) {
      updateSelectedServiceValues((current) => ({ ...current, billingMode }));
    }
  }, [activeValues.billingMode, billingMode, selectedServiceCode, updateSelectedServiceValues]);

  const selectedObsPricing = selectedServiceCode === "OBS" && obsCatalog
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

  const selectedEipPricing = selectedServiceCode === "EIP" && eipCatalog
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

  const selectedElbPricing = selectedServiceCode === "ELB" && elbCatalog
    ? estimateElbConfiguration(elbCatalog, selectedElbInput)
    : null;

  const selectedNatPricing = selectedServiceCode === "NAT"
    ? estimateNatConfiguration(activeNatCatalog, {
        type: natType,
        size: natSize,
        billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
        usageHours: usageHoursValue,
      })
    : null;

  const selectedVpnPricing = selectedServiceCode === "VPN"
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

  const selectedModelArtsPricing = selectedServiceCode === "ModelArts" && modelArtsCatalog
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

  const selectedWorkspacePricing = selectedServiceCode === "Workspace" && workspaceCatalog
    ? estimateWorkspaceConfiguration(workspaceCatalog, {
        architecture: "x86 desktop",
        specification: "Ultimate",
        cpu: workspaceCpu,
        memory: workspaceMemory,
        cpuUsageHours: workspaceCpuUsageHoursValue,
        diskType: workspaceDiskType,
        diskSizeGb: workspaceDiskSizeGbValue,
        diskUsageHours: workspaceDiskUsageHoursValue,
        quantity: workspaceQuantityValue,
      })
    : null;

  const selectedDcsPricing = selectedServiceCode === "DCS" && dcsCatalog
    ? estimateDcsConfiguration(dcsCatalog, {
        edition: "Basic",
        version: dcsVersion,
        instanceType: dcsInstanceType,
        architecture: dcsArchitecture,
        replicas: dcsShowReplicas ? dcsReplicasValue : null,
        specification: dcsSpecification,
        quantity: dcsQuantityValue,
        elasticBandwidth: dcsElasticBandwidth,
        bandwidthMbit: dcsBandwidthMbitValue,
        usageHours: dcsUsageHoursValue,
      })
    : null;

  const selectedCcePricing = selectedServiceCode === "CCE"
    ? estimateCceConfiguration(activeCceCatalog, {
        scale: cceClusterScale,
        masterNodes: cceMasterNodes,
        billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
        usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
      })
    : null;

  const selectedDiskPrice = selectedServiceCode === "EVS"
    ? getDiskPriceForBillingOption(
        evsDiskPricing,
        evsDiskType,
        evsDiskSizeValue,
        evsBillingMode,
        usageHoursValue,
        evsDurationMonthsValue,
      )
    : null;

  const activeBillingOptions = useMemo((): BillingOption[] | null => {
    if (!isConfigurableService) {
      return null;
    }

    switch (selectedServiceCode) {
      case "OBS":
        return ["Pay-per-use"];
      case "EIP":
        return eipType === "Dedicated EIP" && eipChargeMode === "By bandwidth" ? ["Pay-per-use", "Yearly/Monthly"] : ["Pay-per-use"];
      case "ELB":
        return [...getElbBillingOptions(elbType)];
      case "NAT":
        return natType === "Public NAT Gateway" ? ["Pay-per-use", "Yearly/Monthly"] : ["Pay-per-use"];
      case "VPN":
        return vpnAvailableBillingOptions.length > 0 ? [...vpnAvailableBillingOptions] : ["Yearly/Monthly"];
      case "CCE":
      case "CCI":
      case "ModelArts":
        return ["Pay-per-use", "Yearly/Monthly"];
      case "Workspace":
      case "DCS":
        return ["Pay-per-use"];
      case "EVS":
        return (selectedServiceDefinition?.billingOptions as BillingOption[] | undefined) ?? ["Pay-per-use", "Yearly/Monthly"];
      default:
        return (selectedServiceDefinition?.billingOptions as BillingOption[] | undefined) ?? null;
    }
  }, [eipChargeMode, eipType, elbType, isConfigurableService, natType, selectedServiceCode, selectedServiceDefinition?.billingOptions, vpnAvailableBillingOptions]);

  useEffect(() => {
    if (!activeBillingOptions?.includes(billingMode) && activeBillingOptions?.[0]) {
      setBillingMode(activeBillingOptions[0]);
    }
  }, [activeBillingOptions, billingMode, setBillingMode]);

  const selectedEstimate = useMemo(() => {
    switch (selectedServiceCode) {
      case "EVS":
        return selectedDiskPrice
          ? formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount * instanceCountValue, selectedDiskPrice.suffix)
          : "USD 0.00";
      case "OBS":
        return selectedObsPricing
          ? formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.amount * instanceCountValue, selectedObsPricing.suffix)
          : "USD 0.00";
      case "EIP":
        return selectedEipPricing
          ? formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.amount * instanceCountValue, selectedEipPricing.suffix)
          : "USD 0.00";
      case "ELB":
        return selectedElbPricing
          ? formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.amount * instanceCountValue, selectedElbPricing.suffix)
          : "USD 0.00";
      case "NAT":
        return selectedNatPricing
          ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.amount * instanceCountValue, selectedNatPricing.suffix)
          : "USD 0.00";
      case "VPN":
        return selectedVpnPricing
          ? formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.amount * instanceCountValue, selectedVpnPricing.suffix)
          : "USD 0.00";
      case "CCE":
        return selectedCcePricing
          ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.amount * instanceCountValue, selectedCcePricing.suffix)
          : "USD 0.00";
      case "ModelArts":
        return selectedModelArtsPricing
          ? formatFlavorAmount(selectedModelArtsPricing.currency, selectedModelArtsPricing.amount, selectedModelArtsPricing.suffix)
          : "USD 0.00";
      case "Workspace":
        return selectedWorkspacePricing
          ? formatFlavorAmount(selectedWorkspacePricing.currency, selectedWorkspacePricing.amount, selectedWorkspacePricing.suffix)
          : "USD 0.00";
      case "DCS":
        return selectedDcsPricing
          ? formatFlavorAmount(selectedDcsPricing.currency, selectedDcsPricing.amount, selectedDcsPricing.suffix)
          : "USD 0.00";
      case "CCI":
        return "USD 0.00";
      default:
        return "USD 0.00";
    }
  }, [
    instanceCountValue,
    selectedCcePricing,
    selectedDiskPrice,
    selectedEipPricing,
    selectedElbPricing,
    selectedModelArtsPricing,
    selectedNatPricing,
    selectedObsPricing,
    selectedServiceCode,
    selectedDcsPricing,
    selectedWorkspacePricing,
    selectedVpnPricing,
  ]);

  const addToListError = useMemo(() => {
    if (!isConfigurableService) {
      return null;
    }

    switch (selectedServiceCode) {
      case "EVS":
        return selectedDiskPrice ? null : "Select a volume type first.";
      case "OBS":
        return selectedObsPricing ? null : (pricingErrorByService.OBS || "Select an OBS storage class first.");
      case "EIP":
        return selectedEipPricing ? null : (pricingErrorByService.EIP || "EIP pricing is unavailable for the current selection.");
      case "ELB":
        return selectedElbPricing ? null : (pricingErrorByService.ELB || "ELB pricing is unavailable for the current selection.");
      case "NAT":
        return selectedNatPricing ? null : (pricingErrorByService.NAT || "NAT pricing is unavailable for the current selection.");
      case "VPN":
        return selectedVpnPricing ? null : (pricingErrorByService.VPN || "VPN pricing is unavailable for the current selection.");
      case "CCE":
        if (!selectedCcePricing) {
          return pricingErrorByService.CCE || "CCE pricing is unavailable for the current selection.";
        }
        return cceClusterScale && cceMasterNodes ? null : "Select cluster scale and master nodes first.";
      case "CCI":
        return cciCpu && cciMemory ? null : "Enter CPU and memory values first.";
      case "ModelArts":
        return selectedModelArtsPricing ? null : (pricingErrorByService.ModelArts || "ModelArts pricing is unavailable for the current selection.");
      case "Workspace":
        return selectedWorkspacePricing ? null : (pricingErrorByService.Workspace || "Workspace pricing is unavailable for the current selection.");
      case "DCS":
        return selectedDcsPricing ? null : (pricingErrorByService.DCS || "DCS pricing is unavailable for the current selection.");
      default:
        return null;
    }
  }, [
    cceClusterScale,
    cceMasterNodes,
    cciCpu,
    cciMemory,
    isConfigurableService,
    pricingErrorByService.CCE,
    pricingErrorByService.DCS,
    pricingErrorByService.EIP,
    pricingErrorByService.ELB,
    pricingErrorByService.ModelArts,
    pricingErrorByService.NAT,
    pricingErrorByService.OBS,
    pricingErrorByService.VPN,
    pricingErrorByService.Workspace,
    selectedCcePricing,
    selectedDiskPrice,
    selectedEipPricing,
    selectedElbPricing,
    selectedModelArtsPricing,
    selectedNatPricing,
    selectedObsPricing,
    selectedServiceCode,
    selectedDcsPricing,
    selectedWorkspacePricing,
    selectedVpnPricing,
  ]);

  const normalizeFieldValue = useCallback((fieldId: string, nextValue: string) => {
    switch (selectedServiceCode) {
      case "EVS":
        if (fieldId === "diskSizeGiB") return clampNumberString(nextValue, evsDiskSizeBounds.min, evsDiskSizeBounds.max);
        if (fieldId === "usageHours") return clampNumberString(nextValue, 1, 87600, true);
        if (fieldId === "durationMonths") return clampNumberString(nextValue, 1, 360, true);
        if (fieldId === "iops") return String(normalizeGpSsd2Iops(nextValue, evsDiskSizeValue));
        if (fieldId === "throughput") return String(normalizeGpSsd2Throughput(nextValue, gpSsd2IopsValue ?? gpSsd2IopsBounds.min));
        return nextValue;
      case "OBS":
        if (fieldId === "storageAmount") return clampNumberString(nextValue, obsStorageSizeBounds.min, obsStorageSizeBounds.max);
        if (fieldId === "durationMonths") return clampNumberString(nextValue, 1, undefined, true);
        if (fieldId === "outboundTrafficAmount" || fieldId === "pullTrafficAmount" || fieldId === "readTrafficAmount"
          || fieldId === "replicationTrafficAmount" || fieldId === "readRequests" || fieldId === "writeRequests"
          || fieldId === "deleteRequests" || fieldId === "lifecycleTransitionRequests") {
          return clampNumberString(nextValue, 0);
        }
        return nextValue;
      case "EIP":
        if (fieldId === "bandwidthMbit") return clampNumberString(nextValue, eipBandwidthMinimumMbit);
        if (fieldId === "enhanced95DurationMonths") return clampNumberString(nextValue, 1, undefined, true);
        if (fieldId === "sharedBandwidthQuantity") return clampNumberString(nextValue, 1, undefined, true);
        if (fieldId === "trafficAmount") return clampNumberString(nextValue, 0);
        return nextValue;
      case "ELB":
        if (fieldId === "usageHours") return clampNumberString(nextValue, 1, 87600, true);
        if (fieldId === "fixedAvailabilityAzCount") return clampNumberString(nextValue, 1, undefined, true);
        if (
          fieldId === "sharedBandwidthMbit" || fieldId === "sharedTrafficAmount"
          || fieldId.endsWith("NewConnections")
          || fieldId.endsWith("MaxConcurrentConnections")
          || fieldId.endsWith("ProcessedTrafficGbPerHour")
          || fieldId.endsWith("AverageBandwidthMbit")
          || fieldId === "httpQueriesPerSecond"
          || fieldId === "httpForwardingRules"
        ) {
          return clampNumberString(nextValue, 0);
        }
        return nextValue;
      case "VPN":
        if (fieldId === "eipBandwidthMbit1" || fieldId === "eipBandwidthMbit2") return clampNumberString(nextValue, 0);
        return nextValue;
      case "CCI":
        if (fieldId === "cpu" || fieldId === "memoryGiB") return clampNumberString(nextValue, 1, undefined, true);
        return nextValue;
      case "ModelArts":
        if (fieldId === "quantity" || fieldId === "storageQuotaGb") return clampNumberString(nextValue, 1, undefined, true);
        if (fieldId === "usageHours") return clampNumberString(nextValue, 1, 87600, true);
        return nextValue;
      case "Workspace":
        if (fieldId === "cpuUsageHours" || fieldId === "diskUsageHours") return clampNumberString(nextValue, 1, 87600, true);
        if (fieldId === "diskSizeGb") return clampNumberString(nextValue, 80, 32760, true);
        if (fieldId === "quantity") return clampNumberString(nextValue, 1, undefined, true);
        return nextValue;
      case "DCS":
        if (fieldId === "quantity" || fieldId === "bandwidthMbit") return clampNumberString(nextValue, 1, undefined, true);
        if (fieldId === "usageHours") return clampNumberString(nextValue, 1, 87600, true);
        return nextValue;
      default:
        return nextValue;
    }
  }, [eipBandwidthMinimumMbit, evsDiskSizeValue, gpSsd2IopsValue, selectedServiceCode]);

  const setActiveFieldValue = useCallback((fieldId: string, value: string) => {
    const normalized = normalizeFieldValue(fieldId, value);
    updateSelectedServiceValues((current) => ({ ...current, [fieldId]: normalized }));
    if (fieldId === "billingMode") {
      setBillingMode(toBillingMode(normalized, billingMode));
    }
    if (fieldId === "usageHours") {
      updateUsageHours(normalized || "1");
    }
  }, [billingMode, normalizeFieldValue, setBillingMode, updateSelectedServiceValues, updateUsageHours]);

  const resolveFieldValue = useCallback((fieldId: string) => {
    if (fieldId === "billingMode") {
      return billingMode;
    }
    if (fieldId === "usageHours") {
      return usageHours;
    }
    return activeValues[fieldId] ?? "";
  }, [activeValues, billingMode, usageHours]);

  const fieldOptionsById: Record<string, Array<{ value: string; label: string }> | undefined> = useMemo(() => {
    const billingOptions = activeBillingOptions?.map((value) => ({ value, label: value }));
    switch (selectedServiceCode) {
      case "EVS":
        return {
          billingMode: billingOptions,
          diskType: systemDiskOptions.map((value) => ({ value, label: value })),
        };
      case "OBS":
        return {
          billingMode: billingOptions,
          productType: obsProductTypeOptions.map((value) => ({ value, label: value })),
          storageClass: obsStorageClassOptions.map((value) => ({ value, label: value })),
          redundancy: obsRedundancyOptions.map((value) => ({ value, label: value })),
          storageUnit: obsCapacityUnits.map((value) => ({ value, label: value })),
          outboundTrafficUnit: obsCapacityUnits.map((value) => ({ value, label: value })),
          pullTrafficUnit: obsCapacityUnits.map((value) => ({ value, label: value })),
          readTrafficUnit: obsCapacityUnits.map((value) => ({ value, label: value })),
          replicationTrafficUnit: obsCapacityUnits.map((value) => ({ value, label: value })),
          restorationType: obsRestorationTypeOptions.map((value) => ({ value, label: value })),
        };
      case "EIP":
        return {
          billingMode: billingOptions,
          type: (["Dedicated EIP", "Shared EIP"] as const).map((value) => ({ value, label: value })),
          chargeMode: eipChargeModeOptions.map((value) => ({ value, label: value })),
          trafficUnit: eipTrafficUnitOptions.map((value) => ({ value, label: value })),
        };
      case "ELB":
        return {
          billingMode: billingOptions,
          type: (["Shared load balancer", "Dedicated load balancer"] as const).map((value) => ({ value, label: value })),
          networkType: (["Public network", "Private network"] as const).map((value) => ({ value, label: value })),
          sharedChargeMode: (["By traffic", "By bandwidth"] as const).map((value) => ({ value, label: value })),
          sharedTrafficUnit: elbTrafficUnitOptions.map((value) => ({ value, label: value })),
          specificationType: (["Fixed", "Elastic"] as const).map((value) => ({ value, label: value })),
          fixedAvailabilityAzCount: elbFixedAvailabilityAzCountOptions.map((value) => ({ value, label: value })),
          fixedNetworkSpec: elbFixedSpecOptions.map((value) => ({ value, label: value })),
          fixedApplicationSpec: elbFixedSpecOptions.map((value) => ({ value, label: value })),
          tcpMetricMode: (["By traffic", "By bandwidth"] as const).map((value) => ({ value, label: value })),
          udpMetricMode: (["By traffic", "By bandwidth"] as const).map((value) => ({ value, label: value })),
          tlsMetricMode: (["By traffic", "By bandwidth"] as const).map((value) => ({ value, label: value })),
          httpMetricMode: (["By traffic", "By bandwidth"] as const).map((value) => ({ value, label: value })),
        };
      case "NAT":
        return {
          billingMode: billingOptions,
          natType: natTypeOptions.map((value) => ({ value, label: value })),
          natSize: natSizeOptions.map((value) => ({ value, label: value })),
        };
      case "VPN":
        return {
          billingMode: billingOptions,
          edition: vpnEditionOptionsToShow.map((value) => ({ value, label: value })),
          mode: vpnModeOptions.map((value) => ({ value, label: value })),
          networkType: vpnNetworkTypeOptions.map((value) => ({ value, label: value })),
          specification: vpnSpecificationOptions.map((value) => ({ value, label: value })),
          useSharedBandwidth: ["Yes", "No"].map((value) => ({ value, label: value })),
          durationMonths: vpnDurationMonthOptions.map((value) => ({
            value: String(value),
            label: value === 12 ? "1 year" : value === 1 ? "1 month" : `${value} months`,
          })),
        };
      case "CCE":
        return {
          billingMode: billingOptions,
          clusterScale: cceClusterScaleOptions.map((value) => ({ value, label: value })),
          masterNodes: cceMasterNodesOptions.map((value) => ({ value, label: value })),
        };
      case "CCI":
        return {
          billingMode: billingOptions,
        };
      case "ModelArts":
        return {
          billingMode: billingOptions,
          serviceType: [{ value: "AI Development Lifecycle", label: "AI Development Lifecycle" }],
          resourceType: modelArtsResourceTypeOptions.map((value) => ({ value, label: value })),
          specification: modelArtsSpecificationOptions.map((value) => ({ value, label: value })),
          durationMonths: modelArtsDurationMonthOptions.map((value) => ({
            value: String(value),
            label: value === 12 ? "1 year" : value === 1 ? "1 month" : `${value} months`,
          })),
        };
      case "Workspace":
        return {
          billingMode: billingOptions,
          architecture: [{ value: "x86 desktop", label: "x86 desktop" }],
          specification: [{ value: "Ultimate", label: "Ultimate" }],
          cpu: workspaceCpuOptions.map((value) => ({ value, label: value })),
          memory: workspaceMemoryOptions.map((value) => ({ value, label: value })),
          diskType: workspaceDiskTypeOptions.map((value) => ({ value, label: value })),
        };
      case "DCS":
        return {
          billingMode: billingOptions,
          edition: [{ value: "Basic", label: "Basic" }],
          version: dcsVersionOptions.map((value) => ({ value, label: value })),
          instanceType: dcsInstanceTypeOptions.map((value) => ({ value, label: value })),
          architecture: dcsArchitectureOptions.map((value) => ({ value, label: value })),
          replicas: dcsReplicaOptions.map((value) => ({ value: String(value), label: String(value) })),
          specification: dcsSpecificationOptions.map((value) => ({ value, label: value })),
          elasticBandwidth: (["Buy now", "Buy later"] as const).map((value) => ({ value, label: value })),
        };
      default:
        return { billingMode: billingOptions };
    }
  }, [
    activeBillingOptions,
    cceClusterScaleOptions,
    cceMasterNodesOptions,
    dcsArchitectureOptions,
    dcsInstanceTypeOptions,
    dcsReplicaOptions,
    dcsSpecificationOptions,
    dcsVersionOptions,
    eipChargeModeOptions,
    elbFixedAvailabilityAzCountOptions,
    modelArtsResourceTypeOptions,
    modelArtsSpecificationOptions,
    natSizeOptions,
    natTypeOptions,
    obsProductTypeOptions,
    obsRedundancyOptions,
    obsRestorationTypeOptions,
    obsStorageClassOptions,
    selectedServiceCode,
    vpnEditionOptionsToShow,
    vpnModeOptions,
    vpnSpecificationOptions,
    workspaceCpuOptions,
    workspaceDiskTypeOptions,
    workspaceMemoryOptions,
  ]);

  const fieldMinById = useMemo<Record<string, number | undefined>>(
    () => {
      switch (selectedServiceCode) {
        case "EVS":
          return {
            diskSizeGiB: evsDiskSizeBounds.min,
            usageHours: 1,
            durationMonths: 1,
            iops: gpSsd2IopsRange?.min,
            throughput: gpSsd2ThroughputRange?.min,
          };
        case "OBS":
          return { storageAmount: obsStorageSizeBounds.min, durationMonths: 1 };
        case "EIP":
          return { bandwidthMbit: eipBandwidthMinimumMbit, enhanced95DurationMonths: 1, sharedBandwidthQuantity: 1, trafficAmount: 0 };
        case "ELB":
          return {
            usageHours: 1,
            sharedBandwidthMbit: 0,
            sharedTrafficAmount: 0,
            fixedAvailabilityAzCount: 1,
            tcpNewConnections: 0,
            tcpMaxConcurrentConnections: 0,
            tcpProcessedTrafficGbPerHour: 0,
            tcpAverageBandwidthMbit: 0,
            udpNewConnections: 0,
            udpMaxConcurrentConnections: 0,
            udpProcessedTrafficGbPerHour: 0,
            udpAverageBandwidthMbit: 0,
            tlsNewConnections: 0,
            tlsMaxConcurrentConnections: 0,
            tlsProcessedTrafficGbPerHour: 0,
            tlsAverageBandwidthMbit: 0,
            httpNewConnections: 0,
            httpMaxConcurrentConnections: 0,
            httpProcessedTrafficGbPerHour: 0,
            httpAverageBandwidthMbit: 0,
            httpQueriesPerSecond: 0,
            httpForwardingRules: 0,
          };
        case "ModelArts":
          return { quantity: 1, storageQuotaGb: 1, usageHours: 1 };
        case "Workspace":
          return { cpuUsageHours: 1, diskSizeGb: 80, diskUsageHours: 1, quantity: 1 };
        case "DCS":
          return { quantity: 1, bandwidthMbit: 1, usageHours: 1 };
        case "CCI":
          return { cpu: 1, memoryGiB: 1 };
        default:
          return { usageHours: 1 };
      }
    },
    [eipBandwidthMinimumMbit, gpSsd2IopsRange?.min, gpSsd2ThroughputRange?.min, selectedServiceCode],
  );

  const fieldMaxById = useMemo<Record<string, number | undefined>>(
    () => {
      switch (selectedServiceCode) {
        case "EVS":
          return {
            diskSizeGiB: evsDiskSizeBounds.max,
            usageHours: 87600,
            durationMonths: 360,
            iops: gpSsd2IopsRange?.max,
            throughput: gpSsd2ThroughputRange?.max,
          };
        case "OBS":
          return { storageAmount: obsStorageSizeBounds.max };
        case "ELB":
        case "ModelArts":
          return { usageHours: 87600 };
        case "Workspace":
          return { cpuUsageHours: 87600, diskSizeGb: 32760, diskUsageHours: 87600 };
        case "DCS":
          return { usageHours: 87600 };
        default:
          return {};
      }
    },
    [gpSsd2IopsRange?.max, gpSsd2ThroughputRange?.max, selectedServiceCode],
  );

  const fieldDisabledById = useMemo<Record<string, boolean | undefined>>(
    () => ({
      specification: selectedServiceCode === "VPN",
      serviceType: selectedServiceCode === "ModelArts",
      architecture: selectedServiceCode === "Workspace",
      ...(selectedServiceCode === "Workspace" ? { specification: true } : {}),
      ...(selectedServiceCode === "DCS" ? { edition: true } : {}),
    }),
    [selectedServiceCode],
  );

  const activePanelProps = useMemo<ConfigurablePanelProps | null>(() => {
    if (!isConfigurableService || !selectedServiceDefinition) {
      return null;
    }

    const fields = buildConfiguredFields({
      enabled: true,
      definition: selectedServiceDefinition,
      runtimeValues: {
        billingMode,
        diskType: evsDiskType,
        type: elbType,
        specificationType: elbSpecificationType,
        fixedNetworkEnabled: elbFixedNetworkEnabled,
        fixedApplicationEnabled: elbFixedApplicationEnabled,
        tcpEnabled: isCheckedFieldValue(activeValues.tcpEnabled),
        tcpMetricMode: activeValues.tcpMetricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
        udpEnabled: isCheckedFieldValue(activeValues.udpEnabled),
        udpMetricMode: activeValues.udpMetricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
        tlsEnabled: isCheckedFieldValue(activeValues.tlsEnabled),
        tlsMetricMode: activeValues.tlsMetricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
        httpEnabled: isCheckedFieldValue(activeValues.httpEnabled),
        httpMetricMode: activeValues.httpMetricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
        showBandwidth: showEipBandwidth,
        showSharedBandwidth: showElbSharedBandwidth,
        showSharedTraffic: showElbSharedTraffic,
        showUsageHours: selectedServiceCode === "ELB" ? true : billingMode === "Pay-per-use",
        showRestorationFields: obsRestorationTypeOptions.length > 0,
        showReplicationTraffic: showObsReplicationTraffic,
        edition: vpnEdition,
        elasticBandwidth: dcsElasticBandwidth,
        networkType: selectedServiceCode === "ELB" ? elbNetworkType : vpnNetworkType,
        resourceType: modelArtsResourceType,
        showReplicas: dcsShowReplicas,
      },
      values: Object.fromEntries(selectedServiceDefinition.fields.map((field) => [field.id, resolveFieldValue(field.id)])),
      optionsByFieldId: fieldOptionsById,
      minByFieldId: fieldMinById,
      maxByFieldId: fieldMaxById,
      disabledByFieldId: fieldDisabledById,
      onChangeByFieldId: Object.fromEntries(selectedServiceDefinition.fields.map((field) => [field.id, (value: string) => setActiveFieldValue(field.id, value)])),
      onBlurByFieldId: Object.fromEntries(selectedServiceDefinition.fields.map((field) => [field.id, () => setActiveFieldValue(field.id, resolveFieldValue(field.id) || stringifyConfigValue(selectedServiceDefinition.defaults[field.id]))])),
      onStepByFieldId: Object.fromEntries(
        selectedServiceDefinition.fields.map((field) => [
          field.id,
          (delta: number) => {
            const currentValue = resolveFieldValue(field.id);
            const baseValue = Number(currentValue || fieldMinById[field.id] || 0);
            setActiveFieldValue(field.id, String(baseValue + delta));
          },
        ]),
      ),
    });

    const notes = [...(selectedServiceDefinition.summary?.notes ?? [])];
    const selectionNotes: string[] = [];
    let selectionSummary = "Selected specifications:";
    let referenceNote: string | undefined;

    switch (selectedServiceCode) {
      case "EVS": {
        selectionSummary = `Selected specifications: ${evsDiskType} | ${evsDiskSizeValue} GiB | ${billingMode === "Pay-per-use" ? `${usageHoursValue}h` : `${evsDurationMonthsValue}mo`}${isGpSsd2Selected && gpSsd2IopsValue != null && gpSsd2ThroughputValue != null ? ` | ${gpSsd2IopsValue} IOPS | ${gpSsd2ThroughputValue} MB/s` : ""}${selectedDiskPrice ? ` | Disk ${formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}` : ""}`;
        const splitNotice = buildEvsSplitNotice(evsDiskSizeValue);
        if (splitNotice) {
          selectionNotes.push(splitNotice);
          notes.unshift(splitNotice);
        }
        break;
      }
      case "OBS":
        selectionSummary = selectedObsPricing
          ? `Selected specifications: ${obsProductType} | ${obsStorageClass} | ${obsRedundancy}${obsRestorationType ? ` | ${obsRestorationType}` : ""} | ${obsStorageSizeValue} ${obsStorageUnit}${obsReadTrafficValue > 0 ? ` | Read ${obsReadTrafficValue} ${obsReadTrafficUnit}` : ""} | ${obsDurationMonthsValue}mo | ${formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.amount, selectedObsPricing.suffix)}`
          : "Selected specifications:";
        referenceNote = `Pricing sourced from Huawei Cloud OBS calculator API for ${catalogRegionIdByService.OBS ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Deep Archive storage falls back to Huawei's public pricing page because that storage event is omitted from the productInfo response. Sources: ${obsPricingReference.productUrl}, ${obsPricingReference.billingUrl}, and ${obsPricingReference.packageOverviewUrl}`;
        break;
      case "EIP":
        selectionSummary = selectedEipPricing
          ? `Selected specifications: ${eipType} | Dynamic BGP | ${eipChargeMode}${showEipBandwidth ? ` | ${eipBandwidthMbitValue} Mbit/s` : ""}${showEipEnhanced95DurationMonths ? ` | ${eipEnhanced95DurationMonthsValue}mo` : ""}${showEipSharedBandwidthQuantity ? ` | ${eipSharedBandwidthQuantityValue} shared bandwidth${eipSharedBandwidthQuantityValue === 1 ? "" : "s"}` : ""}${showEipTraffic ? ` | ${eipTrafficAmountValue} ${eipTrafficUnit}` : ""} | ${formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.amount, selectedEipPricing.suffix)}`
          : "Selected specifications:";
        referenceNote = `Pricing sourced from Huawei Cloud EIP calculator API for ${catalogRegionIdByService.EIP ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${eipPricingReference.pricingUrl}`;
        break;
      case "ELB":
        selectionSummary = selectedElbPricing
          ? `Selected specifications: ${elbType}${elbType === "Dedicated load balancer" ? ` | ${elbSpecificationType}` : ""}${elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" ? ` | ${elbFixedAvailabilityAzCount} AZs | ${[
              ...(elbFixedNetworkEnabled ? [`Network load balancing (TCP/UDP/TLS): ${elbFixedNetworkSpec}`] : []),
              ...(elbFixedApplicationEnabled ? [`Application load balancing (HTTP/HTTPS): ${elbFixedApplicationSpec}`] : []),
            ].join(" | ")}` : ""}${elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? ` | ${elbDefaults.subAz}` : ""} | ${elbNetworkType}${showElbSharedChargeMode ? ` | ${elbSharedChargeMode}${showElbSharedBandwidth ? ` | ${elbSharedBandwidthMbitValue} Mbit/s` : ""}${showElbSharedTraffic ? ` | ${elbSharedTrafficAmountValue} ${elbSharedTrafficUnit}` : ""}` : ""}${elbType === "Dedicated load balancer" ? ` | ${selectedElbPricing.estimatedLcus.total} estimated LCU` : ""} | ${formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.amount, selectedElbPricing.suffix)}`
          : "Selected specifications:";
        selectionNotes.push(
          ...(selectedElbPricing
            ? [
                ...selectedElbPricing.breakdown.map((entry) => `${entry.label}: ${formatFlavorAmount(selectedElbPricing.currency, entry.amount, selectedElbPricing.suffix)}`),
                ...(elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic"
                  ? [
                      `Estimated LCUs: network ${selectedElbPricing.estimatedLcus.network}, application ${selectedElbPricing.estimatedLcus.application}, total ${selectedElbPricing.estimatedLcus.total}.`,
                      ...selectedElbPricing.protocolBreakdowns.map((entry) => `${entry.protocol}: ${entry.lcu} LCU (${entry.details.join(", ")})`),
                    ]
                  : []),
                ...(elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed"
                  ? [
                      `Fixed dedicated sizing: ${[
                        ...(elbFixedNetworkEnabled ? [`Network load balancing (TCP/UDP/TLS) ${elbFixedNetworkSpec}`] : []),
                        ...(elbFixedApplicationEnabled ? [`Application load balancing (HTTP/HTTPS) ${elbFixedApplicationSpec}`] : []),
                      ].join("; ")} across ${elbFixedAvailabilityAzCount} AZs.`,
                    ]
                  : []),
                ...selectedElbPricing.notes,
              ]
            : []),
        );
        referenceNote = `Pricing sourced from Huawei Cloud ELB calculator API for ${catalogRegionIdByService.ELB ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${elbPricingReference.pricingUrl}, ${elbPricingReference.fixedDrawerNetworkUrl}, and ${elbPricingReference.fixedDrawerAppUrl}`;
        break;
      case "NAT":
        selectionSummary = selectedNatPricing
          ? `Selected specifications: ${natType} | ${natSize} | ${formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.amount, selectedNatPricing.suffix)}`
          : "Selected specifications:";
        referenceNote = `Pricing sourced from Huawei Cloud NAT calculator API for ${catalogRegionIdByService.NAT ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${natPricingReference.pricingUrl} and ${natPricingReference.specsUrl}`;
        break;
      case "VPN":
        selectionSummary = selectedVpnPricing
          ? `Selected specifications: ${vpnEdition}${vpnEdition === "Enterprise" ? ` | ${vpnMode} | ${vpnNetworkType} | ${vpnSelectedSpecification}${showVpnPublicBandwidth ? ` | ${vpnUseSharedBandwidth ? "Shared" : "Dedicated"} bandwidth | EIP1 ${Math.max(0, Number(vpnEipBandwidthMbit1) || 0)} Mbit/s | EIP2 ${Math.max(0, Number(vpnEipBandwidthMbit2) || 0)} Mbit/s` : ""}` : ""}${billingMode === "Yearly/Monthly" ? ` | ${vpnDurationMonths}mo` : ""} | ${formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.amount, selectedVpnPricing.suffix)}`
          : "Selected specifications:";
        notes.unshift(vpnDescriptionNote);
        referenceNote = `Pricing sourced from Huawei Cloud VPN calculator API for ${catalogRegionIdByService.VPN ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${vpnPricingReference.pricingUrl}, ${vpnPricingReference.productUrl}, and ${vpnPricingReference.specsUrl}`;
        break;
      case "CCE":
        selectionSummary = selectedCcePricing
          ? `Selected specifications: ${cceClusterScale} | ${cceMasterNodes} | ${formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.amount, selectedCcePricing.suffix)}`
          : "Selected specifications:";
        referenceNote = `Pricing sourced from Huawei Cloud CCE calculator API for ${catalogRegionIdByService.CCE ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${ccePricingReference.pricingUrl}`;
        break;
      case "CCI":
        selectionSummary = `Selected specifications: ${cciCpu} vCPU | ${cciMemory} GiB`;
        referenceNote = "Reference pricing based on Huawei Cloud CCI calculator.";
        break;
      case "ModelArts":
        selectionSummary = `Selected specifications: AI Development Lifecycle | ${modelArtsResourceType} | ${modelArtsSpecification}${modelArtsResourceType === "EVS Storage" ? ` | ${modelArtsStorageQuotaValue} GB` : ` | ${modelArtsQuantityValue} instance${modelArtsQuantityValue === 1 ? "" : "s"}`}${billingMode === "Yearly/Monthly" ? ` | ${modelArtsDurationMonthsValue === 12 ? "1yr" : `${modelArtsDurationMonthsValue}mo`}` : ` | ${usageHoursValue}h`}${selectedModelArtsPricing ? ` | ${formatFlavorAmount(selectedModelArtsPricing.currency, selectedModelArtsPricing.amount, selectedModelArtsPricing.suffix)}` : ""}`;
        referenceNote = `Pricing sourced from Huawei Cloud ModelArts calculator API for ${catalogRegionIdByService.ModelArts ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${modelArtsPricingReference.pricingUrl} and ${modelArtsPricingReference.productUrl}`;
        break;
      case "Workspace":
        selectionSummary = `Selected specifications: x86 desktop | Ultimate | ${workspaceCpu} | ${workspaceMemory} | ${workspaceDiskType} ${workspaceDiskSizeGbValue} GB | CPU ${workspaceCpuUsageHoursValue}h | Disk ${workspaceDiskUsageHoursValue}h | ${workspaceQuantityValue} desktop${workspaceQuantityValue === 1 ? "" : "s"}${selectedWorkspacePricing ? ` | ${formatFlavorAmount(selectedWorkspacePricing.currency, selectedWorkspacePricing.amount, selectedWorkspacePricing.suffix)}` : ""}`;
        selectionNotes.push(
          ...(selectedWorkspacePricing
            ? [
                ...selectedWorkspacePricing.breakdown.map((entry) => `${entry.label}: ${formatFlavorAmount(selectedWorkspacePricing.currency, entry.amount, selectedWorkspacePricing.suffix)}`),
                `Monthly average: ${formatFlavorAmount(selectedWorkspacePricing.currency, selectedWorkspacePricing.monthlyAverageAmount, "/mo")}.`,
                ...selectedWorkspacePricing.notes,
              ]
            : []),
        );
        referenceNote = `Pricing sourced from Huawei Cloud Workspace calculator API for ${catalogRegionIdByService.Workspace ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${workspacePricingReference.pricingUrl} and ${workspacePricingReference.productUrl}`;
        break;
      case "DCS":
        selectionSummary = `Selected specifications: Basic | ${dcsVersion} | ${dcsInstanceType} | ${dcsArchitecture}${dcsShowReplicas && dcsReplicasValue != null ? ` | ${dcsReplicasValue} replicas` : ""} | ${dcsSpecification} | ${dcsQuantityValue} instance${dcsQuantityValue === 1 ? "" : "s"} | ${dcsElasticBandwidth}${dcsElasticBandwidth === "Buy now" ? ` ${dcsBandwidthMbitValue} Mbit/s` : ""} | ${dcsUsageHoursValue}h${selectedDcsPricing ? ` | ${formatFlavorAmount(selectedDcsPricing.currency, selectedDcsPricing.amount, selectedDcsPricing.suffix)}` : ""}`;
        selectionNotes.push(
          ...(selectedDcsPricing
            ? [
                ...selectedDcsPricing.breakdown.map((entry) => `${entry.label}: ${formatFlavorAmount(selectedDcsPricing.currency, entry.amount, selectedDcsPricing.suffix)}`),
                `Monthly average: ${formatFlavorAmount(selectedDcsPricing.currency, selectedDcsPricing.monthlyAverageAmount, "/mo")}.`,
                ...selectedDcsPricing.notes,
              ]
            : []),
        );
        referenceNote = `Pricing sourced from Huawei Cloud DCS calculator API for ${catalogRegionIdByService.DCS ?? (huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${dcsPricingReference.pricingUrl} and ${dcsPricingReference.productUrl}`;
        break;
    }

    return {
      definition: selectedServiceDefinition,
      fields,
      pricingError: pricingErrorByService[selectedServiceCode] || undefined,
      pricingLoadingMessage: pricingLoadingByService[selectedServiceCode] ? `Loading ${selectedServiceCode} pricing...` : null,
      notes,
      selectionSummary,
      selectionNotes,
      referenceNote,
    };
  }, [
    activeValues,
    billingMode,
    catalogRegionIdByService.CCE,
    catalogRegionIdByService.DCS,
    catalogRegionIdByService.EIP,
    catalogRegionIdByService.ELB,
    catalogRegionIdByService.ModelArts,
    catalogRegionIdByService.NAT,
    catalogRegionIdByService.OBS,
    catalogRegionIdByService.VPN,
    catalogRegionIdByService.Workspace,
    cceClusterScale,
    cceMasterNodes,
    cciCpu,
    cciMemory,
    dcsArchitecture,
    dcsBandwidthMbitValue,
    dcsElasticBandwidth,
    dcsInstanceType,
    dcsQuantityValue,
    dcsReplicasValue,
    dcsShowReplicas,
    dcsSpecification,
    dcsUsageHoursValue,
    dcsVersion,
    eipBandwidthMbitValue,
    eipChargeMode,
    eipEnhanced95DurationMonthsValue,
    eipSharedBandwidthQuantityValue,
    eipTrafficAmountValue,
    eipTrafficUnit,
    eipType,
    elbFixedApplicationEnabled,
    elbFixedApplicationSpec,
    elbFixedAvailabilityAzCount,
    elbFixedNetworkEnabled,
    elbFixedNetworkSpec,
    elbNetworkType,
    elbSharedBandwidthMbitValue,
    elbSharedChargeMode,
    elbSharedTrafficAmountValue,
    elbSharedTrafficUnit,
    elbSpecificationType,
    elbType,
    evsDiskSizeValue,
    evsDiskType,
    evsDurationMonthsValue,
    fieldDisabledById,
    fieldMaxById,
    fieldMinById,
    fieldOptionsById,
    gpSsd2IopsValue,
    gpSsd2ThroughputValue,
    isConfigurableService,
    isGpSsd2Selected,
    modelArtsDurationMonthsValue,
    modelArtsQuantityValue,
    modelArtsResourceType,
    modelArtsSpecification,
    modelArtsStorageQuotaValue,
    natSize,
    natType,
    obsDurationMonthsValue,
    obsProductType,
    obsReadTrafficUnit,
    obsReadTrafficValue,
    obsRedundancy,
    obsRestorationType,
    obsRestorationTypeOptions.length,
    obsStorageClass,
    obsStorageSizeValue,
    obsStorageUnit,
    pricingErrorByService,
    pricingLoadingByService,
    regionValue,
    resolveFieldValue,
    selectedCcePricing,
    selectedDiskPrice,
    selectedEipPricing,
    selectedElbPricing,
    selectedModelArtsPricing,
    selectedNatPricing,
    selectedObsPricing,
    selectedServiceCode,
    selectedServiceDefinition,
    selectedDcsPricing,
    selectedWorkspacePricing,
    selectedVpnPricing,
    setActiveFieldValue,
    showEipBandwidth,
    showEipEnhanced95DurationMonths,
    showEipSharedBandwidthQuantity,
    showEipTraffic,
    showElbSharedBandwidth,
    showElbSharedChargeMode,
    showElbSharedTraffic,
    showObsReplicationTraffic,
    showVpnPublicBandwidth,
    usageHoursValue,
    vpnDescriptionNote,
    vpnDurationMonths,
    vpnEdition,
    vpnEipBandwidthMbit1,
    vpnEipBandwidthMbit2,
    vpnMode,
    vpnNetworkType,
    vpnSelectedSpecification,
    vpnUseSharedBandwidth,
    workspaceCpu,
    workspaceCpuUsageHoursValue,
    workspaceDiskSizeGbValue,
    workspaceDiskType,
    workspaceDiskUsageHoursValue,
    workspaceMemory,
    workspaceQuantityValue,
  ]);

  const buildRequestBodies = useCallback((): ProductMutationBody | ProductMutationBody[] | null => {
    if (!isConfigurableService || addToListError) {
      return null;
    }

    const quantity = selectedServiceCode === "ModelArts" || selectedServiceCode === "Workspace" || selectedServiceCode === "DCS"
      ? 1
      : Math.max(1, instanceCountValue);

    switch (selectedServiceCode) {
      case "EVS":
        return buildEvsProductMutationBodies({
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          serviceTitle: selectedService,
          region: regionValue,
          billingMode,
          usageHours: usageHoursValue,
          durationMonths: evsDurationMonthsValue,
          quantity,
          description: selectedService,
          diskType: evsDiskType,
          diskSizeGiB: evsDiskSizeValue,
          requestedIops: isGpSsd2Selected ? gpSsd2IopsValue : null,
          requestedThroughput: isGpSsd2Selected ? gpSsd2ThroughputValue : null,
          diskPricing: evsDiskPricing,
        });
      case "OBS": {
        if (!obsCatalog || !selectedObsPricing) {
          return null;
        }
        const catalogRegionId = catalogRegionIdByService.OBS ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue;
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "obs",
          title: `${selectedService} ${obsProductType} ${obsStorageClass} ${obsStorageSizeValue} ${obsStorageUnit}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId,
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
              regionId: catalogRegionId,
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
                read: getObsRequestUnits(obsCatalog.requestRates[obsStorageClass]?.read?.measureUnitStep, convertObsRequestInputToCount(obsReadRequestsValue)),
                write: getObsRequestUnits(obsCatalog.requestRates[obsStorageClass]?.write?.measureUnitStep, convertObsRequestInputToCount(obsWriteRequestsValue)),
                delete: getObsRequestUnits(obsCatalog.requestRates[obsStorageClass]?.delete?.measureUnitStep, convertObsRequestInputToCount(obsDeleteRequestsValue)),
              },
            }),
          },
          pricing: {
            total: formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.amount * quantity, selectedObsPricing.suffix),
            estimate: formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.amount, selectedObsPricing.suffix),
            monthlyAverage: formatFlavorAmount(selectedObsPricing.currency, selectedObsPricing.monthlyAverageAmount, "/mo"),
            breakdown: selectedObsPricing.breakdown.map((entry) => ({
              label: entry.label,
              value: formatFlavorAmount(selectedObsPricing.currency, entry.amount, selectedObsPricing.suffix),
            })),
          },
        };
      }
      case "EIP":
        if (!selectedEipPricing) return null;
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "eip",
          title: `${selectedService} ${eipType} Dynamic BGP ${eipChargeMode}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId: catalogRegionIdByService.EIP ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
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
            total: formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.amount * quantity, selectedEipPricing.suffix),
            estimate: formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.amount, selectedEipPricing.suffix),
            monthlyAverage: formatFlavorAmount(selectedEipPricing.currency, selectedEipPricing.monthlyAverageAmount, "/mo"),
            breakdown: selectedEipPricing.breakdown.map((entry) => ({
              label: entry.label,
              value: formatFlavorAmount(selectedEipPricing.currency, entry.amount, selectedEipPricing.suffix),
            })),
          },
        };
      case "ELB":
        if (!selectedElbPricing) return null;
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "elb",
          title: `${selectedService} ${elbType}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId: catalogRegionIdByService.ELB ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
            billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
            type: elbType,
            specificationType: elbSpecificationType,
            subAz: elbDefaults.subAz,
            fixedAvailabilityAzCount: elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed" ? elbFixedAvailabilityAzCount : null,
            fixedSelectedTypes: elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed"
              ? [
                  ...(elbFixedNetworkEnabled ? (["Network load balancing (TCP/UDP/TLS)"] as const) : []),
                  ...(elbFixedApplicationEnabled ? (["Application load balancing (HTTP/HTTPS)"] as const) : []),
                ]
              : [],
            fixedTypeSpecs: elbType === "Dedicated load balancer" && elbSpecificationType === "Fixed"
              ? {
                  "Network load balancing (TCP/UDP/TLS)": elbFixedNetworkSpec,
                  "Application load balancing (HTTP/HTTPS)": elbFixedApplicationSpec,
                }
              : {},
            networkType: elbNetworkType,
            sharedChargeMode: showElbSharedChargeMode ? elbSharedChargeMode : null,
            sharedBandwidthMbit: showElbSharedBandwidth ? elbSharedBandwidthMbitValue : null,
            sharedTrafficAmount: showElbSharedTraffic ? elbSharedTrafficAmountValue : null,
            sharedTrafficUnit: showElbSharedTraffic ? elbSharedTrafficUnit : null,
            selectedProtocols: elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? elbSelectedProtocols : [],
            protocolInputs: elbType === "Dedicated load balancer" && elbSpecificationType === "Elastic" ? elbProtocolInputs : {},
            estimatedNetworkLcus: selectedElbPricing.estimatedLcus.network,
            estimatedApplicationLcus: selectedElbPricing.estimatedLcus.application,
            estimatedTotalLcus: selectedElbPricing.estimatedLcus.total,
            selectedNetworkSpecLcus: selectedElbPricing.selectedSpecLcus.network,
            selectedApplicationSpecLcus: selectedElbPricing.selectedSpecLcus.application,
            usageHours: usageHoursValue,
          },
          pricing: {
            total: formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.amount * quantity, selectedElbPricing.suffix),
            estimate: formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.amount, selectedElbPricing.suffix),
            monthlyAverage: formatFlavorAmount(selectedElbPricing.currency, selectedElbPricing.monthlyAverageAmount, "/mo"),
            breakdown: selectedElbPricing.breakdown.map((entry) => ({
              label: entry.label,
              value: formatFlavorAmount(selectedElbPricing.currency, entry.amount, selectedElbPricing.suffix),
            })),
          },
        };
      case "NAT":
        if (!selectedNatPricing) return null;
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "nat",
          title: `${selectedService} ${natType} ${natSize}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId: catalogRegionIdByService.NAT ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
            billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
            type: natType,
            size: natSize,
            resourceSpecCode: selectedNatPricing.tier.resourceSpecCode,
            usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
            billableDays: selectedNatPricing.billableDays,
          },
          pricing: {
            total: formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.amount * quantity, selectedNatPricing.suffix),
            estimate: formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.amount, selectedNatPricing.suffix),
            daily: selectedNatPricing.dailyAmount != null ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.dailyAmount, "/day") : null,
            hourly: selectedNatPricing.hourlyAmount != null ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.hourlyAmount, "/h") : null,
            monthly: selectedNatPricing.monthlyAmount != null ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.monthlyAmount, "/mo") : null,
            yearly: selectedNatPricing.yearlyAmount != null ? formatFlavorAmount(selectedNatPricing.currency, selectedNatPricing.yearlyAmount, "/yr") : null,
          },
        };
      case "VPN":
        if (!selectedVpnPricing) return null;
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "vpn",
          title: `${selectedService} ${vpnEdition} ${vpnMode} ${vpnSelectedSpecification}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId: catalogRegionIdByService.VPN ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
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
            total: formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.amount * quantity, selectedVpnPricing.suffix),
            estimate: formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.amount, selectedVpnPricing.suffix),
            monthlyAverage: formatFlavorAmount(selectedVpnPricing.currency, selectedVpnPricing.monthlyAverageAmount, "/mo"),
            breakdown: selectedVpnPricing.breakdown.map((entry) => ({
              label: entry.label,
              value: formatFlavorAmount(selectedVpnPricing.currency, entry.amount, selectedVpnPricing.suffix),
            })),
          },
        };
      case "CCE":
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "cce",
          title: `${selectedService} ${cceClusterScale} ${cceMasterNodes}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId: catalogRegionIdByService.CCE ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
            billingMode,
            clusterScale: cceClusterScale,
            masterNodes: cceMasterNodes,
            usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
            resourceSpecCode: selectedCcePricing?.tier.resourceSpecCode ?? null,
          },
          pricing: {
            total: selectedEstimate,
            estimate: selectedCcePricing ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.amount, selectedCcePricing.suffix) : null,
            hourly: selectedCcePricing?.hourlyAmount != null ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.hourlyAmount, "/h") : null,
            monthly: selectedCcePricing?.monthlyAmount != null ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.monthlyAmount, "/mo") : null,
            yearly: selectedCcePricing?.yearlyAmount != null ? formatFlavorAmount(selectedCcePricing.currency, selectedCcePricing.yearlyAmount, "/yr") : null,
          },
        };
      case "CCI":
        return {
          serviceCode: selectedServiceCode,
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
          pricing: { total: selectedEstimate },
        };
      case "ModelArts":
        if (!selectedModelArtsPricing) return null;
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "modelarts",
          title: `${selectedService} ${modelArtsResourceType} ${modelArtsSpecification}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId: catalogRegionIdByService.ModelArts ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
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
        };
      case "Workspace":
        if (!selectedWorkspacePricing) return null;
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "workspace",
          title: `${selectedService} ${workspaceCpu} ${workspaceMemory}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId: catalogRegionIdByService.Workspace ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
            billingMode: "Pay-per-use",
            architecture: "x86 desktop",
            specification: "Ultimate",
            cpu: workspaceCpu,
            memory: workspaceMemory,
            cpuUsageHours: workspaceCpuUsageHoursValue,
            diskType: workspaceDiskType,
            diskSizeGb: workspaceDiskSizeGbValue,
            diskUsageHours: workspaceDiskUsageHoursValue,
            quantity: workspaceQuantityValue,
            desktopResourceSpecCode: selectedWorkspacePricing.desktopTier.resourceSpecCode,
            desktopProductId: selectedWorkspacePricing.desktopTier.productIds.ONDEMAND ?? null,
            diskResourceSpecCode: selectedWorkspacePricing.diskTier.resourceSpecCode,
            diskProductId: selectedWorkspacePricing.diskTier.productIds.ONDEMAND ?? null,
          },
          pricing: {
            total: selectedEstimate,
            estimate: formatFlavorAmount(selectedWorkspacePricing.currency, selectedWorkspacePricing.amount, selectedWorkspacePricing.suffix),
            monthlyAverage: formatFlavorAmount(selectedWorkspacePricing.currency, selectedWorkspacePricing.monthlyAverageAmount, "/mo"),
            breakdown: selectedWorkspacePricing.breakdown.map((entry) => ({
              label: entry.label,
              value: formatFlavorAmount(selectedWorkspacePricing.currency, entry.amount, selectedWorkspacePricing.suffix),
            })),
          },
        };
      case "DCS":
        if (!selectedDcsPricing) return null;
        return {
          serviceCode: selectedServiceCode,
          serviceName: selectedService,
          productType: "dcs",
          title: `${selectedService} ${dcsVersion} ${dcsInstanceType} ${dcsSpecification}`,
          quantity,
          config: {
            region: regionValue,
            catalogRegionId: catalogRegionIdByService.DCS ?? huaweiRegions[regionValue].catalogRegionId ?? regionValue,
            billingMode: "Pay-per-use",
            edition: "Basic",
            version: dcsVersion,
            instanceType: dcsInstanceType,
            architecture: dcsArchitecture,
            replicas: dcsShowReplicas ? dcsReplicasValue : null,
            specification: dcsSpecification,
            quantity: dcsQuantityValue,
            elasticBandwidth: dcsElasticBandwidth,
            bandwidthMbit: dcsElasticBandwidth === "Buy now" ? dcsBandwidthMbitValue : null,
            usageHours: dcsUsageHoursValue,
            resourceSpecCode: selectedDcsPricing.tier.resourceSpecCode,
            productId: selectedDcsPricing.tier.productIds.ONDEMAND ?? null,
          },
          pricing: {
            total: selectedEstimate,
            estimate: formatFlavorAmount(selectedDcsPricing.currency, selectedDcsPricing.amount, selectedDcsPricing.suffix),
            monthlyAverage: formatFlavorAmount(selectedDcsPricing.currency, selectedDcsPricing.monthlyAverageAmount, "/mo"),
            breakdown: selectedDcsPricing.breakdown.map((entry) => ({
              label: entry.label,
              value: formatFlavorAmount(selectedDcsPricing.currency, entry.amount, selectedDcsPricing.suffix),
            })),
          },
        };
      default:
        return null;
    }
  }, [
    addToListError,
    billingMode,
    catalogRegionIdByService.CCE,
    catalogRegionIdByService.DCS,
    catalogRegionIdByService.ELB,
    catalogRegionIdByService.EIP,
    catalogRegionIdByService.ModelArts,
    catalogRegionIdByService.NAT,
    catalogRegionIdByService.OBS,
    catalogRegionIdByService.VPN,
    catalogRegionIdByService.Workspace,
    cceClusterScale,
    cceMasterNodes,
    cciCpu,
    cciMemory,
    dcsArchitecture,
    dcsBandwidthMbitValue,
    dcsElasticBandwidth,
    dcsInstanceType,
    dcsQuantityValue,
    dcsReplicasValue,
    dcsShowReplicas,
    dcsSpecification,
    dcsUsageHoursValue,
    dcsVersion,
    eipBandwidthMbitValue,
    eipChargeMode,
    eipEnhanced95DurationMonthsValue,
    eipSharedBandwidthQuantityValue,
    eipTrafficAmountValue,
    eipTrafficUnit,
    eipType,
    elbFixedApplicationEnabled,
    elbFixedApplicationSpec,
    elbFixedAvailabilityAzCount,
    elbFixedNetworkEnabled,
    elbFixedNetworkSpec,
    elbNetworkType,
    elbProtocolInputs,
    elbSelectedProtocols,
    elbSharedBandwidthMbitValue,
    elbSharedChargeMode,
    elbSharedTrafficAmountValue,
    elbSharedTrafficUnit,
    elbSpecificationType,
    elbType,
    evsDiskPricing,
    evsDiskSizeValue,
    evsDiskType,
    evsDurationMonthsValue,
    gpSsd2IopsValue,
    gpSsd2ThroughputValue,
    instanceCountValue,
    isConfigurableService,
    isGpSsd2Selected,
    modelArtsDurationMonthsValue,
    modelArtsQuantityValue,
    modelArtsResourceType,
    modelArtsSpecification,
    modelArtsStorageQuotaValue,
    natSize,
    natType,
    obsCatalog,
    obsDeleteRequestsValue,
    obsDurationMonthsValue,
    obsLifecycleTransitionRequestsValue,
    obsOutboundTrafficUnit,
    obsOutboundTrafficValue,
    obsProductType,
    obsPullTrafficUnit,
    obsPullTrafficValue,
    obsReadRequestsValue,
    obsReadTrafficUnit,
    obsReadTrafficValue,
    obsRedundancy,
    obsReplicationTrafficUnit,
    obsReplicationTrafficValue,
    obsRestorationType,
    obsStorageClass,
    obsStorageSizeValue,
    obsStorageUnit,
    obsWriteRequestsValue,
    regionValue,
    selectedCcePricing,
    selectedDcsPricing,
    selectedEipPricing,
    selectedElbPricing,
    selectedEstimate,
    selectedModelArtsPricing,
    selectedNatPricing,
    selectedObsPricing,
    selectedService,
    selectedServiceCode,
    selectedWorkspacePricing,
    selectedVpnPricing,
    showEipBandwidth,
    showEipEnhanced95DurationMonths,
    showEipSharedBandwidthQuantity,
    showEipTraffic,
    showElbSharedBandwidth,
    showElbSharedChargeMode,
    showElbSharedTraffic,
    showObsPullTraffic,
    showObsReplicationTraffic,
    showVpnPublicBandwidth,
    usageHoursValue,
    vpnDurationMonths,
    vpnEdition,
    vpnEipBandwidthMbit1,
    vpnEipBandwidthMbit2,
    vpnMode,
    vpnNetworkType,
    vpnSelectedSpecification,
    vpnUseSharedBandwidth,
    workspaceCpu,
    workspaceCpuUsageHoursValue,
    workspaceDiskSizeGbValue,
    workspaceDiskType,
    workspaceDiskUsageHoursValue,
    workspaceMemory,
    workspaceQuantityValue,
  ]);

  const hydrateProduct = useCallback((product: AppProduct): EditHydrationResult => {
    if (!isRecord(product.config)) {
      return { handled: false, error: "This product cannot be edited from the calculator." };
    }

    const nextRegion = readProductRegion(product, regionValue);
    const nextBillingMode = toBillingMode(product.config.billingMode, "Pay-per-use");
    const nextUsageHours =
      typeof product.config.usageHours === "number" && Number.isFinite(product.config.usageHours)
        ? String(Math.max(1, Math.floor(product.config.usageHours)))
        : "744";
    const nextInstanceCount = String(Math.max(1, product.quantity));

    switch (product.productType) {
      case "evs": {
        const systemDisk = isRecord(product.config.systemDisk) ? product.config.systemDisk : null;
        replaceServiceValues("EVS", {
          ...(serviceValuesByCode.EVS ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("EVS")!)),
          billingMode: nextBillingMode === "RI" ? "Pay-per-use" : nextBillingMode,
          diskType:
            (typeof product.config.diskType === "string" && (systemDiskOptions as readonly string[]).includes(product.config.diskType))
              ? product.config.diskType
              : (typeof systemDisk?.type === "string" && (systemDiskOptions as readonly string[]).includes(systemDisk.type))
              ? systemDisk.type
              : "High I/O",
          diskSizeGiB:
            typeof product.config.diskSizeGiB === "number" && Number.isFinite(product.config.diskSizeGiB)
              ? String(Math.max(evsDiskSizeBounds.min, Math.floor(product.config.diskSizeGiB)))
              : typeof systemDisk?.sizeGiB === "number" && Number.isFinite(systemDisk.sizeGiB)
              ? String(Math.max(ecsDiskSizeBounds.min, Math.floor(systemDisk.sizeGiB)))
              : String(evsDiskSizeBounds.min),
          usageHours: nextUsageHours,
          durationMonths:
            typeof product.config.durationMonths === "number" && Number.isFinite(product.config.durationMonths)
              ? String(Math.max(1, Math.floor(product.config.durationMonths)))
              : "1",
          iops: String(getGpSsd2RequestedIops(product.config, typeof product.config.diskSizeGiB === "number" ? product.config.diskSizeGiB : evsDiskSizeBounds.min)),
          throughput: String(
            getGpSsd2RequestedThroughput(
              product.config,
              getGpSsd2RequestedIops(product.config, typeof product.config.diskSizeGiB === "number" ? product.config.diskSizeGiB : evsDiskSizeBounds.min),
            ),
          ),
        });
        return {
          handled: true,
          nextRegion,
          nextBillingMode: nextBillingMode === "RI" ? "Pay-per-use" : nextBillingMode,
          nextUsageHours,
          nextInstanceCount,
        };
      }
      case "obs": {
        replaceServiceValues("OBS", {
          ...(serviceValuesByCode.OBS ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("OBS")!)),
          productType: isObsProductType(product.config.productType) ? product.config.productType : "Object storage",
          storageClass: isObsStorageClass(product.config.storageClass) ? product.config.storageClass : "Standard",
          redundancy: isObsRedundancy(product.config.redundancy) ? product.config.redundancy : "Single-AZ storage",
          storageAmount:
            typeof product.config.storageAmount === "number" && Number.isFinite(product.config.storageAmount)
              ? String(Math.max(obsStorageSizeBounds.min, product.config.storageAmount))
              : typeof product.config.storageGiB === "number" && Number.isFinite(product.config.storageGiB)
              ? String(Math.max(obsStorageSizeBounds.min, product.config.storageGiB))
              : String(obsStorageSizeBounds.min),
          storageUnit: isObsCapacityUnit(product.config.storageUnit) ? product.config.storageUnit : "GB",
          durationMonths:
            typeof product.config.durationMonths === "number" && Number.isFinite(product.config.durationMonths)
              ? String(Math.max(1, Math.floor(product.config.durationMonths)))
              : "1",
          outboundTrafficAmount:
            typeof product.config.outboundTrafficAmount === "number" && Number.isFinite(product.config.outboundTrafficAmount)
              ? String(Math.max(0, product.config.outboundTrafficAmount))
              : "0",
          outboundTrafficUnit: isObsCapacityUnit(product.config.outboundTrafficUnit) ? product.config.outboundTrafficUnit : "GB",
          readRequests:
            typeof product.config.readRequests === "number" && Number.isFinite(product.config.readRequests)
              ? formatObsRequestInputValue(product.config.readRequests)
              : "0",
          writeRequests:
            typeof product.config.writeRequests === "number" && Number.isFinite(product.config.writeRequests)
              ? formatObsRequestInputValue(product.config.writeRequests)
              : "0",
          deleteRequests:
            typeof product.config.deleteRequests === "number" && Number.isFinite(product.config.deleteRequests)
              ? formatObsRequestInputValue(product.config.deleteRequests)
              : "0",
          pullTrafficAmount:
            typeof product.config.pullTrafficAmount === "number" && Number.isFinite(product.config.pullTrafficAmount)
              ? String(Math.max(0, product.config.pullTrafficAmount))
              : "0",
          pullTrafficUnit: isObsCapacityUnit(product.config.pullTrafficUnit) ? product.config.pullTrafficUnit : "GB",
          restorationType: isObsRestorationType(product.config.restorationType) ? product.config.restorationType : "",
          readTrafficAmount:
            typeof product.config.readTrafficAmount === "number" && Number.isFinite(product.config.readTrafficAmount)
              ? String(Math.max(0, product.config.readTrafficAmount))
              : "0",
          readTrafficUnit: isObsCapacityUnit(product.config.readTrafficUnit) ? product.config.readTrafficUnit : "GB",
          replicationTrafficAmount:
            typeof product.config.replicationTrafficAmount === "number" && Number.isFinite(product.config.replicationTrafficAmount)
              ? String(Math.max(0, product.config.replicationTrafficAmount))
              : "0",
          replicationTrafficUnit: isObsCapacityUnit(product.config.replicationTrafficUnit) ? product.config.replicationTrafficUnit : "GB",
          lifecycleTransitionRequests:
            typeof product.config.lifecycleTransitionRequests === "number" && Number.isFinite(product.config.lifecycleTransitionRequests)
              ? formatObsRequestInputValue(product.config.lifecycleTransitionRequests)
              : "0",
        });
        return {
          handled: true,
          nextRegion,
          nextBillingMode: "Pay-per-use",
          nextUsageHours,
          nextInstanceCount,
        };
      }
      case "eip":
        replaceServiceValues("EIP", {
          ...(serviceValuesByCode.EIP ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("EIP")!)),
          type: product.config.type === "Shared EIP" ? "Shared EIP" : "Dedicated EIP",
          chargeMode:
            product.config.chargeMode === "By traffic" || product.config.chargeMode === "Enhanced 95"
              ? product.config.chargeMode
              : "By bandwidth",
          bandwidthMbit: typeof product.config.bandwidthMbit === "number" ? String(product.config.bandwidthMbit) : String(eipDefaults.bandwidthMbit),
          enhanced95DurationMonths: typeof product.config.durationMonths === "number" ? String(product.config.durationMonths) : "1",
          sharedBandwidthQuantity: typeof product.config.sharedBandwidthQuantity === "number" ? String(product.config.sharedBandwidthQuantity) : "1",
          trafficAmount: typeof product.config.trafficAmount === "number" ? String(product.config.trafficAmount) : "0",
          trafficUnit: product.config.trafficUnit === "TB" ? "TB" : "GB",
        });
        return { handled: true, nextRegion, nextBillingMode, nextUsageHours, nextInstanceCount };
      case "elb": {
        const fixedSelectedTypes = Array.isArray(product.config.fixedSelectedTypes)
          ? product.config.fixedSelectedTypes.filter((entry): entry is string => typeof entry === "string")
          : [];
        const fixedTypeSpecs = isRecord(product.config.fixedTypeSpecs) ? product.config.fixedTypeSpecs : {};
        const selectedProtocols = Array.isArray(product.config.selectedProtocols)
          ? product.config.selectedProtocols.filter((entry): entry is string => typeof entry === "string")
          : [];
        const protocolInputs = isRecord(product.config.protocolInputs) ? product.config.protocolInputs : {};
        const nextElbType = product.config.type === "Dedicated load balancer" ? "Dedicated load balancer" : "Shared load balancer";
        const nextElbBillingMode = getElbBillingOptions(nextElbType).includes(nextBillingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly")
          ? nextBillingMode
          : getElbBillingOptions(nextElbType)[0] ?? "Pay-per-use";
        replaceServiceValues("ELB", {
          ...(serviceValuesByCode.ELB ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("ELB")!)),
          type: nextElbType,
          specificationType: product.config.specificationType === "Elastic" ? "Elastic" : "Fixed",
          networkType: product.config.networkType === "Private network" ? "Private network" : "Public network",
          sharedChargeMode: product.config.sharedChargeMode === "By bandwidth" ? "By bandwidth" : "By traffic",
          usageHours: nextUsageHours,
          sharedBandwidthMbit:
            typeof product.config.sharedBandwidthMbit === "number" ? String(Math.max(0, product.config.sharedBandwidthMbit)) : String(elbDefaults.sharedBandwidthMbit),
          sharedTrafficAmount:
            typeof product.config.sharedTrafficAmount === "number" ? String(Math.max(0, product.config.sharedTrafficAmount)) : String(elbDefaults.sharedTrafficGb),
          sharedTrafficUnit: product.config.sharedTrafficUnit === "TB" ? "TB" : "GB",
          fixedAvailabilityAzCount:
            typeof product.config.fixedAvailabilityAzCount === "number" ? String(Math.max(1, Math.floor(product.config.fixedAvailabilityAzCount))) : String(elbDefaults.fixedAvailabilityAzCount),
          fixedNetworkEnabled: fixedSelectedTypes.includes("Network load balancing (TCP/UDP/TLS)") ? "true" : "false",
          fixedNetworkSpec:
            typeof fixedTypeSpecs["Network load balancing (TCP/UDP/TLS)"] === "string"
              ? String(fixedTypeSpecs["Network load balancing (TCP/UDP/TLS)"])
              : elbDefaults.fixedTypeSpecs["Network load balancing (TCP/UDP/TLS)"],
          fixedApplicationEnabled: fixedSelectedTypes.includes("Application load balancing (HTTP/HTTPS)") ? "true" : "false",
          fixedApplicationSpec:
            typeof fixedTypeSpecs["Application load balancing (HTTP/HTTPS)"] === "string"
              ? String(fixedTypeSpecs["Application load balancing (HTTP/HTTPS)"])
              : elbDefaults.fixedTypeSpecs["Application load balancing (HTTP/HTTPS)"],
          tcpEnabled: selectedProtocols.includes("Network load balancing (TCP)") ? "true" : "false",
          tcpNewConnections: String(isRecord(protocolInputs["Network load balancing (TCP)"]) && typeof protocolInputs["Network load balancing (TCP)"].newConnections === "number" ? Math.max(0, protocolInputs["Network load balancing (TCP)"].newConnections) : 0),
          tcpMaxConcurrentConnections: String(isRecord(protocolInputs["Network load balancing (TCP)"]) && typeof protocolInputs["Network load balancing (TCP)"].maxConcurrentConnections === "number" ? Math.max(0, protocolInputs["Network load balancing (TCP)"].maxConcurrentConnections) : 0),
          tcpMetricMode: isRecord(protocolInputs["Network load balancing (TCP)"]) && protocolInputs["Network load balancing (TCP)"].metricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
          tcpProcessedTrafficGbPerHour: String(isRecord(protocolInputs["Network load balancing (TCP)"]) && typeof protocolInputs["Network load balancing (TCP)"].processedTrafficGbPerHour === "number" ? Math.max(0, protocolInputs["Network load balancing (TCP)"].processedTrafficGbPerHour) : 0),
          tcpAverageBandwidthMbit: String(isRecord(protocolInputs["Network load balancing (TCP)"]) && typeof protocolInputs["Network load balancing (TCP)"].averageBandwidthMbit === "number" ? Math.max(0, protocolInputs["Network load balancing (TCP)"].averageBandwidthMbit) : 0),
          udpEnabled: selectedProtocols.includes("Network load balancing (UDP)") ? "true" : "false",
          udpNewConnections: String(isRecord(protocolInputs["Network load balancing (UDP)"]) && typeof protocolInputs["Network load balancing (UDP)"].newConnections === "number" ? Math.max(0, protocolInputs["Network load balancing (UDP)"].newConnections) : 0),
          udpMaxConcurrentConnections: String(isRecord(protocolInputs["Network load balancing (UDP)"]) && typeof protocolInputs["Network load balancing (UDP)"].maxConcurrentConnections === "number" ? Math.max(0, protocolInputs["Network load balancing (UDP)"].maxConcurrentConnections) : 0),
          udpMetricMode: isRecord(protocolInputs["Network load balancing (UDP)"]) && protocolInputs["Network load balancing (UDP)"].metricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
          udpProcessedTrafficGbPerHour: String(isRecord(protocolInputs["Network load balancing (UDP)"]) && typeof protocolInputs["Network load balancing (UDP)"].processedTrafficGbPerHour === "number" ? Math.max(0, protocolInputs["Network load balancing (UDP)"].processedTrafficGbPerHour) : 0),
          udpAverageBandwidthMbit: String(isRecord(protocolInputs["Network load balancing (UDP)"]) && typeof protocolInputs["Network load balancing (UDP)"].averageBandwidthMbit === "number" ? Math.max(0, protocolInputs["Network load balancing (UDP)"].averageBandwidthMbit) : 0),
          tlsEnabled: selectedProtocols.includes("Network load balancing (TLS)") ? "true" : "false",
          tlsNewConnections: String(isRecord(protocolInputs["Network load balancing (TLS)"]) && typeof protocolInputs["Network load balancing (TLS)"].newConnections === "number" ? Math.max(0, protocolInputs["Network load balancing (TLS)"].newConnections) : 0),
          tlsMaxConcurrentConnections: String(isRecord(protocolInputs["Network load balancing (TLS)"]) && typeof protocolInputs["Network load balancing (TLS)"].maxConcurrentConnections === "number" ? Math.max(0, protocolInputs["Network load balancing (TLS)"].maxConcurrentConnections) : 0),
          tlsMetricMode: isRecord(protocolInputs["Network load balancing (TLS)"]) && protocolInputs["Network load balancing (TLS)"].metricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
          tlsProcessedTrafficGbPerHour: String(isRecord(protocolInputs["Network load balancing (TLS)"]) && typeof protocolInputs["Network load balancing (TLS)"].processedTrafficGbPerHour === "number" ? Math.max(0, protocolInputs["Network load balancing (TLS)"].processedTrafficGbPerHour) : 0),
          tlsAverageBandwidthMbit: String(isRecord(protocolInputs["Network load balancing (TLS)"]) && typeof protocolInputs["Network load balancing (TLS)"].averageBandwidthMbit === "number" ? Math.max(0, protocolInputs["Network load balancing (TLS)"].averageBandwidthMbit) : 0),
          httpEnabled: selectedProtocols.includes("Application load balancing (HTTP/HTTPS)") ? "true" : "false",
          httpNewConnections: String(isRecord(protocolInputs["Application load balancing (HTTP/HTTPS)"]) && typeof protocolInputs["Application load balancing (HTTP/HTTPS)"].newConnections === "number" ? Math.max(0, protocolInputs["Application load balancing (HTTP/HTTPS)"].newConnections) : 0),
          httpMaxConcurrentConnections: String(isRecord(protocolInputs["Application load balancing (HTTP/HTTPS)"]) && typeof protocolInputs["Application load balancing (HTTP/HTTPS)"].maxConcurrentConnections === "number" ? Math.max(0, protocolInputs["Application load balancing (HTTP/HTTPS)"].maxConcurrentConnections) : 0),
          httpMetricMode: isRecord(protocolInputs["Application load balancing (HTTP/HTTPS)"]) && protocolInputs["Application load balancing (HTTP/HTTPS)"].metricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
          httpProcessedTrafficGbPerHour: String(isRecord(protocolInputs["Application load balancing (HTTP/HTTPS)"]) && typeof protocolInputs["Application load balancing (HTTP/HTTPS)"].processedTrafficGbPerHour === "number" ? Math.max(0, protocolInputs["Application load balancing (HTTP/HTTPS)"].processedTrafficGbPerHour) : 0),
          httpAverageBandwidthMbit: String(isRecord(protocolInputs["Application load balancing (HTTP/HTTPS)"]) && typeof protocolInputs["Application load balancing (HTTP/HTTPS)"].averageBandwidthMbit === "number" ? Math.max(0, protocolInputs["Application load balancing (HTTP/HTTPS)"].averageBandwidthMbit) : 0),
          httpQueriesPerSecond: String(isRecord(protocolInputs["Application load balancing (HTTP/HTTPS)"]) && typeof protocolInputs["Application load balancing (HTTP/HTTPS)"].queriesPerSecond === "number" ? Math.max(0, protocolInputs["Application load balancing (HTTP/HTTPS)"].queriesPerSecond) : 0),
          httpForwardingRules: String(isRecord(protocolInputs["Application load balancing (HTTP/HTTPS)"]) && typeof protocolInputs["Application load balancing (HTTP/HTTPS)"].forwardingRules === "number" ? Math.max(0, protocolInputs["Application load balancing (HTTP/HTTPS)"].forwardingRules) : 0),
        });
        return { handled: true, nextRegion, nextBillingMode: nextElbBillingMode, nextUsageHours, nextInstanceCount };
      }
      case "nat":
        replaceServiceValues("NAT", {
          ...(serviceValuesByCode.NAT ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("NAT")!)),
          natType: product.config.type === "Private NAT Gateway" ? "Private NAT Gateway" : "Public NAT Gateway",
          natSize:
            product.config.size === "Medium" || product.config.size === "Large" || product.config.size === "Extra-large"
              ? product.config.size
              : "Small",
        });
        return { handled: true, nextRegion, nextBillingMode, nextUsageHours, nextInstanceCount };
      case "vpn":
        replaceServiceValues("VPN", {
          ...(serviceValuesByCode.VPN ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("VPN")!)),
          edition: product.config.edition === "Enterprise" ? "Enterprise" : "Classic",
          mode: product.config.mode === "Point-to-Cloud" ? "Point-to-Cloud" : "Site-to-Cloud",
          networkType: product.config.networkType === "Private network" ? "Private network" : "Public network",
          useSharedBandwidth: product.config.useSharedBandwidth === true ? "Yes" : "No",
          eipBandwidthMbit1: typeof product.config.eipBandwidthMbit1 === "number" ? String(product.config.eipBandwidthMbit1) : String(vpnDefaults.eipBandwidthMbit1),
          eipBandwidthMbit2: typeof product.config.eipBandwidthMbit2 === "number" ? String(product.config.eipBandwidthMbit2) : String(vpnDefaults.eipBandwidthMbit2),
          durationMonths: typeof product.config.durationMonths === "number" ? String(product.config.durationMonths) : String(vpnDefaults.durationMonths),
        });
        return { handled: true, nextRegion, nextBillingMode, nextUsageHours, nextInstanceCount };
      case "cce":
        replaceServiceValues("CCE", {
          ...(serviceValuesByCode.CCE ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("CCE")!)),
          clusterScale: typeof product.config.clusterScale === "string" ? product.config.clusterScale : cceDefaults.scale,
          masterNodes: product.config.masterNodes === "Single" ? "Single" : "3 Masters",
        });
        return { handled: true, nextRegion, nextBillingMode, nextUsageHours, nextInstanceCount };
      case "cci":
        replaceServiceValues("CCI", {
          ...(serviceValuesByCode.CCI ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("CCI")!)),
          cpu: typeof product.config.cpu === "number" ? String(Math.max(1, Math.floor(product.config.cpu))) : "1",
          memoryGiB: typeof product.config.memoryGiB === "number" ? String(Math.max(1, Math.floor(product.config.memoryGiB))) : "1",
        });
        return { handled: true, nextRegion, nextBillingMode, nextUsageHours, nextInstanceCount };
      case "modelarts":
        replaceServiceValues("ModelArts", {
          ...(serviceValuesByCode.ModelArts ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("ModelArts")!)),
          serviceType: "AI Development Lifecycle",
          resourceType: isModelArtsResourceType(product.config.resourceType) ? product.config.resourceType : modelArtsDefaults.resourceType,
          specification: typeof product.config.specification === "string" ? product.config.specification : modelArtsDefaults.specification,
          quantity: typeof product.config.quantity === "number" ? String(Math.max(1, Math.floor(product.config.quantity))) : String(modelArtsDefaults.quantity),
          storageQuotaGb:
            typeof product.config.storageQuotaGb === "number" ? String(Math.max(1, product.config.storageQuotaGb)) : String(modelArtsDefaults.storageQuotaGb),
          durationMonths:
            typeof product.config.durationMonths === "number" && isModelArtsDurationMonths(product.config.durationMonths)
              ? String(product.config.durationMonths)
              : String(modelArtsDefaults.durationMonths),
          usageHours: nextUsageHours,
        });
        return { handled: true, nextRegion, nextBillingMode, nextUsageHours, nextInstanceCount: "1" };
      case "workspace":
        replaceServiceValues("Workspace", {
          ...(serviceValuesByCode.Workspace ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("Workspace")!)),
          architecture: "x86 desktop",
          specification: "Ultimate",
          cpu: isWorkspaceCpuOption(product.config.cpu) ? product.config.cpu : workspaceDefaults.cpu,
          memory: isWorkspaceMemoryOption(product.config.memory) ? product.config.memory : workspaceDefaults.memory,
          cpuUsageHours:
            typeof product.config.cpuUsageHours === "number" && Number.isFinite(product.config.cpuUsageHours)
              ? String(Math.max(1, Math.floor(product.config.cpuUsageHours)))
              : String(workspaceDefaults.cpuUsageHours),
          diskType: isWorkspaceDiskType(product.config.diskType) ? product.config.diskType : workspaceDefaults.diskType,
          diskSizeGb:
            typeof product.config.diskSizeGb === "number" && Number.isFinite(product.config.diskSizeGb)
              ? String(Math.max(80, Math.floor(product.config.diskSizeGb)))
              : String(workspaceDefaults.diskSizeGb),
          diskUsageHours:
            typeof product.config.diskUsageHours === "number" && Number.isFinite(product.config.diskUsageHours)
              ? String(Math.max(1, Math.floor(product.config.diskUsageHours)))
              : String(workspaceDefaults.diskUsageHours),
          quantity:
            typeof product.config.quantity === "number" && Number.isFinite(product.config.quantity)
              ? String(Math.max(1, Math.floor(product.config.quantity)))
              : String(workspaceDefaults.quantity),
        });
        return { handled: true, nextRegion, nextBillingMode: "Pay-per-use", nextUsageHours: String(workspaceDefaults.cpuUsageHours), nextInstanceCount: "1" };
      case "dcs":
        replaceServiceValues("DCS", {
          ...(serviceValuesByCode.DCS ?? buildDefaultValues(getConfigurableServiceDefinitionByCode("DCS")!)),
          edition: "Basic",
          version: isDcsVersion(product.config.version) ? product.config.version : dcsDefaults.version,
          instanceType: isDcsInstanceType(product.config.instanceType) ? product.config.instanceType : dcsDefaults.instanceType,
          architecture: isDcsArchitecture(product.config.architecture) ? product.config.architecture : dcsDefaults.architecture,
          replicas:
            typeof product.config.replicas === "number" && Number.isFinite(product.config.replicas)
              ? String(Math.max(1, Math.floor(product.config.replicas)))
              : String(dcsDefaults.replicas),
          specification: typeof product.config.specification === "string" ? product.config.specification : dcsDefaults.specification,
          quantity:
            typeof product.config.quantity === "number" && Number.isFinite(product.config.quantity)
              ? String(Math.max(1, Math.floor(product.config.quantity)))
              : String(dcsDefaults.quantity),
          elasticBandwidth: isDcsBandwidthMode(product.config.elasticBandwidth) ? product.config.elasticBandwidth : dcsDefaults.elasticBandwidth,
          bandwidthMbit:
            typeof product.config.bandwidthMbit === "number" && Number.isFinite(product.config.bandwidthMbit)
              ? String(Math.max(1, Math.floor(product.config.bandwidthMbit)))
              : String(dcsDefaults.bandwidthMbit),
          usageHours:
            typeof product.config.usageHours === "number" && Number.isFinite(product.config.usageHours)
              ? String(Math.max(1, Math.floor(product.config.usageHours)))
              : String(dcsDefaults.usageHours),
        });
        return { handled: true, nextRegion, nextBillingMode: "Pay-per-use", nextUsageHours: String(dcsDefaults.usageHours), nextInstanceCount: "1" };
      default:
        return { handled: false, error: "This product cannot be edited from the calculator." };
    }
  }, [regionValue, replaceServiceValues, serviceValuesByCode]);

  return {
    isConfigurableService,
    activeBillingOptions,
    panelProps: activePanelProps,
    selectedEstimate,
    quantityLabel: runtimeMeta.quantityLabel,
    showGlobalQuantityControl: runtimeMeta.showGlobalQuantityControl,
    showSharedUsageHours: runtimeMeta.shouldShowSharedUsageHours({ showEipEnhanced95DurationMonths }),
    addToListError,
    buildRequestBodies,
    applyDefaultsForServiceCode,
    hydrateProduct,
    batchSnapshot: {
      obs: {
        catalog: obsCatalog,
        catalogRegionId: catalogRegionIdByService.OBS ?? null,
        productType: obsProductType,
        storageClass: obsStorageClass,
        redundancy: obsRedundancy,
        storageSizeValue: obsStorageSizeValue,
        storageUnit: obsStorageUnit,
        durationMonthsValue: obsDurationMonthsValue,
        outboundTrafficValue: obsOutboundTrafficValue,
        outboundTrafficUnit: obsOutboundTrafficUnit,
        readRequestsValue: obsReadRequestsValue,
        writeRequestsValue: obsWriteRequestsValue,
        deleteRequestsValue: obsDeleteRequestsValue,
        pullTrafficValue: obsPullTrafficValue,
        pullTrafficUnit: obsPullTrafficUnit,
        restorationType: obsRestorationType,
        readTrafficValue: obsReadTrafficValue,
        readTrafficUnit: obsReadTrafficUnit,
        replicationTrafficValue: obsReplicationTrafficValue,
        replicationTrafficUnit: obsReplicationTrafficUnit,
        lifecycleTransitionRequestsValue: obsLifecycleTransitionRequestsValue,
      },
      evs: {
        diskPricing: evsDiskPricing,
        diskType: evsDiskType,
        diskSizeValue: evsDiskSizeValue,
        durationMonthsValue: evsDurationMonthsValue,
        requestedIops: isGpSsd2Selected ? gpSsd2IopsValue : null,
        requestedThroughput: isGpSsd2Selected ? gpSsd2ThroughputValue : null,
      },
    },
  };
}
