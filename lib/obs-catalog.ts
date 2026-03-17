export const obsPricingReference = {
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/obs.html",
  billingUrl: "https://support.huaweicloud.com/intl/en-us/price-obs/obs_42_0009.html",
  packageOverviewUrl: "https://support.huaweicloud.com/intl/en-us/price-obs/obs_42_0020.html",
  hourlyConversionDays: 30,
  deepArchiveMonthlyPriceUsdPerGbFallback: 0.002,
} as const;

export const obsProductTypeLabels = {
  calc_29_: "Object storage",
  calc_30_: "Parallel file system",
} as const;

export const obsStorageClassLabels = {
  dataInfo_1_: "Archive",
  dataInfo_2_: "Standard",
  dataInfo_3_: "Infrequent Access",
  dataInfo_22_: "Deep Archive",
} as const;

export const obsRedundancyLabels = {
  dataInfo_4_: "Single-AZ storage",
  dataInfo_5_: "Multi-AZ storage",
} as const;

export const obsMinimumStorageDays = {
  Standard: 0,
  "Infrequent Access": 30,
  Archive: 90,
  "Deep Archive": 180,
} as const;

export const obsCapacityUnits = ["GB", "TB", "PB"] as const;

export type ObsProductType = (typeof obsProductTypeLabels)[keyof typeof obsProductTypeLabels];
export type ObsStorageClass = (typeof obsStorageClassLabels)[keyof typeof obsStorageClassLabels];
export type ObsRedundancy = (typeof obsRedundancyLabels)[keyof typeof obsRedundancyLabels];
export type ObsCapacityUnit = (typeof obsCapacityUnits)[number];

export type ObsConditionalRate = {
  amount: number;
  condition: string | null;
  conditionName: string | null;
};

export type ObsTieredRate = {
  upToGb: number | null;
  amountPerGb: number;
};

export type ObsRateCard = {
  billingEvent: string;
  productId: string | null;
  usageFactor: string | null;
  usageMeasureId: number | null;
  measureUnit: number | null;
  measureUnitStep: number | null;
  amount: number | null;
  tiers: ObsTieredRate[];
  conditionalRates: ObsConditionalRate[];
};

export type ObsPricingVariant = {
  productType: ObsProductType;
  productTypeCode: keyof typeof obsProductTypeLabels;
  storageClass: ObsStorageClass;
  storageClassCode: keyof typeof obsStorageClassLabels;
  redundancy: ObsRedundancy;
  redundancyCode: keyof typeof obsRedundancyLabels;
  storageRate: ObsRateCard;
  minimumStorageDays: number;
  isFallback: boolean;
};

export type ObsPricingCatalog = {
  currency: string;
  regionId: string;
  variants: ObsPricingVariant[];
  outboundRates: Partial<Record<ObsStorageClass, ObsRateCard>>;
  requestRates: Partial<Record<ObsStorageClass, {
    read?: ObsRateCard;
    write?: ObsRateCard;
    delete?: ObsRateCard;
  }>>;
  pullTrafficRate: ObsRateCard | null;
  replicationRate: ObsRateCard | null;
};

export type ObsEstimateInput = {
  productType: ObsProductType;
  storageClass: ObsStorageClass;
  redundancy: ObsRedundancy;
  storageAmount: number;
  storageUnit: ObsCapacityUnit;
  durationMonths: number;
  outboundTrafficAmount: number;
  outboundTrafficUnit: ObsCapacityUnit;
  readRequests: number;
  writeRequests: number;
  deleteRequests: number;
  pullTrafficAmount: number;
  pullTrafficUnit: ObsCapacityUnit;
  replicationTrafficAmount: number;
  replicationTrafficUnit: ObsCapacityUnit;
};

export type ObsEstimateBreakdownItem = {
  key: "storage" | "outbound" | "read" | "write" | "delete" | "pull" | "replication";
  label: string;
  amount: number;
};

