import { expect, test } from "bun:test";

import { estimateLtsConfiguration } from "@/lib/lts-catalog";
import { parseLtsPricingCatalogResponse } from "@/lib/lts-pricing";

const payload = {
  product: {
    "lts_lts.logstorage": [
      {
        resourceSpecCode: "lts.log.storage",
        type: "Log Storage Size",
        planList: [
          { productId: "lts-storage", billingMode: "ONDEMAND", billingEvent: "event.type.lts.ltslogstorage.aom.size", amount: 0.000125 },
        ],
      },
      {
        resourceSpecCode: "lts.log.storage.cold",
        "log storage": "log storage cold",
        planList: [
          { productId: "lts-storage-cold", billingMode: "ONDEMAND", billingEvent: "event.type.lts.ltslogstorage.logcoldstoragesize", amount: 0.00003993 },
        ],
      },
    ],
    "lts_lts.logindex": [
      {
        resourceSpecCode: "lts.log.index",
        planList: [
          { productId: "lts-index", billingMode: "ONDEMAND", billingEvent: "event.type.lts.ltslogindex.traffic", amount: 0.08 },
        ],
      },
    ],
    "lts_lts.logflow": [
      {
        resourceSpecCode: "lts.log.flow",
        planList: [
          { productId: "lts-flow", billingMode: "ONDEMAND", billingEvent: "event.type.lts.ltslogflow.traffic", amount: 0.05 },
        ],
      },
    ],
    "lts_lts.logtransfer": [
      {
        resourceSpecCode: "lts.log.transfer.basic",
        planList: [
          { productId: "lts-transfer-basic", billingMode: "ONDEMAND", billingEvent: "event.type.lts.ltslogtransfer.logbasictransfertraffic", amount: 0.0125 },
        ],
      },
      {
        resourceSpecCode: "lts.log.transfer.senior",
        planList: [
          { productId: "lts-transfer-advanced", billingMode: "ONDEMAND", billingEvent: "event.type.lts.ltslogtransfer.logseniortransfertraffic", amount: 0.05 },
        ],
      },
    ],
  },
} as const;

test("LTS parser extracts storage, traffic, and transfer tiers", () => {
  const catalog = parseLtsPricingCatalogResponse(payload, "sa-brazil-1");
  expect(catalog.storageTiers.map((tier) => tier.storageClass)).toEqual(["Standard", "Cold"]);
  expect(catalog.transferTiers.map((tier) => tier.transferType)).toEqual(["Basic", "Advanced"]);
});

test("LTS estimator follows documented flow, index, and storage billing", () => {
  const catalog = parseLtsPricingCatalogResponse(payload, "sa-brazil-1");
  expect(estimateLtsConfiguration(catalog, {
    rawLogSizeGb: 100,
    intelligentColdStorage: true,
    logStorageDurationDays: 30,
    indexFieldRatio: 100,
    dailyBasicTransferVolumeGb: 0,
    dailyAdvancedTransferVolumeGb: 0,
    usageHours: 720,
    quantity: 1,
  })?.amount).toBe(399.01666);

  expect(estimateLtsConfiguration(catalog, {
    rawLogSizeGb: 100,
    intelligentColdStorage: true,
    logStorageDurationDays: 30,
    indexFieldRatio: 100,
    dailyBasicTransferVolumeGb: 100,
    dailyAdvancedTransferVolumeGb: 100,
    usageHours: 720,
    quantity: 1,
  })?.amount).toBe(586.51666);
});

test("LTS estimator rejects impossible values", () => {
  const catalog = parseLtsPricingCatalogResponse(payload, "sa-brazil-1");
  expect(estimateLtsConfiguration(catalog, {
    rawLogSizeGb: 10,
    intelligentColdStorage: false,
    logStorageDurationDays: 0,
    indexFieldRatio: 100,
    dailyBasicTransferVolumeGb: 0,
    dailyAdvancedTransferVolumeGb: 0,
    usageHours: 720,
    quantity: 1,
  })).toBeNull();

  expect(estimateLtsConfiguration(catalog, {
    rawLogSizeGb: 10,
    intelligentColdStorage: false,
    logStorageDurationDays: 7,
    indexFieldRatio: 120,
    dailyBasicTransferVolumeGb: 0,
    dailyAdvancedTransferVolumeGb: 0,
    usageHours: 720,
    quantity: 1,
  })).toBeNull();
});
