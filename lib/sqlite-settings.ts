import type { Database } from "bun:sqlite";

/** Journal-mode changes can return BUSY immediately even with busy_timeout set. */
export function configureSqlite(db: Database) {
  db.exec("PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON;");
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      const mode = db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode;
      if (mode !== "wal" && mode !== "memory") db.exec("PRAGMA journal_mode=WAL;");
      return;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || !String(error.code).startsWith("SQLITE_BUSY") || Date.now() >= deadline) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
}
