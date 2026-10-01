import { mkdir, writeFile } from "node:fs/promises";
import { HuaweiCollector } from "../../lib/huawei-sync/collector";
import { SyncStore } from "../../lib/huawei-sync/store";
import { inspectConfig } from "../../lib/huawei-sync/engine";
import { DemoSources, type Scope } from "./sources";
const output = process.env.BROWSERLESS_OUTPUT || "/tmp/neo-browserless-audit";
await mkdir(output, { recursive: true });
const store = new SyncStore(`${output}/sources.sqlite`);
const sources = new DemoSources(new HuaweiCollector(store));
const { directory } = await sources.getShared();
const results: unknown[] = [];
let index = 0;
try {
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (index < directory.services.length) {
        const service = directory.services[index++];
        const regions = directory.regions.filter(
          (r) => directory.billingModes[service.id]?.[r.id]?.length,
        );
        const region =
          ["ap-southeast-1", "ap-southeast-3", "sa-brazil-1"].find((id) =>
            regions.some((r) => r.id === id),
          ) || regions[0]?.id;
        if (!region) {
          results.push({
            service: service.id,
            name: service.name,
            status: "no-common-HWC-scope",
          });
          continue;
        }
        const modes = directory.billingModes[service.id][region];
        const billingMode = modes.includes("ONDEMAND") ? "ONDEMAND" : modes[0];
        try {
          const payload = await sources.forScope({
            service: service.id,
            region,
            billingMode,
          } as Scope);
          const meta = await inspectConfig(store.body(payload.source.config));
          results.push({
            service: service.id,
            name: service.name,
            region,
            billingMode,
            modes,
            regions: regions.map((r) => r.id),
            components: meta.components,
            callbackCount: meta.callbacks.length,
            source: payload.source,
            status: "sources-loaded",
          });
        } catch (error) {
          results.push({
            service: service.id,
            name: service.name,
            region,
            billingMode,
            status: "source-error",
            error: String(error),
          });
        }
        console.log(
          `${results.length}/${directory.services.length}: ${service.id}`,
        );
        await writeFile(
          `${output}/inventory.json`,
          JSON.stringify(
            {
              checkedAt: new Date().toISOString(),
              discovered: directory.services.length,
              results,
            },
            null,
            2,
          ),
        );
      }
    }),
  );
  console.log("COMPLETE", results.length);
} finally {
  store.close();
}
