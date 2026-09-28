import { verifyInOfficialBrowser } from "../lib/huawei-sync/browser-verifier";
import { SyncStore } from "../lib/huawei-sync/store";
import { syncCalculator } from "../lib/huawei-sync/worker";

const store = new SyncStore();
const once = process.argv.includes("--once");
const regions = process.env.HUAWEI_SYNC_REGIONS?.split(",").filter(Boolean);
const services = process.env.HUAWEI_SYNC_SERVICES?.split(",").filter(Boolean);
const maxServices = Number(process.env.HUAWEI_SYNC_MAX_SCOPES ?? 10);
const interval = Number(process.env.HUAWEI_SYNC_INTERVAL_MS ?? 900_000);
if (regions?.length === 0 || !Number.isInteger(maxServices) || maxServices < 1 || maxServices > 100 || interval < 60_000) throw new Error("Invalid synchronization schedule");
let stopped = false;
let wake: (() => void) | undefined;
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { stopped = true; wake?.(); });
try {
  do {
    try { console.log(JSON.stringify(await syncCalculator(store, verifyInOfficialBrowser, { regions, services, maxServices }))); }
    catch (error) { console.error("Synchronization cycle failed:", error instanceof Error ? error.message : error); if (once) process.exitCode = 1; }
    if (once || stopped) break;
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, interval);
      wake = () => { clearTimeout(timer); resolve(); };
    });
  } while (!stopped);
} finally { store.close(); }
