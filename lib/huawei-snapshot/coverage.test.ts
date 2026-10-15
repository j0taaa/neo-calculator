import { test, expect } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SnapshotStore } from "./store";
import { CoverageAudit, discoveryScopes } from "./coverage";
import type { SnapshotRelease, ScopeSnapshot } from "./types";
const scope: ScopeSnapshot = {
  service: "one",
  region: "partner",
  tag: "general.online.portal",
  modes: ["ONDEMAND"],
  config: "config",
  products: { product: {}, urlPath: "one", region: "partner" },
  source: {
    page: "page",
    config: "config",
    products: "products",
    framework: "framework",
    menu: "menu",
    fetchedAt: new Date().toISOString(),
  },
  verifiedAt: new Date().toISOString(),
  checks: 4,
};
function release(): SnapshotRelease {
  return {
    version: 1,
    id: "",
    createdAt: new Date().toISOString(),
    directory: {
      services: [
        { id: "one", name: "One", available: true, category: "category" },
        { id: "beta", name: "Beta", available: true, category: "category" },
      ],
      regions: [
        { id: "partner", name: "Partner" },
        { id: "second", name: "Second" },
      ],
      billingModes: {
        one: { partner: ["ONDEMAND"], second: ["PERIOD"] },
        beta: { partner: ["ONDEMAND"] },
      },
    },
    menu: "menu",
    frameworkUrl: "framework",
    bridgeHash: "bridge",
    auditHash: "audit",
    assets: {
      framework: { hash: "framework", type: "application/javascript" },
    },
    scopes: {},
    diagnostics: [],
  };
}
test("discovery includes every advertised region/mode, interleaves services and never invents unsupported pairs", () => {
  expect(discoveryScopes(release())).toEqual([
    { service: "one", region: "partner" },
    { service: "beta", region: "partner" },
    { service: "one", region: "second" },
  ]);
  expect(discoveryScopes(release(), ["one"], ["second"])).toEqual([
    { service: "one", region: "second" },
  ]);
});
test("interrupted audit resumes valid current-source scopes without changing active publication", async () => {
  const root = await mkdtemp(join(tmpdir(), "coverage-")),
    store = new SnapshotStore(root);
  try {
    const hash = await store.writeScope(scope),
      r = release(),
      audit = await CoverageAudit.create(store, r, 3);
    await Promise.all([
      audit.checked("one", "partner", hash),
      audit.checked("beta", "partner", undefined, "unsupported"),
    ]);
    const progress = JSON.parse(
      await readFile(join(root, "audit-progress.json"), "utf8"),
    );
    expect(progress.completed).toBe(2);
    expect(progress.errors).toHaveLength(1);
    await expect(store.active()).rejects.toThrow();
    const resumed = await CoverageAudit.create(store, r, 3);
    expect((await resumed.resume(scope))?.checks).toBe(4);
    expect(
      await resumed.resume({
        ...scope,
        source: { ...scope.source, products: "new prices" },
      }),
    ).toBeNull();
    expect(
      await resumed.resume({ ...scope, tag: "general.online.beta" }),
    ).toBeNull();
    const changedStyles = await CoverageAudit.create(store, {
      ...r,
      assets: { ...r.assets, style: { hash: "new styles", type: "text/css" } },
    }, 3);
    expect(await changedStyles.resume(scope)).toBeNull();
    const changedAudit = await CoverageAudit.create(
      store,
      { ...r, auditHash: "new validator" },
      3,
    );
    expect(await changedAudit.resume(scope)).toBeNull();
    const changed = await CoverageAudit.create(
      store,
      { ...r, bridgeHash: "changed" },
      3,
    );
    expect(await changed.resume(scope)).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("expired verification evidence is not resumed", async () => {
  const root = await mkdtemp(join(tmpdir(), "coverage-old-")),
    store = new SnapshotStore(root);
  try {
    const expired = { ...scope, verifiedAt: "2020-01-01" },
      hash = await store.writeScope(expired),
      r = release(),
      audit = await CoverageAudit.create(store, r, 1);
    await audit.checked("one", "partner", hash);
    await audit.finish("failed");
    expect(
      await (await CoverageAudit.create(store, r, 1)).resume(expired),
    ).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("full synchronization refuses a missing advertised scope even when a previous partial catalog exists", async () => {
  const { assertFullCoverage } = await import("./coverage");
  const r = release(),
    scopes = discoveryScopes(r);
  r.scopes = { "one/partner": "validated" };
  expect(() => assertFullCoverage(r, scopes)).toThrow("1/3");
  r.scopes = Object.fromEntries(
    scopes.map((s) => [`${s.service}/${s.region}`, "validated"]),
  );
  expect(() => assertFullCoverage(r, scopes)).not.toThrow();
  r.diagnostics = [
    { service: "one", region: "partner", error: "validation failed" },
  ];
  expect(() => assertFullCoverage(r, scopes)).toThrow("incomplete");
});
