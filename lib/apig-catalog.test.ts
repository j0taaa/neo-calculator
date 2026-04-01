import { expect, test } from "bun:test";

import { estimateApigConfiguration, listApigEditions } from "@/lib/apig-catalog";
import { parseApigPricingCatalogResponse } from "@/lib/apig-pricing";

const payload = {
  product: {
    "apig_apig.instance": [
      {
        resourceSpecCode: "BASIC",
        productSpecSysDesc: "TPS:2000number;type:basic",
        planList: [
          {
            productId: "apig-basic",
            billingMode: "ONDEMAND",
            billingEvent: "event.type.apig.apiginstance.duration",
            amount: 0.76,
          },
        ],
      },
      {
        resourceSpecCode: "PROFESSIONAL",
        productSpecSysDesc: "TPS:4000number;type:professional",
        planList: [
          {
            productId: "apig-pro",
            billingMode: "ONDEMAND",
            billingEvent: "event.type.apig.apiginstance.duration",
            amount: 3.46,
          },
        ],
      },
      {
        resourceSpecCode: "PLATINUM_X2",
        productSpecSysDesc: "TPS:20000number;type:platinum_x2",
        planList: [
          {
            productId: "apig-platinum-2",
            billingMode: "ONDEMAND",
            billingEvent: "event.type.apig.apiginstance.duration",
            amount: 14.194,
          },
        ],
      },
    ],
    "apig_apig.publicip": [
      {
        resourceSpecCode: "publicip",
        planList: [
          {
            productId: "apig-public-bandwidth",
            billingMode: "ONDEMAND",
            billingEvent: "event.type.apig.apigpublicip.duration",
            divisionList: [
              { amount: 0.013, division: { beginValue: 0, endValue: 5 } },
              { amount: 0.04, division: { beginValue: 5, endValue: -1 } },
            ],
          },
        ],
      },
    ],
  },
} as const;

test("APIG parser extracts editions and public bandwidth tiers", () => {
  const catalog = parseApigPricingCatalogResponse(payload, "la-south-2");

  expect(listApigEditions(catalog)).toEqual(["Basic", "Professional", "Platinum 2"]);
  expect(catalog.publicBandwidthTiers[0]?.tiers).toEqual([
    { startGb: 0, upToGb: 5, amountPerGb: 0.013 },
    { startGb: 5, upToGb: null, amountPerGb: 0.04 },
  ]);
  expect(catalog.publicBandwidthTiers[0]?.ratePerMbitHour).toBeNull();
});

test("APIG estimator uses instance hourly rate without public outbound access", () => {
  const catalog = parseApigPricingCatalogResponse(payload, "la-south-2");

  expect(estimateApigConfiguration(catalog, {
    edition: "Basic",
    publicOutboundAccess: false,
    bandwidthMbit: 0,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(565.44);
});

test("APIG estimator adds tiered public bandwidth when enabled", () => {
  const catalog = parseApigPricingCatalogResponse(payload, "la-south-2");

  expect(estimateApigConfiguration(catalog, {
    edition: "Basic",
    publicOutboundAccess: true,
    bandwidthMbit: 10,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(762.6);
});

test("APIG estimator rejects invalid public bandwidth selections", () => {
  const catalog = parseApigPricingCatalogResponse(payload, "la-south-2");

  expect(estimateApigConfiguration(catalog, {
    edition: "Basic",
    publicOutboundAccess: true,
    bandwidthMbit: 0,
    usageHours: 744,
    quantity: 1,
  })).toBeNull();
});

test("APIG estimator supports flat live public outbound bandwidth rates", () => {
  const catalog = parseApigPricingCatalogResponse({
    product: {
      "apig_apig.instance": payload.product["apig_apig.instance"],
      "apig_apig.publicip": [
        {
          resourceSpecCode: "publicip",
          planList: [
            {
              productId: "apig-public-bandwidth-flat",
              billingMode: "ONDEMAND",
              billingEvent: "event.type.apig.apigpublicip.duration",
              amount: 0.0281,
            },
          ],
        },
      ],
    },
  }, "sa-brazil-1");

  expect(estimateApigConfiguration(catalog, {
    edition: "Basic",
    publicOutboundAccess: true,
    bandwidthMbit: 10,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(774.504);
});
