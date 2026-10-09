import { expect, test } from "bun:test";
import type { NativeDirectory } from "../huawei-native/native-types";
import { apiService, calculatorApi, snapshotProductSchema } from "./api";

const directory: NativeDirectory = {
  services: [{ id: "redis", name: "DCS", category: "Database", available: true },
    { id: "rabbitMQ", name: "RabbitMQ", category: "Middleware", available: true }],
  regions: [{ id: "region-a", name: "A" }, { id: "region-b", name: "B" }],
  billingModes: { redis: { "region-a": ["PERIOD"] } },
};
test("API service aliases resolve to published canonical identities without accepting unknown services", () => {
  for (const code of ["DCS", "dcs", " HUAWEI:redis ", "hwc:redis"])
    expect(apiService(directory, code)?.id).toBe("redis");
  expect(apiService(directory, "DMS RabbitMQ")?.id).toBe("rabbitMQ");
  expect(apiService(directory, "rabbitmq")?.id).toBe("rabbitMQ");
  for (const code of ["unpublished", "constructor", "toString", "__proto__"])
    expect(apiService(directory, code)).toBeUndefined();
});
test("discovery describes local configuration and authenticated price reconstruction, with regional availability", () => {
  const metadata = calculatorApi(directory, "redis");
  expect(metadata).not.toHaveProperty("sessionUrl");
  expect(metadata.calculationMethod).toBe("POST");
  expect(metadata.calculationUrl).toBe("/api/v1/calculate");
  expect(metadata.catalogUrl).toBe("/api/v1/public/catalog/HUAWEI%3Aredis");
  expect(metadata.regions).toEqual([directory.regions[0]]);
  const config = snapshotProductSchema("HUAWEI:redis").properties.config;
  expect(config.required).toEqual(["region", "billingMode", "selection", "local"]);
  expect(config.properties.local.required).toEqual(["release", "pricing", "inquiries"]);
});
