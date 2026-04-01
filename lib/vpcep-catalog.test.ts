import { expect, test } from "bun:test";

import { estimateVpcepConfiguration, listVpcepServiceCategories } from "@/lib/vpcep-catalog";
import { parseVpcepPricingCatalogResponse } from "@/lib/vpcep-pricing";

const payload = {
  product: {
    "vpc_vpcep": [
      {
        resourceSpecCode: "vpcep.basic",
        productSpecSysDesc: "Type:basic",
        type: "basic",
        planList: [
          {
            productId: "vpcep-basic",
            billingMode: "ONDEMAND",
            billingEvent: "event.type.vpc.vpcep.traffic",
            amount: 0,
          },
          {
            productId: "vpcep-basic",
            billingMode: "ONDEMAND",
            billingEvent: "event.type.vpc.vpcep.duration",
            amount: 0.014,
          },
        ],
      },
    ],
  },
} as const;

test("VPCEP parser extracts service categories and rates", () => {
  const catalog = parseVpcepPricingCatalogResponse(payload, "ap-southeast-1");

  expect(listVpcepServiceCategories(catalog)).toEqual(["Basic Edition"]);
  expect(catalog.serviceTiers[0]?.durationRatePerHour).toBe(0.014);
  expect(catalog.serviceTiers[0]?.trafficRatePerGb).toBe(0);
});

test("VPCEP estimator uses duration and traffic rates", () => {
  const catalog = parseVpcepPricingCatalogResponse(payload, "ap-southeast-1");

  expect(estimateVpcepConfiguration(catalog, { serviceCategory: "Basic Edition", usageHours: 744, trafficGb: 0, quantity: 1 })?.amount).toBeCloseTo(10.416, 5);
  expect(estimateVpcepConfiguration(catalog, { serviceCategory: "Basic Edition", usageHours: 24, trafficGb: 100, quantity: 2 })?.amount).toBeCloseTo(0.672, 5);
});
