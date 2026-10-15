import { expect, test } from "bun:test";
import { sendHttpRequest, sendCurlRequest } from "./huawei-http";

test("curl transport sends large cart JSON and special characters through stdin without shell expansion", async () => {
  const original = process.env.HWC_DISABLE_PROXY;
  process.env.HWC_DISABLE_PROXY = "1";
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
    return Response.json({ body: await request.text(), cookie: request.headers.get("cookie") });
  } });
  try {
    const body = JSON.stringify({ title: "<>&'\" $() `literal`\nUnicode 中文", resources: "x".repeat(500000) });
    const response = await sendCurlRequest({ method: "POST", url: `http://127.0.0.1:${server.port}/cart`, headers: { "Content-Type": "application/json", Cookie: "session=private-test-cookie" }, body });
    expect(response.status).toBe(200);
    expect(JSON.parse(response.bodyText)).toEqual({ body, cookie: "session=private-test-cookie" });
  } finally { server.stop(true); if (original === undefined) delete process.env.HWC_DISABLE_PROXY; else process.env.HWC_DISABLE_PROXY = original; }
});

test("authenticated cart requests do not forward cookies through redirects", async () => {
  const original = process.env.HWC_DISABLE_PROXY; process.env.HWC_DISABLE_PROXY = "1";
  let redirected = false;
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(request) {
    if (new URL(request.url).pathname === "/private") return new Response(null, { status: 302, headers: { Location: "/unexpected" } });
    redirected = true; return new Response("Not expected");
  } });
  try {
    const response = await sendCurlRequest({ method: "GET", url: `http://127.0.0.1:${server.port}/private`, headers: { Cookie: "session=private-test-cookie" } });
    expect(response.status).toBe(302); expect(redirected).toBe(false);
  } finally { server.stop(true); if (original === undefined) delete process.env.HWC_DISABLE_PROXY; else process.env.HWC_DISABLE_PROXY = original; }
});

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
