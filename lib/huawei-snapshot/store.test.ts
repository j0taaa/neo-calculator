import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SnapshotStore } from "./store";
import type { SnapshotRelease, ScopeSnapshot } from "./types";
const scope: ScopeSnapshot = {
  service: "ecs",
  region: "region-1",
  modes: ["ONDEMAND"],
  config: "config",
  products: { product: {}, region: "region-1", urlPath: "ecs" },
  source: {
    page: "",
    config: "",
    products: "",
    framework: "",
    menu: "",
    fetchedAt: "2026-10-08",
  },
  verifiedAt: "2026-10-08",
  checks: 1,
};
test("publication is atomic and a broken candidate preserves the working release", async () => {
  const root = await mkdtemp(join(tmpdir(), "snapshot-store-test-")),
    store = new SnapshotStore(root);
  try {
    const hash = await store.blob(JSON.stringify(scope), ".json");
    const candidate: SnapshotRelease = {
      version: 1,
      id: "",
      createdAt: "2026-10-08",
      directory: { services: [], regions: [], billingModes: {} },
      menu: "{}",
      frameworkUrl: "",
      assets: {},
      scopes: { "ecs/region-1": hash },
      diagnostics: [],
    };
    const id = await store.publish(candidate);
    expect((await store.active()).id).toBe(id);
    await expect(store.publish({ ...candidate, scopes: {} })).rejects.toThrow(
      "empty",
    );
    await expect(
      store.publish({
        ...candidate,
        scopes: { "ecs/region-1": "a".repeat(64) },
      }),
    ).rejects.toThrow();
    expect((await store.active()).id).toBe(id);
    await writeFile(join(root, "blobs", hash + ".json"), "tampered");
    await expect(store.scope(candidate, "ecs", "region-1")).rejects.toThrow(
      "integrity",
    );
    await expect(store.release("../active")).rejects.toThrow("identifier");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("daily verification metadata shares the large catalog and proof blobs", async () => {
  const root = await mkdtemp(join(tmpdir(), "snapshot-dedup-")),
    store = new SnapshotStore(root);
  try {
    const first = await store.writeScope(scope),
      second = await store.writeScope({ ...scope, verifiedAt: "2026-10-09" });
    const a = JSON.parse(await store.read(first, ".json")),
      b = JSON.parse(await store.read(second, ".json"));
    expect(first).not.toBe(second);
    expect(a.productsBlob).toBe(b.productsBlob);
    expect(a.configBlob).toBe(b.configBlob);
    expect(a.products).toBeUndefined();
    expect(
      (
        await store.scope(
          { scopes: { "ecs/region-1": second } } as SnapshotRelease,
          "ecs",
          "region-1",
        )
      ).products,
    ).toEqual(scope.products);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime scope reads skip audit bodies while audit reads still check integrity", async () => {
  const root = await mkdtemp(join(tmpdir(), "snapshot-runtime-")),
    store = new SnapshotStore(root);
  try {
    const hash = await store.writeScope({
      ...scope,
      proof: [],
      customProof: [{ product: {}, months: 1, amount: 0 }],
    });
    const release = { scopes: { "ecs/region-1": hash } } as SnapshotRelease;
    const record = JSON.parse(await store.read(hash, ".json"));
    await unlink(join(root, "blobs", record.proofBlob));
    await unlink(join(root, "blobs", record.customProofBlob));
    expect(
      (await store.scope(release, "ecs", "region-1", false)).products,
    ).toEqual(scope.products);
    expect(
      (await store.scope(release, "ecs", "region-1", false)).proof,
    ).toBeUndefined();
    expect(
      (await store.scope(release, "ecs", "region-1", false)).customProof,
    ).toBeUndefined();
    await expect(store.scope(release, "ecs", "region-1")).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("session headers validate the pinned metadata without reading catalogs, while calculation still requires verified catalogs", async () => {
  const root = await mkdtemp(join(tmpdir(), "snapshot-header-")), store = new SnapshotStore(root);
  try {
    const hash = await store.writeScope(scope);
    const release = { scopes: { "ecs/region-1": hash } } as SnapshotRelease;
    const record = JSON.parse(await store.read(hash, ".json"));
    await unlink(join(root, "blobs", record.productsBlob));
    expect(await store.scopeHeader(release, "ecs", "region-1")).toEqual({ modes: ["ONDEMAND"] });
    await expect(store.scope(release, "ecs", "region-1", false)).rejects.toThrow();
    await expect(store.scopeHeader(release, "ecs", "other-region")).rejects.toThrow("no validated");
    const wrong = await store.writeScope({ ...scope, region: "wrong-region" });
    await expect(store.scopeHeader({ scopes: { "ecs/region-1": wrong } } as SnapshotRelease, "ecs", "region-1"))
      .rejects.toThrow("Invalid synchronized scope");
    await writeFile(join(root, "blobs", hash + ".json"), "tampered");
    await expect(store.scopeHeader(release, "ecs", "region-1")).rejects.toThrow("integrity");
  } finally { await rm(root, { recursive: true, force: true }); }
});
