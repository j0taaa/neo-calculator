import { expect, test } from "bun:test";

import {
  estimateRdsConfiguration,
  listRdsInstanceClasses,
  listRdsInstanceTypes,
  listRdsSizes,
  listRdsStorageTypes,
  listRdsVersions,
} from "@/lib/rds-catalog";
import { parseRdsPricingCatalogResponse } from "@/lib/rds-pricing";

const fixture = {
  product: {
    "rds_rds.vm": [
      {
        engineType: "MySQL",
        dbVersion: "dataInfo_57_",
        instanceClass: "General-purpose",
        cpu: "2Core",
        mem: "4096MB",
        resourceSpecCode: "rds.mysql.n1.large.2.ha",
        productSpecSysDesc: "DB Engine:MySQL;DB Engine Version:5.6|5.7|8.0;DB Instance Type:Primary/Standby;Storage Type:Cloud SSD;Instance Class:General-purpose;vCPU:2Core;Memory:4096MB",
        planList: [{ billingMode: "ONDEMAND", amount: 0.16, productId: "mysql-gp-ha-2-4" }],
      },
      {
        engineType: "MySQL",
        dbVersion: "dataInfo_57_",
        instanceClass: "General-purpose",
        cpu: "2Core",
        mem: "8192MB",
        resourceSpecCode: "rds.mysql.n1.large.4.ha",
        productSpecSysDesc: "DB Engine:MySQL;DB Engine Version:5.6|5.7|8.0;DB Instance Type:Primary/Standby;Storage Type:Flexible SSD;Instance Class:General-purpose;vCPU:2Core;Memory:8192MB",
        planList: [{ billingMode: "ONDEMAND", amount: 0.2, productId: "mysql-gp-ha-2-8" }],
      },
      {
        engineType: "PostgreSQL",
        dbVersion: "dataInfo_78_",
        instanceClass: "General-purpose",
        cpu: "2Core",
        mem: "4096MB",
        resourceSpecCode: "rds.pg.n1.large.2.ha",
        productSpecSysDesc: "DB Engine:PostgreSQL;DB Engine Version:9.5|9.6|10|11|12;DB Instance Type:Primary/Standby;Storage Type:Cloud SSD;Instance Class:General-purpose;vCPU:2Core;Memory:4096MB",
        planList: [{ billingMode: "ONDEMAND", amount: 0.16, productId: "pg-gp-ha-2-4" }],
      },
      {
        engineType: "PostgreSQL",
        dbVersion: "dataInfo_78_",
        instanceClass: "General-purpose",
        cpu: "2Core",
        mem: "8192MB",
        resourceSpecCode: "rds.pg.n1.large.4.rr",
        productSpecSysDesc: "DB Engine:PostgreSQL;DB Engine Version:9.5|9.6|10|11|12;DB Instance Type:Read replica;Storage Type:Cloud SSD;Instance Class:General-purpose;vCPU:2Core;Memory:8192MB",
        planList: [{ billingMode: "ONDEMAND", amount: 0.1, productId: "pg-gp-rr-2-8" }],
      },
      {
        engineType: "PostgreSQL",
        dbVersion: "dataInfo_78_",
        instanceClass: "Delicated",
        cpu: "2Core",
        mem: "8192MB",
        resourceSpecCode: "rds.pg.x1.large.4.rr",
        productSpecSysDesc: "DB Engine:PostgreSQL;DB Engine Version:9.5|9.6|10|11|12;DB Instance Type:Read replica;Storage Type:Cloud SSD;Instance Class:Delicated;vCPU:2Core;Memory:8192MB",
        planList: [{ billingMode: "ONDEMAND", amount: 0.15, productId: "pg-ded-rr-2-8" }],
      },
      {
        engineType: "PostgreSQL",
        dbVersion: "dataInfo_78_",
        instanceClass: "Delicated",
        cpu: "4Core",
        mem: "8192MB",
        resourceSpecCode: "rds.pg.x1.xlarge.2.ha",
        productSpecSysDesc: "DB Engine:PostgreSQL;DB Engine Version:9.5|9.6|10|11|12;DB Instance Type:Primary/Standby;Storage Type:Cloud SSD;Instance Class:Delicated;vCPU:4Core;Memory:8192MB",
        planList: [{ billingMode: "ONDEMAND", amount: 0.48, productId: "pg-ded-ha-4-8" }],
      },
    ],
    "rds_rds.volume": [
      {
        engineType: "MySQL",
        resourceSpecCode: "rds.mysql.volume.gpssd2.ha",
        productSpecSysDesc: "Volume Type:Flexible SSD;DB Engine:MySQL;DB Instance Type:Primary/Standby",
        planList: [{ billingMode: "ONDEMAND", amount: 0.000274, productId: "mysql-flex-ha" }],
      },
      {
        engineType: "MySQL",
        resourceSpecCode: "rds.mysql.volume.gpssd2.throughput.ha",
        productSpecSysDesc: "Volume Type:Flexible SSD throughput;DB Engine:MySQL;DB Instance Type:Primary/Standby",
        planList: [{ billingMode: "ONDEMAND", amount: 0.000137, productId: "mysql-flex-ha-throughput" }],
      },
      {
        engineType: "MySQL",
        resourceSpecCode: "rds.mysql.volume.gpssd2.iops.ha",
        productSpecSysDesc: "Volume Type:Flexible SSD IOPS;DB Engine:MySQL;DB Instance Type:Primary/Standby",
        planList: [{ billingMode: "ONDEMAND", amount: 0.000017, productId: "mysql-flex-ha-iops" }],
      },
      {
        engineType: "PostgreSQL",
        resourceSpecCode: "rds.pg.volume.cloudssd.ha",
        productSpecSysDesc: "Volume Type:Cloud SSD;DB Engine:PostgreSQL;DB Instance Type:Primary/Standby",
        planList: [{ billingMode: "ONDEMAND", amount: 0.0008, productId: "pg-cloud-ha" }],
      },
      {
        engineType: "PostgreSQL",
        resourceSpecCode: "rds.pg.volume.cloudssd.rr",
        productSpecSysDesc: "Volume Type:Cloud SSD;DB Engine:PostgreSQL;DB Instance Type:Read replica",
        planList: [{ billingMode: "ONDEMAND", amount: 0.0004, productId: "pg-cloud-rr" }],
      },
    ],
  },
};

