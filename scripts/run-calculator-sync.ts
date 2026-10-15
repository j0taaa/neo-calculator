import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { snapshotDirectory } from "../lib/huawei-snapshot/store";
const interval = 24 * 60 * 60 * 1000;
async function lastSuccess() {
  try {
    const status = JSON.parse(
      await readFile(join(snapshotDirectory(), "last-sync.json"), "utf8"),
    );
    return status.ok ? Date.parse(status.at) : 0;
  } catch {
    return 0;
  }
}
// Failed jobs retry in one hour. Existing snapshots continue serving during retries.
for (;;) {
  const delay = Math.max(0, (await lastSuccess()) + interval - Date.now());
  if (delay > 0) {
    await Bun.sleep(Math.min(delay, 60000));
    continue;
  }
  const result = Bun.spawn(
    [process.execPath, "run", "scripts/sync-calculator-snapshot.ts"],
    {
      env: { ...process.env, HUAWEI_SOURCE_ACCESS: "sync" },
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  const code = await result.exited;
  if (code !== 0) await Bun.sleep(60 * 60 * 1000);
}
