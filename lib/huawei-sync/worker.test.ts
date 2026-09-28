import { expect, test } from "bun:test";
import { HuaweiCollector, parseDirectory } from "./collector";
import { SyncStore } from "./store";
import { syncCalculator } from "./worker";

test("discovered service publishes without a hand-edited registry; a bad update preserves the active version", async () => {
  const store = new SyncStore(":memory:");
  let source = await Bun.file("tests/fixtures/huawei-sync/nat.js.txt").text();
  const products = await Bun.file("tests/fixtures/huawei-sync/nat-products.json").text();
  const collector = new HuaweiCollector(store, async url => ({ ok: true, status: 200, bodyText:
    url.includes("menuInfo") ? JSON.stringify({ menuInfos: [{ parentCategoryName: "Networking", subCategoryLists: [{ urlPath: "nat", categoryName: "NAT", hasCalculator: true }] }], regionRules: { "ap-southeast-1": "ALL", "ally-region": "ALL" }, regionsOfSite: { HWC: ["ap-southeast-1"] } }) :
    url.endsWith("calculator.html") ? '<script src="https://portal.hc-cdn.com/CBC-PortalCalculator/test/framework.js"></script>' :
    url.endsWith("framework.js") ? "framework" : url.includes("productInfo") ? products : source
  }));
  let checks = 0;
  const verify = async () => { checks++; const evidence = store.snapshot("test-evidence", "independent-result"); return { source: "official-browser" as const, checkedAt: new Date().toISOString(), cases: 16, evidenceHash: evidence.hash }; };
  try {
    expect(await syncCalculator(store, verify, {}, collector)).toEqual({ skipped: false, published: 1, quarantined: 0 });
    const active = store.active("nat", "ap-southeast-1")!.id;
    expect(store.directory()[0].id).toBe("nat");
    source = source.replace('type: "CommonSelect"', 'type: "UnrecognizedControl"');
    store.db.exec("UPDATE fetches SET fetched_at='1970-01-01T00:00:00Z'");
    expect((await syncCalculator(store, verify, {}, collector)).quarantined).toBe(1);
    expect(store.active("nat", "ap-southeast-1")!.id).toBe(active);
    expect(checks).toBe(1);
  } finally { store.close(); }
});

test("invalid directories are rejected and removal needs two complete fresh scans", () => {
  for (const body of ['{}', '{"menuInfos":[]}', '{"menuInfos":[{}]}', '{"menuInfos":[{"subCategoryLists":[{"categoryName":"Bad"}]}]}']) expect(() => parseDirectory(body)).toThrow();
  const store = new SyncStore(":memory:");
  try {
    store.directory([{ id: "nat", name: "NAT", category: "Networking", available: true }]);
    store.directory([]); expect(store.directory()[0].available).toBe(true);
    store.directory([]); expect(store.directory()[0].available).toBe(false);
  } finally { store.close(); }
});
