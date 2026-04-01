import { expect, test } from "bun:test";

import { estimateModelArtsConfiguration, type ModelArtsPricingCatalog } from "@/lib/modelarts-catalog";

const catalog: ModelArtsPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  serviceType: "AI Development Lifecycle",
  computeTiers: [
    {
      resourceType: "Public Resource Pool",
      specification: "Compute CPU instance (2U)",
      resourceSpecCode: "modelarts.vm.cpu.2u",
      cpuUnits: 2,
      memoryGiB: 8,
      prices: { ONDEMAND: 0.175 },
      productIds: { ONDEMAND: "OFFI843398144303439875" },
    },
    {
      resourceType: "Dedicated Resource Pool",
      specification: "Compute CPU dedicated instance (8U)",
      resourceSpecCode: "modelarts.vm.cpu.8ud",
      cpuUnits: 8,
      memoryGiB: 32,
      prices: { ONDEMAND: 0.697, MONTHLY: 334.704, YEARLY: 3347.04 },
      productIds: {
        ONDEMAND: "OFFI843398144303439873",
        MONTHLY: "OFFI843400111289409538",
        YEARLY: "OFFI843400111289409539",
      },
    },
  ],
  storageTier: {
    resourceType: "EVS Storage",
    specification: "Instance storage",
    resourceSpecCode: "modelarts.storage.volume",
    prices: { ONDEMAND: 0.0004 },
    productIds: { ONDEMAND: "OFFI-modelarts-storage" },
  },
};

test("ModelArts price examples stay aligned", () => {
  expect(
    estimateModelArtsConfiguration(catalog, {
      billingMode: "Yearly/Monthly",
      serviceType: "AI Development Lifecycle",
      resourceType: "Dedicated Resource Pool",
      specification: "Compute CPU dedicated instance (8U)",
      quantity: 1,
      storageQuotaGb: 1,
      usageHours: 744,
      durationMonths: 1,
    })?.amount,
  ).toBe(334.704);

  expect(
    estimateModelArtsConfiguration(catalog, {
      billingMode: "Pay-per-use",
      serviceType: "AI Development Lifecycle",
      resourceType: "Public Resource Pool",
      specification: "Compute CPU instance (2U)",
      quantity: 1,
      storageQuotaGb: 1,
      usageHours: 744,
      durationMonths: 1,
    })?.amount,
  ).toBe(130.2);

  expect(
    estimateModelArtsConfiguration(catalog, {
      billingMode: "Pay-per-use",
      serviceType: "AI Development Lifecycle",
      resourceType: "Dedicated Resource Pool",
      specification: "Compute CPU dedicated instance (8U)",
      quantity: 1,
      storageQuotaGb: 1,
      usageHours: 744,
      durationMonths: 1,
    })?.amount,
  ).toBe(518.568);

  expect(
    estimateModelArtsConfiguration(catalog, {
      billingMode: "Pay-per-use",
      serviceType: "AI Development Lifecycle",
      resourceType: "EVS Storage",
      specification: "Instance storage",
      quantity: 1,
      storageQuotaGb: 1,
      usageHours: 744,
      durationMonths: 1,
    })?.amount,
  ).toBe(0.2976);
});

test("ModelArts rejects unsupported yearly or monthly contract lengths", () => {
  expect(
    estimateModelArtsConfiguration(catalog, {
      billingMode: "Yearly/Monthly",
      serviceType: "AI Development Lifecycle",
      resourceType: "Dedicated Resource Pool",
      specification: "Compute CPU dedicated instance (8U)",
      quantity: 1,
      storageQuotaGb: 1,
      usageHours: 744,
      durationMonths: 10,
    }),
  ).toBeNull();
});
