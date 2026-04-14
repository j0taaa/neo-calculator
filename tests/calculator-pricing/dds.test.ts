import { expect, test } from "bun:test";

import { estimateDdsConfiguration, type DdsPricingCatalog } from "@/lib/dds-catalog";

const catalog: DdsPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  tiers: [
    {
      dbType: "Replica set",
      specification: "2 vCPUs | 4 GB",
      vCpus: 2,
      memoryGb: 4,
      resourceSpecCode: "dds.mongodb.c6.large.2.repset",
      prices: { ONDEMAND: 0.15, MONTHLY: 100 },
      productIds: { ONDEMAND: "dds-replica-on-1", MONTHLY: "dds-replica-mo-1" },
    },
    {
      dbType: "Replica set",
      specification: "4 vCPUs | 8 GB",
      vCpus: 4,
      memoryGb: 8,
      resourceSpecCode: "dds.mongodb.c6.xlarge.2.repset",
      prices: { ONDEMAND: 0.25, MONTHLY: 175 },
      productIds: { ONDEMAND: "dds-replica-on-2", MONTHLY: "dds-replica-mo-2" },
    },
    {
      dbType: "Cluster",
      specification: "4 vCPUs | 16 GB",
      vCpus: 4,
      memoryGb: 16,
      resourceSpecCode: "dds.mongodb.c6.xlarge.4.cluster",
      prices: { ONDEMAND: 0.50, MONTHLY: 350 },
      productIds: { ONDEMAND: "dds-cluster-on-1", MONTHLY: "dds-cluster-mo-1" },
    },
  ],
};

test("DDS Pay-per-use estimate for different dbType and spec combos", () => {
  expect(
    estimateDdsConfiguration(catalog, {
      dbType: "Replica set",
      specification: "2 vCPUs | 4 GB",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(111.6, 2);

  expect(
    estimateDdsConfiguration(catalog, {
      dbType: "Replica set",
      specification: "4 vCPUs | 8 GB",
      quantity: 2,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(372.0, 2);

  expect(
    estimateDdsConfiguration(catalog, {
      dbType: "Cluster",
      specification: "4 vCPUs | 16 GB",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(372.0, 2);
});

test("DDS Yearly/Monthly estimate", () => {
  expect(
    estimateDdsConfiguration(catalog, {
      dbType: "Replica set",
      specification: "2 vCPUs | 4 GB",
      quantity: 1,
      usageHours: 0,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(100, 2);

  expect(
    estimateDdsConfiguration(catalog, {
      dbType: "Replica set",
      specification: "4 vCPUs | 8 GB",
      quantity: 2,
      usageHours: 0,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(350, 2);
});

test("DDS returns null for unknown spec", () => {
  expect(
    estimateDdsConfiguration(catalog, {
      dbType: "Replica set",
      specification: "999 vCPUs | 999 GB",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    }),
  ).toBeNull();

  expect(
    estimateDdsConfiguration(catalog, {
      dbType: "Shard",
      specification: "2 vCPUs | 4 GB",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    }),
  ).toBeNull();
});
