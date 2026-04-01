import { expect, test } from "bun:test";

import { estimateRdsConfiguration, type RdsPricingCatalog } from "@/lib/rds-catalog";

const apCatalog: RdsPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  computeTiers: [
    {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Primary/Standby",
      subAz: "General AZ",
      instanceClass: "General-purpose",
      cpu: 2,
      memoryGiB: 4,
      sizeLabel: "2 vCPUs, 4 GB",
      resourceSpecCode: "rds.mysql.n1.large.2.ha",
      prices: { ONDEMAND: 0.16 },
      productIds: { ONDEMAND: "mysql-gp-ha-2-4" },
    },
    {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Primary/Standby",
      subAz: "General AZ",
      instanceClass: "General-purpose",
      cpu: 2,
      memoryGiB: 8,
      sizeLabel: "2 vCPUs, 8 GB",
      resourceSpecCode: "rds.mysql.n1.large.4.ha",
      prices: { ONDEMAND: 0.2 },
      productIds: { ONDEMAND: "mysql-gp-ha-2-8" },
    },
    {
      engine: "PostgreSQL",
      version: "17",
      instanceType: "Primary/Standby",
      subAz: "General AZ",
      instanceClass: "General-purpose",
      cpu: 2,
      memoryGiB: 4,
      sizeLabel: "2 vCPUs, 4 GB",
      resourceSpecCode: "rds.pg.n1.large.2.ha",
      prices: { ONDEMAND: 0.16 },
      productIds: { ONDEMAND: "pg-gp-ha-2-4" },
    },
    {
      engine: "PostgreSQL",
      version: "17",
      instanceType: "Read replica",
      subAz: "General AZ",
      instanceClass: "General-purpose",
      cpu: 2,
      memoryGiB: 8,
      sizeLabel: "2 vCPUs, 8 GB",
      resourceSpecCode: "rds.pg.n1.large.4.rr",
      prices: { ONDEMAND: 0.1 },
      productIds: { ONDEMAND: "pg-gp-rr-2-8" },
    },
    {
      engine: "PostgreSQL",
      version: "17",
      instanceType: "Read replica",
      subAz: "General AZ",
      instanceClass: "Dedicated",
      cpu: 2,
      memoryGiB: 8,
      sizeLabel: "2 vCPUs, 8 GB",
      resourceSpecCode: "rds.pg.x1.large.4.rr",
      prices: { ONDEMAND: 0.15 },
      productIds: { ONDEMAND: "pg-ded-rr-2-8" },
    },
    {
      engine: "PostgreSQL",
      version: "17",
      instanceType: "Primary/Standby",
      subAz: "General AZ",
      instanceClass: "Dedicated",
      cpu: 4,
      memoryGiB: 8,
      sizeLabel: "4 vCPUs, 8 GB",
      resourceSpecCode: "rds.pg.x1.xlarge.2.ha",
      prices: { ONDEMAND: 0.48 },
      productIds: { ONDEMAND: "pg-ded-ha-4-8" },
    },
  ],
  storageTiers: [
    {
      engine: "MySQL",
      instanceType: "Primary/Standby",
      storageType: "Flexible SSD",
      resourceSpecCode: "rds.mysql.volume.gpssd2.ha",
      prices: { ONDEMAND: 0.000274 },
      productIds: { ONDEMAND: "mysql-flex-ha" },
      iopsPricePerUnitHour: 0.000017,
      throughputPricePerUnitHour: 0.000137,
    },
    {
      engine: "PostgreSQL",
      instanceType: "Primary/Standby",
      storageType: "Cloud SSD",
      resourceSpecCode: "rds.pg.volume.cloudssd.ha",
      prices: { ONDEMAND: 0.0008 },
      productIds: { ONDEMAND: "pg-cloud-ha" },
    },
    {
      engine: "PostgreSQL",
      instanceType: "Read replica",
      storageType: "Cloud SSD",
      resourceSpecCode: "rds.pg.volume.cloudssd.rr",
      prices: { ONDEMAND: 0.0004 },
      productIds: { ONDEMAND: "pg-cloud-rr" },
    },
  ],
};

const brazilCatalog: RdsPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  computeTiers: [
    {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Primary/Standby",
      subAz: "General AZ",
      instanceClass: "General-purpose",
      cpu: 2,
      memoryGiB: 8,
      sizeLabel: "2 vCPUs, 8 GB",
      resourceSpecCode: "rds.mysql.n1.large.4.ha",
      prices: { ONDEMAND: 0.3 },
      productIds: { ONDEMAND: "br-mysql-gp-ha-2-8" },
    },
  ],
  storageTiers: [
    {
      engine: "MySQL",
      instanceType: "Primary/Standby",
      storageType: "Flexible SSD",
      resourceSpecCode: "rds.mysql.volume.gpssd2.ha",
      prices: { ONDEMAND: 0.000396 },
      productIds: { ONDEMAND: "br-mysql-flex-ha" },
      iopsPricePerUnitHour: 0.00002466,
      throughputPricePerUnitHour: 0.00019726,
    },
  ],
};

test("RDS documented price anchors stay aligned", () => {
  expect(
    estimateRdsConfiguration(apCatalog, {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Primary/Standby",
      instanceClass: "General-purpose",
      size: "2 vCPUs, 4 GB",
      storageType: "Flexible SSD",
      storageSizeGb: 40,
      iops: 3000,
      throughputMibps: 128,
      usageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(127.19, 2);

  expect(
    estimateRdsConfiguration(apCatalog, {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Primary/Standby",
      instanceClass: "General-purpose",
      size: "2 vCPUs, 8 GB",
      storageType: "Flexible SSD",
      storageSizeGb: 40,
      iops: 3000,
      throughputMibps: 125,
      usageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(156.95, 2);

  expect(
    estimateRdsConfiguration(apCatalog, {
      engine: "PostgreSQL",
      version: "17",
      instanceType: "Primary/Standby",
      instanceClass: "General-purpose",
      size: "2 vCPUs, 4 GB",
      storageType: "Cloud SSD",
      storageSizeGb: 40,
      iops: 3000,
      throughputMibps: 128,
      usageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(142.85, 2);

  expect(
    estimateRdsConfiguration(apCatalog, {
      engine: "PostgreSQL",
      version: "17",
      instanceType: "Read replica",
      instanceClass: "General-purpose",
      size: "2 vCPUs, 8 GB",
      storageType: "Cloud SSD",
      storageSizeGb: 40,
      iops: 3000,
      throughputMibps: 128,
      usageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(86.3, 2);

  expect(
    estimateRdsConfiguration(apCatalog, {
      engine: "PostgreSQL",
      version: "17",
      instanceType: "Read replica",
      instanceClass: "Dedicated",
      size: "2 vCPUs, 8 GB",
      storageType: "Cloud SSD",
      storageSizeGb: 40,
      iops: 3000,
      throughputMibps: 128,
      usageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(123.5, 2);

  expect(
    estimateRdsConfiguration(apCatalog, {
      engine: "PostgreSQL",
      version: "17",
      instanceType: "Primary/Standby",
      instanceClass: "Dedicated",
      size: "4 vCPUs, 8 GB",
      storageType: "Cloud SSD",
      storageSizeGb: 40,
      iops: 3000,
      throughputMibps: 128,
      usageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(380.93, 2);

  expect(
    estimateRdsConfiguration(brazilCatalog, {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Primary/Standby",
      instanceClass: "General-purpose",
      size: "2 vCPUs, 8 GB",
      storageType: "Flexible SSD",
      storageSizeGb: 40,
      iops: 3000,
      throughputMibps: 125,
      usageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(234.98, 2);
});
