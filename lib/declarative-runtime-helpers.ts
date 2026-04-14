import { apigDefaults, apigPricingReference, estimateApigConfiguration, listApigEditions } from "@/lib/apig-catalog";
import { cbhDefaults, cbhPricingReference, estimateCbhConfiguration, listCbhDurationMonths, listCbhEditions, listCbhInstanceTypes } from "@/lib/cbh-catalog";
import { cbrDefaults, cbrPricingReference, estimateCbrConfiguration, listCbrDurationMonths, listCbrVaultTypes } from "@/lib/cbr-catalog";
import { ccmDefaults, ccmPricingReference, estimateCcmConfiguration, listCcmAuthorities, listCcmCertificateTypes, listCcmDomainTypes, listCcmValidityPeriods } from "@/lib/ccm-catalog";
import { buildObsHuaweiPayload, convertObsCapacityToGb, convertObsRequestInputToCount, estimateObsConfiguration, getObsRedundancyOptions, getObsStorageClassOptions, listObsProductTypes, listObsRedundancies, listObsRestorationTypes, listObsStorageClasses, normalizeObsPositiveNumber, obsPricingReference, shouldShowObsPullTraffic, type ObsCapacityUnit, type ObsEstimateInput, type ObsPricingCatalog, type ObsProductType, type ObsRedundancy, type ObsRestorationType, type ObsStorageClass } from "@/lib/obs-catalog";
import { eipDefaults, eipSharedBandwidthMinimumMbit, eipSharedEnhanced95MinimumMbit, estimateEipConfiguration, eipPricingReference } from "@/lib/eip-catalog";
import { elbDefaults, elbDedicatedProtocolOptions, elbFixedSpecOptions, estimateElbConfiguration, elbPricingReference, getElbBillingOptions, shouldShowElbSharedBandwidth, shouldShowElbSharedChargeMode, shouldShowElbSharedTraffic } from "@/lib/elb-catalog";
import { cceDefaults, ccePricingReference, estimateCceConfiguration, getFallbackCcePricingCatalog, listCceClusterScales, listCceMasterNodes } from "@/lib/cce-catalog";
import { dcsDefaults, dcsPricingReference, estimateDcsConfiguration, listDcsArchitectures, listDcsInstanceTypes, listDcsReplicas, listDcsSpecifications, listDcsVersions } from "@/lib/dcs-catalog";
import { estimateNatConfiguration, getFallbackNatPricingCatalog, listNatGatewaySizes, listNatGatewayTypes, natDefaults, natPricingReference } from "@/lib/nat-catalog";
import { estimateModelArtsConfiguration, listModelArtsResourceTypes, listModelArtsSpecifications, modelArtsDefaults, modelArtsPricingReference } from "@/lib/modelarts-catalog";
import { estimateVpnConfiguration, getFallbackVpnPricingCatalog, getVpnBillingOptions, listVpnModes, listVpnSpecifications, shouldShowVpnPublicBandwidth, vpnDefaults, vpnPricingReference } from "@/lib/vpn-catalog";
import { estimateWorkspaceConfiguration, listWorkspaceCpuOptions, listWorkspaceDiskTypes, listWorkspaceMemoryOptions, workspaceDefaults, workspacePricingReference } from "@/lib/workspace-catalog";
import { estimateFunctionGraphConfiguration, functionGraphDefaults, functionGraphPricingReference, getFallbackFunctionGraphPricingCatalog } from "@/lib/functiongraph-catalog";
import { estimateFlexusRdsConfiguration, flexusRdsDefaults, flexusRdsPricingReference, listFlexusRdsEngines, listFlexusRdsInstanceTypes, listFlexusRdsSizes, listFlexusRdsVersions } from "@/lib/flexus-rds-catalog";
import { directConnectDefaults, directConnectPricingReference, estimateDirectConnectConfiguration, listDirectConnectDurationMonths, listDirectConnectPortSpeeds } from "@/lib/direct-connect-catalog";
import { erDefaults, erPricingReference, estimateErConfiguration } from "@/lib/er-catalog";
import { estimateGaConfiguration, gaDefaults, gaPricingReference, getGaDestinationEndpointForRegion, listGaAccessPoints } from "@/lib/ga-catalog";
import { estimateGaussDbConfiguration, gaussDbDefaults, gaussDbPricingReference, listGaussDbEditions, listGaussDbSpecifications } from "@/lib/gaussdb-catalog";
import { estimateLtsConfiguration, ltsDefaults, ltsPricingReference } from "@/lib/lts-catalog";
import { estimateRdsConfiguration, isRdsEngine, isRdsInstanceClass, isRdsInstanceType, isRdsStorageType, isRdsVersion, listRdsEngines, listRdsInstanceClasses, listRdsInstanceTypes, listRdsSizes, listRdsStorageTypes, listRdsVersions, rdsDefaults, rdsPricingReference } from "@/lib/rds-catalog";
import { estimateVpcepConfiguration, listVpcepServiceCategories, vpcepDefaults, vpcepPricingReference } from "@/lib/vpcep-catalog";
import { convertSfsStorageToGb, estimateSfsConfiguration, getSfsStorageUnitOptions, hasSfsPackagePricing, inferSfsStorageAmountFromGb, inferSfsStorageUnitFromGb, listSfsDurationMonths, listSfsFileSystemTypes, listSfsStorageSpaceOptions, listSfsTypes, sfsDefaults, sfsPricingReference } from "@/lib/sfs-catalog";
import { estimateSfsTurboConfiguration, listSfsTurboBillingOptions, listSfsTurboCapacityOptions, listSfsTurboDurationMonths, listSfsTurboGenerations, listSfsTurboTypes, sfsTurboDefaults, sfsTurboPricingReference } from "@/lib/sfs-turbo-catalog";
import { estimateGesConfiguration, gesDefaults, gesPricingReference, listGesGraphSizes } from "@/lib/ges-catalog";
import { estimateHssConfiguration, hssDefaults, hssPricingReference, listHssEditions } from "@/lib/hss-catalog";
import { estimateDewConfiguration, dewDefaults, dewPricingReference, listDewKeyTypes } from "@/lib/dew-catalog";
import { estimateSmnConfiguration, smnDefaults, smnPricingReference, listSmnProtocolTypes } from "@/lib/smn-catalog";
import { estimateDwsConfiguration, dwsDefaults, dwsPricingReference, listDwsSpecifications } from "@/lib/dws-catalog";
import { estimateDliConfiguration, dliDefaults, dliPricingReference, listDliBillingItems, listDliSpecifications } from "@/lib/dli-catalog";
import { estimateCdmConfiguration, cdmDefaults, cdmPricingReference, listCdmInstanceTypes } from "@/lib/cdm-catalog";
import { estimateDdsConfiguration, ddsDefaults, ddsPricingReference, listDdsDbTypes, listDdsSpecifications } from "@/lib/dds-catalog";
import { estimateWafConfiguration, wafDefaults, wafPricingReference, listWafEditions } from "@/lib/waf-catalog";
import { estimateCfwConfiguration, cfwDefaults, cfwPricingReference, listCfwEditions } from "@/lib/cfw-catalog";
import { estimateDmsConfiguration, dmsDefaults, dmsPricingReference, listDmsFlavors, listDmsBandwidths, listDmsStorageTypes } from "@/lib/dms-catalog";
import { estimateDrsConfiguration, drsDefaults, drsPricingReference, listDrsTaskTypes, listDrsDirections } from "@/lib/drs-catalog";
import { estimateMrsConfiguration, mrsDefaults, mrsPricingReference, listMrsClusterTypes, listMrsNodeTypes } from "@/lib/mrs-catalog";
import { estimateCseConfiguration, cseDefaults, csePricingReference, listCseSpecifications } from "@/lib/cse-catalog";
import { disDefaults, disPricingReference, estimateDisConfiguration, listDisTypes } from "@/lib/dis-catalog";
import { buildEvsProductMutationBodies, buildEvsSplitNotice, evsDiskSizeBounds, formatObsRequestInputValue, getGpSsd2IopsBounds, getGpSsd2RequestedIops, getGpSsd2RequestedThroughput, getGpSsd2ThroughputBounds, getObsRequestUnits, normalizeGpSsd2Iops, normalizeGpSsd2Throughput, obsStorageSizeBounds, parsePositiveNumber, splitEvsDiskSizes, systemDiskOptions } from "@/lib/configurable-runtime-utils";
import { getBatchDescription, getBatchDiskSize, getBatchDiskType, getBatchObsAmount, getBatchObsProductType, getBatchObsRedundancy, getBatchObsStorageClass, getBatchObsStorageSize, getBatchObsUnit, getNestedRecord, parseBatchQuantity } from "@/lib/batch-input-utils";
import { formatFlavorAmount, getDiskPriceForBillingOption, isRecord } from "@/lib/calculator-page-helpers";
import { evaluateDefinitionExpression } from "@/lib/declarative-runtime-evaluator";
import { huaweiRegions } from "@/lib/huawei-regions";

