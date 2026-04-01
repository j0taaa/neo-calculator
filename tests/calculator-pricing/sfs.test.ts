import { expect, test } from "bun:test";

import { estimateSfsConfiguration, type SfsPricingCatalog } from "@/lib/sfs-catalog";

const catalog: SfsPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  packageTiers: [
    {
      fileSystemType: "General",
      type: "Capacity-Oriented",
      storageSpaceGb: 100,
      resourceSpecCode: "sfs.storage.100gb",
      plans: [
        { productId: "100gb-month", billingMode: "MONTHLY", periodNum: 1, amount: 7 },
        { productId: "100gb-year", billingMode: "YEARLY", periodNum: 1, amount: 63 },
      ],
    },
    {
      fileSystemType: "General",
      type: "Capacity-Oriented",
      storageSpaceGb: 500,
      resourceSpecCode: "sfs.storage.500gb",
      plans: [
        { productId: "500gb-month", billingMode: "MONTHLY", periodNum: 1, amount: 35 },
        { productId: "500gb-year", billingMode: "YEARLY", periodNum: 1, amount: 315 },
      ],
    },
  ],
  paygTiers: [
    {
      fileSystemType: "General",
      type: "General",
      resourceSpecCode: "SFS_SATA",
      ratePerGbHour: 0.000125,
      productId: "sfs-payg",
    },
  ],
};

test("SFS live catalog anchors stay aligned", () => {
  expect(estimateSfsConfiguration(catalog, {
    billingMode: "Yearly/Monthly",
    fileSystemType: "General",
    type: "Capacity-Oriented",
    storageSpaceGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(7);
  expect(estimateSfsConfiguration(catalog, {
    billingMode: "Pay-per-use",
    fileSystemType: "General",
    type: "General",
    storageSpaceGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(9.3);
});

test("SFS rejects unsupported combinations", () => {
  expect(estimateSfsConfiguration(catalog, {
    billingMode: "Pay-per-use",
    fileSystemType: "General",
    type: "Capacity-Oriented",
    storageSpaceGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })).toBeNull();
});
