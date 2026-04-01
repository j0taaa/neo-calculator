import { expect, test } from "bun:test";

import { estimateGaConfiguration, getGaDestinationEndpointForRegion, listGaAccessPoints } from "@/lib/ga-catalog";
import { parseGaPricingCatalogResponse } from "@/lib/ga-pricing";

const payload = {
  product: {
    ga_accelerator: [
      {
        resourceSpecCode: "accelerator",
        planList: [
          { productId: "ga-accelerator", billingMode: "ONDEMAND", billingEvent: "event.type.ga.accelerator.duration", amount: 0.356 },
        ],
      },
    ],
    ga_traffic: [
      {
        resourceSpecCode: "traffic.brazil.saopaulo",
        "Source endpoint": "Brazil",
        "Destination endpoint": "LA-Sao Paulo1",
        planList: [
          { productId: "ga-traffic-sp", billingMode: "ONDEMAND", billingEvent: "event.type.ga.traffic.traffic", amount: 0.169 },
        ],
      },
      {
        resourceSpecCode: "traffic.chile.saopaulo",
        "Source endpoint": "Chile",
        "Destination endpoint": "LA-Sao Paulo1",
        planList: [
          { productId: "ga-traffic-sp-cl", billingMode: "ONDEMAND", billingEvent: "event.type.ga.traffic.traffic", amount: 0.181 },
        ],
      },
      {
        resourceSpecCode: "traffic.brazil.santiago",
        "Source endpoint": "Brazil",
        "Destination endpoint": "LA-Santiago",
        planList: [
          { productId: "ga-traffic-stg", billingMode: "ONDEMAND", billingEvent: "event.type.ga.traffic.traffic", amount: 0.173 },
        ],
      },
    ],
  },
} as const;

test("GA parser extracts accelerator and traffic tiers", () => {
  const catalog = parseGaPricingCatalogResponse(payload, "global-cbc-1");
  expect(getGaDestinationEndpointForRegion("la-sao-paulo1")).toBe("LA-Sao Paulo1");
  expect(listGaAccessPoints(catalog, "la-sao-paulo1")).toEqual(["Brazil", "Chile"]);
  expect(listGaAccessPoints(catalog, "la-santiago")).toEqual(["Brazil"]);
});

test("GA estimator combines accelerator duration and region traffic", () => {
  const catalog = parseGaPricingCatalogResponse(payload, "global-cbc-1");

  expect(estimateGaConfiguration(catalog, {
    regionValue: "la-sao-paulo1",
    accessPoint: "Brazil",
    trafficGb: 100,
    usageHours: 720,
    quantity: 1,
  })?.amount).toBe(273.22);

  expect(estimateGaConfiguration(catalog, {
    regionValue: "la-santiago",
    accessPoint: "Brazil",
    trafficGb: 50,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(273.514);
});

test("GA estimator rejects unsupported destinations and invalid values", () => {
  const catalog = parseGaPricingCatalogResponse(payload, "global-cbc-1");

  expect(estimateGaConfiguration(catalog, {
    regionValue: "eu-paris",
    accessPoint: "Brazil",
    trafficGb: 10,
    usageHours: 720,
    quantity: 1,
  })).toBeNull();

  expect(estimateGaConfiguration(catalog, {
    regionValue: "la-sao-paulo1",
    accessPoint: "Brazil",
    trafficGb: -1,
    usageHours: 720,
    quantity: 1,
  })).toBeNull();
});
