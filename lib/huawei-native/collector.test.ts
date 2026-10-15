import { expect, test } from "bun:test";
import { HuaweiCollector } from "./collector";
import { SourceStore } from "./store";

test("RI callers can refresh recurring catalog rates while retaining the cached configuration", async () => {
  const store = new SourceStore(":memory:");
  let configs = 0, products = 0;
  const collector = new HuaweiCollector(store, async url => {
    const productRequest = new URL(url).pathname.endsWith("/productInfo");
    const bodyText = productRequest
      ? JSON.stringify({product:{rate:++products},region:"ap-southeast-1",urlPath:"ecs"})
      : `configuration-${++configs}`;
    return {ok:true,status:200,bodyText};
  });
  try {
    const first = await collector.service("ecs","ap-southeast-1");
    const cached = await collector.service("ecs","ap-southeast-1");
    expect(cached.products.hash).toBe(first.products.hash);
    const refreshed = await collector.service("ecs","ap-southeast-1",true);
    expect(refreshed.products.hash).not.toBe(first.products.hash);
    expect(refreshed.config.hash).toBe(first.config.hash);
    expect(products).toBe(2); expect(configs).toBe(1);
  } finally {store.close();}
});

test("independent configuration and regional products start together", async () => {
  const store = new SourceStore(":memory:");
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const collector = new HuaweiCollector(store, async url => {
    const path = new URL(url).pathname.split("/").at(-1)!;
    started.push(path); await gate;
    return { ok: true, status: 200, bodyText: path === "productInfo" ? JSON.stringify({ product: {}, region: "ap-southeast-1", urlPath: "ecs" }) : "config" };
  });
  try {
    const request = collector.service("ecs", "ap-southeast-1");
    expect(started).toEqual(["config", "productInfo"]);
    release(); await request;
  } finally { store.close(); }
});
test("concurrent source fetches share work; a later forced refresh still reaches Huawei", async () => {
  const store = new SourceStore(":memory:");
  let requests = 0;
  const collector = new HuaweiCollector(store, async () => {
    requests++; await new Promise(resolve => setTimeout(resolve, 10));
    return { ok: true, status: 200, bodyText: "valid" };
  });
  try {
    const [first, second] = await Promise.all([collector.fetch("https://example.test/source"), collector.fetch("https://example.test/source")]);
    expect(first.hash).toBe(second.hash); expect(requests).toBe(1);
    await collector.fetch("https://example.test/source", 0); expect(requests).toBe(2);
    await expect(collector.fetch("https://example.test/source", 60000, () => { throw new Error("Invalid cached source"); })).rejects.toThrow("Invalid cached source");
  } finally { store.close(); }
});
test("each daily collector refreshes configuration once across all regions even when the cache is recent", async () => {
  const store = new SourceStore(":memory:");
  let configs = 0;
  const request = async (url: string) => {
    const u = new URL(url);
    return { ok: true, status: 200, bodyText: u.pathname.endsWith("/config") ? `config-${++configs}` : JSON.stringify({ product: {}, region: u.searchParams.get("region"), urlPath: "ecs" }) };
  };
  try {
    await new HuaweiCollector(store, request).service("ecs", "first");
    const daily = new HuaweiCollector(store, request);
    const a = await daily.service("ecs", "first", true, "general.online.portal", true);
    const b = await daily.service("ecs", "second", true, "general.online.portal", true);
    expect(a.config.body).toBe("config-2");
    expect(b.config.hash).toBe(a.config.hash);
    expect(configs).toBe(2);
    await new HuaweiCollector(store, request).service("ecs", "first", true, "general.online.portal", true);
    expect(configs).toBe(3);
  } finally { store.close(); }
});
