import { expect, test } from "bun:test";
import { calculatorServices, huaweiServiceId, nativeRegion, legacyRegion, availableMode } from "./service-directory";
import type { NativeDirectory } from "@/lib/huawei-native/native-types";
const directory: NativeDirectory = {
  services: [{ id: "redis", name: "DCS (for Redis)", category: "Databases", available: true },
    { id: "new-service", name: "CodeArts", category: "New", available: true }],
  regions: [{ id: "new-region-1", name: "New region" }],
  billingModes: { redis: { "new-region-1": ["PERIOD"] } },
};
test("aliases preserve saved service identity and automatically expose new services with unambiguous names", () => {
  const services = calculatorServices([{ code: "DCS", name: "Distributed Cache Service", icon: "/globe.svg" },
    { code: "CodeArts", name: "CodeArts", icon: "/globe.svg" }], directory);
  expect(services[0].huaweiId).toBe("redis");
  expect(services[2]).toMatchObject({ code: "HUAWEI:new-service", huaweiId: "new-service", name: "CodeArts · new-service" });
  expect(huaweiServiceId("HWC:nat")).toBe("nat");
  expect(huaweiServiceId("HUAWEI:new-service")).toBe("new-service");
  expect(huaweiServiceId("Flexus L")).toBe("hcss");
});
test("regional identities round-trip without substituting another region", () => {
  expect(nativeRegion("cn-hong-kong")).toBe("ap-southeast-1");
  expect(legacyRegion("ap-southeast-1")).toBe("cn-hong-kong");
  expect(nativeRegion("new-region-1")).toBe("new-region-1");
  expect(legacyRegion("new-region-1")).toBeUndefined();
  expect(availableMode(directory, { service: "redis", region: "new-region-1", billingMode: "ONDEMAND" })).toBe("PERIOD");
  expect(availableMode(directory, { service: "redis", region: "unsupported", billingMode: "RI" })).toBe("RI");
});
