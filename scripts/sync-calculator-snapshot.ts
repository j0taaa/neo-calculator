process.env.HUAWEI_SOURCE_ACCESS = "sync";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SourceStore } from "../lib/huawei-native/store";
import { HuaweiCollector } from "../lib/huawei-native/collector";
import { SnapshotStore, snapshotDirectory } from "../lib/huawei-snapshot/store";
import { collectRelease, collectScope } from "../lib/huawei-snapshot/collect";
import { SyncRenderer } from "../lib/huawei-snapshot/sync-renderer";
import { validateCatalogContracts } from "../lib/huawei-snapshot/contracts";
import { verifyRecordedQuotes } from "../lib/huawei-snapshot/audit";
import {
  PricingChanged,
  revalidateUnchangedScope,
} from "../lib/huawei-snapshot/revalidate";
import { acquireSyncLease } from "../lib/huawei-snapshot/lease";
import { scopeKey } from "../lib/huawei-snapshot/types";
import {
  CoverageAudit,
  discoveryScopes,
  assertFullCoverage,
} from "../lib/huawei-snapshot/coverage";

const root = snapshotDirectory();
await mkdir(root, { recursive: true });
const lock = join(root, "sync.lock");
const handle = await acquireSyncLease(lock);
let renderer: SyncRenderer | undefined;
let rendererPromise: Promise<SyncRenderer> | undefined;
let audit: CoverageAudit | undefined;
try {
  const store = new SnapshotStore(root),
    collector = new HuaweiCollector(new SourceStore());
  const previous = await store.active().catch(() => null),
    release = await collectRelease(collector, store);

  const services = process.env.HUAWEI_SYNC_SERVICES?.split(",").filter(Boolean);
  const regions = process.env.HUAWEI_SYNC_REGIONS?.split(",").filter(Boolean);
  const scopes = discoveryScopes(release, services, regions);
  audit = await CoverageAudit.create(store, release, scopes.length);
  console.log(
    JSON.stringify({
      discoveredServices: release.directory.services.length,
      discoveredRegions: release.directory.regions.length,
      scopes: scopes.length,
    }),
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
          let scope = await collectScope(collector, release, service, region);
          const resumed = await audit!.resume(scope);
          const old = previous?.scopes[key]
            ? await store.scope(previous, service, region)
            : null;
          const unchanged =
            !scope.customPricing &&
            previous?.bridgeHash === release.bridgeHash &&
            previous?.auditHash === release.auditHash &&
            old &&
            old.proof?.length &&
            ["config", "products", "framework", "menu"].every(
              (k) =>
                old.source[k as keyof typeof old.source] ===
                scope.source[k as keyof typeof scope.source],
            );
          const validateChanged = async () => {
            rendererPromise ??= SyncRenderer.create(store);
            renderer = await rendererPromise;
            scope.checks = await renderer.validate(
              { ...release, id: previous?.id ?? "candidate" },
              scope,
            );
            for (const locationCode of Object.keys(scope.locationModes ?? {})) {
              const locationChecks = await renderer.validate(
                { ...release, id: previous?.id ?? "candidate" },
                scope,
                false,
                locationCode,
              );
              if (!locationChecks || !scope.locationModes![locationCode].length)
                throw new Error(`No verified offer for availability zone ${locationCode}`);
              scope.checks += locationChecks;
            }
            scope.checks += await validateCatalogContracts(scope);
            verifyRecordedQuotes(scope);
          };
          if (resumed) {
            scope = resumed;
            verifyRecordedQuotes(scope);
          } else if (unchanged) {
            scope.modes = old!.modes;
            try {
              scope.checks = await revalidateUnchangedScope(scope, old!);
            } catch (error) {
              if (!(error instanceof PricingChanged)) throw error;
              scope = await collectScope(collector, release, service, region);
              await validateChanged();
            }
          } else await validateChanged();
          if (!resumed) scope.verifiedAt = new Date().toISOString();
          if (!scope.checks || !scope.modes.length)
            throw new Error(
              "No valid offer was verified for this advertised service/region",
            );
          release.directory.billingModes[service][region] = scope.modes;
          release.scopes[key] = await store.writeScope(scope);
          await audit!.checked(service, region, release.scopes[key]);
          console.log(
            JSON.stringify({
              scope: key,
              checks: scope.checks,
              unchanged: !!unchanged,
              resumed: !!resumed,
            }),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          release.diagnostics.push({ service, region, error: message });
          await audit!.checked(service, region, undefined, message);
          console.error(JSON.stringify({ scope: key, error: message }));
        }
      }
    }),
  );
  await writeFile(
    join(root, "last-audit.json"),
    JSON.stringify(release, null, 2),
  );
  if (!services && !regions) assertFullCoverage(release, scopes);
  if (previous && (services || regions))
    throw new Error(
      "A limited test synchronization cannot replace an existing release",
    );
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
  await audit.finish("complete");
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
  await audit?.finish("failed");
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
