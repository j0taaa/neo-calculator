import { expect, test } from "bun:test";

import { estimateGaConfiguration, type GaPricingCatalog } from "@/lib/ga-catalog";

const catalog: GaPricingCatalog = {
  currency: "USD",
  regionId: "global-cbc-1",
  acceleratorTiers: [
    {
      resourceSpecCode: "accelerator",
      hourlyRate: 0.356,
      productId: "ga-accelerator",
    },
  ],
  trafficTiers: [
    {
      resourceSpecCode: "traffic.brazil.saopaulo",
      accessPoint: "Brazil",
      destinationEndpoint: "LA-Sao Paulo1",
      ratePerGb: 0.169,
      productId: "ga-traffic-sp",
    },
    {
      resourceSpecCode: "traffic.chile.santiago",
      accessPoint: "Chile",
      destinationEndpoint: "LA-Santiago",
      ratePerGb: 0.173,
      productId: "ga-traffic-stg",
    },
  ],
};

test("GA LATAM estimates stay aligned", () => {
  expect(estimateGaConfiguration(catalog, {
    regionValue: "la-sao-paulo1",
    accessPoint: "Brazil",
    trafficGb: 100,
    usageHours: 720,
    quantity: 1,
  })?.amount).toBe(273.22);

  expect(estimateGaConfiguration(catalog, {
    regionValue: "la-santiago",
    accessPoint: "Chile",
    trafficGb: 50,
    usageHours: 720,
    quantity: 1,
  })?.amount).toBe(264.97);
});

test("GA rejects impossible values", () => {
  expect(estimateGaConfiguration(catalog, {
    regionValue: "la-sao-paulo1",
    accessPoint: "Brazil",
    trafficGb: -1,
    usageHours: 720,
    quantity: 1,
  })).toBeNull();
});
