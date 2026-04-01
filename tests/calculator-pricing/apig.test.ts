import { expect, test } from "bun:test";

import { estimateApigConfiguration, type ApigPricingCatalog } from "@/lib/apig-catalog";

const catalog: ApigPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  editionTiers: [
    {
      edition: "Basic",
      resourceSpecCode: "BASIC",
      hourlyRate: 0.76,
      productId: "apig-basic",
    },
    {
      edition: "Professional",
      resourceSpecCode: "PROFESSIONAL",
      hourlyRate: 3.46,
      productId: "apig-pro",
    },
  ],
  publicBandwidthTiers: [
    {
      resourceSpecCode: "publicip",
      productId: "apig-public-bandwidth",
      ratePerMbitHour: null,
      tiers: [
        { startGb: 0, upToGb: 5, amountPerGb: 0.013 },
        { startGb: 5, upToGb: null, amountPerGb: 0.04 },
      ],
    },
  ],
};

test("APIG price anchors stay aligned", () => {
  expect(estimateApigConfiguration(catalog, {
    edition: "Basic",
    publicOutboundAccess: false,
    bandwidthMbit: 0,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(565.44);

  expect(estimateApigConfiguration(catalog, {
    edition: "Basic",
    publicOutboundAccess: true,
    bandwidthMbit: 10,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(762.6);
});

test("APIG rejects impossible values", () => {
  expect(estimateApigConfiguration(catalog, {
    edition: "Professional",
    publicOutboundAccess: true,
    bandwidthMbit: 0,
    usageHours: 744,
    quantity: 1,
  })).toBeNull();
});
