import { expect, test } from "bun:test";

import {
  estimateModelArtsConfiguration,
  listModelArtsResourceTypes,
  listModelArtsSpecifications,
  type ModelArtsPricingCatalog,
} from "@/lib/modelarts-catalog";

const saoPauloCatalog: ModelArtsPricingCatalog = {
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
      resourceType: "Public Resource Pool",
      specification: "Compute CPU instance (8U)",
      resourceSpecCode: "modelarts.vm.cpu.8u",
      cpuUnits: 8,
      memoryGiB: 32,
      prices: { ONDEMAND: 0.697 },
      productIds: { ONDEMAND: "OFFI843398144303439874" },
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

test("ModelArts lists billing-compatible resource types and specifications", () => {
  expect(listModelArtsResourceTypes(saoPauloCatalog, "Pay-per-use")).toEqual([
    "Public Resource Pool",
    "Dedicated Resource Pool",
    "EVS Storage",
  ]);
  expect(listModelArtsResourceTypes(saoPauloCatalog, "Yearly/Monthly")).toEqual(["Dedicated Resource Pool"]);
  expect(listModelArtsSpecifications(saoPauloCatalog, {
    billingMode: "Pay-per-use",
    resourceType: "Public Resource Pool",
  })).toEqual(["Compute CPU instance (2U)", "Compute CPU instance (8U)"]);
  expect(listModelArtsSpecifications(saoPauloCatalog, {
    billingMode: "Yearly/Monthly",
    resourceType: "Dedicated Resource Pool",
  })).toEqual(["Compute CPU dedicated instance (8U)"]);
});

test("ModelArts estimate matches the provided yearly/monthly dedicated example", () => {
  const estimate = estimateModelArtsConfiguration(saoPauloCatalog, {
    billingMode: "Yearly/Monthly",
    serviceType: "AI Development Lifecycle",
    resourceType: "Dedicated Resource Pool",
    specification: "Compute CPU dedicated instance (8U)",
    quantity: 1,
    storageQuotaGb: 1,
    usageHours: 744,
    durationMonths: 1,
  });

  expect(estimate?.amount).toBe(334.704);
});

test("ModelArts estimate matches the provided pay-per-use examples", () => {
  const publicEstimate = estimateModelArtsConfiguration(saoPauloCatalog, {
    billingMode: "Pay-per-use",
    serviceType: "AI Development Lifecycle",
    resourceType: "Public Resource Pool",
    specification: "Compute CPU instance (2U)",
    quantity: 1,
    storageQuotaGb: 1,
    usageHours: 744,
    durationMonths: 1,
  });
  const dedicatedEstimate = estimateModelArtsConfiguration(saoPauloCatalog, {
    billingMode: "Pay-per-use",
    serviceType: "AI Development Lifecycle",
    resourceType: "Dedicated Resource Pool",
    specification: "Compute CPU dedicated instance (8U)",
    quantity: 1,
    storageQuotaGb: 1,
    usageHours: 744,
    durationMonths: 1,
  });
  const storageEstimate = estimateModelArtsConfiguration(saoPauloCatalog, {
    billingMode: "Pay-per-use",
    serviceType: "AI Development Lifecycle",
    resourceType: "EVS Storage",
    specification: "Instance storage",
    quantity: 1,
    storageQuotaGb: 1,
    usageHours: 744,
    durationMonths: 1,
  });

  expect(publicEstimate?.amount).toBe(130.2);
  expect(dedicatedEstimate?.amount).toBe(518.568);
  expect(storageEstimate?.amount).toBe(0.2976);
});
