process.env.HUAWEI_SOURCE_ACCESS = "sync";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SourceStore } from "../lib/huawei-native/store";
import { HuaweiCollector } from "../lib/huawei-native/collector";
import { SnapshotStore, snapshotDirectory } from "../lib/huawei-snapshot/store";
import { collectRelease, collectScope } from "../lib/huawei-snapshot/collect";
import { SyncRenderer } from "../lib/huawei-snapshot/sync-renderer";
import { validateCatalogContracts } from "../lib/huawei-snapshot/contracts";
import { revalidateUnchangedScope } from "../lib/huawei-snapshot/revalidate";
import { acquireSyncLease } from "../lib/huawei-snapshot/lease";
import { scopeKey } from "../lib/huawei-snapshot/types";

const root = snapshotDirectory();
await mkdir(root, { recursive: true });
const lock = join(root, "sync.lock");
const handle = await acquireSyncLease(lock);
let renderer: SyncRenderer | undefined;
let rendererPromise: Promise<SyncRenderer> | undefined;
try {
  const store = new SnapshotStore(root),
    collector = new HuaweiCollector(new SourceStore());
  const previous = await store.active().catch(() => null),
    release = await collectRelease(collector, store);

  const services = process.env.HUAWEI_SYNC_SERVICES?.split(",").filter(Boolean);
  const regions = process.env.HUAWEI_SYNC_REGIONS?.split(",").filter(Boolean);
  const scopes = release.directory.services
    .filter((service) => !services || services.includes(service.id))
    .flatMap((service) =>
      release.directory.regions
        .filter(
          (region) =>
            (!regions || regions.includes(region.id)) &&
            release.directory.billingModes[service.id]?.[region.id]?.length,
        )
        .map((region) => ({ service: service.id, region: region.id })),
    );
  let next = 0;
  const concurrency = Math.min(
    2,
    Math.max(1, Number(process.env.HUAWEI_SYNC_CONCURRENCY) || 1),
  );
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < scopes.length) {
        const { service, region } = scopes[next++],
          key = scopeKey(service, region);
        try {
          const scope = await collectScope(collector, release, service, region);
          const old = previous?.scopes[key]
            ? await store.scope(previous, service, region)
            : null;
          const unchanged =
            previous?.bridgeHash === release.bridgeHash &&
            old &&
            ["config", "products", "framework", "menu"].every(
              (k) =>
                old.source[k as keyof typeof old.source] ===
                scope.source[k as keyof typeof scope.source],
            );
          if (unchanged) {
            scope.modes = old!.modes;
            scope.checks = await revalidateUnchangedScope(scope, old!);
          } else {
            rendererPromise ??= SyncRenderer.create(store);
            renderer = await rendererPromise;
            scope.checks = await renderer.validate(
              { ...release, id: previous?.id ?? "candidate" },
              scope,
            );
            scope.checks += await validateCatalogContracts(scope);
          }
          scope.verifiedAt = new Date().toISOString();
          release.directory.billingModes[service][region] = scope.modes;
          release.scopes[key] = await store.writeScope(scope);
          console.log(
            JSON.stringify({
              scope: key,
              checks: scope.checks,
              unchanged: !!unchanged,
            }),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          release.diagnostics.push({ service, region, error: message });
          console.error(JSON.stringify({ scope: key, error: message }));
        }
      }
    }),
  );
  await writeFile(
    join(root, "last-audit.json"),
    JSON.stringify(release, null, 2),
  );
  if (!previous && !services && !regions && release.diagnostics.length)
    throw new Error(
      "The initial full synchronization is incomplete. No partial catalog was published. See last-sync.json for failed scopes.",
    );
  if (previous)
    for (const [key, hash] of Object.entries(previous.scopes)) {
      if (!release.scopes[key]) {
        if (services || regions)
          throw new Error(
            "A limited test synchronization cannot replace an existing release",
          );
        throw new Error(
          `Synchronization could not validate ${key}. The previous release remains active.`,
        );
      }
      void hash;
    }
  // Publish only services/regions with validated modes. Discovered unsupported scopes stay pending.
  release.directory.services = release.directory.services.filter((service) =>
    Object.keys(release.scopes).some((key) => key.startsWith(service.id + "/")),
  );
  for (const [service, regionModes] of Object.entries(
    release.directory.billingModes,
  ))
    for (const region of Object.keys(regionModes))
      if (!release.scopes[scopeKey(service, region)])
        delete regionModes[region];
  const id = await store.publish(release);
  console.log(
    JSON.stringify({
      published: id,
      scopes: Object.keys(release.scopes).length,
      pending: release.diagnostics.length,
    }),
  );
  await writeFile(
    join(root, "last-sync.json"),
    JSON.stringify(
      {
        ok: true,
        at: new Date().toISOString(),
        release: id,
        diagnostics: release.diagnostics,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    join(root, "last-sync.json"),
    JSON.stringify(
      {
        ok: false,
        at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await renderer?.close();
  await handle.close();
  await rm(lock, { force: true });
}
