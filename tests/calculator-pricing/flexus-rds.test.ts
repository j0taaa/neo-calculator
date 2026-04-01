import { expect, test } from "bun:test";

import { estimateFlexusRdsConfiguration, type FlexusRdsPricingCatalog } from "@/lib/flexus-rds-catalog";

const catalog: FlexusRdsPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  computeTiers: [
    {
      engine: "MySQL",
      instanceType: "Primary/Standby",
      instanceClass: "Lightweight",
      cpu: 2,
      memoryGiB: 4,
      sizeLabel: "2 vCPUs, 4 GB",
      resourceSpecCode: "rds.mysql.y1.large.2.ha",
      prices: { MONTHLY: 58.92, YEARLY: 589.2 },
      productIds: { MONTHLY: "mysql-ha-monthly", YEARLY: "mysql-ha-yearly" },
    },
    {
      engine: "MySQL",
      instanceType: "Single",
      instanceClass: "Lightweight",
      cpu: 4,
      memoryGiB: 8,
      sizeLabel: "4 vCPUs, 8 GB",
      resourceSpecCode: "rds.mysql.y1.xlarge.2",
      prices: { MONTHLY: 53.64, YEARLY: 536.4 },
      productIds: { MONTHLY: "mysql-single-4x8-monthly", YEARLY: "mysql-single-4x8-yearly" },
    },
  ],
  storageTiers: [
    {
      engine: "MySQL",
      instanceType: "Primary/Standby",
      storageType: "Cloud SSD",
      resourceSpecCode: "rds.mysql.volume.cloudssd.ha",
      prices: { MONTHLY: 0.3424, YEARLY: 3.424 },
      productIds: { MONTHLY: "mysql-storage-ha-monthly", YEARLY: "mysql-storage-ha-yearly" },
    },
    {
      engine: "MySQL",
      instanceType: "Single",
      storageType: "Cloud SSD",
      resourceSpecCode: "rds.mysql.volume.cloudssd",
      prices: { MONTHLY: 0.214, YEARLY: 2.14 },
      productIds: { MONTHLY: "mysql-storage-single-monthly", YEARLY: "mysql-storage-single-yearly" },
    },
  ],
};

test("Flexus RDS price examples stay aligned", () => {
  expect(
    estimateFlexusRdsConfiguration(catalog, {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Primary/Standby",
      instanceClass: "Lightweight",
      size: "2 vCPUs, 4 GB",
      storageType: "Cloud SSD",
      storageSizeGb: 120,
      durationMonths: 1,
      quantity: 1,
    })?.amount,
  ).toBe(100.008);

  expect(
    estimateFlexusRdsConfiguration(catalog, {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Single",
      instanceClass: "Lightweight",
      size: "4 vCPUs, 8 GB",
      storageType: "Cloud SSD",
      storageSizeGb: 240,
      durationMonths: 1,
      quantity: 1,
    })?.amount,
  ).toBe(105);

  expect(
    estimateFlexusRdsConfiguration(catalog, {
      engine: "MySQL",
      version: "8.0",
      instanceType: "Primary/Standby",
      instanceClass: "Lightweight",
      size: "2 vCPUs, 4 GB",
      storageType: "Cloud SSD",
      storageSizeGb: 120,
      durationMonths: 12,
      quantity: 1,
    })?.amount,
  ).toBe(1000.08);
});
