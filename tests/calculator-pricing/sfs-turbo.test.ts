import { expect, test } from "bun:test";

import { estimateSfsTurboConfiguration, type SfsTurboPricingCatalog } from "@/lib/sfs-turbo-catalog";

const catalog: SfsTurboPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  tiers: [
    {
      generation: "On Sale",
      fileSystemType: "SFS Turbo",
      type: "20MB/s/TiB",
      resourceSpecCode: "sfs.turbo.20MBps",
      plans: [
        { productId: "20-month", billingMode: "MONTHLY", periodNum: 1, amount: 0.043 },
        { productId: "20-year-1", billingMode: "YEARLY", periodNum: 1, amount: 0.473 },
        { productId: "20-year-2", billingMode: "YEARLY", periodNum: 2, amount: 0.7224 },
        { productId: "20-year-3", billingMode: "YEARLY", periodNum: 3, amount: 0.8514 },
        { productId: "20-payg", billingMode: "ONDEMAND", periodNum: null, amount: 0.000059 },
      ],
    },
    {
      generation: "Previous-Generation File Systems",
      fileSystemType: "SFS Turbo",
      type: "Standard Dedicated",
      resourceSpecCode: "sfs.turbo.standard.dedicated",
      plans: [
        { productId: "std-dec-payg", billingMode: "ONDEMAND", periodNum: null, amount: 0.0000576 },
      ],
    },
  ],
};

test("SFS Turbo LATAM estimates stay aligned", () => {
  expect(estimateSfsTurboConfiguration(catalog, {
    billingMode: "Yearly/Monthly",
    generation: "On Sale",
    type: "20MB/s/TiB",
    capacityTb: 2,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(88.064);

  expect(estimateSfsTurboConfiguration(catalog, {
    billingMode: "Pay-per-use",
    generation: "Previous-Generation File Systems",
    type: "Standard Dedicated",
    capacityTb: 2,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(87.76581);
});

test("SFS Turbo rejects impossible capacities", () => {
  expect(estimateSfsTurboConfiguration(catalog, {
    billingMode: "Yearly/Monthly",
    generation: "On Sale",
    type: "20MB/s/TiB",
    capacityTb: 1,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })).toBeNull();
});