export type ObsEstimateResult = {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  storageAmountGb: number;
  durationMonths: number;
  breakdown: ObsEstimateBreakdownItem[];
  notes: string[];
  variant: ObsPricingVariant;
};

export function isObsProductType(value: unknown): value is ObsProductType {
  return typeof value === "string" && Object.values(obsProductTypeLabels).includes(value as ObsProductType);
}

export function isObsStorageClass(value: unknown): value is ObsStorageClass {
  return typeof value === "string" && Object.values(obsStorageClassLabels).includes(value as ObsStorageClass);
}

export function isObsRedundancy(value: unknown): value is ObsRedundancy {
  return typeof value === "string" && Object.values(obsRedundancyLabels).includes(value as ObsRedundancy);
}

export function isObsCapacityUnit(value: unknown): value is ObsCapacityUnit {
  return typeof value === "string" && obsCapacityUnits.includes(value as ObsCapacityUnit);
}

export function normalizeObsPositiveNumber(value: unknown, fallback: number, minimum = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
}

export function convertObsCapacityToGb(amount: number, unit: ObsCapacityUnit) {
  const normalizedAmount = Math.max(0, amount);
  if (unit === "PB") {
    return normalizedAmount * 1_000_000;
  }
  if (unit === "TB") {
    return normalizedAmount * 1_000;
  }
  return normalizedAmount;
}

function roundObsAmount(value: number) {
  return Number(value.toFixed(5));
}

function pickObsRateAmount(rate: ObsRateCard | undefined) {
  if (!rate) {
    return null;
  }

  if (rate.tiers.length > 0) {
    return null;
  }

  if (rate.conditionalRates.length > 0) {
    const conditionalAmounts = rate.conditionalRates
      .map((entry) => entry.amount)
      .filter((amount) => Number.isFinite(amount));

    return conditionalAmounts.length ? Math.max(...conditionalAmounts) : null;
  }

  return typeof rate.amount === "number" && Number.isFinite(rate.amount) ? rate.amount : null;
}

function estimateTieredTrafficCost(rate: ObsRateCard, trafficGb: number) {
  if (!rate.tiers.length) {
    const flatRate = pickObsRateAmount(rate);
    return flatRate == null ? 0 : flatRate * trafficGb;
  }

  let remaining = Math.max(0, trafficGb);
  let previousCap = 0;
  let total = 0;

  for (const tier of rate.tiers) {
    if (remaining <= 0) {
      break;
    }

    const tierCap = tier.upToGb ?? Number.POSITIVE_INFINITY;
    const tierSize = Math.min(remaining, tierCap - previousCap);
    if (tierSize > 0) {
      total += tierSize * tier.amountPerGb;
      remaining -= tierSize;
    }
    previousCap = tierCap;
  }

  return total;
}

function estimateRequestCost(rate: ObsRateCard | undefined, rawRequests: number) {
  const unitAmount = pickObsRateAmount(rate);
  const unitStep = typeof rate?.measureUnitStep === "number" && Number.isFinite(rate.measureUnitStep) && rate.measureUnitStep > 0
    ? rate.measureUnitStep
    : 1;
  if (unitAmount == null || rawRequests <= 0) {
    return 0;
  }

  return (rawRequests / unitStep) * unitAmount;
}

export function listObsProductTypes(catalog: ObsPricingCatalog) {
  return [...new Set(catalog.variants.map((variant) => variant.productType))];
}

export function listObsStorageClasses(catalog: ObsPricingCatalog, productType: ObsProductType) {
  return [...new Set(catalog.variants.filter((variant) => variant.productType === productType).map((variant) => variant.storageClass))];
}

export function listObsRedundancies(catalog: ObsPricingCatalog, productType: ObsProductType, storageClass: ObsStorageClass) {
  return [...new Set(
    catalog.variants
      .filter((variant) => variant.productType === productType && variant.storageClass === storageClass)
      .map((variant) => variant.redundancy),
  )];
}

