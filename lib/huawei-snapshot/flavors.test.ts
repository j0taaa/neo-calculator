import { expect, test } from "bun:test";
import { snapshotFlavors } from "./flavors";
import type { ScopeSnapshot } from "./types";
test("flavor cards separate identical SKUs and rates by availability zone", () => {
  const row = {
    resourceType: "hws.resource.type.vm",
    resourceSpecCode: "c7n.large.2.linux",
    cpu: "2",
    mem: "4",
    planList: [{ billingMode: "ONDEMAND", amount: 1 }],
  };
  const scope = {
    products: {
      product: {
        vm: [
          row,
          {
            ...row,
            locationCode: "lagos",
            planList: [{ billingMode: "ONDEMAND", amount: 2 }],
          },
          { ...row, resourceSpecCode: "edge-only", locationCode: "lagos" },
        ],
      },
    },
    source: { fetchedAt: "now" },
  } as unknown as ScopeSnapshot;
  expect(snapshotFlavors(scope)).toHaveLength(1);
  expect(snapshotFlavors(scope)[0].prices.ONDEMAND).toBe(1);
  expect(snapshotFlavors(scope, "lagos")).toHaveLength(2);
  expect(snapshotFlavors(scope, "lagos")[0].prices.ONDEMAND).toBe(2);
  expect(snapshotFlavors(scope, "unknown")).toEqual([]);
});
