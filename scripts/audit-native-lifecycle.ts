/** Real Chromium cleanup audit; controller timestamps avoid waiting for expiry. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type { Browser } from "playwright";
import { NativeCalculator, NativeError } from "../lib/huawei-sync/native-session";
import { HuaweiCollector } from "../lib/huawei-sync/collector";
import { SyncStore } from "../lib/huawei-sync/store";
import type { NativeState } from "../lib/huawei-sync/native-types";

const output = process.env.NATIVE_LIFECYCLE_AUDIT_DIR ?? "/tmp/neo-native-lifecycle-audit";
await mkdir(output, { recursive: true });
const store = new SyncStore(`${output}/sources.sqlite`);
const calculator = new NativeCalculator(new HuaweiCollector(store));
// Age only controller sessions; Playwright, HTTP, quote caches and timers keep real time.
const lifecycle = calculator as unknown as {
  browser?: Promise<Browser>;
  sessions: Map<string, { created: number; touched: number }>;
};
function advance(milliseconds: number) {
  for (const session of lifecycle.sessions.values()) {
    session.created -= milliseconds;
    session.touched -= milliseconds;
  }
}
const evidence: string[] = [];
function pass(message: string) { evidence.push(message); console.log(`PASS: ${message}`); }
function quoted(state: NativeState) {
  assert(state.quote, state.priceError);
  assert.deepEqual(state.diagnostics, []);
  return state;
}
// Observe the actual process and contexts without changing the production interface.
async function browser(): Promise<Browser> {
  assert(lifecycle.browser);
  return lifecycle.browser;
}
const expired = (error: unknown) => error instanceof NativeError && error.status === 410;
try {
  let state = quoted(await calculator.open("nat", "ap-southeast-1", "ONDEMAND"));
  const original = await browser();
  const amount = state.quote!.amount;
  advance(5 * 60_000 + 1);
  await calculator.sweep();
  assert(original.isConnected());
  assert.equal(original.contexts().length, 1);
  state = quoted(await calculator.refresh(state.session, state.revision));
  assert.equal(state.quote!.amount, amount);
  pass("An active session survives sweeping and refreshes correctly");

  const selection = state.selection;
  await calculator.remove(state.session);
  assert.equal(original.contexts().length, 0);
  await calculator.sweep();
  advance(6 * 60_000);
  await calculator.sweep();
  assert(original.isConnected());
  pass("An empty pool releases contexts while keeping Chromium warm");

  state = quoted(await calculator.restore(selection));
  const replacement = await browser();
  assert.equal(replacement, original);
  assert(replacement.isConnected());
  assert.deepEqual(state.selection, selection);
  assert.equal(state.quote!.amount, amount);
  pass("Saved selections replay and price correctly after common assets are released");

  advance(10 * 60_000 + 1);
  await assert.rejects(calculator.refresh(state.session, state.revision), expired);
  assert.equal(replacement.contexts().length, 0);
  pass("Expired save requests promptly release their browser context");

  state = quoted(await calculator.open("nat", "ap-southeast-1", "ONDEMAND"));
  const duration = state.fields.find(field => field.component === "global_ONDEMANDTIME" && field.type === "number")!;
  assert(duration);
  const action = { session: state.session, revision: state.revision, field: duration.id, value: 2 };
  const editing = calculator.act(action);
  advance(31 * 60_000);
  await assert.rejects(calculator.refresh(state.session, state.revision), expired);
  await assert.rejects(calculator.act(action), expired);
  await calculator.sweep();
  assert.equal(replacement.contexts().length, 1);
  state = quoted(await editing);
  assert.equal(state.quote!.amount, amount * 2);
  pass("Expiry checks and sweeping leave an in-flight edit intact");
  await assert.rejects(calculator.refresh(state.session, state.revision), expired);
  assert.equal(replacement.contexts().length, 0);
  pass("Finished expired work is cleaned up by the next save request");

  await assert.rejects(calculator.open("not-a-service", "ap-southeast-1"));
  assert.equal(replacement.contexts().length, 0);
  state = quoted(await calculator.open("nat", "ap-southeast-1", "ONDEMAND"));
  assert.equal(replacement.contexts().length, 1);
  await calculator.remove(state.session);
  pass("Rejected opens leak no contexts and do not prevent the next valid open");
  await calculator.close();
  assert(!replacement.isConnected());
  pass("Explicit shutdown closes the shared browser");
  await writeFile(`${output}/evidence.json`, JSON.stringify({ checkedAt: new Date().toISOString(), evidence }, null, 2));
} finally {
  await calculator.close();
  store.close();
}
