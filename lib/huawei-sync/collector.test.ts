import { expect, test } from "bun:test";
import { HuaweiCollector } from "./collector";
import { SyncStore } from "./store";

test("RI callers can refresh recurring catalog rates while retaining the cached configuration", async () => {
  const store = new SyncStore(":memory:");
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
