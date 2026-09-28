import { expect, test } from "bun:test";
import { SyncStore, canonical } from "./store";
import type { ServiceRelease } from "./types";

test("source versions are immutable, publishing requires evidence, and rollback restores the previous release", () => {
  const store = new SyncStore(":memory:");
  try {
    const first = store.snapshot("config", "first");
    store.snapshot("config", "second");
    expect(store.body(first.hash)).toBe("first");
    const evidence = store.snapshot("evidence", "[]");
    const verification = { source: "official-browser" as const, checkedAt: new Date().toISOString(), cases: 16, evidenceHash: evidence.hash };
    const release: ServiceRelease = { id: "a", service: { id: "nat", name: "NAT", category: "Networking", available: true }, region: "ap-southeast-1", configHash: first.hash, productsHash: first.hash, menuHash: first.hash, frameworkHash: first.hash, engineVersion: "1", createdAt: verification.checkedAt, status: "candidate", diagnostics: [], verification: null };
    store.save(release);
    expect(() => store.promote("a", { ...verification, cases: 0 })).toThrow();
    store.promote("a", verification);
    store.save({ ...release, id: "b" }); store.promote("b", verification);
    store.save({ ...release, id: "b" }); store.promote("b", verification);
    store.rollback("nat", release.region, "Post-release mismatch");
    expect(store.active("nat", release.region)?.id).toBe("a");
    expect(store.release("b")?.status).toBe("quarantined");
  } finally { store.close(); }
});

test("leases exclude concurrent runs and only their owner can release them", () => {
  const store = new SyncStore(":memory:");
  try {
    const owner = store.acquireLease("job", 100, 0)!;
    expect(store.acquireLease("job", 100, 50)).toBeNull();
    store.releaseLease("job", "wrong");
    expect(store.acquireLease("job", 100, 50)).toBeNull();
    expect(store.acquireLease("job", 100, 101)).not.toBeNull();
    store.releaseLease("job", owner);
    expect(store.acquireLease("job", 100, 102)).toBeNull();
  } finally { store.close(); }
});

test("canonical request hashes ignore object key ordering but preserve quantities and product order", () => {
  expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }));
  expect(canonical({ quantity: 1 })).not.toBe(canonical({ quantity: 2 }));
});
