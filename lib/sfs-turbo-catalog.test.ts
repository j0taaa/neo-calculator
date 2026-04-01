import { expect, test } from "bun:test";

import {
  estimateSfsTurboConfiguration,
  listSfsTurboBillingOptions,
  listSfsTurboDurationMonths,
  listSfsTurboGenerations,
  listSfsTurboTypes,
} from "@/lib/sfs-turbo-catalog";
import { parseSfsTurboPricingCatalogResponse } from "@/lib/sfs-turbo-pricing";

const payload = {
  product: {
    "sfsturbo_sfsturbo": [
      {
        resourceSpecCode: "sfs.turbo.20MBps",
        type: "20MBps",
        planList: [
          { productId: "20-month", billingMode: "MONTHLY", periodNum: 1, amount: 0.043, billingEvent: "event.type.onetime" },
          { productId: "20-year-1", billingMode: "YEARLY", periodNum: 1, amount: 0.473, billingEvent: "event.type.onetime" },
          { productId: "20-year-2", billingMode: "YEARLY", periodNum: 2, amount: 0.7224, billingEvent: "event.type.onetime" },
          { productId: "20-year-3", billingMode: "YEARLY", periodNum: 3, amount: 0.8514, billingEvent: "event.type.onetime" },
          { productId: "20-payg", billingMode: "ONDEMAND", periodNum: null, amount: 0.000059, billingEvent: "event.type.sfsturbo.sfsturbo.period" },
        ],
      },
      {
        resourceSpecCode: "sfs.turbo.standard",
        type: "standard",
        planList: [
          { productId: "std-month", billingMode: "MONTHLY", periodNum: 1, amount: 0.08, billingEvent: "event.type.onetime" },
          { productId: "std-year", billingMode: "YEARLY", periodNum: 1, amount: 0.72, billingEvent: "event.type.onetime" },
          { productId: "std-payg", billingMode: "ONDEMAND", periodNum: null, amount: 0.000128, billingEvent: "event.type.sfsturbo.sfsturbo.period" },
        ],
      },
      {
        resourceSpecCode: "sfs.turbo.standard.dedicated",
        type: "standard dec",
        planList: [
          { productId: "std-dec-payg", billingMode: "ONDEMAND", periodNum: null, amount: 0.0000576, billingEvent: "event.type.sfsturbo.sfsturbo.period" },
        ],
      },
    ],
  },
};

test("SFS Turbo parser extracts generations, types, and durations", () => {
  const catalog = parseSfsTurboPricingCatalogResponse(payload, "la-south-2");

  expect(listSfsTurboGenerations(catalog)).toEqual(["On Sale", "Previous-Generation File Systems"]);
  expect(listSfsTurboTypes(catalog, "On Sale")).toEqual(["20MB/s/TiB"]);
  expect(listSfsTurboTypes(catalog, "Previous-Generation File Systems")).toEqual(["Standard", "Standard Dedicated"]);
  expect(listSfsTurboBillingOptions(catalog, { generation: "Previous-Generation File Systems", type: "Standard Dedicated" })).toEqual(["Pay-per-use"]);
  expect(listSfsTurboDurationMonths(catalog, { generation: "On Sale", type: "20MB/s/TiB" })).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24, 36]);
});

test("SFS Turbo estimator prices package and payg flows", () => {
  const catalog = parseSfsTurboPricingCatalogResponse(payload, "la-south-2");

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
