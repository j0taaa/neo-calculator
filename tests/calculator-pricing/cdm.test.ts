import { expect, test } from "bun:test";

import { estimateCdmConfiguration, type CdmPricingCatalog } from "@/lib/cdm-catalog";

const catalog: CdmPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  tiers: [
    {
      instanceType: "cdm.small",
      vCpus: 2,
      memoryGb: 4,
      bandwidthGbit: "1",
      maxJobs: 16,
      label: "Small",
      resourceSpecCode: "cdm.small",
      prices: { ONDEMAND: 0.10 },
      productIds: { ONDEMAND: "cdm-small-on-1" },
    },
    {
      instanceType: "cdm.large",
      vCpus: 4,
      memoryGb: 8,
      bandwidthGbit: "10",
      maxJobs: 64,
      label: "Large",
      resourceSpecCode: "cdm.large",
      prices: { ONDEMAND: 0.25 },
      productIds: { ONDEMAND: "cdm-large-on-1" },
    },
    {
      instanceType: "cdm.xlarge",
      vCpus: 8,
      memoryGb: 16,
      bandwidthGbit: "10",
      maxJobs: 128,
      label: "Extra Large",
      resourceSpecCode: "cdm.xlarge",
      prices: { ONDEMAND: 0.45 },
      productIds: { ONDEMAND: "cdm-xlarge-on-1" },
    },
  ],
};

test("CDM Pay-per-use estimate with usageHours", () => {
  expect(
    estimateCdmConfiguration(catalog, {
      instanceType: "cdm.small",
      quantity: 1,
      usageHours: 744,
    })?.amount,
  ).toBeCloseTo(74.4, 2);

  expect(
    estimateCdmConfiguration(catalog, {
      instanceType: "cdm.large",
      quantity: 2,
      usageHours: 744,
    })?.amount,
  ).toBeCloseTo(372.0, 2);

  expect(
    estimateCdmConfiguration(catalog, {
      instanceType: "cdm.xlarge",
      quantity: 1,
      usageHours: 744,
    })?.amount,
  ).toBeCloseTo(334.8, 2);
});

test("CDM returns null for unknown instance type", () => {
  expect(
    estimateCdmConfiguration(catalog, {
      instanceType: "cdm.nonexistent",
      quantity: 1,
      usageHours: 744,
    }),
  ).toBeNull();
});
