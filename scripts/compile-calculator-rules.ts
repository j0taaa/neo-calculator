/** Upgrade a previously audited price catalog. Extraction and comparisons happen only in this worker. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SnapshotStore } from "../lib/huawei-snapshot/store";
import { auditFingerprint } from "../lib/huawei-snapshot/collect";
import { compileRules } from "../lib/calculator-rules/compile";
import { CalculatorEngine } from "../lib/calculator-rules/engine";
import { CalculatorOracle } from "../lib/calculator-rules/oracle";
import { assertIndependentState } from "../lib/calculator-rules/validate";

const store = new SnapshotStore(), original = await store.active();
const auditHash = await auditFingerprint(store), bridge = await readFile("public/calculator-snapshot-bridge.js", "utf8");
const bridgeHash = await store.blob(bridge);
const release = { ...original, auditHash, bridgeHash, assets: { ...original.assets, "neo:bridge": { hash: bridgeHash, type: "application/javascript", imports: [] } }, scopes: {} as Record<string, string>, diagnostics: [] as typeof original.diagnostics, engine: { kind: "neo-rules" as const, version: 1 as const, fingerprint: auditHash } };
const progressPath = join(store.root, "compilation-progress.json");
let completed: Record<string, string> = {}, previous: Record<string, string> = {};
try { const saved = JSON.parse(await readFile(progressPath, "utf8")); if (saved.source === original.id) { previous = saved.completed; if (saved.fingerprint === auditHash) completed = saved.completed; } } catch {}
const oracle = await CalculatorOracle.create(store), menu = JSON.parse(release.menu);
const fixtureRoot = join(store.root, "rule-fixtures"); await mkdir(fixtureRoot, { recursive: true });
const training = process.env.HUAWEI_RULE_REFERENCES ? (await readFile(process.env.HUAWEI_RULE_REFERENCES, "utf8")).trim().split("\n").map(line => JSON.parse(line).reference) : [];
const queue = Object.keys(original.scopes);
const concurrency = Math.max(1, Math.min(2, Number(process.env.HUAWEI_SYNC_CONCURRENCY ?? 2)));
let checkpoint = Promise.resolve();
let checked = 0;
try {
  async function worker() { for (let key; (key = queue.shift());) {
    const [service, region] = key.split("/");
    try {
      if (completed[key]) { const scope = await store.scope({ ...release, scopes: completed }, service, region, false); if (!scope.rules || !scope.rulesChecks) throw new Error("Invalid compilation checkpoint"); release.scopes[key] = completed[key]; continue; }
      const scope = await store.scope(original, service, region);
      let recorded = previous[key] ? (await store.scope({ ...release, scopes: previous }, service, region)).rulesReference ?? [] : scope.rulesReference ?? [];
      try { recorded = JSON.parse(await readFile(join(fixtureRoot, original.scopes[key] + ".json"), "utf8")); } catch {}
      scope.rules = JSON.parse(JSON.stringify(compileRules(scope.config))); scope.rulesChecks = 0; scope.defaults = {}; scope.emptyForms = {}; scope.rulesReference = [];
      const locations = [{ code: undefined as string | undefined, modes: scope.commonModes ?? scope.modes }, ...Object.entries(scope.locationModes ?? {}).map(([code, modes]) => ({ code, modes }))];
      for (const { code, modes } of locations) for (const mode of modes) {
        const cached = recorded.find(state => state.billingMode === mode && state.local?.pricing.selectedProduct.locationCode === code);
        // Older MRS evidence used ambiguous DOM IDs; refresh it with the corrected reader.
        const refresh = !cached || mode === "PERIOD" && !cached.ruleOrder || service === "mrs" && !cached.ruleOrder;
        const session = refresh ? await oracle.open(release, scope, mode, code) : undefined;
        try {
          const reference = session ? await session.action({ action: "open" }) : cached!, engine = new CalculatorEngine(scope.rules, scope, menu, original.id, mode);
          const index = recorded.indexOf(cached!); if (index >= 0) recorded[index] = reference; else recorded.push(reference);
          await writeFile(join(fixtureRoot, original.scopes[key] + ".json"), JSON.stringify(recorded));
          const defaults = engine.learnDefaults(reference);
          for (const evidence of training.filter(state => state.service === service && state.billingMode === mode && state.source.config === scope.source.config && state.ruleOrder)) defaults.global_PERIODORDER = engine.learnDependencyOrder(evidence);
          scope.defaults[`${mode}/${code ?? "common"}`] = defaults;
          const actual = reference.quote ? engine.restore(reference.selection) : engine.state;
          assertIndependentState(reference, actual); scope.rulesChecks++; checked++; scope.rulesReference.push(reference);
        } finally { await session?.close(); }
      }
      if (!scope.rulesChecks) throw new Error("No independently verified calculator modes");
      release.scopes[key] = completed[key] = await store.writeScope(scope);
      checkpoint = checkpoint.then(() => writeFile(progressPath, JSON.stringify({ source: original.id, fingerprint: auditHash, completed, errors: release.diagnostics, updatedAt: new Date().toISOString() })));
      await checkpoint;
      console.log(JSON.stringify({ scope: key, compiled: Object.keys(completed).length, total: Object.keys(original.scopes).length, checks: scope.rulesChecks }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      release.diagnostics.push({ service, region, error: message }); console.error(JSON.stringify({ scope: key, error: message }));
    }
  }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await writeFile(join(store.root, "compilation-audit.json"), JSON.stringify(release));
  if (await auditFingerprint(store) !== auditHash) throw new Error("Compiler changed during audit; the active snapshot was retained");
  if (release.diagnostics.length || Object.keys(release.scopes).length !== Object.keys(original.scopes).length) throw new Error("Full independent compilation failed; the active snapshot was retained");
  const id = await store.publish(release); console.log(JSON.stringify({ published: id, scopes: Object.keys(release.scopes).length, checks: checked }));
} finally { await oracle.close(); }
