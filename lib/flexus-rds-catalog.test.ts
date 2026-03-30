import { expect, test } from "bun:test";

import {
  estimateFlexusRdsConfiguration,
  listFlexusRdsEngines,
  listFlexusRdsInstanceTypes,
  listFlexusRdsSizes,
  listFlexusRdsVersions,
  type FlexusRdsPricingCatalog,
} from "@/lib/flexus-rds-catalog";
import { parseFlexusRdsPricingCatalogResponse } from "@/lib/flexus-rds-pricing";

const payload = {
  product: {
    "rds_rds.vm": [
      {
        resourceSpecCode: "rds.mysql.y1.large.2.ha",
        productSpecSysDesc: "DB Engine:MySQL;DB Engine Version:5.6|5.7|8.0;DB Instance Type:Primary/Standby;Storage Type:Cloud SSD;Instance Class:HRDS;vCPU:2CORE;Memory:4096MB",
        engineType: "MySQL",
        instanceClass: "HRDS",
        cpu: "2CORE",
        mem: "4096MB",
        planList: [
          { productId: "mysql-ha-monthly", billingMode: "MONTHLY", amount: 58.92 },
          { productId: "mysql-ha-yearly", billingMode: "YEARLY", amount: 589.2 },
        ],
      },
      {
        resourceSpecCode: "rds.mysql.y1.large.4",
        productSpecSysDesc: "DB Engine:MySQL;DB Engine Version:5.6|5.7|8.0;DB Instance Type:Single;Storage Type:Cloud SSD;Instance Class:HRDS;vCPU:2CORE;Memory:8192MB",
        engineType: "MySQL",
        instanceClass: "HRDS",
        cpu: "2CORE",
        mem: "8192MB",
        planList: [
          { productId: "mysql-single-2x8-monthly", billingMode: "MONTHLY", amount: 37.23 },
          { productId: "mysql-single-2x8-yearly", billingMode: "YEARLY", amount: 326.4 },
        ],
      },
      {
        resourceSpecCode: "rds.mysql.y1.xlarge.2",
        productSpecSysDesc: "DB Engine:MySQL;DB Engine Version:5.6|5.7|8.0;DB Instance Type:Single;Storage Type:Cloud SSD;Instance Class:HRDS;vCPU:4CORE;Memory:8192MB",
        engineType: "MySQL",
        instanceClass: "HRDS",
        cpu: "4CORE",
        mem: "8192MB",
        planList: [
          { productId: "mysql-single-4x8-monthly", billingMode: "MONTHLY", amount: 53.64 },
          { productId: "mysql-single-4x8-yearly", billingMode: "YEARLY", amount: 536.4 },
        ],
      },
      {
        resourceSpecCode: "rds.pg.y1.large.2.ha",
        productSpecSysDesc: "DB Engine:PostgreSQL;DB Engine Version:9.5|9.6|10|11|12;DB Instance Type:Primary/Standby;Storage Type:Cloud SSD;Instance Class:HRDS;vCPU:2CORE;Memory:4096MB",
        engineType: "PostgreSQL",
        instanceClass: "HRDS",
        cpu: "2CORE",
        mem: "4096MB",
        planList: [
          { productId: "pg-ha-monthly", billingMode: "MONTHLY", amount: 54.75 },
          { productId: "pg-ha-yearly", billingMode: "YEARLY", amount: 480 },
        ],
      },
      {
        resourceSpecCode: "rds.pg.y1.xlarge.2",
        productSpecSysDesc: "DB Engine:PostgreSQL;DB Engine Version:9.5|9.6|10|11|12;DB Instance Type:Single;Storage Type:Cloud SSD;Instance Class:HRDS;vCPU:4CORE;Memory:8192MB",
        engineType: "PostgreSQL",
        instanceClass: "HRDS",
        cpu: "4CORE",
        mem: "8192MB",
        planList: [
          { productId: "pg-single-monthly", billingMode: "MONTHLY", amount: 49.15 },
          { productId: "pg-single-yearly", billingMode: "YEARLY", amount: 491.5 },
        ],
      },
    ],
    "rds_rds.volume": [
      {
        resourceSpecCode: "rds.mysql.volume.cloudssd.ha",
        productSpecSysDesc: "Volume Type:Cloud SSD;DB Engine:MySQL;DB Instance Type:Primary/Standby",
        volumeType: "Cloud SSD",
        engineType: "MySQL",
        instanceType: "dataInfo_14_",
        planList: [
          { productId: "mysql-storage-ha-monthly", billingMode: "MONTHLY", amount: 0.3424 },
          { productId: "mysql-storage-ha-yearly", billingMode: "YEARLY", amount: 3.424 },
        ],
      },
      {
        resourceSpecCode: "rds.mysql.volume.cloudssd",
        productSpecSysDesc: "Volume Type:Cloud SSD;DB Engine:MySQL;DB Instance Type:Single",
        volumeType: "Cloud SSD",
        engineType: "MySQL",
        instanceType: "dataInfo_16_",
        planList: [
          { productId: "mysql-storage-single-monthly", billingMode: "MONTHLY", amount: 0.214 },
          { productId: "mysql-storage-single-yearly", billingMode: "YEARLY", amount: 2.14 },
        ],
      },
      {
        resourceSpecCode: "rds.pg.volume.cloudssd.ha",
        productSpecSysDesc: "Volume Type:Cloud SSD;DB Engine:PostgreSQL;DB Instance Type:Primary/Standby",
        volumeType: "Cloud SSD",
        engineType: "PostgreSQL",
        instanceType: "dataInfo_14_",
        planList: [
          { productId: "pg-storage-ha-monthly", billingMode: "MONTHLY", amount: 0.3424 },
          { productId: "pg-storage-ha-yearly", billingMode: "YEARLY", amount: 3.424 },
        ],
      },
      {
        resourceSpecCode: "rds.pg.volume.cloudssd",
        productSpecSysDesc: "Volume Type:Cloud SSD;DB Engine:PostgreSQL;DB Instance Type:Single",
        volumeType: "Cloud SSD",
        engineType: "PostgreSQL",
        instanceType: "dataInfo_16_",
        planList: [
          { productId: "pg-storage-single-monthly", billingMode: "MONTHLY", amount: 0.214 },
          { productId: "pg-storage-single-yearly", billingMode: "YEARLY", amount: 2.14 },
        ],
      },
    ],
  },
} as const;

