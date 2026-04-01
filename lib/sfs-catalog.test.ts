import { expect, test } from "bun:test";

import { estimateSfsConfiguration, listSfsDurationMonths, listSfsStorageSpaceOptions, listSfsTypes } from "@/lib/sfs-catalog";
import { parseSfsPricingCatalogResponse } from "@/lib/sfs-pricing";

const payload = {
  product: {
    sfs_sfs: [
      {
        resourceSpecCode: "sfs.storage.100gb",
        productSpecSysDesc: "sfsStorageType:100GB",
        planList: [
          { productId: "100gb-month", billingMode: "MONTHLY", periodNum: 1, amount: 7 },
          { productId: "100gb-year", billingMode: "YEARLY", periodNum: 1, amount: 63 },
        ],
      },
      {
        resourceSpecCode: "sfs.storage.500gb",
        productSpecSysDesc: "sfsStorageType:500GB",
        planList: [
          { productId: "500gb-month", billingMode: "MONTHLY", periodNum: 1, amount: 35 },
          { productId: "500gb-year", billingMode: "YEARLY", periodNum: 1, amount: 315 },
        ],
      },
      {
        resourceSpecCode: "SFS_SATA",
        planList: [
          { productId: "sfs-payg", billingMode: "ONDEMAND", periodNum: null, amount: 0.000125, billingEvent: "event.type.sfs.size" },
        ],
      },
    ],
  },
};

test("SFS parser separates package and payg tiers", () => {
  const catalog = parseSfsPricingCatalogResponse(payload, "la-south-2");
  expect(listSfsTypes(catalog, "Yearly/Monthly")).toEqual(["Capacity-Oriented"]);
  expect(listSfsTypes(catalog, "Pay-per-use")).toEqual(["General"]);
  expect(listSfsStorageSpaceOptions(catalog)).toEqual([100, 500]);
  expect(listSfsDurationMonths(catalog, "Capacity-Oriented")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 12]);
});

test("SFS estimates package and payg flows", () => {
  const catalog = parseSfsPricingCatalogResponse(payload, "la-south-2");
  expect(estimateSfsConfiguration(catalog, {
    billingMode: "Yearly/Monthly",
    fileSystemType: "General",
    type: "Capacity-Oriented",
    storageSpaceGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(7);
  expect(estimateSfsConfiguration(catalog, {
    billingMode: "Pay-per-use",
    fileSystemType: "General",
    type: "General",
    storageSpaceGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(9.3);
});