export function findObsPricingVariant(
  catalog: ObsPricingCatalog,
  productType: ObsProductType,
  storageClass: ObsStorageClass,
  redundancy: ObsRedundancy,
) {
  return catalog.variants.find((variant) => (
    variant.productType === productType
    && variant.storageClass === storageClass
    && variant.redundancy === redundancy
  )) ?? null;
}

export function estimateObsConfiguration(catalog: ObsPricingCatalog, input: ObsEstimateInput): ObsEstimateResult | null {
  const variant = findObsPricingVariant(catalog, input.productType, input.storageClass, input.redundancy);
  if (!variant) {
    return null;
  }

  const durationMonths = Math.max(1, Math.floor(input.durationMonths || 1));
  const storageAmountGb = convertObsCapacityToGb(input.storageAmount, input.storageUnit);
  const durationHours = durationMonths * 24 * obsPricingReference.hourlyConversionDays;
  const storageRateAmount = pickObsRateAmount(variant.storageRate);
  const storageCost = storageRateAmount == null ? 0 : storageRateAmount * storageAmountGb * durationHours;
  const outboundTrafficGb = convertObsCapacityToGb(input.outboundTrafficAmount, input.outboundTrafficUnit);
  const pullTrafficGb = convertObsCapacityToGb(input.pullTrafficAmount, input.pullTrafficUnit);
  const replicationTrafficGb = convertObsCapacityToGb(input.replicationTrafficAmount, input.replicationTrafficUnit);
  const outboundCost = estimateTieredTrafficCost(catalog.outboundRates[input.storageClass] ?? {
    billingEvent: "",
    productId: null,
    usageFactor: null,
    usageMeasureId: null,
    measureUnit: null,
    measureUnitStep: null,
    amount: 0,
    tiers: [],
    conditionalRates: [],
  }, outboundTrafficGb);
  const readCost = estimateRequestCost(catalog.requestRates[input.storageClass]?.read, input.readRequests);
  const writeCost = estimateRequestCost(catalog.requestRates[input.storageClass]?.write, input.writeRequests);
  const deleteCost = estimateRequestCost(catalog.requestRates[input.storageClass]?.delete, input.deleteRequests);
  const pullRateAmount = pickObsRateAmount(catalog.pullTrafficRate ?? undefined);
  const pullCost = pullRateAmount == null ? 0 : pullRateAmount * pullTrafficGb;
  const replicationRateAmount = pickObsRateAmount(catalog.replicationRate ?? undefined);
  const replicationCost = replicationRateAmount == null ? 0 : replicationRateAmount * replicationTrafficGb;
  const totalAmount = roundObsAmount(storageCost + outboundCost + readCost + writeCost + deleteCost + pullCost + replicationCost);
  const notes: string[] = [];

  const outboundRate = catalog.outboundRates[input.storageClass];
  if (outboundRate?.conditionalRates.length) {
    notes.push("Deep Archive internet outbound traffic uses multiple time-of-day rates. This estimate uses the highest published rate.");
  }
  if (variant.minimumStorageDays > 0) {
    notes.push(`${variant.storageClass} has a ${variant.minimumStorageDays}-day minimum storage duration.`);
  }
  if (variant.isFallback) {
    notes.push("The base Deep Archive storage rate uses Huawei's public pricing-page fallback because the productInfo endpoint omits that specific storage event.");
  }

  const breakdown: ObsEstimateBreakdownItem[] = [
    { key: "storage", label: "Storage", amount: roundObsAmount(storageCost) } satisfies ObsEstimateBreakdownItem,
    { key: "outbound", label: "Internet outbound traffic", amount: roundObsAmount(outboundCost) } satisfies ObsEstimateBreakdownItem,
    { key: "read", label: "Read requests", amount: roundObsAmount(readCost) } satisfies ObsEstimateBreakdownItem,
    { key: "write", label: "Write requests", amount: roundObsAmount(writeCost) } satisfies ObsEstimateBreakdownItem,
    { key: "delete", label: "Delete requests", amount: roundObsAmount(deleteCost) } satisfies ObsEstimateBreakdownItem,
    { key: "pull", label: "Pull traffic", amount: roundObsAmount(pullCost) } satisfies ObsEstimateBreakdownItem,
    { key: "replication", label: "Cross-region replication", amount: roundObsAmount(replicationCost) } satisfies ObsEstimateBreakdownItem,
  ].filter((item) => item.amount > 0);

  return {
    currency: catalog.currency,
    amount: totalAmount,
    suffix: `/${durationMonths}mo`,
    monthlyAverageAmount: roundObsAmount(totalAmount / durationMonths),
    storageAmountGb,
    durationMonths,
    breakdown,
    notes,
    variant,
  };
}

