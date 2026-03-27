import { buildObsHuaweiPayload, convertObsCapacityToGb, convertObsRequestInputToCount, estimateObsConfiguration, getObsRedundancyOptions, getObsStorageClassOptions, listObsProductTypes, listObsRedundancies, listObsRestorationTypes, listObsStorageClasses, normalizeObsPositiveNumber, obsPricingReference, shouldShowObsPullTraffic, type ObsCapacityUnit, type ObsEstimateInput, type ObsPricingCatalog, type ObsProductType, type ObsRedundancy, type ObsRestorationType, type ObsStorageClass } from "@/lib/obs-catalog";
import { eipDefaults, eipSharedBandwidthMinimumMbit, eipSharedEnhanced95MinimumMbit, estimateEipConfiguration, eipPricingReference } from "@/lib/eip-catalog";
import { elbDefaults, elbDedicatedProtocolOptions, elbFixedSpecOptions, estimateElbConfiguration, elbPricingReference, getElbBillingOptions, shouldShowElbSharedBandwidth, shouldShowElbSharedChargeMode, shouldShowElbSharedTraffic } from "@/lib/elb-catalog";
import { cceDefaults, ccePricingReference, estimateCceConfiguration, getFallbackCcePricingCatalog, listCceClusterScales, listCceMasterNodes } from "@/lib/cce-catalog";
import { dcsDefaults, dcsPricingReference, estimateDcsConfiguration, listDcsArchitectures, listDcsInstanceTypes, listDcsReplicas, listDcsSpecifications, listDcsVersions } from "@/lib/dcs-catalog";
import { estimateNatConfiguration, getFallbackNatPricingCatalog, listNatGatewaySizes, listNatGatewayTypes, natDefaults, natPricingReference } from "@/lib/nat-catalog";
import { estimateModelArtsConfiguration, listModelArtsResourceTypes, listModelArtsSpecifications, modelArtsDefaults, modelArtsPricingReference } from "@/lib/modelarts-catalog";
import { estimateVpnConfiguration, getFallbackVpnPricingCatalog, getVpnBillingOptions, listVpnModes, listVpnSpecifications, shouldShowVpnPublicBandwidth, vpnDefaults, vpnPricingReference } from "@/lib/vpn-catalog";
import { estimateWorkspaceConfiguration, listWorkspaceCpuOptions, listWorkspaceDiskTypes, listWorkspaceMemoryOptions, workspaceDefaults, workspacePricingReference } from "@/lib/workspace-catalog";
import { buildEvsProductMutationBodies, buildEvsSplitNotice, evsDiskSizeBounds, formatObsRequestInputValue, getGpSsd2IopsBounds, getGpSsd2RequestedIops, getGpSsd2RequestedThroughput, getGpSsd2ThroughputBounds, getObsRequestUnits, normalizeGpSsd2Iops, normalizeGpSsd2Throughput, obsStorageSizeBounds, parsePositiveNumber, splitEvsDiskSizes, systemDiskOptions } from "@/lib/configurable-runtime-utils";
import { getBatchDescription, getBatchDiskSize, getBatchDiskType, getBatchObsAmount, getBatchObsProductType, getBatchObsRedundancy, getBatchObsStorageClass, getBatchObsStorageSize, getBatchObsUnit, getNestedRecord, parseBatchQuantity } from "@/lib/batch-input-utils";
import { formatFlavorAmount, getDiskPriceForBillingOption, isRecord } from "@/lib/calculator-page-helpers";
import { huaweiRegions } from "@/lib/huawei-regions";

function asArray<T>(value: T[] | readonly T[] | null | undefined) {
  return Array.isArray(value) ? [...value] : [];
}

function optionList(values: readonly (string | number)[] | null | undefined) {
  return asArray(values).map((value) => ({ value: String(value), label: String(value) }));
}

function clampNumber(value: unknown, minimum: number, maximum?: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return minimum;
  }
  return maximum == null ? Math.max(minimum, parsed) : Math.min(maximum, Math.max(minimum, parsed));
}

function clampInteger(value: unknown, minimum: number, maximum?: number) {
  return Math.floor(clampNumber(value, minimum, maximum));
}

function boolString(value: unknown) {
  return value === true || value === "true" || value === "Enabled" ? "true" : "false";
}

