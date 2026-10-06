import { expect, test } from "bun:test";
import { NativeStaticCache } from "./native-static-cache";
const url = "https://portal.hc-cdn.com/CBC-PortalCalculator/11.4.201/vueRelated-3716367d.js";
const headers = { "content-type": "application/javascript", "cache-control": "max-age=86400" };
test("versioned public assets retain bytes while prices and unversioned resources are never cached", () => {
  const cache = new NativeStaticCache();
  cache.put(url, "script", 200, headers, Buffer.from("public script"));
  expect(cache.get(url, "script")?.body.toString()).toBe("public script");
  for (const unsafe of ["https://portal-intl.huaweicloud.com/api/productInfo", "https://portal.hc-cdn.com/authui/login.js",
    url + "?private=1", url.replace("https:", "http:"), url.replace("portal.hc-cdn.com", "attacker.test")]) {
    cache.put(unsafe, "script", 200, headers, Buffer.from("unsafe"));
    expect(cache.get(unsafe, "script")).toBeUndefined();
  }
  expect(cache.get(url, "xhr")).toBeUndefined();
});
test("expiry respects shorter upstream lifetimes and caps versioned assets at fifteen minutes", () => {
  let now = 0; const cache = new NativeStaticCache(undefined, () => now);
  cache.put(url, "script", 200, headers, Buffer.from("versioned"));
  now = 900000; expect(cache.get(url, "script")).toBeUndefined();
  cache.put(url, "script", 200, { ...headers, "cache-control": "max-age=1" }, Buffer.from("short"));
  now += 1000; cache.sweep(); expect(cache.get(url, "script")).toBeUndefined();
});
test("private, invalid, cookie and varying responses cannot enter the shared cache", () => {
  const cache = new NativeStaticCache();
  for (const override of [{ "cache-control": "private, max-age=60" }, { "cache-control": "no-store" },
    { "cache-control": "no-cache" }, { "cache-control": "max-age=0" }, { "set-cookie": "session=private" },
    { vary: "Cookie" }, { "content-type": "text/html" }]) {
    cache.put(url, "script", 200, { ...headers, ...override }, Buffer.from("invalid"));
    expect(cache.get(url, "script")).toBeUndefined();
  }
  cache.put(url, "script", 502, headers, Buffer.from("error"));
  expect(cache.get(url, "script")).toBeUndefined();
});
test("the cache evicts least recently used assets, preserves decompressed bytes and clears", () => {
  const cache = new NativeStaticCache(6);
  const second = url.replace("vueRelated", "second"), third = url.replace("vueRelated", "third");
  cache.put(url, "script", 200, { ...headers, "content-encoding": "gzip", "content-length": "99" }, Buffer.from("123"));
  cache.put(second, "script", 200, headers, Buffer.from("456"));
  expect(cache.get(url, "script")?.headers["content-encoding"]).toBeUndefined();
  expect(cache.get(url, "script")?.headers["content-length"]).toBeUndefined();
  cache.put(third, "script", 200, headers, Buffer.from("789"));
  expect(cache.get(second, "script")).toBeUndefined();
  expect(cache.get(url, "script")?.body.toString()).toBe("123");
  cache.clear(); expect(cache.get(url, "script")).toBeUndefined();
});