function buildObsRateCardIdentity(rate: ObsRateCard | undefined) {
  return {
    billingEvent: rate?.billingEvent ?? "",
    productId: rate?.productId ?? "",
    amount: pickObsRateAmount(rate) ?? 0,
    usageMeasureId: rate?.usageMeasureId ?? 10,
    measureUnit: rate?.measureUnit ?? 10,
    measureUnitStep: rate?.measureUnitStep ?? 1,
    usageFactor: rate?.usageFactor ?? "",
  };
}

export function buildObsHuaweiPayload(options: {
  regionId: string;
  catalog?: ObsPricingCatalog | null;
  input: ObsEstimateInput;
  estimate: ObsEstimateResult;
  title: string;
  description: string;
  storageRequestUnits: {
    read: number;
    write: number;
    delete: number;
  };
}) {
  const { regionId, catalog, input, estimate, title, description, storageRequestUnits } = options;
  const productTypeCode = Object.entries(obsProductTypeLabels).find(([, label]) => label === input.productType)?.[0] ?? "calc_29_";
  const storageClassCode = Object.entries(obsStorageClassLabels).find(([, label]) => label === input.storageClass)?.[0] ?? "dataInfo_2_";
  const redundancyCode = Object.entries(obsRedundancyLabels).find(([, label]) => label === input.redundancy)?.[0] ?? "dataInfo_4_";
  const durationHours = estimate.durationMonths * 24 * obsPricingReference.hourlyConversionDays;
  const durationMonths = estimate.durationMonths;
  const storageAmountGb = estimate.storageAmountGb;
  const outboundTrafficGb = convertObsCapacityToGb(input.outboundTrafficAmount, input.outboundTrafficUnit);
  const pullTrafficGb = convertObsCapacityToGb(input.pullTrafficAmount, input.pullTrafficUnit);
  const replicationTrafficGb = convertObsCapacityToGb(input.replicationTrafficAmount, input.replicationTrafficUnit);
  const requestRates = {
    read: buildObsRateCardIdentity(catalog?.requestRates[input.storageClass]?.read),
    write: buildObsRateCardIdentity(catalog?.requestRates[input.storageClass]?.write),
    delete: buildObsRateCardIdentity(catalog?.requestRates[input.storageClass]?.delete),
  };
  const outboundRate = buildObsRateCardIdentity(catalog?.outboundRates[input.storageClass]);
  const pullRate = buildObsRateCardIdentity(catalog?.pullTrafficRate ?? undefined);
  const replicationRate = buildObsRateCardIdentity(catalog?.replicationRate ?? undefined);
  const productAllInfos: Array<Record<string, unknown>> = [];

  const storageRate = buildObsRateCardIdentity(estimate.variant.storageRate);
  productAllInfos.push({
    resourceType: "hws.resource.type.obs",
    cloudServiceType: "hws.service.type.obs",
    resourceSpecCode: estimate.variant.storageRate.productId ? "obs.001" : "obs.synthetic",
    productSpecSysDesc: `type:${input.productType}`,
    resourceSpecType: "Standard_Storage_Space,Internet_Traffic",
    periodList: 1,
    _skuInfo: [],
    productType: productTypeCode,
    storageType: storageClassCode,
    multiAZType: redundancyCode,
    usageValue: storageAmountGb,
    transRate: "",
    transTarget: "",
    usageMeasureId: storageRate.usageMeasureId,
    amount: storageRate.amount,
    productId: storageRate.productId || `synthetic-${estimate.variant.storageRate.billingEvent}`,
    billingMode: "ONDEMAND",
    siteCode: "HWC",
    billingEvent: storageRate.billingEvent,
    measureUnitStep: storageRate.measureUnitStep,
    measureUnit: storageRate.measureUnit,
    usageFactor: storageRate.usageFactor,
    productNum: durationHours,
    productNumMeasureId: 20,
    inquiryTag: "normal",
    cpqPurchaseCapacity: storageAmountGb,
    cpqPurchaseDuration: durationHours,
    cpqPurchaseQuantity: durationMonths,
    selectIndex: 0,
    inquiryResult: {
      id: `${Date.now()}-0-${storageRate.productId || "storage"}`,
      productId: storageRate.productId || `synthetic-${estimate.variant.storageRate.billingEvent}`,
      amount: estimate.breakdown.find((entry) => entry.key === "storage")?.amount ?? 0,
      discountAmount: 0,
      originalAmount: estimate.breakdown.find((entry) => entry.key === "storage")?.amount ?? 0,
      perAmount: null,
      perDiscountAmount: null,
      perOriginalAmount: null,
      perPeriodType: null,
      measureId: 1,
      extendParams: null,
    },
  });

  const extraLineItems = [
    { key: "outbound", value: outboundTrafficGb, rate: outboundRate, measureValue: outboundTrafficGb, titleKey: "calc_8_" },
    { key: "read", value: input.readRequests, rate: requestRates.read, measureValue: storageRequestUnits.read, titleKey: "calc_13_" },
    { key: "write", value: input.writeRequests, rate: requestRates.write, measureValue: storageRequestUnits.write, titleKey: "calc_14_" },
    { key: "delete", value: input.deleteRequests, rate: requestRates.delete, measureValue: storageRequestUnits.delete, titleKey: "calc_15_" },
    { key: "pull", value: pullTrafficGb, rate: pullRate, measureValue: pullTrafficGb, titleKey: "calc_10_" },
    { key: "replication", value: replicationTrafficGb, rate: replicationRate, measureValue: replicationTrafficGb, titleKey: "calc_11_" },
  ];

  extraLineItems.forEach((item, index) => {
    const breakdownItem = estimate.breakdown.find((entry) => entry.key === item.key);
    if (!breakdownItem || breakdownItem.amount <= 0) {
      return;
    }

    productAllInfos.push({
      resourceType: "hws.resource.type.obs",
      cloudServiceType: "hws.service.type.obs",
      resourceSpecCode: "obs.001",
      productSpecSysDesc: `type:${input.productType}`,
      resourceSpecType: "Standard_Storage_Space,Internet_Traffic",
      periodList: 1,
      _skuInfo: [],
      productType: productTypeCode,
      storageType: storageClassCode,
      multiAZType: redundancyCode,
      resourceSize: item.measureValue,
      resouceSizeMeasureId: item.key === "delete" ? 31 : item.key === "read" || item.key === "write" ? 54 : 10,
      addToList_title: item.titleKey,
      productId: item.rate.productId || `synthetic-${item.key}`,
      billingMode: "ONDEMAND",
      siteCode: "HWC",
      billingEvent: item.rate.billingEvent,
      measureUnitStep: item.rate.measureUnitStep,
      measureUnit: item.rate.measureUnit,
      usageFactor: item.rate.usageFactor,
      usageMeasureId: item.rate.usageMeasureId,
      amount: item.rate.amount,
      usageValue: item.measureValue,
      cpqPurchaseCapacity: item.measureValue,
      selectIndex: index + 1,
      inquiryTag: "normal",
      inquiryResult: {
        id: `${Date.now()}-${index + 1}-${item.rate.productId || item.key}`,
        productId: item.rate.productId || `synthetic-${item.key}`,
        amount: breakdownItem.amount,
        discountAmount: 0,
        originalAmount: breakdownItem.amount,
        perAmount: null,
        perDiscountAmount: null,
        perOriginalAmount: null,
        perPeriodType: null,
        measureId: 1,
        extendParams: null,
      },
    });
  });

  return {
    buyUrl: `https://console-intl.huaweicloud.com/obs/?region=${encodeURIComponent(regionId)}&locale=en-us#/obs/manager/buckets`,
    rewriteValue: {
      global_TITLE: {
        tag: "general.online.portal",
      },
      global_DESCRIPTION: description,
      global_REGIONINFO: {
        region: regionId,
        locationType: "commonAZ",
        chargeMode: "ONDEMAND",
      },
      template_RENDER: {
        calculator_productType_switch: {
          productType: productTypeCode,
        },
        calculator_storageType_switch: {
          storageType: storageClassCode,
        },
        calculator_multiAZ_radio: {
          multiAZType: redundancyCode,
          UNSET_Stepper_0: {
            measureId: 10,
            measureValue: storageAmountGb,
            measureNameBeforeTrans: "",
            measurePluralNameBeforeTrans: "",
            transRate: "",
            transTarget: "",
          },
          UNSET_Stepper_2: {
            measureId: 20,
            measureValue: durationMonths,
            measureNameBeforeTrans: "",
            measurePluralNameBeforeTrans: "",
            transRate: "",
            transTarget: "",
          },
        },
        calculator_Outbound_stepper: {
          UNSET_Stepper_0: {
            measureId: 10,
            measureValue: outboundTrafficGb,
            measureNameBeforeTrans: "",
            measurePluralNameBeforeTrans: "",
            transRate: "",
            transTarget: "",
          },
        },
        calculator_Request_wan_stepper2: {
          UNSET_Stepper_0: {
            measureId: 54,
            measureValue: storageRequestUnits.read,
            measureNameBeforeTrans: "calc_12_",
            measurePluralNameBeforeTrans: "calc_12_",
            transRate: "",
            transTarget: "",
          },
        },
        calculator_Request_wan_stepper3: {
          UNSET_Stepper_0: {
            measureId: 54,
            measureValue: storageRequestUnits.write,
            measureNameBeforeTrans: "calc_12_",
            measurePluralNameBeforeTrans: "calc_12_",
            transRate: "",
            transTarget: "",
          },
        },
        calculator_Request_stepper4: {
          UNSET_Stepper_0: {
            measureId: 31,
            measureValue: storageRequestUnits.delete,
            measureNameBeforeTrans: "calc_16_",
            measurePluralNameBeforeTrans: "calc_16_",
            transRate: "",
            transTarget: "",
          },
        },
        calculator_Traffic_stepper: {
          UNSET_Stepper_0: {
            measureId: 10,
            measureValue: pullTrafficGb,
            measureNameBeforeTrans: "",
            measurePluralNameBeforeTrans: "",
            transRate: "",
            transTarget: "",
          },
        },
        calculator_Replication_stepper: {
          UNSET_Stepper_0: {
            measureId: 17,
            measureValue: replicationTrafficGb,
            measureNameBeforeTrans: "",
            measurePluralNameBeforeTrans: "",
            transRate: "",
            transTarget: "",
          },
        },
      },
    },
    selectedProduct: {
      region: regionId,
      locationType: "commonAZ",
      chargeMode: "ONDEMAND",
      tag: "general.online.portal",
      serviceCode: "obs",
      timeTag: Date.now(),
      chargeModeName: "ONDEMAND",
      periodType: 4,
      periodNum: 1,
      subscriptionNum: 1,
      description,
      amount: estimate.amount,
      discountAmount: 0,
      originalAmount: estimate.amount,
      _customTitle: title,
      productAllInfos,
    },
  };
}
