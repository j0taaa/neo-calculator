import { expect, test } from "bun:test";

import { estimateDcsConfiguration, type DcsPricingCatalog } from "@/lib/dcs-catalog";

const catalog: DcsPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  edition: "Basic",
  instanceTiers: [
    {
      edition: "Basic",
      version: "7.0",
      instanceType: "Single-node",
      architecture: "x86 | DRAM",
      memoryGiB: 4,
      specification: "4 GB",
      replicas: null,
      resourceSpecCode: "redis.basic.single.x86.4g",
      prices: { ONDEMAND: 0.0633333333 },
      productIds: { ONDEMAND: "redis.basic.single.x86.7.0.4g" },
    },
    {
      edition: "Basic",
      version: "7.0",
      instanceType: "Single-node",
      architecture: "ARM | DRAM",
      memoryGiB: 4,
      specification: "4 GB",
      replicas: null,
      resourceSpecCode: "redis.basic.single.arm.4g",
      prices: { ONDEMAND: 0.0470026882 },
      productIds: { ONDEMAND: "redis.basic.single.arm.7.0.4g" },
    },
    {
      edition: "Basic",
      version: "7.0",
      instanceType: "Master/Standby",
      architecture: "x86 | DRAM",
      memoryGiB: 4,
      specification: "4 GB",
      replicas: 2,
      resourceSpecCode: "redis.basic.ms.x86.2rep.4g",
      prices: { ONDEMAND: 0.1313306452 },
      productIds: { ONDEMAND: "redis.basic.ms.x86.7.0.2rep.4g" },
    },
    {
      edition: "Basic",
      version: "7.0",
      instanceType: "Redis Cluster",
      architecture: "x86 | DRAM",
      memoryGiB: 4,
      specification: "4 GB",
      replicas: 2,
      resourceSpecCode: "redis.basic.cluster.x86.2rep.4g",
      prices: { ONDEMAND: 0.1773252688 },
      productIds: { ONDEMAND: "redis.basic.cluster.x86.7.0.2rep.4g" },
    },
    {
      edition: "Basic",
      version: "7.0",
      instanceType: "Redis Cluster",
      architecture: "ARM | DRAM",
      memoryGiB: 4,
      specification: "4 GB",
      replicas: 2,
      resourceSpecCode: "redis.basic.cluster.arm.2rep.4g",
      prices: { ONDEMAND: 0.1223252688 },
      productIds: { ONDEMAND: "redis.basic.cluster.arm.7.0.2rep.4g" },
    },
  ],
  bandwidthRatePerMbitHour: 0.005,
};

test("DCS documented examples stay aligned", () => {
  expect(
    estimateDcsConfiguration(catalog, {
      edition: "Basic",
      version: "7.0",
      instanceType: "Single-node",
      architecture: "x86 | DRAM",
      replicas: null,
      specification: "4 GB",
      quantity: 1,
      elasticBandwidth: "Buy now",
      bandwidthMbit: 1,
      usageHours: 744,
    })?.amount,
  ).toBeCloseTo(50.84, 2);

  expect(
    estimateDcsConfiguration(catalog, {
      edition: "Basic",
      version: "7.0",
      instanceType: "Master/Standby",
      architecture: "x86 | DRAM",
      replicas: 2,
      specification: "4 GB",
      quantity: 1,
      elasticBandwidth: "Buy now",
      bandwidthMbit: 1,
      usageHours: 744,
    })?.amount,
  ).toBeCloseTo(101.43, 2);

  expect(
    estimateDcsConfiguration(catalog, {
      edition: "Basic",
      version: "7.0",
      instanceType: "Redis Cluster",
      architecture: "x86 | DRAM",
      replicas: 2,
      specification: "4 GB",
      quantity: 1,
      elasticBandwidth: "Buy now",
      bandwidthMbit: 1,
      usageHours: 744,
    })?.amount,
  ).toBeCloseTo(135.65, 2);

  expect(
    estimateDcsConfiguration(catalog, {
      edition: "Basic",
      version: "7.0",
      instanceType: "Redis Cluster",
      architecture: "ARM | DRAM",
      replicas: 2,
      specification: "4 GB",
      quantity: 1,
      elasticBandwidth: "Buy now",
      bandwidthMbit: 1,
      usageHours: 744,
    })?.amount,
  ).toBeCloseTo(94.73, 2);

  expect(
    estimateDcsConfiguration(catalog, {
      edition: "Basic",
      version: "7.0",
      instanceType: "Single-node",
      architecture: "ARM | DRAM",
      replicas: null,
      specification: "4 GB",
      quantity: 1,
      elasticBandwidth: "Buy later",
      bandwidthMbit: 1,
      usageHours: 744,
    })?.amount,
  ).toBeCloseTo(34.97, 2);
});

test("DCS rejects impossible elastic bandwidth values", () => {
  expect(
    estimateDcsConfiguration(catalog, {
      edition: "Basic",
      version: "7.0",
      instanceType: "Single-node",
      architecture: "x86 | DRAM",
      replicas: null,
      specification: "4 GB",
      quantity: 1,
      elasticBandwidth: "Buy now",
      bandwidthMbit: 0,
      usageHours: 744,
    }),
  ).toBeNull();
});
