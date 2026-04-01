import { expect, test } from "bun:test";

import { estimateLtsConfiguration, type LtsPricingCatalog } from "@/lib/lts-catalog";

const catalog: LtsPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  storageTiers: [
    { storageClass: "Standard", resourceSpecCode: "lts.log.storage", ratePerGbHour: 0.000125, productId: "lts-storage" },
    { storageClass: "Cold", resourceSpecCode: "lts.log.storage.cold", ratePerGbHour: 0.00003993, productId: "lts-storage-cold" },
  ],
  indexTiers: [
    { resourceSpecCode: "lts.log.index", ratePerGb: 0.08, productId: "lts-index" },
  ],
  flowTiers: [
    { resourceSpecCode: "lts.log.flow", ratePerGb: 0.05, productId: "lts-flow" },
  ],
  transferTiers: [
    { transferType: "Basic", resourceSpecCode: "lts.log.transfer.basic", ratePerGb: 0.0125, productId: "lts-basic" },
    { transferType: "Advanced", resourceSpecCode: "lts.log.transfer.senior", ratePerGb: 0.05, productId: "lts-advanced" },
  ],
};

test("LTS documented anchor stays aligned in Sao Paulo", () => {
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
});

test("LTS rejects impossible values", () => {
  expect(estimateLtsConfiguration(catalog, {
    rawLogSizeGb: 100,
    intelligentColdStorage: true,
    logStorageDurationDays: 30,
    indexFieldRatio: 101,
    dailyBasicTransferVolumeGb: 0,
    dailyAdvancedTransferVolumeGb: 0,
    usageHours: 720,
    quantity: 1,
  })).toBeNull();
});
