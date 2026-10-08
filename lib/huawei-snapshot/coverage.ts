import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { SnapshotRelease, ScopeSnapshot } from "./types";
import type { SnapshotStore } from "./store";
import { frameworkAssetsHash } from "./framework";

/** Enumerate every advertised offer, sampling each service before proceeding to its next region. */
export function discoveryScopes(
  release: SnapshotRelease,
  services?: string[],
  regions?: string[],
) {
  const groups = release.directory.services
    .filter((s) => !services || services.includes(s.id))
    .map((service) =>
      release.directory.regions
        .filter(
          (region) =>
            (!regions || regions.includes(region.id)) &&
            release.directory.billingModes[service.id]?.[region.id]?.length,
        )
        .map((region) => ({ service: service.id, region: region.id })),
    );
  return Array.from(
    { length: Math.max(0, ...groups.map((group) => group.length)) },
    (_, index) =>
      groups.flatMap((group) => (group[index] ? [group[index]] : [])),
  ).flat();
}
export function assertFullCoverage(
  release: SnapshotRelease,
  scopes: { service: string; region: string }[],
) {
  const missing = scopes.filter(
    ({ service, region }) => !release.scopes[`${service}/${region}`],
  );
  if (missing.length || release.diagnostics.length)
    throw new Error(
      `Full synchronization is incomplete (${scopes.length - missing.length}/${scopes.length} scopes validated). No partial catalog was published. See audit-progress.json for failed scopes.`,
    );
}
const unchangedScope = (a: ScopeSnapshot, b: ScopeSnapshot) =>
  a.tag === b.tag &&
  ["config", "products", "framework", "menu"].every(
    (key) =>
      a.source[key as keyof typeof a.source] ===
      b.source[key as keyof typeof b.source],
  );
type CoverageProgress = {
  version: 1;
  startedAt: string;
  updatedAt: string;
  total: number;
  completed: number;
  phase: "running" | "complete" | "failed";
  release: SnapshotRelease;
  errors: SnapshotRelease["diagnostics"];
};

/** Durable audit progress never changes the active snapshot. Only successful, current-source scopes resume. */
export class CoverageAudit {
  private queue: Promise<void> = Promise.resolve();
  private constructor(
    private path: string,
    private store: SnapshotStore,
    private progress: CoverageProgress,
    private cached: SnapshotRelease | null,
  ) {}
  static async create(
    store: SnapshotStore,
    release: SnapshotRelease,
    total: number,
  ) {
    const path = join(store.root, "audit-progress.json");
    let cached: SnapshotRelease | null = null;
    try {
      const old = JSON.parse(await readFile(path, "utf8")) as CoverageProgress;
      if (
        old.version === 1 &&
        old.phase !== "complete" &&
        old.release.bridgeHash === release.bridgeHash &&
        old.release.auditHash === release.auditHash &&
        frameworkAssetsHash(old.release.assets) === frameworkAssetsHash(release.assets) &&
        old.release.menu === release.menu
      )
        cached = old.release;
    } catch {}
    const progress: CoverageProgress = {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      total,
      completed: 0,
      phase: "running",
      release: { ...release, scopes: { ...(cached?.scopes ?? {}) } },
      errors: [],
    };
    const audit = new CoverageAudit(path, store, progress, cached);
    await audit.write();
    return audit;
  }
  async resume(scope: ScopeSnapshot) {
    if (!this.cached?.scopes[`${scope.service}/${scope.region}`]) return null;
    const old = await this.store
      .scope(this.cached, scope.service, scope.region)
      .catch(() => null);
    if (
      !old ||
      Date.now() - Date.parse(old.verifiedAt) > 24 * 60 * 60 * 1000 ||
      !Number.isFinite(Date.parse(old.verifiedAt)) ||
      !unchangedScope(scope, old)
    )
      return null;
    return old;
  }
  async checked(
    service: string,
    region: string,
    hash?: string,
    error?: string,
  ) {
    return this.serialize(async () => {
      const key = `${service}/${region}`;
      if (hash) this.progress.release.scopes[key] = hash;
      else {
        delete this.progress.release.scopes[key];
        this.progress.errors.push({
          service,
          region,
          error: error ?? "Scope was not validated",
        });
      }
      this.progress.completed++;
      await this.write();
    });
  }
  async finish(phase: "complete" | "failed") {
    return this.serialize(async () => {
      this.progress.phase = phase;
      await this.write();
    });
  }
  private serialize(work: () => Promise<void>) {
    const next = this.queue.then(work);
    this.queue = next.catch(() => {});
    return next;
  }
  private async write() {
    this.progress.updatedAt = new Date().toISOString();
    const temp = this.path + "." + randomUUID();
    await writeFile(temp, JSON.stringify(this.progress));
    await rename(temp, this.path);
  }
}
