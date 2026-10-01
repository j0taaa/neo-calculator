import { writeFile, mkdir } from "node:fs/promises";
import { HuaweiCollector } from "../../lib/huawei-sync/collector";
import { SyncStore } from "../../lib/huawei-sync/store";
import { DemoSources, type Scope } from "./sources";
import { BrowserlessSession } from "./runtime";
const output = process.env.BROWSERLESS_OUTPUT || "/tmp/neo-browserless-audit";
await mkdir(output, { recursive: true });
const store = new SyncStore(`${output}/sources.sqlite`);
const sources = new DemoSources(new HuaweiCollector(store));
const results: unknown[] = [];
let failed = false;
try {
  for (const name of process.argv.slice(2)) {
    const [service, region, billingMode] = name.split(":");
    const scope = { service, region, billingMode } as Scope;
    let session: BrowserlessSession | undefined;
    const start = Date.now();
    try {
      session = await BrowserlessSession.open(sources, scope);
      const state = await session.state();
      if (!state.quote) failed = true;
      results.push({
        scope,
        status: state.quote ? "quoted" : "blocked",
        amount: state.quote?.amount,
        error: state.priceError,
        elapsedSeconds: (Date.now() - start) / 1000,
      });
      await writeFile(
        `${output}/${name.replaceAll(":", "-")}.json`,
        JSON.stringify(state, null, 2),
      );
      console.log(
        JSON.stringify({
          scope,
          amount: state.quote?.amount,
          fields: state.fields.length,
          diagnostics: state.diagnostics,
          error: state.priceError,
          logs: state.logs.slice(0, 500),
          metrics: state.metrics,
          elapsedSeconds: (Date.now() - start) / 1000,
        }),
      );
    } catch (error) {
      failed = true;
      results.push({
        scope,
        status: "failed",
        error: String(error),
        elapsedSeconds: (Date.now() - start) / 1000,
      });
      console.log(
        JSON.stringify({
          scope,
          error: String(error),
          elapsedSeconds: (Date.now() - start) / 1000,
        }),
      );
    } finally {
      await session?.close();
    }
  }
} finally {
  store.close();
  await writeFile(
    `${output}/probe-results.json`,
    JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
  );
}
if (!results.length) {
  console.error(
    "Usage: bun experiments/browserless/probe.ts service:region:billing-mode [...]",
  );
  process.exit(2);
}
process.exit(failed ? 1 : 0);