function firstDefined<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value != null) {
      return value;
    }
  }
  return null;
}

function byLabelAmount(currency: string, suffix: string, breakdown: Array<{ label: string; amount: number }> | null | undefined) {
  return asArray(breakdown).map((entry) => ({
    label: entry.label,
    value: formatFlavorAmount(currency, entry.amount, suffix),
  }));
}

function formatBreakdownNotes(currency: string, suffix: string, breakdown: Array<{ label: string; amount: number }> | null | undefined) {
  return byLabelAmount(currency, suffix, breakdown).map((entry) => `${entry.label}: ${entry.value}`);
}

export const declarativeRuntimeHelpers = {
  formatFlavorAmount,
  getDiskPriceForBillingOption,
  buildEvsProductMutationBodies,
  buildEvsSplitNotice,
  splitEvsDiskSizes,
  getGpSsd2IopsBounds,
  getGpSsd2RequestedIops,
  getGpSsd2RequestedThroughput,
  getGpSsd2ThroughputBounds,
  normalizeGpSsd2Iops,
  normalizeGpSsd2Throughput,
  evsDiskSizeBounds,
  obsStorageSizeBounds,
  systemDiskOptions,
  parsePositiveNumber,
  normalizeObsPositiveNumber,
  convertObsCapacityToGb,
  convertObsRequestInputToCount,
  formatObsRequestInputValue,
  getObsRequestUnits,
  getObsStorageClassOptions,
  getObsRedundancyOptions,
  listObsProductTypes,
  listObsStorageClasses,
  listObsRedundancies,
  listObsRestorationTypes,
  shouldShowObsPullTraffic,
  estimateObsConfiguration,
  buildObsHuaweiPayload,
  estimateEipConfiguration,
  estimateElbConfiguration,
  estimateNatConfiguration,
  estimateVpnConfiguration,
  estimateCceConfiguration,
  estimateModelArtsConfiguration,
  estimateWorkspaceConfiguration,
  estimateDcsConfiguration,
  getElbBillingOptions,
  shouldShowElbSharedBandwidth,
  shouldShowElbSharedChargeMode,
  shouldShowElbSharedTraffic,
  getFallbackNatPricingCatalog,
  getFallbackVpnPricingCatalog,
  getFallbackCcePricingCatalog,
  getVpnBillingOptions,
  shouldShowVpnPublicBandwidth,
  listNatGatewayTypes,
  listNatGatewaySizes,
  listVpnModes,
  listVpnSpecifications,
  listCceClusterScales,
  listCceMasterNodes,
  listModelArtsResourceTypes,
  listModelArtsSpecifications,
  listWorkspaceCpuOptions,
  listWorkspaceMemoryOptions,
  listWorkspaceDiskTypes,
  listDcsVersions,
  listDcsInstanceTypes,
  listDcsArchitectures,
  listDcsReplicas,
  listDcsSpecifications,
  getBatchDescription,
  getBatchDiskSize,
  getBatchDiskType,
  getBatchObsAmount,
  getBatchObsProductType,
  getBatchObsRedundancy,
  getBatchObsStorageClass,
  getBatchObsStorageSize,
  getBatchObsUnit,
  getNestedRecord,
  parseBatchQuantity,
  optionList,
  clampNumber,
  clampInteger,
  boolString,
  firstDefined,
  byLabelAmount,
  formatBreakdownNotes,
  obsPricingReference,
  eipDefaults,
  eipSharedBandwidthMinimumMbit,
  eipSharedEnhanced95MinimumMbit,
  elbDefaults,
  elbDedicatedProtocolOptions,
  elbFixedSpecOptions,
  cceDefaults,
  dcsDefaults,
  natDefaults,
  modelArtsDefaults,
  vpnDefaults,
  workspaceDefaults,
  eipPricingReference,
  elbPricingReference,
  ccePricingReference,
  dcsPricingReference,
  natPricingReference,
  modelArtsPricingReference,
  vpnPricingReference,
  workspacePricingReference,
  huaweiRegions,
  isRecord,
  asArray,
};

export type DeclarativeRuntimeHelpers = typeof declarativeRuntimeHelpers;
export type { ObsCapacityUnit, ObsEstimateInput, ObsPricingCatalog, ObsProductType, ObsRedundancy, ObsRestorationType, ObsStorageClass };
