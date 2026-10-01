import { expect, test } from "bun:test";
import { globalize, DemoSources } from "./sources";
import { HuaweiCollector } from "../../lib/huawei-sync/collector";
import { SyncStore } from "../../lib/huawei-sync/store";
import { runIsolated } from "../../lib/huawei-sync/sandbox";
test("restores classic-script var/function globals, preserves closures, and keeps lexical declarations private", async () => {
  const source = globalize(
    '"use strict"; var scale=3; function transform(value){return value*scale}; let secret=9;',
  );
  const result = await runIsolated(
    "var window={};" + source,
    "function(){return {result:window.transform(4),scale:window.scale,private:typeof window.secret}}",
    {},
  );
  expect(result).toEqual({ result: 12, scale: 3, private: "undefined" });
});
test("rejects destructured global bindings instead of silently discarding variables", () => {
  expect(() => globalize("var {a}=value;")).toThrow(
    "Unsupported global binding",
  );
});
test("fails source collection explicitly and retries instead of retaining a failed shared promise", async () => {
  const store = new SyncStore(":memory:");
  let requests = 0;
  const sources = new DemoSources(
    new HuaweiCollector(store, async () => {
      requests++;
      return { ok: false, status: 503, bodyText: "" };
    }),
  );
  try {
    await expect(sources.getShared()).rejects.toThrow(
      "Huawei source request failed",
    );
    const first = requests;
    await expect(sources.getShared()).rejects.toThrow(
      "Huawei source request failed",
    );
    expect(requests).toBeGreaterThan(first);
  } finally {
    store.close();
  }
});
