import { expect, test } from "bun:test";

import { estimateVpcepConfiguration, type VpcepPricingCatalog } from "@/lib/vpcep-catalog";

const catalog: VpcepPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  serviceTiers: [
    {
      serviceCategory: "Basic Edition",
      resourceSpecCode: "vpcep.basic",
      durationRatePerHour: 0.014,
      trafficRatePerGb: 0,
      productId: "vpcep-basic",
    },
  ],
};

test("VPCEP live catalog anchors stay aligned", () => {
  expect(estimateVpcepConfiguration(catalog, { serviceCategory: "Basic Edition", usageHours: 1, trafficGb: 0, quantity: 1 })?.amount).toBeCloseTo(0.014, 5);
  expect(estimateVpcepConfiguration(catalog, { serviceCategory: "Basic Edition", usageHours: 744, trafficGb: 0, quantity: 1 })?.amount).toBeCloseTo(10.416, 5);
});

test("VPCEP rejects impossible duration", () => {
  expect(estimateVpcepConfiguration(catalog, { serviceCategory: "Basic Edition", usageHours: 0, trafficGb: 0, quantity: 1 })).toBeNull();
});
