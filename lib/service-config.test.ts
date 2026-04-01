import { expect, test } from "bun:test";

import {
  configurableServiceCodes,
  findServiceCatalogEntry,
  getConfigurablePricingDefinitionByCode,
  getConfigurableServiceDefinitionByCode,
  getConfiguredBillingOptions,
  serviceCatalog,
  supportedBatchAddServiceCodes,
  supportedCalculatorServiceCodes,
} from "@/lib/service-config";

test("service registry exposes the legacy service catalog and supported service lists", () => {
  expect(serviceCatalog.length).toBeGreaterThan(50);
  expect(findServiceCatalogEntry("EVS")?.name).toBe("Elastic Volume Service");
  expect(findServiceCatalogEntry("OBS")?.name).toBe("Object Storage Service");
  expect(supportedCalculatorServiceCodes).toContain("EVS");
  expect(supportedBatchAddServiceCodes).toContain("EVS");
});

test("EVS pilot definition loads from typed TS config with declarative conditional fields", () => {
  expect(configurableServiceCodes).toContain("EVS");

  const definition = getConfigurableServiceDefinitionByCode("EVS");
  expect(definition).not.toBeNull();
  expect(definition?.implementation).toBe("config-pilot");
  expect(definition?.billingOptions).toEqual(["Pay-per-use", "Yearly/Monthly"]);

  const usageHoursField = definition?.fields.find((field) => field.id === "usageHours");
  const durationMonthsField = definition?.fields.find((field) => field.id === "durationMonths");
  const iopsField = definition?.fields.find((field) => field.id === "iops");

  expect(usageHoursField?.visibleWhen).toEqual({ field: "billingMode", equals: "Pay-per-use" });
  expect(durationMonthsField?.visibleWhen).toEqual({ field: "billingMode", equals: "Yearly/Monthly" });
  expect(iopsField?.visibleWhenAll).toEqual([
    { field: "billingMode", equals: "Pay-per-use" },
    { field: "diskType", equals: "General Purpose SSD V2" },
  ]);
});

test("EVS pilot pricing definition links metrics to normalized catalog rate sources", () => {
  const pricing = getConfigurablePricingDefinitionByCode("EVS");
  expect(pricing).not.toBeNull();
  expect(pricing?.catalogAdapter).toBe("evs");
  expect(Object.keys(pricing?.rateSources ?? {})).toEqual(["diskBase", "gpSsd2Iops", "gpSsd2Throughput"]);
  expect(pricing?.metrics.map((metric) => metric.id)).toEqual(["diskStorage", "gpSsd2Iops", "gpSsd2Throughput"]);
  expect(getConfiguredBillingOptions("EVS")).toEqual(["Pay-per-use", "Yearly/Monthly"]);
});