test("Flexus RDS parser extracts the lightweight catalog subset", () => {
  const catalog = parseFlexusRdsPricingCatalogResponse(payload, "ap-southeast-1");

  expect(listFlexusRdsEngines(catalog)).toEqual(["MySQL", "PostgreSQL"]);
  expect(listFlexusRdsVersions("MySQL")).toEqual(["8.0", "5.7"]);
  expect(listFlexusRdsVersions("PostgreSQL")).toEqual(["12", "11", "10", "9.6", "9.5"]);
  expect(listFlexusRdsInstanceTypes(catalog, "MySQL")).toEqual(["Primary/Standby", "Single"]);
  expect(listFlexusRdsSizes(catalog, { engine: "MySQL", instanceType: "Primary/Standby" })).toEqual(["2 vCPUs, 4 GB"]);
  expect(listFlexusRdsSizes(catalog, { engine: "MySQL", instanceType: "Single" })).toEqual(["2 vCPUs, 8 GB", "4 vCPUs, 8 GB"]);
});

test("Flexus RDS estimator uses the direct monthly hrds rates", () => {
  const catalog = parseFlexusRdsPricingCatalogResponse(payload, "ap-southeast-1");

  const haEstimate = estimateFlexusRdsConfiguration(catalog, {
    engine: "MySQL",
    version: "8.0",
    instanceType: "Primary/Standby",
    instanceClass: "Lightweight",
    size: "2 vCPUs, 4 GB",
    storageType: "Cloud SSD",
    storageSizeGb: 120,
    durationMonths: 1,
    quantity: 1,
  });
  expect(haEstimate?.amount).toBe(100.008);
  expect(haEstimate?.suffix).toBe("/mo");

  const singleEstimate = estimateFlexusRdsConfiguration(catalog, {
    engine: "MySQL",
    version: "8.0",
    instanceType: "Single",
    instanceClass: "Lightweight",
    size: "4 vCPUs, 8 GB",
    storageType: "Cloud SSD",
    storageSizeGb: 240,
    durationMonths: 1,
    quantity: 1,
  });
  expect(singleEstimate?.amount).toBe(105);
  expect(singleEstimate?.suffix).toBe("/mo");
});

test("Flexus RDS estimator uses the direct yearly hrds rates for 1-year selections", () => {
  const catalog = parseFlexusRdsPricingCatalogResponse(payload, "ap-southeast-1") as FlexusRdsPricingCatalog;

  const estimate = estimateFlexusRdsConfiguration(catalog, {
    engine: "MySQL",
    version: "8.0",
    instanceType: "Primary/Standby",
    instanceClass: "Lightweight",
    size: "2 vCPUs, 4 GB",
    storageType: "Cloud SSD",
    storageSizeGb: 120,
    durationMonths: 12,
    quantity: 1,
  });

  expect(estimate?.amount).toBe(1000.08);
  expect(estimate?.suffix).toBe("/1yr");
  expect(estimate?.monthlyAverageAmount).toBe(83.34);
});
