import type { NativeBillingMode } from "../huawei-native/native-billing";
import type { SnapshotRelease, ScopeSnapshot } from "./types";
import { frameData } from "./frame-data";

export function assetPath(release: SnapshotRelease, original: string) {
  const asset = release.assets[original];
  if (!asset) throw new Error(`Missing synchronized dependency: ${original}`);
  return `/api/calculator/snapshot/${release.id}/asset/${asset.hash}`;
}
export function rewriteImports(
  body: string,
  original: string,
  release: SnapshotRelease,
) {
  const imports = release.assets[original]?.imports;
  if (!imports)
    throw new Error(
      "The snapshot dependency manifest is incomplete. Synchronize the catalog again.",
    );
  for (const dependency of [...imports].sort((a, b) => b.start - a.start))
    body =
      body.slice(0, dependency.start) +
      assetPath(release, dependency.url) +
      body.slice(dependency.end);
  return body;
}

/** Fetch the pinned module graph together; execution still follows its original imports. */
function modulePreloads(release: SnapshotRelease, origin: string) {
  const visited = new Set<string>();
  const links: string[] = [];
  function visit(original: string) {
    if (visited.has(original)) return;
    visited.add(original);
    const asset = release.assets[original];
    const path = assetPath(release, original);
    if (asset.type !== "application/javascript") return;
    links.push(`<link rel="modulepreload" crossorigin="anonymous" href="${origin + path}">`);
    for (const dependency of asset.imports ?? []) visit(dependency.url);
  }
  visit(release.frameworkUrl);
  return links.join("");
}
export function frameHtml(
  release: SnapshotRelease,
  snapshot: ScopeSnapshot | Pick<ScopeSnapshot, "modes">,
  billingMode: NativeBillingMode,
  origin: string,
  token: string,
  locationCode?: string,
  dataPath?: string,
) {
  if (!snapshot.modes.includes(billingMode))
    throw new Error("Billing mode is not present in this snapshot");
  if (!dataPath && !("config" in snapshot))
    throw new Error("Inline delivery requires the complete scope data");
  const payload = JSON.stringify({
    release: release.id,
    ...(dataPath || !("config" in snapshot) ? {} : frameData(release, snapshot)),
    billingMode,
    token,
    ...(locationCode ? { locationCode } : {}),
  }).replace(/</g, "\\u003c");
  const framework = origin + assetPath(release, release.frameworkUrl);
  const version = new URL(release.frameworkUrl).pathname.split("/").at(-2);
  const css =
    origin +
    assetPath(release, new URL("style.css", release.frameworkUrl).href);
  const bridge = origin + (release.bridgeHash ? assetPath(release, "neo:bridge") : "/api/calculator/snapshot/bridge");
  const data = dataPath ? origin + dataPath : undefined;
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}">${data ? `<link rel="preload" as="script" href="${data}">` : ""}${modulePreloads(release, origin)}<link rel="preload" as="script" href="${bridge}"></head><body><div id="app"></div>
${data ? `<script src="${data}"></script>` : ""}
<script>window.__neoSnapshot=${data ? `Object.assign({},window.__neoSnapshotData,${payload})` : payload}; Object.assign(window,{version:${JSON.stringify(version)},timeOutTime:30000,calcStation:'zh-HK',calcLanguage:'en-us',calcSymbol:'$',calcUnit:'USD',baseUrl:'/'});</script>
<script src="${bridge}"></script>
<script type="module" src="${framework}"></script></body></html>`;
}
