import { expect, test } from "bun:test";

import { buildClonedListName, selectCheapestFlavorForClone } from "@/lib/cart-clone";
import type { StoredEcsFlavor } from "@/lib/ecs-flavor-catalog";
import type { SystemDiskOption } from "@/lib/evs-disk-pricing";

const baseFlavor = {
  regionId: "sa-brazil-1",
  family: "General purpose",
  architecture: "x86",
  series: "c7",
  description: "Test flavor",
  currency: "USD",
  updatedAt: "2026-03-11T00:00:00.000Z",
} satisfies Omit<StoredEcsFlavor, "resourceSpecCode" | "cpu" | "ramGiB" | "prices" | "priceSources">;

function makeFlavor(
  resourceSpecCode: string,
  cpu: number,
  ramGiB: number,
  prices: StoredEcsFlavor["prices"],
): StoredEcsFlavor {
  return {
    ...baseFlavor,
    resourceSpecCode,
    cpu,
    ramGiB,
    prices,
    priceSources: {},
  };
}

function makeDiskPricing(overrides: Partial<Record<SystemDiskOption, Partial<Record<"ONDEMAND" | "MONTHLY" | "YEARLY", number>>>>) {
  return {
    currency: "USD",
    prices: {
      "High I/O": {},
      "Ultra-high I/O": {},
      "Extreme SSD": {},
      "General Purpose SSD": {},
      "General Purpose SSD V2": {},
      ...overrides,
    },
  };
}

test("selectCheapestFlavorForClone picks the cheapest pay-per-use flavor that meets the requirements", () => {
  const flavors = [
    makeFlavor("g6.large.2", 2, 8, { ONDEMAND: 0.24 }),
    makeFlavor("c7.xlarge.4", 4, 16, { ONDEMAND: 0.18 }),
    makeFlavor("c7.medium.1", 1, 4, { ONDEMAND: 0.09 }),
  ];
  const diskPricing = makeDiskPricing({
    "High I/O": { ONDEMAND: 0.01 },
    "Ultra-high I/O": { ONDEMAND: 0.03 },
  });

  const selection = selectCheapestFlavorForClone(
    flavors,
    diskPricing,
    {
      region: "la-sao-paulo1",
      billingMode: "Pay-per-use",
      usageHours: 100,
      vcpu: 2,
      ramGiB: 8,
      systemDiskType: "High I/O",
      systemDiskSizeGiB: 40,
    },
    "Pay-per-use",
  );

  expect(selection?.flavor.resourceSpecCode).toBe("c7.xlarge.4");
  expect(selection?.catalogBillingMode).toBe("ONDEMAND");
  expect(selection?.systemDiskType).toBe("High I/O");
  expect(selection?.totalAmount).toBe(58);
});

test("selectCheapestFlavorForClone ignores derived on-demand prices for pay-per-use", () => {
  const flavors: StoredEcsFlavor[] = [
    {
      ...makeFlavor("t6.xlarge.4", 4, 16, { ONDEMAND: 0.116, RI: 630.72 }),
      priceSources: {
        ONDEMAND: "rate_inquiry",
        RI: "catalog_plan",
      },
    },
    makeFlavor("c7.xlarge.4", 4, 16, { ONDEMAND: 0.18 }),
  ];
  const diskPricing = makeDiskPricing({
    "High I/O": { ONDEMAND: 0.01 },
  });

  const selection = selectCheapestFlavorForClone(
    flavors,
    diskPricing,
    {
      region: "la-sao-paulo1",
      billingMode: "Pay-per-use",
      usageHours: 100,
      vcpu: 2,
      ramGiB: 8,
      systemDiskType: "High I/O",
      systemDiskSizeGiB: 40,
    },
    "Pay-per-use",
  );

  expect(selection?.flavor.resourceSpecCode).toBe("c7.xlarge.4");
  expect(selection?.catalogBillingMode).toBe("ONDEMAND");
});

test("selectCheapestFlavorForClone falls back to the cheapest available on-demand disk for RI", () => {
  const flavors = [
    makeFlavor("g6.large.2", 2, 8, { RI: 900 }),
    makeFlavor("c7.xlarge.4", 4, 16, { RI: 840 }),
  ];
  const diskPricing = makeDiskPricing({
    "Ultra-high I/O": { ONDEMAND: 0.03 },
    "General Purpose SSD": { ONDEMAND: 0.02 },
  });

  const selection = selectCheapestFlavorForClone(
    flavors,
    diskPricing,
    {
      region: "la-sao-paulo1",
      billingMode: "RI",
      usageHours: 744,
      vcpu: 2,
      ramGiB: 8,
      systemDiskType: "High I/O",
      systemDiskSizeGiB: 40,
    },
    "RI",
  );

  expect(selection?.flavor.resourceSpecCode).toBe("c7.xlarge.4");
  expect(selection?.catalogBillingMode).toBe("RI");
  expect(selection?.systemDiskType).toBe("General Purpose SSD");
  expect(selection?.diskAmount).toBe(7008);
  expect(selection?.totalAmount).toBe(7848);
});

test("selectCheapestFlavorForClone prefers monthly pricing before yearly when both are viable", () => {
  const flavors = [
    makeFlavor("m7.large.2", 2, 8, { MONTHLY: 110 }),
    makeFlavor("m7.xlarge.4", 4, 16, { YEARLY: 650 }),
  ];
  const diskPricing = makeDiskPricing({
    "High I/O": { MONTHLY: 1.2, YEARLY: 8 },
  });

  const selection = selectCheapestFlavorForClone(
    flavors,
    diskPricing,
    {
      region: "la-sao-paulo1",
      billingMode: "Yearly/Monthly",
      usageHours: 744,
      vcpu: 2,
      ramGiB: 8,
      systemDiskType: "High I/O",
      systemDiskSizeGiB: 40,
    },
    "Yearly/Monthly",
  );

  expect(selection?.catalogBillingMode).toBe("MONTHLY");
  expect(selection?.flavor.resourceSpecCode).toBe("m7.large.2");
  expect(selection?.totalAmount).toBe(158);
});

test("buildClonedListName appends region and billing suffixes when no explicit name is provided", () => {
  expect(buildClonedListName("API Cart", { targetRegion: "la-sao-paulo1", targetBillingMode: "RI" })).toBe(
    "API Cart (LA-Sao Paulo1 · RI)",
  );
  expect(buildClonedListName("API Cart", {})).toBe("API Cart (Copy)");
  expect(buildClonedListName("API Cart", { name: "Disaster Recovery" })).toBe("Disaster Recovery");
});
