import { expect, test } from "bun:test";

import {
  estimateDcsConfiguration,
  listDcsArchitectures,
  listDcsInstanceTypes,
  listDcsReplicas,
  listDcsSpecifications,
  listDcsVersions,
} from "@/lib/dcs-catalog";
import { parseDcsPricingCatalogResponse } from "@/lib/dcs-pricing";

const fixture = {
  product: {
    redis_instances: [
      {
        redisVersion: "7.0",
        instanceType: "Single-node",
        architecture: "x86",
        specification: "4 GB",
        resourceSpecCode: "redis.basic.single.x86.4g",
        planList: [{ productId: "redis.basic.single.x86.7.0.4g", billingMode: "ONDEMAND", amount: 0.0633333333 }],
      },
      {
        redisVersion: "7.0",
        instanceType: "Single-node",
        architecture: "arm",
        specification: "4 GB",
        resourceSpecCode: "redis.basic.single.arm.4g",
        planList: [{ productId: "redis.basic.single.arm.7.0.4g", billingMode: "ONDEMAND", amount: 0.0470026882 }],
      },
      {
        redisVersion: "7.0",
        instanceType: "Master/Standby",
        architecture: "x86",
        replicas: 2,
        specification: "4 GB",
        resourceSpecCode: "redis.basic.ms.x86.2rep.4g",
        planList: [{ productId: "redis.basic.ms.x86.7.0.2rep.4g", billingMode: "ONDEMAND", amount: 0.1313306452 }],
      },
      {
        redisVersion: "7.0",
        instanceType: "Redis Cluster",
        architecture: "x86",
        replicas: 2,
        specification: "4 GB",
        resourceSpecCode: "redis.basic.cluster.x86.2rep.4g",
        planList: [{ productId: "redis.basic.cluster.x86.7.0.2rep.4g", billingMode: "ONDEMAND", amount: 0.1773252688 }],
      },
      {
        redisVersion: "7.0",
        instanceType: "Redis Cluster",
        architecture: "arm",
        replicas: 2,
        specification: "4 GB",
        resourceSpecCode: "redis.basic.cluster.arm.2rep.4g",
        planList: [{ productId: "redis.basic.cluster.arm.7.0.2rep.4g", billingMode: "ONDEMAND", amount: 0.1223252688 }],
      },
      {
        redisVersion: "7.0",
        instanceType: "Single-node",
        architecture: "x86",
        specification: "0.125 GB",
        resourceSpecCode: "redis.basic.single.x86.0.125g",
        planList: [{ productId: "redis.basic.single.x86.7.0.0.125g", billingMode: "ONDEMAND", amount: 0.004 }],
      },
      {
        redisVersion: "7.0",
        instanceType: "Single-node",
        architecture: "x86",
        specification: "64 GB",
        resourceSpecCode: "redis.basic.single.x86.64g",
        planList: [{ productId: "redis.basic.single.x86.7.0.64g", billingMode: "ONDEMAND", amount: 1.1 }],
      },
      {
        redisVersion: "7.0",
        instanceType: "Redis Cluster",
        architecture: "x86",
        replicas: 1,
        specification: "4 GB",
        resourceSpecCode: "redis.basic.cluster.x86.1rep.4g",
        planList: [{ productId: "redis.basic.cluster.x86.7.0.1rep.4g", billingMode: "ONDEMAND", amount: 0.16 }],
      },
      {
        redisVersion: "7.0",
        instanceType: "Redis Cluster",
        architecture: "x86",
        replicas: 6,
        specification: "1024 GB",
        resourceSpecCode: "redis.basic.cluster.x86.6rep.1024g",
        planList: [{ productId: "redis.basic.cluster.x86.7.0.6rep.1024g", billingMode: "ONDEMAND", amount: 9.5 }],
      }
    ],
    redis_bandwidth: [
      {
        type: "Elastic Bandwidth",
        resourceSpecCode: "redis.bandwidth.1m",
        bandwidthMbit: 1,
        planList: [{ productId: "redis.bandwidth.1m", billingMode: "ONDEMAND", amount: 0.005 }]
      }
    ]
  }
};

test("DCS parser extracts versions, instance types, architectures, replicas, and specifications", () => {
  const catalog = parseDcsPricingCatalogResponse(fixture, "ap-southeast-1");

  expect(listDcsVersions(catalog)).toEqual(["7.0"]);
  expect(listDcsInstanceTypes(catalog, "7.0")).toEqual(["Single-node", "Master/Standby", "Redis Cluster"]);
  expect(listDcsArchitectures(catalog, { version: "7.0", instanceType: "Redis Cluster" })).toEqual(["x86 | DRAM", "ARM | DRAM"]);
  expect(listDcsReplicas(catalog, { version: "7.0", instanceType: "Master/Standby", architecture: "x86 | DRAM" })).toEqual([2]);
  expect(listDcsReplicas(catalog, { version: "7.0", instanceType: "Redis Cluster", architecture: "x86 | DRAM" })).toEqual([1, 2, 6]);
  expect(listDcsSpecifications(catalog, { version: "7.0", instanceType: "Single-node", architecture: "x86 | DRAM", replicas: null })).toEqual(["0.125 GB", "4 GB", "64 GB"]);
});

test("DCS estimator matches the documented example prices", () => {
  const catalog = parseDcsPricingCatalogResponse(fixture, "ap-southeast-1");

  const singleX86 = estimateDcsConfiguration(catalog, {
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
  });
  const masterStandbyX86 = estimateDcsConfiguration(catalog, {
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
  });
  const clusterX86 = estimateDcsConfiguration(catalog, {
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
  });
  const clusterArm = estimateDcsConfiguration(catalog, {
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
  });
  const singleArmBuyLater = estimateDcsConfiguration(catalog, {
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
  });

  expect(singleX86?.amount).toBeCloseTo(50.84, 2);
  expect(masterStandbyX86?.amount).toBeCloseTo(101.43, 2);
  expect(clusterX86?.amount).toBeCloseTo(135.65, 2);
  expect(clusterArm?.amount).toBeCloseTo(94.73, 2);
  expect(singleArmBuyLater?.amount).toBeCloseTo(34.97, 2);
});
