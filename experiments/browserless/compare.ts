import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { HuaweiCollector } from "../../lib/huawei-sync/collector";
import { NativeCalculator } from "../../lib/huawei-sync/native-session";
import { semanticInquiry } from "../../lib/huawei-sync/browser-verifier";
import { canonical, SyncStore } from "../../lib/huawei-sync/store";
import type { NativeState } from "../../lib/huawei-sync/native-types";
import { BrowserlessSession, type DemoState } from "./runtime";
import { DemoSources, type Scope } from "./sources";
const output = process.env.BROWSERLESS_OUTPUT || "/tmp/neo-browserless-audit";
await mkdir(output, { recursive: true });
const store = new SyncStore(`${output}/sources.sqlite`);
const sources = new DemoSources(new HuaweiCollector(store));
const native = new NativeCalculator(sources.collector);
const results: unknown[] = [];
const scopes: Scope[] = [
  { service: "nat", region: "ap-southeast-1", billingMode: "ONDEMAND" },
  { service: "nat", region: "ap-southeast-1", billingMode: "PERIOD" },
  { service: "ecs", region: "ap-southeast-1", billingMode: "ONDEMAND" },
  { service: "ecs", region: "sa-brazil-1", billingMode: "RI" },
  { service: "elb", region: "ap-southeast-1", billingMode: "ONDEMAND" },
  { service: "redis", region: "ap-southeast-3", billingMode: "ONDEMAND" },
  { service: "ccm", region: "ap-southeast-1", billingMode: "ONETIME" },
];
async function save() {
  await writeFile(
    `${output}/comparison.json`,
    JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
  );
}
try {
  for (const scope of scopes) {
    let session: BrowserlessSession | undefined,
      official: NativeState | undefined,
      candidate: DemoState | undefined;
    const started = Date.now();
    try {
      session = await BrowserlessSession.open(sources, scope);
      candidate = await session.state();
      official = await native.open(
        scope.service,
        scope.region,
        scope.billingMode,
      );
      async function compare(name: string) {
        assert(candidate!.quote, candidate!.priceError || "No candidate quote");
        assert(official!.quote, official!.priceError || "No native quote");
        assert.equal(candidate!.source.config, official!.source.config);
        assert.equal(candidate!.source.products, official!.source.products);
        assert.deepEqual(
          candidate!.fields,
          official!.fields,
          "Visible controls/options/values differ",
        );
        const requests = (inquiries: DemoState["inquiries"]) =>
          inquiries.map((i) => canonical(semanticInquiry(i))).sort();
        assert.deepEqual(
          requests(candidate!.inquiries),
          requests(official!.inquiries),
          "Inquiry payloads differ",
        );
        assert.equal(
          candidate!.quote.amount,
          official!.quote.amount,
          "Prices differ",
        );
        assert.deepEqual(
          candidate!.quote.payment,
          official!.quote.payment,
          "Payment schedules differ",
        );
        results.push({
          ...scope,
          name,
          status: "match",
          amount: candidate!.quote.amount,
          payment: candidate!.quote.payment,
          fields: candidate!.fields.length,
          metrics: candidate!.metrics,
          source: candidate!.source,
        });
        console.log(
          `${scope.service}/${scope.region}/${scope.billingMode}/${name}: MATCH ${candidate!.quote.amount}`,
        );
        await save();
      }
      async function change(
        name: string,
        id: string,
        value: string | number | boolean,
      ) {
        candidate = await session!.change(id, value);
        official = await native.act({
          session: official!.session,
          revision: official!.revision,
          field: id,
          value,
        });
        await compare(name);
      }
      async function choose(name: string, label: RegExp) {
        const field = candidate!.fields.find(
          (f) =>
            !f.disabled &&
            f.options?.some((o) => !o.disabled && label.test(o.label)),
        );
        if (!field) throw Error(`Missing option ${label}`);
        await change(
          name,
          field.id,
          field.options!.find((o) => !o.disabled && label.test(o.label))!.value,
        );
      }
      await compare("default");
      if (scope.service === "nat") {
        if (scope.billingMode === "ONDEMAND")
          await choose("private-NAT", /^Private/);
        else await choose("annual", /^1 year$/i);
      }
      if (scope.service === "ecs") {
        await choose("C7n-images-available", /^C7n$/);
        await choose("aC8-images-unavailable", /^aC8$/);
        if (scope.billingMode === "RI")
          await choose("three-years", /^3 Years$/);
        else {
          await choose("Kunpeng", /^Kunpeng$/);
          await choose("x86", /^x86$/);
        }
      }
      if (scope.service === "elb") {
        await choose("shared", /^Shared load balancer$/i);
        await choose("dedicated", /^Dedicated load balancer$/i);
        await choose("fixed", /^Fixed$/i);
      }
      if (scope.service === "redis") {
        const field = candidate!.fields.find(
          (f) =>
            !f.disabled &&
            f.type === "select" &&
            f.options!.some((o) => !o.disabled && o.value !== f.value),
        );
        if (field)
          await change(
            "alternative-specification",
            field.id,
            field.options!.find((o) => !o.disabled && o.value !== field.value)!
              .value,
          );
      }
      const number = candidate.fields.find(
        (f) =>
          !f.disabled &&
          f.type === "number" &&
          (f.component === "global_QUANTITY" ||
            f.component === "global_ONDEMANDTIME"),
      );
      if (number) await change("quantity-or-duration-two", number.id, 2);
      results.push({
        ...scope,
        name: "completed",
        status: "completed",
        elapsedSeconds: (Date.now() - started) / 1000,
      });
    } catch (error) {
      results.push({
        ...scope,
        status: "failed",
        error: String(error),
        elapsedSeconds: (Date.now() - started) / 1000,
      });
      console.error(`${scope.service}: ${error}`);
    } finally {
      await session?.close();
      if (official) await native.remove(official.session);
      await save();
    }
  }
} finally {
  await native.close();
  store.close();
}
process.exit(
  results.some((r) => (r as { status: string }).status === "failed") ? 1 : 0,
);
