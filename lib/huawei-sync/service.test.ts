import { expect, test } from "bun:test";
import { ENGINE_VERSION } from "./program";
import { currentRelease, parseFormInput } from "./service";
import { SyncStore } from "./store";
import type { ServiceRelease } from "./types";

test("current quotes reject obsolete, expired, retired and incompatible releases", () => {
  const store = new SyncStore(":memory:");
  const service = { id: "nat", name: "NAT", category: "Networking", available: true };
  const now = new Date().toISOString();
  const evidence = store.snapshot("test-evidence", "[]");
  const release: ServiceRelease = { id: "original", service, region: "ap-southeast-1", configHash: evidence.hash, productsHash: evidence.hash, frameworkHash: evidence.hash, menuHash: evidence.hash, engineVersion: ENGINE_VERSION, createdAt: now, status: "candidate", diagnostics: [], verification: null };
  try {
    store.directory([service]); store.save(release);
    store.promote(release.id, { source: "official-browser", checkedAt: now, cases: 1, evidenceHash: evidence.hash });
    expect(currentRelease(service.id, release.region, release.id, store).id).toBe(release.id);
    expect(() => currentRelease(service.id, release.region, "stale", store)).toThrow("updated");
    store.save({ ...store.active(service.id, release.region)!, engineVersion: "incompatible" });
    expect(() => currentRelease(service.id, release.region, undefined, store)).toThrow("not passed");
    store.save({ ...store.active(service.id, release.region)!, engineVersion: ENGINE_VERSION, verification: { source: "official-browser", checkedAt: "2000-01-01T00:00:00Z", cases: 1, evidenceHash: evidence.hash } });
    expect(() => currentRelease(service.id, release.region, undefined, store)).toThrow("expired");
    store.save({ ...release, id: "changed", status: "quarantined", diagnostics: ["Unknown control"] });
    expect(() => currentRelease(service.id, release.region, undefined, store)).toThrow("awaiting verification");
    store.directory([{ ...service, available: false }]);
    expect(() => currentRelease(service.id, release.region, undefined, store)).toThrow("not currently offered");
  } finally { store.close(); }
});

test("external form input rejects invalid scopes, complex values and nonfinite usage", () => {
  for (const input of [null, { region: "../nat", values: {} }, { region: "ap-southeast-1", values: { key: {} } }, { region: "ap-southeast-1", values: {}, duration: Infinity }]) expect(() => parseFormInput(input)).toThrow();
  expect(parseFormInput({ region: "ap-southeast-1", values: { option: "small" }, duration: 2 }).duration).toBe(2);
});
