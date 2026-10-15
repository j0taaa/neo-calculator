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
test("flavor cards use the official generation choices and ignore catalog-only generations", () => {
  const row = {
    resourceType: "hws.resource.type.vm", resourceSpecCode: "t6.large.2.linux",
    generation: "T6", series: "catalog-series", cpu: "2", mem: "4",
    planList: [{ billingMode: "ONDEMAND", amount: 1 }],
  };
  const scope = {
    config: `var viewConfig = {calc_view:{components:[{
      id: 'calculator_ecs_radio', type: 'CommonRadioGroup',
      optionKeys: ['arch', 'generation'], sortMethods: {
        0: ['x86'], 1: [ // available flavors
          'T6', /* disabled catalog data is not a choice */ 'C7n'
        ]
      }, titleTips: []
    }]}};`,
    products: { product: { vm: [row, {...row, generation: "aT7", resourceSpecCode: "at7.large.2.linux"}] } },
    source: { fetchedAt: "now" },
  } as unknown as ScopeSnapshot;
  expect(snapshotFlavors(scope).map(flavor => flavor.resourceSpecCode)).toEqual(["t6.large.2.linux"]);
  expect(snapshotFlavors(scope)[0].series).toBe("T6");
  expect(() => snapshotFlavors({...scope, config: "unrecognized config"})).toThrow("generation choices");
  expect(snapshotFlavors({...scope, config: "compiled during synchronization", flavorGenerations: ["T6"]})).toHaveLength(1);
});
test("RI card availability requires an actual reservation offer in the same zone", () => {
  const row = { resourceType: "hws.resource.type.vm", resourceSpecCode: "eligible.linux",
    cpu: "2", mem: "4", planList: [{ billingMode: "ONDEMAND", amount: 1 }] };
  const scope = {
    products: { product: { vm: [row, {...row, resourceSpecCode: "other.linux"},
      {...row, RITime: "nodeData.1_3", planList: [{ billingMode: "RI", amount: 0 }]},
      {...row, resourceSpecCode: "other.linux", locationCode: "zone", RITime: "nodeData.1_3", planList: [{ billingMode: "RI", amount: 0 }]}] } },
    source: { fetchedAt: "now" },
  } as unknown as ScopeSnapshot;
  const [eligible, other] = snapshotFlavors(scope);
  expect(eligible.billingModes).toEqual(["RI", "ONDEMAND"]);
  expect(eligible.prices.RI).toBeUndefined();
  expect(other.billingModes).toEqual(["ONDEMAND"]);
});
