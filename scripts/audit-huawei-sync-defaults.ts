import { writeFile } from "node:fs/promises";
import { evaluateForm } from "../lib/huawei-sync/engine";
import { verifyInOfficialBrowser } from "../lib/huawei-sync/browser-verifier";
import { SyncStore } from "../lib/huawei-sync/store";

const directory = process.env.HUAWEI_AUDIT_DIR ?? "/tmp/neo-sync-complex-audit";
const store = new SyncStore(process.env.HUAWEI_SYNC_DB ?? `${directory}/sync.sqlite`);
const results = [];
try {
  for (const region of ["ap-southeast-1", "sa-brazil-1", "ap-southeast-3"]) {
    const release = store.listReleases().find(item => item.service.id === "redis" && item.region === region);
    if (!release) throw new Error(`Missing captured DCS scope: ${region}`);
    const identity = { region, configHash: release.configHash, productsHash: release.productsHash, engineVersion: release.engineVersion };
    try {
      const form = await evaluateForm(store.body(release.configHash), JSON.parse(store.body(release.productsHash)), { region, values: {} });
      const checked = await verifyInOfficialBrowser(release, [{ input: { region, values: form.values }, form }], store);
      results.push({ ...identity, result: "passed-default-only", ...checked });
    } catch (error) {
      results.push({ ...identity, result: "failed", error: String(error) });
    }
    console.log(results.at(-1));
    await writeFile(`${directory}/dcs-default-checks.json`, JSON.stringify(results, null, 2));
  }
} finally { store.close(); }
// Playwright/Bun can retain closed transport handles; this one-shot CLI has finished all work.
process.exit(results.some(result => result.result === "failed") ? 1 : 0);