function asArray<T>(value: T[] | readonly T[] | null | undefined) {
  return Array.isArray(value) ? [...value] : [];
}

function optionList(values: readonly (string | number)[] | null | undefined) {
  return asArray(values).map((value) => ({ value: String(value), label: String(value) }));
}

function resolveOption<T extends string | number>(value: unknown, options: readonly T[] | null | undefined, fallback: T) {
  const normalizedOptions = asArray(options);
  const resolved = normalizedOptions.find((entry) => entry === value);
  if (resolved != null) {
    return resolved;
  }
  return normalizedOptions[0] ?? fallback;
}

function resolveNumberOption(value: unknown, options: readonly number[] | null | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  const normalizedOptions = asArray(options).filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
  if (Number.isFinite(parsed) && normalizedOptions.includes(parsed)) {
    return parsed;
  }
  return normalizedOptions[0] ?? fallback;
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

function concatArrays<T>(...values: Array<readonly T[] | T[] | null | undefined>) {
  return values.flatMap((value) => asArray(value));
}

function joinSelectionParts(values: Array<string | number | null | undefined>) {
  return values
    .filter((value): value is string | number => value != null && String(value).trim().length > 0)
    .map(String)
    .join(" | ");
}

function firstMeaningfulText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function integerString(value: unknown, fallback: unknown, minimum = 1, maximum?: number) {
  const fallbackValue = clampInteger(fallback, minimum, maximum);
  return String(clampInteger(value, minimum, maximum) || fallbackValue);
}

function multiplyNumbers(...values: Array<number | null | undefined>) {
  return values.reduce<number>((product, value) => product * (typeof value === "number" && Number.isFinite(value) ? value : 1), 1);
}

function getCatalogRegionId(regionValue: keyof typeof huaweiRegions | string) {
  if (typeof regionValue === "string" && regionValue in huaweiRegions) {
    return huaweiRegions[regionValue as keyof typeof huaweiRegions].catalogRegionId ?? regionValue;
  }

  return regionValue;
}

function runLegacyDefinitionExpression(expression: string | null | undefined, scope: Record<string, unknown>) {
  return evaluateDefinitionExpression(expression, {
    helpers: declarativeRuntimeHelpers,
    ...scope,
  });
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
  estimateApigConfiguration,
  estimateCcmConfiguration,
  estimateCbhConfiguration,
  estimateCbrConfiguration,
  estimateEipConfiguration,
  estimateElbConfiguration,
  estimateNatConfiguration,
  estimateVpnConfiguration,
  estimateCceConfiguration,
  estimateModelArtsConfiguration,
  estimateWorkspaceConfiguration,
  estimateFunctionGraphConfiguration,
  estimateDirectConnectConfiguration,
  estimateErConfiguration,
  estimateGaConfiguration,
  estimateFlexusRdsConfiguration,
  estimateLtsConfiguration,
  estimateRdsConfiguration,
  estimateVpcepConfiguration,
  estimateSfsConfiguration,
  estimateSfsTurboConfiguration,
  hasSfsPackagePricing,
  estimateDcsConfiguration,
  estimateGesConfiguration,
  estimateCseConfiguration,
  estimateDisConfiguration,
  estimateHssConfiguration,
  estimateDewConfiguration,
  estimateSmnConfiguration,
  estimateDwsConfiguration,
  estimateDliConfiguration,
  estimateCdmConfiguration,
  estimateDdsConfiguration,
  estimateWafConfiguration,
  estimateCfwConfiguration,
  estimateDmsConfiguration,
  estimateDrsConfiguration,
  estimateMrsConfiguration,
  estimateGaussDbConfiguration,
  convertSfsStorageToGb,
  inferSfsStorageUnitFromGb,
  inferSfsStorageAmountFromGb,
  getElbBillingOptions,
  shouldShowElbSharedBandwidth,
  shouldShowElbSharedChargeMode,
  shouldShowElbSharedTraffic,
  getFallbackNatPricingCatalog,
  getFallbackVpnPricingCatalog,
  getFallbackCcePricingCatalog,
  getFallbackFunctionGraphPricingCatalog,
  getVpnBillingOptions,
  shouldShowVpnPublicBandwidth,
  listApigEditions,
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
  listRdsEngines,
  listFlexusRdsEngines,
  listFlexusRdsVersions,
  listFlexusRdsInstanceTypes,
  listFlexusRdsSizes,
  listDirectConnectPortSpeeds,
  listDirectConnectDurationMonths,
  listGaAccessPoints,
  listCbhInstanceTypes,
  listCbhEditions,
  listCbhDurationMonths,
  listCcmCertificateTypes,
  listCcmAuthorities,
  listCcmDomainTypes,
  listCcmValidityPeriods,
  listCbrVaultTypes,
  listCbrDurationMonths,
  listRdsVersions,
  listRdsInstanceTypes,
  listRdsInstanceClasses,
  listRdsSizes,
  listRdsStorageTypes,
  listVpcepServiceCategories,
  listDcsVersions,
  listDcsInstanceTypes,
  listDcsArchitectures,
  listDcsReplicas,
  listDcsSpecifications,
  listSfsFileSystemTypes,
  listSfsTypes,
  listSfsStorageSpaceOptions,
  listSfsDurationMonths,
  getSfsStorageUnitOptions,
  listSfsTurboGenerations,
  listSfsTurboTypes,
  listSfsTurboCapacityOptions,
  listSfsTurboDurationMonths,
  listSfsTurboBillingOptions,
  listGesGraphSizes,
  listHssEditions,
  listDewKeyTypes,
  listSmnProtocolTypes,
  listCseSpecifications,
  listDisTypes,
  listDwsSpecifications,
  listDliBillingItems,
  listDliSpecifications,
  listCdmInstanceTypes,
  listDdsDbTypes,
  listDdsSpecifications,
  listWafEditions,
  listCfwEditions,
  listDmsFlavors,
  listDmsBandwidths,
  listDmsStorageTypes,
  listDrsTaskTypes,
  listDrsDirections,
  listMrsClusterTypes,
  listMrsNodeTypes,
  listGaussDbEditions,
  listGaussDbSpecifications,
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
  resolveOption,
  resolveNumberOption,
  clampNumber,
  clampInteger,
  boolString,
  firstDefined,
  firstMeaningfulText,
  concatArrays,
  joinSelectionParts,
  integerString,
  multiplyNumbers,
  getCatalogRegionId,
  getGaDestinationEndpointForRegion,
  runLegacyDefinitionExpression,
  byLabelAmount,
  formatBreakdownNotes,
  obsPricingReference,
  eipDefaults,
  eipSharedBandwidthMinimumMbit,
  eipSharedEnhanced95MinimumMbit,
  apigDefaults,
  elbDefaults,
  elbDedicatedProtocolOptions,
  elbFixedSpecOptions,
  cceDefaults,
  cbhDefaults,
  cbrDefaults,
  ccmDefaults,
  dcsDefaults,
  natDefaults,
  modelArtsDefaults,
  vpnDefaults,
  workspaceDefaults,
  functionGraphDefaults,
  directConnectDefaults,
  erDefaults,
  gaDefaults,
  gaussDbDefaults,
  flexusRdsDefaults,
  ltsDefaults,
  rdsDefaults,
  vpcepDefaults,
  sfsDefaults,
  sfsTurboDefaults,
  gesDefaults,
  hssDefaults,
  dewDefaults,
  smnDefaults,
  cseDefaults,
  disDefaults,
  dwsDefaults,
  dliDefaults,
  cdmDefaults,
  ddsDefaults,
  wafDefaults,
  cfwDefaults,
  dmsDefaults,
  drsDefaults,
  mrsDefaults,
  apigPricingReference,
  eipPricingReference,
  elbPricingReference,
  ccePricingReference,
  cbhPricingReference,
  cbrPricingReference,
  ccmPricingReference,
  dcsPricingReference,
  natPricingReference,
  modelArtsPricingReference,
  vpnPricingReference,
  workspacePricingReference,
  functionGraphPricingReference,
  directConnectPricingReference,
  erPricingReference,
  gaPricingReference,
  gaussDbPricingReference,
  flexusRdsPricingReference,
  ltsPricingReference,
  rdsPricingReference,
  vpcepPricingReference,
  sfsPricingReference,
  sfsTurboPricingReference,
  gesPricingReference,
  hssPricingReference,
  dewPricingReference,
  smnPricingReference,
  csePricingReference,
  disPricingReference,
  dwsPricingReference,
  dliPricingReference,
  cdmPricingReference,
  ddsPricingReference,
  wafPricingReference,
  cfwPricingReference,
  dmsPricingReference,
  drsPricingReference,
  mrsPricingReference,
  huaweiRegions,
  isRecord,
  asArray,
  isRdsEngine,
  isRdsVersion,
  isRdsInstanceType,
  isRdsInstanceClass,
  isRdsStorageType,
};

export type DeclarativeRuntimeHelpers = typeof declarativeRuntimeHelpers;
export type { ObsCapacityUnit, ObsEstimateInput, ObsPricingCatalog, ObsProductType, ObsRedundancy, ObsRestorationType, ObsStorageClass };