test("additional configurable service definitions load from typed TS config", () => {
  expect(configurableServiceCodes).toEqual(expect.arrayContaining(["OBS", "EIP", "ELB", "NAT", "VPN", "CCE", "CCI", "ModelArts", "Workspace", "DCS", "DC", "CBH", "VPCEP", "FunctionGraph", "RDS", "Flexus RDS", "ER", "APIG"]));

  expect(getConfigurableServiceDefinitionByCode("OBS")?.implementation).toBe("configurable");
  expect(getConfigurableServiceDefinitionByCode("ELB")?.implementation).toBe("configurable");
  expect(getConfigurableServiceDefinitionByCode("ELB")?.fields.map((field) => field.id)).toEqual(expect.arrayContaining(["type", "fixedAvailabilityAzCount", "tcpEnabled"]));
  expect(getConfigurablePricingDefinitionByCode("ELB")?.catalogAdapter).toBe("elb");
  expect(getConfigurableServiceDefinitionByCode("NAT")?.fields.map((field) => field.id)).toEqual(["natType", "natSize"]);
  expect(getConfigurableServiceDefinitionByCode("CCI")?.fields.find((field) => field.id === "cpu")?.min).toBe(1);
  expect(getConfigurableServiceDefinitionByCode("EIP")?.fields.find((field) => field.id === "trafficAmount")?.inputMode).toBe("decimal");
  expect(getConfigurablePricingDefinitionByCode("VPN")?.catalogAdapter).toBe("vpn");
  expect(getConfigurableServiceDefinitionByCode("ModelArts")?.fields.map((field) => field.id)).toEqual([
    "serviceType",
    "resourceType",
    "specification",
    "quantity",
    "storageQuotaGb",
    "usageHours",
    "durationMonths",
  ]);
  expect(getConfigurablePricingDefinitionByCode("ModelArts")?.catalogAdapter).toBe("modelarts");
  expect(getConfigurableServiceDefinitionByCode("Workspace")?.fields.map((field) => field.id)).toEqual([
    "architecture",
    "specification",
    "cpu",
    "memory",
    "cpuUsageHours",
    "diskType",
    "diskSizeGb",
    "diskUsageHours",
    "quantity",
  ]);
  expect(getConfigurablePricingDefinitionByCode("Workspace")?.catalogAdapter).toBe("workspace");
  expect(getConfigurableServiceDefinitionByCode("DCS")?.fields.map((field) => field.id)).toEqual([
    "edition",
    "version",
    "instanceType",
    "architecture",
    "replicas",
    "specification",
    "quantity",
    "elasticBandwidth",
    "bandwidthMbit",
    "usageHours",
  ]);
  expect(getConfigurablePricingDefinitionByCode("DCS")?.catalogAdapter).toBe("dcs");
  expect(getConfigurableServiceDefinitionByCode("DC")?.fields.map((field) => field.id)).toEqual([
    "portSpeed",
    "durationMonths",
    "quantity",
  ]);
  expect(getConfigurablePricingDefinitionByCode("DC")?.catalogAdapter).toBe("direct-connect");
  expect(getConfigurableServiceDefinitionByCode("CBH")?.fields.map((field) => field.id)).toEqual([
    "instanceType",
    "edition",
    "durationMonths",
    "quantity",
  ]);
  expect(getConfigurablePricingDefinitionByCode("CBH")?.catalogAdapter).toBe("cbh");
  expect(getConfigurableServiceDefinitionByCode("VPCEP")?.fields.map((field) => field.id)).toEqual([
    "serviceCategory",
    "usageHours",
    "trafficGb",
    "quantity",
  ]);
  expect(getConfigurablePricingDefinitionByCode("VPCEP")?.catalogAdapter).toBe("vpcep");
  expect(getConfigurableServiceDefinitionByCode("ER")?.fields.map((field) => field.id)).toEqual([
    "attachmentQuantity",
    "usageHours",
    "trafficGb",
    "quantity",
  ]);
  expect(getConfigurablePricingDefinitionByCode("ER")?.catalogAdapter).toBe("er");
  expect(getConfigurableServiceDefinitionByCode("FunctionGraph")?.fields.map((field) => field.id)).toEqual([
    "averageRequestsAmount",
    "averageRequestsUnit",
    "executionDurationMs",
    "memoryAmount",
    "memoryUnit",
  ]);
  expect(getConfigurablePricingDefinitionByCode("FunctionGraph")?.catalogAdapter).toBe("functiongraph");
  expect(getConfigurableServiceDefinitionByCode("RDS")?.fields.map((field) => field.id)).toEqual([
    "engine",
    "version",
    "instanceType",
    "subAz",
    "instanceClass",
    "size",
    "storageType",
    "storageSizeGb",
    "iops",
    "throughputMibps",
    "usageHours",
    "quantity",
  ]);
  expect(getConfigurablePricingDefinitionByCode("RDS")?.catalogAdapter).toBe("rds");
  expect(getConfigurableServiceDefinitionByCode("Flexus RDS")?.fields.map((field) => field.id)).toEqual([
    "engine",
    "version",
    "instanceType",
    "instanceClass",
    "size",
    "storageType",
    "storageSizeGb",
    "durationMonths",
    "quantity",
  ]);
  expect(getConfigurablePricingDefinitionByCode("Flexus RDS")?.catalogAdapter).toBe("flexus-rds");
  expect(getConfigurableServiceDefinitionByCode("APIG")?.fields.map((field) => field.id)).toEqual([
    "edition",
    "publicOutboundAccess",
    "bandwidthMbit",
    "usageHours",
    "quantity",
  ]);
  expect(getConfigurablePricingDefinitionByCode("APIG")?.catalogAdapter).toBe("apig");
});
