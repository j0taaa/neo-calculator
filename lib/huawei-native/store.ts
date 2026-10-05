import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { configureSqlite } from "../sqlite-settings";
import type { Snapshot } from "./types";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export class SourceStore {
  readonly db: Database;
  constructor(path = process.env.HUAWEI_SOURCE_DB ?? "data/huawei-sources.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    configureSqlite(this.db);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots(hash TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS fetches(url TEXT PRIMARY KEY, hash TEXT NOT NULL, fetched_at TEXT NOT NULL);
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
}
