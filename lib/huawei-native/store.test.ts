import { expect, test } from "bun:test";
import { SourceStore, canonical } from "./store";

test("source bodies remain immutable while the latest fetch advances", () => {
  const store = new SourceStore(":memory:");
  try {
    const first = store.snapshot("config", "first", "2026-10-05T00:00:00Z");
    const second = store.snapshot("config", "second", "2026-10-06T00:00:00Z");
    expect(store.body(first.hash)).toBe("first");
    expect(store.latest("config")).toEqual(second);
    expect(store.latest("missing")).toBeNull();
    expect(() => store.body("missing")).toThrow("Missing source snapshot");
    expect(store.db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all())
      .toEqual([{ name: "fetches" }, { name: "snapshots" }]);
  } finally { store.close(); }
});

test("canonical request hashes ignore object key ordering but preserve quantities and product order", () => {
  expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }));
  expect(canonical({ quantity: 1 })).not.toBe(canonical({ quantity: 2 }));
});