test("RDS parser extracts supported engines, versions, instance types, classes, sizes, and storage types", () => {
  const catalog = parseRdsPricingCatalogResponse(fixture, "ap-southeast-1");

  expect(listRdsVersions(catalog, "MySQL")).toEqual(["8.0"]);
  expect(listRdsVersions(catalog, "PostgreSQL")).toEqual(["17"]);
  expect(listRdsInstanceTypes(catalog, { engine: "PostgreSQL", version: "17" })).toEqual(["Primary/Standby", "Read replica"]);
  expect(listRdsInstanceClasses(catalog, { engine: "PostgreSQL", version: "17", instanceType: "Read replica" })).toEqual(["General-purpose", "Dedicated"]);
  expect(listRdsSizes(catalog, { engine: "PostgreSQL", version: "17", instanceType: "Read replica", instanceClass: "General-purpose" })).toEqual(["2 vCPUs, 8 GB"]);
  expect(listRdsStorageTypes(catalog, { engine: "MySQL", instanceType: "Primary/Standby" })).toEqual(["Flexible SSD"]);
});

test("RDS estimator matches the documented example prices", () => {
  const catalog = parseRdsPricingCatalogResponse(fixture, "ap-southeast-1");

  const mysqlGpHa = estimateRdsConfiguration(catalog, {
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
  });
  const mysqlGpHa8g = estimateRdsConfiguration(catalog, {
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
  });
  const pgGpHa = estimateRdsConfiguration(catalog, {
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
  });
  const pgGpRr = estimateRdsConfiguration(catalog, {
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
  });
  const pgDedRr = estimateRdsConfiguration(catalog, {
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
  });
  const pgDedHa = estimateRdsConfiguration(catalog, {
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
  });

  expect(mysqlGpHa?.amount).toBeCloseTo(205.22, 2);
  expect(mysqlGpHa8g?.amount).toBeCloseTo(469.97, 2);
  expect(pgGpHa?.amount).toBeCloseTo(217.84, 2);
  expect(pgGpRr?.amount).toBeCloseTo(123.80, 2);
  expect(pgDedRr?.amount).toBeCloseTo(175.88, 2);
  expect(pgDedHa?.amount).toBeCloseTo(530.32, 2);
});

test("RDS estimator uses the direct Brazil Flexible SSD rates for MySQL general-purpose HA", () => {
  const brazilFixture = {
    product: {
      "rds_rds.vm": [
        {
          engineType: "MySQL",
          dbVersion: "dataInfo_57_",
          instanceClass: "General-purpose",
          cpu: "2Core",
          mem: "8192MB",
          resourceSpecCode: "rds.mysql.n1.large.4.ha",
          productSpecSysDesc: "DB Engine:MySQL;DB Engine Version:5.6|5.7|8.0;DB Instance Type:Primary/Standby;Storage Type:Flexible SSD;Instance Class:General-purpose;vCPU:2Core;Memory:8192MB",
          planList: [{ billingMode: "ONDEMAND", amount: 0.3, productId: "br-mysql-gp-ha-2-8" }],
        },
      ],
      "rds_rds.volume": [
        {
          engineType: "MySQL",
          resourceSpecCode: "rds.mysql.volume.gpssd2.ha",
          productSpecSysDesc: "Volume Type:Flexible SSD;DB Engine:MySQL;DB Instance Type:Primary/Standby",
          planList: [{ billingMode: "ONDEMAND", amount: 0.000396, productId: "br-mysql-flex-ha" }],
        },
        {
          engineType: "MySQL",
          resourceSpecCode: "rds.mysql.volume.gpssd2.throughput.ha",
          productSpecSysDesc: "Volume Type:Flexible SSD throughput;DB Engine:MySQL;DB Instance Type:Primary/Standby",
          planList: [{ billingMode: "ONDEMAND", amount: 0.00019726, productId: "br-mysql-flex-ha-throughput" }],
        },
        {
          engineType: "MySQL",
          resourceSpecCode: "rds.mysql.volume.gpssd2.iops.ha",
          productSpecSysDesc: "Volume Type:Flexible SSD IOPS;DB Engine:MySQL;DB Instance Type:Primary/Standby",
          planList: [{ billingMode: "ONDEMAND", amount: 0.00002466, productId: "br-mysql-flex-ha-iops" }],
        },
      ],
    },
  };
  const catalog = parseRdsPricingCatalogResponse(brazilFixture, "sa-brazil-1");
  const estimate = estimateRdsConfiguration(catalog, {
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
  });

  expect(estimate?.amount).toBeCloseTo(234.98, 2);
  expect(estimate?.computeAmount).toBeCloseTo(223.2, 2);
  expect(estimate?.storageAmount).toBeCloseTo(11.78, 2);
  expect(estimate?.memorySurchargeAmount).toBe(0);
  expect(estimate?.throughputAmount).toBe(0);
  expect(estimate?.iopsAmount).toBe(0);
});
