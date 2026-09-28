import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { configureSqlite } from "../sqlite-settings";
import type { ServiceRelease, Snapshot, SyncService, Verification } from "./types";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export class SyncStore {
  readonly db: Database;
  constructor(path = process.env.HUAWEI_SYNC_DB ?? "data/huawei-sync.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    configureSqlite(this.db);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots(hash TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS fetches(url TEXT PRIMARY KEY, hash TEXT NOT NULL, fetched_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS directory(id TEXT PRIMARY KEY, json TEXT NOT NULL, seen_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS releases(id TEXT PRIMARY KEY, service TEXT NOT NULL, region TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS active(service TEXT NOT NULL, region TEXT NOT NULL, release_id TEXT NOT NULL, previous_id TEXT, PRIMARY KEY(service,region));
      CREATE TABLE IF NOT EXISTS leases(name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS attempts(service TEXT NOT NULL,region TEXT NOT NULL,last_attempt TEXT NOT NULL, PRIMARY KEY(service,region));
      CREATE TABLE IF NOT EXISTS missing_services(id TEXT PRIMARY KEY, scans INTEGER NOT NULL);
    `);
  }
  close() { this.db.close(); }
  snapshot(url: string, body: string, now = new Date().toISOString()): Snapshot {
    const digest = hash(body);
    this.db.transaction(() => {
      this.db.query("INSERT OR IGNORE INTO snapshots VALUES (?,?)").run(digest, body);
      this.db.query("INSERT OR REPLACE INTO fetches VALUES (?,?,?)").run(url, digest, now);
    })();
    return { url, body, hash: digest, fetchedAt: now };
  }
  body(digest: string): string {
    const result = this.db.query<{ body: string }, [string]>("SELECT body FROM snapshots WHERE hash=?").get(digest);
    if (!result) throw new Error(`Missing source snapshot ${digest}`);
    return result.body;
  }
  latest(url: string): Snapshot | null {
    const row = this.db.query<{ hash: string; fetched_at: string }, [string]>("SELECT * FROM fetches WHERE url=?").get(url);
    return row ? { url, hash: row.hash, body: this.body(row.hash), fetchedAt: row.fetched_at } : null;
  }
  directory(services?: SyncService[]) {
    if (services) this.db.transaction(() => {
      const present = new Set(services.map(s => s.id));
      for (const row of this.db.query<{ id: string; json: string }, []>("SELECT id,json FROM directory").all()) {
        if (present.has(row.id)) { this.db.query("DELETE FROM missing_services WHERE id=?").run(row.id); continue; }
        this.db.query("INSERT INTO missing_services VALUES (?,1) ON CONFLICT(id) DO UPDATE SET scans=scans+1").run(row.id);
        const misses = this.db.query<{ scans: number }, [string]>("SELECT scans FROM missing_services WHERE id=?").get(row.id)!;
        if (misses.scans >= 2) this.db.query("UPDATE directory SET json=? WHERE id=?").run(JSON.stringify({ ...JSON.parse(row.json), available: false }),row.id);
      }
      for (const service of services) this.db.query("INSERT OR REPLACE INTO directory VALUES (?,?,?)").run(service.id, JSON.stringify(service), new Date().toISOString());
    })();
    return this.db.query<{ json: string }, []>("SELECT json FROM directory ORDER BY id").all().map(row => JSON.parse(row.json) as SyncService);
  }
  save(release: ServiceRelease) {
    this.db.query("INSERT OR REPLACE INTO releases VALUES (?,?,?,?)").run(release.id, release.service.id, release.region, JSON.stringify(release));
  }
  release(id: string) {
    const row = this.db.query<{ json: string }, [string]>("SELECT json FROM releases WHERE id=?").get(id);
    return row ? JSON.parse(row.json) as ServiceRelease : null;
  }
  active(service: string, region: string) {
    const row = this.db.query<{ release_id: string }, [string, string]>("SELECT release_id FROM active WHERE service=? AND region=?").get(service, region);
    return row ? this.release(row.release_id) : null;
  }
  promote(id: string, verification: Verification) {
    return this.db.transaction(() => {
      const release = this.release(id);
      if (!release || release.status !== "candidate" || release.diagnostics.length) throw new Error("Only supported candidates can be promoted");
      if (verification.source !== "official-browser" || verification.cases < 1 || !verification.evidenceHash) throw new Error("Independent verification required");
      this.body(verification.evidenceHash);
      release.status = "active"; release.verification = verification;
      const previous = this.active(release.service.id, release.region);
      this.save(release);
      if (previous?.id !== release.id) this.db.query("INSERT OR REPLACE INTO active VALUES (?,?,?,?)").run(release.service.id, release.region, release.id, previous?.id ?? null);
      return release;
    })();
  }
  rollback(service: string, region: string, reason: string) {
    this.db.transaction(() => {
      const row = this.db.query<{ release_id: string; previous_id: string | null }, [string, string]>("SELECT * FROM active WHERE service=? AND region=?").get(service, region);
      if (!row) return;
      const bad = this.release(row.release_id)!;
      bad.status = "quarantined"; bad.diagnostics.push(reason); this.save(bad);
      if (row.previous_id) this.db.query("UPDATE active SET release_id=?,previous_id=NULL WHERE service=? AND region=?").run(row.previous_id, service, region);
      else this.db.query("DELETE FROM active WHERE service=? AND region=?").run(service, region);
    })();
  }
  listReleases() {
    return this.db.query<{ json: string }, []>("SELECT json FROM releases WHERE rowid IN (SELECT MAX(rowid) FROM releases GROUP BY service,region) ORDER BY rowid DESC").all().map(row => JSON.parse(row.json) as ServiceRelease);
  }
  acquireLease(name: string, durationMs: number, now = Date.now()) {
    const owner = randomUUID();
    const result = this.db.query("INSERT INTO leases VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE leases.expires_at <= ?").run(name, owner, now + durationMs, now);
    return result.changes ? owner : null;
  }
  releaseLease(name: string, owner: string) { this.db.query("DELETE FROM leases WHERE name=? AND owner=?").run(name, owner); }
  renewLease(name: string, owner: string, durationMs: number) { return this.db.query("UPDATE leases SET expires_at=? WHERE name=? AND owner=?").run(Date.now() + durationMs, name, owner).changes > 0; }
  attempted(service: string, region: string) { this.db.query("INSERT OR REPLACE INTO attempts VALUES (?,?,?)").run(service, region, new Date().toISOString()); }
  attempts() { return this.db.query<{ service: string; region: string; last_attempt: string }, []>("SELECT * FROM attempts").all(); }
}
