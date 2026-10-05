import { HuaweiCollector } from "./collector";
import { inspectConfig } from "./engine";
import { ENGINE_VERSION } from "./program";
import { enumerateScenarios, type Scenario } from "./scenarios";
import { canonical, hash, SyncStore } from "./store";
import type { ServiceRelease, Verification } from "./types";

export type VerifyCandidate = (release: ServiceRelease, scenarios: Scenario[], store: SyncStore) => Promise<Verification>;
export type SyncOptions = { regions?: string[]; services?: string[]; maxServices?: number; maxStates?: number };

export async function syncCalculator(store: SyncStore, verify: VerifyCandidate, options: SyncOptions, collector = new HuaweiCollector(store)) {
  const owner = store.acquireLease("calculator-sync", 120_000);
  if (!owner) return { skipped: true, published: 0, quarantined: 0 };
  let ownsLease = true;
  const heartbeat = setInterval(() => { ownsLease = store.renewLease("calculator-sync", owner, 120_000); }, 30_000);
  const runId = crypto.randomUUID();
  const stats = { skipped: false, published: 0, quarantined: 0 };
  store.db.query("INSERT INTO runs VALUES (?,?,NULL,?)").run(runId, new Date().toISOString(), "{}");
  try {
    const { snapshot: menu, services } = await collector.directory();
    const framework = await collector.framework();
    const candidates = services.filter(s => s.available && (!options.services || options.services.includes(s.id)));
    // Oldest or never attempted scopes first: bounded work must not starve newly discovered services.
    const menuData = JSON.parse(menu.body);
    const regions = options.regions ?? Object.keys(menuData.regionRules).filter(region =>
      (menuData.regionsOfSite?.HWC?.includes(region) ?? true) &&
      (menuData.regionRules[region] === "ALL" || menuData.regionRules[region]?.calc === true));
    const attempts = store.attempts();
    const jobs = regions.flatMap(region => candidates.map(service => {
      const active = store.active(service.id, region);
      const last = attempts.find(a => a.service === service.id && a.region === region)?.last_attempt ?? "";
      const urgent = active && Date.now() - Date.parse(active.verification?.checkedAt ?? "1970") >= 6 * 60 * 60_000;
      return { service, region, last, urgent: Boolean(urgent) };
    }));
    jobs.sort((a,b) => Number(b.urgent)-Number(a.urgent) || a.last.localeCompare(b.last));
    for (const { service, region } of jobs.slice(0, options.maxServices ?? 10)) {
      store.attempted(service.id, region);
      let release: ServiceRelease | null = null;
      try {
        const { config, products } = await collector.service(service.id, region);
        const identity = { service: service.id, region, config: config.hash, products: products.hash, menu: menu.hash, framework: framework.hash, engine: ENGINE_VERSION };
        const id = hash(canonical(identity));
        const existing = store.release(id);
        if (existing && existing.status !== "candidate" && Date.now() - Date.parse(existing.verification?.checkedAt ?? existing.createdAt) < 6 * 60 * 60_000) continue;
        release = { id, service, region, configHash: config.hash, productsHash: products.hash, menuHash: menu.hash, frameworkHash: framework.hash, engineVersion: ENGINE_VERSION, createdAt: new Date().toISOString(), status: "candidate", diagnostics: [], verification: null };
        await inspectConfig(config.body);
        const scenarios = await enumerateScenarios(config.body, JSON.parse(products.body), region, options.maxStates ?? 128);
        store.save(release);
        const verification = await verify(release, scenarios, store);
        if (!ownsLease) throw new Error("Synchronization lease lost");
        const current = await collector.fetch(config.url);
        if (current.hash !== config.hash) throw new Error("Huawei configuration changed during verification");
        const currentProducts = await collector.fetch(products.url);
        if (currentProducts.hash !== products.hash) throw new Error("Huawei catalog changed during verification");
        store.promote(id, verification);
        stats.published++;
        console.log(`Published ${service.id}/${region}: ${verification.cases} independent checks`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown synchronization failure";
        if (release) {
          release.status = "quarantined"; release.diagnostics = [reason]; store.save(release);
          if (store.active(service.id, region)?.id === release.id) store.rollback(service.id, region, reason);
        }
        stats.quarantined++;
        console.log(`Held ${service.id}/${region}: ${reason}`);
      }
    }
    return stats;
  } finally {
    clearInterval(heartbeat);
    store.db.query("UPDATE runs SET finished_at=?,json=? WHERE id=?").run(new Date().toISOString(), JSON.stringify(stats), runId);
    store.releaseLease("calculator-sync", owner);
  }
}
