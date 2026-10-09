import { expect, test } from "bun:test";
import { frameHtml } from "./frame-html";
import type { ScopeSnapshot, SnapshotRelease } from "./types";

const framework = "https://official.example/1/framework.js";
const shared = "https://official.example/1/shared.js";
const child = "https://official.example/1/child.js";
const asset = (hash: string, urls: string[] = []) => ({
  hash,
  type: "application/javascript",
  imports: urls.map(url => ({ url, start: 0, end: 0 })),
});
const release: SnapshotRelease = {
  version: 1, id: "release", createdAt: "today", bridgeHash: "bridge",
  directory: { services: [], regions: [], billingModes: {} },
  menu: "{}", frameworkUrl: framework, scopes: {}, diagnostics: [],
  assets: {
    [framework]: asset("framework", [shared, child]),
    [shared]: asset("shared"),
    [child]: asset("child", [shared, framework]),
    "https://official.example/1/style.css": { hash: "css", type: "text/css", imports: [] },
    "neo:bridge": asset("bridge"),
    "https://official.example/unused.js": asset("unused"),
  },
};
const scope = {
  service: "ecs", region: "region", modes: ["ONDEMAND", "PERIOD", "RI", "ONETIME"],
  config: "rules", products: { product: {}, region: "region", urlPath: "ecs" },
  source: { fetchedAt: "today" }, proof: [], customProof: [],
} as unknown as ScopeSnapshot;

test("startup preloads the complete pinned module graph once, including shared and cyclic imports", () => {
  const html = frameHtml(release, scope, "ONDEMAND", "https://neo.example", "token");
  const preloads = [...html.matchAll(/<link rel="modulepreload" crossorigin="anonymous" href="([^"]+)">/g)].map(match => match[1]);
  expect(preloads).toEqual(["framework", "shared", "child"].map(hash => `https://neo.example/api/calculator/snapshot/release/asset/${hash}`));
  expect(html).not.toContain("asset/unused");
  expect(html.indexOf('rel="modulepreload"')).toBeLessThan(html.indexOf("window.__neoSnapshot="));
  expect(html).toContain('<link rel="preload" as="script" href="https://neo.example/api/calculator/snapshot/release/asset/bridge">');
  expect(html.indexOf('<script src="')).toBeLessThan(html.indexOf('<script type="module"'));
});

test("preloading preserves the configuration payload and script order in every billing mode", () => {
  for (const mode of scope.modes) {
    const html = frameHtml(release, scope, mode, "https://neo.example", "token", "zone");
    const payload = JSON.parse(html.match(/window\.__neoSnapshot=(.*?); Object\.assign/)![1]);
    expect(payload).toEqual({
      release: release.id, snapshot: { ...scope, proof: undefined, customProof: undefined },
      menu: "{}", billingMode: mode, token: "token", locationCode: "zone",
    });
    expect(html).toContain('<script type="module" src="https://neo.example/api/calculator/snapshot/release/asset/framework">');
  }
  expect(() => frameHtml(release, { ...scope, modes: [] }, "ONDEMAND", "https://neo.example", "token")).toThrow("Billing mode");
});

test("missing pinned dependencies fail closed and old snapshots retain the bridge fallback", () => {
  const assets = { ...release.assets };
  delete assets[shared];
  expect(() => frameHtml({ ...release, assets }, scope, "ONDEMAND", "https://neo.example", "token")).toThrow("Missing synchronized dependency");
  const html = frameHtml({ ...release, bridgeHash: undefined }, scope, "ONDEMAND", "https://neo.example", "token");
  expect(html).toContain('<script src="https://neo.example/api/calculator/snapshot/bridge">');
});
