import { sendHttpRequest } from "@/lib/huawei-http";
import {
  obsMinimumStorageDays,
  obsPricingReference,
  obsProductTypeLabels,
  obsRedundancyLabels,
  obsRestorationTypeOptions,
  obsStorageClassLabels,
  type ObsConditionalRate,
  type ObsPricingCatalog,
  type ObsPricingVariant,
  type ObsRateCard,
  type ObsTieredRate,
} from "@/lib/obs-catalog";

type RawPlan = {
  productId?: string;
  billingEvent?: string;
  usageFactor?: string;
  usageMeasureId?: number;
  measureUnit?: number | null;
  measureUnitStep?: number | null;
  amount?: number;
  condition?: string;
  conditionName?: string;
  divisionList?: Array<{
    amount?: number;
    division?: {
      endValue?: number;
    };
  }>;
};

type RawObsItem = {
  productType?: string;
  storageType?: string;
  multiAZType?: string;
  planList?: RawPlan[];
};

const OBS_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";

const DEFAULT_CURRENCY = "USD";
const DEFAULT_ARCHIVE_EVENT = "event.type.obs.size_cold";
const DEFAULT_DEEP_ARCHIVE_EVENT = "event.type.obs.obs.size_deep_archive";

function buildObsProductInfoUrl(regionId: string) {
  const url = new URL(OBS_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "obs");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function parseTieredRates(plan: RawPlan): ObsTieredRate[] {
  return (plan.divisionList ?? [])
    .map((division) => {
      if (typeof division.amount !== "number" || !Number.isFinite(division.amount)) {
        return null;
      }

      return {
        upToGb: typeof division.division?.endValue === "number" && division.division.endValue >= 0 ? division.division.endValue : null,
        amountPerGb: division.amount,
      } satisfies ObsTieredRate;
    })
    .filter((tier): tier is ObsTieredRate => tier != null);
}

function parseConditionalRate(plan: RawPlan): ObsConditionalRate | null {
  if (typeof plan.amount !== "number" || !Number.isFinite(plan.amount)) {
    return null;
  }

  return {
    amount: plan.amount,
    condition: typeof plan.condition === "string" ? plan.condition : null,
    conditionName: typeof plan.conditionName === "string" ? plan.conditionName : null,
  };
}

function buildRateCard(plans: RawPlan[]): ObsRateCard | null {
  const firstPlan = plans.find((plan) => typeof plan.billingEvent === "string") ?? plans[0];
  if (!firstPlan || typeof firstPlan.billingEvent !== "string") {
    return null;
  }

  const directPlan = plans.find((plan) => typeof plan.amount === "number" && Number.isFinite(plan.amount));

  return {
    billingEvent: firstPlan.billingEvent,
    productId: typeof firstPlan.productId === "string" ? firstPlan.productId : null,
    usageFactor: typeof firstPlan.usageFactor === "string" ? firstPlan.usageFactor : null,
    usageMeasureId: typeof firstPlan.usageMeasureId === "number" ? firstPlan.usageMeasureId : null,
    measureUnit: typeof firstPlan.measureUnit === "number" ? firstPlan.measureUnit : null,
    measureUnitStep: typeof firstPlan.measureUnitStep === "number" ? firstPlan.measureUnitStep : null,
    amount: directPlan && typeof directPlan.amount === "number" ? directPlan.amount : null,
    tiers: parseTieredRates(firstPlan),
    conditionalRates: plans.map(parseConditionalRate).filter((entry): entry is ObsConditionalRate => entry != null),
  };
}

function groupPlansByBillingEvent(items: RawObsItem[]) {
  const grouped = new Map<string, RawPlan[]>();

  for (const item of items) {
    for (const plan of item.planList ?? []) {
      if (typeof plan.billingEvent !== "string" || !plan.billingEvent.trim()) {
        continue;
      }

      const current = grouped.get(plan.billingEvent) ?? [];
      current.push(plan);
      grouped.set(plan.billingEvent, current);
    }
  }

  return grouped;
}

function buildVariant(items: RawObsItem[], productTypeCode: keyof typeof obsProductTypeLabels, storageClassCode: keyof typeof obsStorageClassLabels, redundancyCode: keyof typeof obsRedundancyLabels, billingEvent: string): ObsPricingVariant | null {
  const matchingItem = items.find((item) => (
    item.productType === productTypeCode
    && item.storageType === storageClassCode
    && item.multiAZType === redundancyCode
    && (item.planList ?? []).some((plan) => plan.billingEvent === billingEvent)
  ));

  if (!matchingItem) {
    return null;
  }

  const storageRate = buildRateCard((matchingItem.planList ?? []).filter((plan) => plan.billingEvent === billingEvent));
  if (!storageRate) {
    return null;
  }

  return {
    productType: obsProductTypeLabels[productTypeCode],
    productTypeCode,
    storageClass: obsStorageClassLabels[storageClassCode],
    storageClassCode,
    redundancy: obsRedundancyLabels[redundancyCode],
    redundancyCode,
    storageRate,
    minimumStorageDays: obsMinimumStorageDays[obsStorageClassLabels[storageClassCode]],
    isFallback: false,
  };
}

export async function fetchObsPricingCatalog(regionId: string): Promise<ObsPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildObsProductInfoUrl(regionId),
    headers: { accept: "application/json" },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`OBS product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("OBS product info response was empty");
  }

  let body: { product?: { obs_obs?: RawObsItem[] } };
  try {
    body = JSON.parse(response.bodyText) as { product?: { obs_obs?: RawObsItem[] } };
  } catch {
    throw new Error(`OBS product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  const items = Array.isArray(body.product?.obs_obs) ? body.product.obs_obs : [];
  const groupedPlans = groupPlansByBillingEvent(items);
  const variants = [
    buildVariant(items, "calc_29_", "dataInfo_2_", "dataInfo_4_", "event.type.obssize"),
    buildVariant(items, "calc_29_", "dataInfo_2_", "dataInfo_5_", "event.type.obs.obs.size_3az"),
    buildVariant(items, "calc_29_", "dataInfo_3_", "dataInfo_4_", "event.type.obs.size_warm"),
    buildVariant(items, "calc_29_", "dataInfo_3_", "dataInfo_5_", "event.type.obs.obs.size_warm_3az"),
    buildVariant(items, "calc_29_", "dataInfo_1_", "dataInfo_4_", "event.type.obs.size_cold"),
    buildVariant(items, "calc_30_", "dataInfo_2_", "dataInfo_4_", "event.type.obs.obs.pfs_size"),
  ].filter((variant): variant is ObsPricingVariant => variant != null);

  if (!variants.some((variant) => (
    variant.productTypeCode === "calc_29_"
    && variant.storageClassCode === "dataInfo_1_"
    && variant.redundancyCode === "dataInfo_4_"
  ))) {
    const archiveFallbackAmount = obsPricingReference.archiveMonthlyPriceUsdPerGbFallback / (24 * obsPricingReference.hourlyConversionDays);
    variants.push({
      productType: obsProductTypeLabels.calc_29_,
      productTypeCode: "calc_29_",
      storageClass: obsStorageClassLabels.dataInfo_1_,
      storageClassCode: "dataInfo_1_",
      redundancy: obsRedundancyLabels.dataInfo_4_,
      redundancyCode: "dataInfo_4_",
      storageRate: {
        billingEvent: DEFAULT_ARCHIVE_EVENT,
        productId: null,
        usageFactor: "size_cold",
        usageMeasureId: 13,
        measureUnit: 10,
        measureUnitStep: 1,
        amount: archiveFallbackAmount,
        tiers: [],
        conditionalRates: [],
      },
      minimumStorageDays: obsMinimumStorageDays.Archive,
      isFallback: true,
    });
  }

  const deepArchiveFallbackAmount = obsPricingReference.deepArchiveMonthlyPriceUsdPerGbFallback / (24 * obsPricingReference.hourlyConversionDays);
  variants.push({
    productType: obsProductTypeLabels.calc_29_,
    productTypeCode: "calc_29_",
    storageClass: obsStorageClassLabels.dataInfo_22_,
    storageClassCode: "dataInfo_22_",
    redundancy: obsRedundancyLabels.dataInfo_4_,
    redundancyCode: "dataInfo_4_",
    storageRate: {
      billingEvent: DEFAULT_DEEP_ARCHIVE_EVENT,
      productId: null,
      usageFactor: "size_deep_archive",
      usageMeasureId: 13,
      measureUnit: 10,
      measureUnitStep: 1,
      amount: deepArchiveFallbackAmount,
      tiers: [],
      conditionalRates: [],
    },
    minimumStorageDays: obsMinimumStorageDays["Deep Archive"],
    isFallback: true,
  });

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    variants,
    outboundRates: {
      Standard: buildRateCard(groupedPlans.get("event.type.obs.downloadexternal") ?? []) ?? undefined,
      "Infrequent Access": buildRateCard(groupedPlans.get("event.type.obs.download_warm_external") ?? []) ?? undefined,
      Archive: buildRateCard(groupedPlans.get("event.type.obs.download_cold_external") ?? []) ?? undefined,
      "Deep Archive": buildRateCard(groupedPlans.get("event.type.obs.obs.download_da.external") ?? []) ?? undefined,
    },
    requestRates: {
      Standard: {
        read: buildRateCard(groupedPlans.get("event.type.obsget") ?? []) ?? undefined,
        write: buildRateCard(groupedPlans.get("event.type.obsput") ?? []) ?? undefined,
        delete: buildRateCard(groupedPlans.get("event.type.obsdelete") ?? []) ?? undefined,
      },
      "Infrequent Access": {
        read: buildRateCard(groupedPlans.get("event.type.obs.get_warm") ?? []) ?? undefined,
        write: buildRateCard(groupedPlans.get("event.type.obs.put_warm") ?? []) ?? undefined,
        delete: buildRateCard(groupedPlans.get("event.type.obs.delete_warm") ?? []) ?? undefined,
      },
      Archive: {
        read: buildRateCard(groupedPlans.get("event.type.obs.get_cold") ?? []) ?? undefined,
        write: buildRateCard(groupedPlans.get("event.type.obs.put_cold") ?? []) ?? undefined,
        delete: buildRateCard(groupedPlans.get("event.type.obs.delete_cold") ?? []) ?? undefined,
      },
      "Deep Archive": {
        read: buildRateCard(groupedPlans.get("event.type.obs.obs.get_da") ?? []) ?? undefined,
        write: buildRateCard(groupedPlans.get("event.type.obs.obs.put_da") ?? []) ?? undefined,
        delete: buildRateCard(groupedPlans.get("event.type.obs.obs.delete_da") ?? []) ?? undefined,
      },
    },
    pullTrafficRate: buildRateCard(groupedPlans.get("event.type.obs.obs.download.cdn") ?? []),
    replicationRate: buildRateCard(groupedPlans.get("event.type.obs.download_crr") ?? []),
    readTrafficRates: {
      "Infrequent Access": {
        [obsRestorationTypeOptions["Infrequent Access"][0]]: buildRateCard(groupedPlans.get("event.type.obs.retrieval_size_warm") ?? []) ?? undefined,
      },
      Archive: {
        [obsRestorationTypeOptions.Archive[0]]: buildRateCard(groupedPlans.get("event.type.obs.restore_size_ex") ?? []) ?? undefined,
        [obsRestorationTypeOptions.Archive[1]]: buildRateCard(groupedPlans.get("event.type.obs.restore_size_sd") ?? []) ?? undefined,
        [obsRestorationTypeOptions.Archive[2]]: buildRateCard(groupedPlans.get("event.type.obs.obs.retrieval_size_cold") ?? []) ?? undefined,
      },
      "Deep Archive": {
        [obsRestorationTypeOptions["Deep Archive"][0]]: buildRateCard(groupedPlans.get("event.type.obs.obs.restore_size_ex_da") ?? []) ?? undefined,
        [obsRestorationTypeOptions["Deep Archive"][1]]: buildRateCard(groupedPlans.get("event.type.obs.obs.restore_size_sd_da") ?? []) ?? undefined,
      },
    },
    lifecycleTransitionRates: {
      "Infrequent Access": buildRateCard(groupedPlans.get("event.type.obs.transitionwarm") ?? []) ?? undefined,
      Archive: buildRateCard(groupedPlans.get("event.type.obs.transitioncold") ?? []) ?? undefined,
      "Deep Archive": buildRateCard(groupedPlans.get("event.type.obs.obs.transition_da") ?? []) ?? undefined,
    },
  };
}
