import { expect, test } from "bun:test";
import { sendHttpRequest } from "./huawei-http";

test("offline source policy also blocks calculator CDN requests", async () => {
  const access = process.env.HUAWEI_SOURCE_ACCESS;
  const root = process.env.HUAWEI_SNAPSHOT_DIR;
  try {
    process.env.HUAWEI_SOURCE_ACCESS = "offline";
    process.env.HUAWEI_SNAPSHOT_DIR = "/tmp/neo-nonexistent-http-test-snapshot";
    await expect(sendHttpRequest({ method: "GET", url: "https://portal.hc-cdn.com/CBC-PortalCalculator/framework.js" }))
      .rejects.toThrow("snapshot is not available");
  } finally {
    if (access === undefined) delete process.env.HUAWEI_SOURCE_ACCESS;
    else process.env.HUAWEI_SOURCE_ACCESS = access;
    if (root === undefined) delete process.env.HUAWEI_SNAPSHOT_DIR;
    else process.env.HUAWEI_SNAPSHOT_DIR = root;
  }
});
