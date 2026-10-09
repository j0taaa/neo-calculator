import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { frameData, frameDataPath, frameDataScript } from "./frame-data";
import type { ScopeSnapshot, SnapshotRelease } from "./types";

const release = {
  id: "release-a", menu: '{"global":{"unsafe":"</script><script>throw 1</script>"}}',
  scopes: { "ecs/region": "scope-a" },
} as unknown as SnapshotRelease;
const scope = {
  service: "ecs", region: "region", config: "conditional rules", products: { amount: 0.14968 },
  proof: [{ secret: "audit only" }], customProof: [{ amount: 1 }],
} as unknown as ScopeSnapshot;

test("cached data preserves catalog values, excludes audit evidence and escapes script endings", () => {
  const script = frameDataScript(release, scope);
  const window: { __neoSnapshotData?: unknown } = {};
  runInNewContext(script, { window });
  expect(window.__neoSnapshotData).toEqual(JSON.parse(JSON.stringify(frameData(release, scope))));
  expect(script).not.toContain("</script>");
  expect(script).not.toContain("audit only");
  expect(script).not.toContain("customProof");
  expect(scope.proof).toHaveLength(1);
});

test("cache identity pins both release and scope, including a new release reusing unchanged data", () => {
  expect(frameDataPath(release, "ecs", "region")).toBe("/api/calculator/snapshot/release-a/data/scope-a");
  expect(frameDataPath({ ...release, id: "release-b" }, "ecs", "region"))
    .toBe("/api/calculator/snapshot/release-b/data/scope-a");
  expect(frameDataPath({ ...release, scopes: { "ecs/region": "scope-b" } }, "ecs", "region"))
    .toBe("/api/calculator/snapshot/release-a/data/scope-b");
  expect(() => frameDataPath(release, "ecs", "other")).toThrow("Missing synchronized scope data");
});
