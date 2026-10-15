import type { ScopeSnapshot, SnapshotRelease } from "./types";

/** Session-independent data is immutable only within this exact published release. */
export function frameData(release: SnapshotRelease, snapshot: ScopeSnapshot) {
  return {
    snapshot: { ...snapshot, proof: undefined, customProof: undefined },
    menu: release.menu.replace(
      /https:\/\/[^"\s]+\.(?:svg|png)(?:\?[^"\s]*)?/g,
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
    ),
  };
}

export function frameDataScript(release: SnapshotRelease, snapshot: ScopeSnapshot) {
  return `window.__neoSnapshotData=${JSON.stringify(frameData(release, snapshot)).replace(/</g, "\\u003c")};`;
}

export function frameDataPath(release: SnapshotRelease, service: string, region: string) {
  const hash = release.scopes[`${service}/${region}`];
  if (!hash) throw new Error("Missing synchronized scope data");
  return `/api/calculator/snapshot/${release.id}/data/${hash}`;
}
