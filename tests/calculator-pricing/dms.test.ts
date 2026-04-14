import { expect, test } from "bun:test";

import { estimateDmsConfiguration, type DmsPricingCatalog } from "@/lib/dms-catalog";

const catalog: DmsPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  flavors: [
    {
      flavor: "kafka.2u4g.cluster.small",
      label: "2 vCPUs | 4 GB",
      resourceSpecCode: "dms.kafka.c2.medium.4",
      prices: { ONDEMAND: 0.0472 },
      productIds: { ONDEMAND: "dms.kafka.c2.medium.4" },
    },
    {
      flavor: "kafka.4u8g.cluster",
      label: "4 vCPUs | 8 GB",
      resourceSpecCode: "dms.kafka.c3.large.8",
      prices: { ONDEMAND: 0.0944 },
      productIds: { ONDEMAND: "dms.kafka.c3.large.8" },
    },
  ],
  bandwidths: [
    {
      bandwidth: "100MB/s",
      label: "100MB/s",
      bandwidthMbps: 100,
      resourceSpecCode: "dms.kafka.bandwidth.100mb",
      prices: { ONDEMAND: 0.012 },
      productIds: { ONDEMAND: "dms.kafka.bandwidth.100mb" },
    },
  ],
  storageTypes: [
    {
      storageType: "Ultra-high I/O",
      label: "Ultra-high I/O",
      resourceSpecCode: "dms.kafka.storage.sas",
      prices: { ONDEMAND: 0.0009 },
      productIds: { ONDEMAND: "dms.kafka.storage.sas" },
    },
    {
      storageType: "General Purpose SSD",
      label: "General Purpose SSD",
      resourceSpecCode: "dms.kafka.storage.sata",
      prices: { ONDEMAND: 0.0005 },
      productIds: { ONDEMAND: "dms.kafka.storage.sata" },
    },
  ],
};

test("DMS estimates Pay-per-use with small flavor", () => {
  const result = estimateDmsConfiguration(catalog, {
    flavor: "kafka.2u4g.cluster.small",
    brokers: 3,
    bandwidth: "100MB/s",
    storageType: "Ultra-high I/O",
    storageGb: 100,
    quantity: 1,
    usageHours: 744,
    billingMode: "Pay-per-use",
  });

  expect(result).not.toBeNull();
  expect(result!.currency).toBe("USD");
  expect(result!.suffix).toBe("/744h");
  expect(result!.billingMode).toBe("Pay-per-use");
  expect(result!.brokers).toBe(3);
  expect(result!.breakdown.length).toBeGreaterThanOrEqual(1);

  const flavorItem = result!.breakdown.find((b) => b.label.includes("kafka.2u4g.cluster.small"));
  expect(flavorItem).toBeDefined();
  expect(flavorItem!.amount).toBeCloseTo(35.12, 2);
});

test("DMS estimates Pay-per-use with large flavor", () => {
  const result = estimateDmsConfiguration(catalog, {
    flavor: "kafka.4u8g.cluster",
    brokers: 3,
    bandwidth: "100MB/s",
    storageType: "General Purpose SSD",
    storageGb: 200,
    quantity: 1,
    usageHours: 744,
    billingMode: "Pay-per-use",
  });

  expect(result).not.toBeNull();
  expect(result!.breakdown.length).toBeGreaterThanOrEqual(1);

  const flavorItem = result!.breakdown.find((b) => b.label.includes("kafka.4u8g.cluster"));
  expect(flavorItem).toBeDefined();
  expect(flavorItem!.amount).toBeCloseTo(70.23, 2);
});

test("DMS returns null for unknown flavor when no other tiers match", () => {
  const catalogEmpty: DmsPricingCatalog = {
    currency: "USD",
    regionId: "ap-southeast-1",
    flavors: [],
    bandwidths: [],
    storageTypes: [],
  };

  const result = estimateDmsConfiguration(catalogEmpty, {
    flavor: "unknown.flavor",
    brokers: 3,
    bandwidth: "100MB/s",
    storageType: "Ultra-high I/O",
    storageGb: 100,
    quantity: 1,
    usageHours: 744,
    billingMode: "Pay-per-use",
  });

  expect(result).toBeNull();
});
