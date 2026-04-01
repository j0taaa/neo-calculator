import { expect, test } from "bun:test";

import { estimateCbrConfiguration, listCbrDurationMonths } from "@/lib/cbr-catalog";
import { parseCbrPricingCatalogResponse } from "@/lib/cbr-pricing";

const payload = {
  product: {
    "cbr_cbr.vault": [
      {
        type: "Server",
        resourceSpecCode: "vault.backup.server.normal",
        planList: [
          { productId: "srv-month", billingMode: "MONTHLY", periodNum: 1, amount: 0.036 },
          { productId: "srv-year1", billingMode: "YEARLY", periodNum: 1, amount: 0.359 },
          { productId: "srv-year3", billingMode: "YEARLY", periodNum: 3, amount: 0.65 },
          { productId: "srv-ondemand", billingMode: "ONDEMAND", periodNum: null, amount: 0.00005, billingEvent: "event.type.cbr.cbrvault.duration" },
        ],
      },
      {
        type: "Disk",
        resourceSpecCode: "vault.backup.volume.normal",
        planList: [
          { productId: "disk-month", billingMode: "MONTHLY", periodNum: 1, amount: 0.019 },
        ],
      },
    ],
  },
};

test("CBR parser normalizes vault tiers", () => {
  const catalog = parseCbrPricingCatalogResponse(payload, "sa-brazil-1");
  expect(catalog.vaultTiers.map((tier) => tier.vaultType)).toEqual(["Disk", "Server"]);
  expect(listCbrDurationMonths(catalog, "Server")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 36]);
});

test("CBR estimates both subscription and pay-per-use flows", () => {
  const catalog = parseCbrPricingCatalogResponse(payload, "sa-brazil-1");
  expect(estimateCbrConfiguration(catalog, {
    billingMode: "Yearly/Monthly",
    vaultType: "Server",
    vaultCapacityGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(3.6);
  expect(estimateCbrConfiguration(catalog, {
    billingMode: "Pay-per-use",
    vaultType: "Server",
    vaultCapacityGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(3.72);
});

