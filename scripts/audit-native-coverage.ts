/** Check that consolidation preserves access to each existing calculator's official form. */
import { serviceCatalog, supportedCalculatorServiceCodes, freeAlwaysServiceCodes } from "../lib/service-config";
import { huaweiServiceId } from "../lib/calculator/service-directory";
import { nativeRequest } from "../lib/huawei-native/native-client";
import type { NativeDirectory, NativeState } from "../lib/huawei-native/native-types";
import { writeFile } from "node:fs/promises";
const directory = await nativeRequest<NativeDirectory>();
const seen = new Set<string>();
const evidence: unknown[] = [];
const started = Date.now();
const requested = process.env.NATIVE_COVERAGE_SERVICES?.split(",");
for (const entry of serviceCatalog.filter(service => supportedCalculatorServiceCodes.includes(service.code) && !freeAlwaysServiceCodes.includes(service.code))) {
  const service = huaweiServiceId(entry.code);
  if (requested && !requested.includes(service)) continue;
  if (seen.has(service)) continue;
  seen.add(service);
  const published = directory.services.some(candidate => candidate.id === service);
  if (!published) { evidence.push({ service, result: "compatibility", reason: "No official calculator" }); continue; }
  const regions = ["sa-brazil-1", "ap-southeast-1", "ap-southeast-3", ...directory.regions.map(region => region.id)];
  const region = regions.find(region => directory.billingModes[service]?.[region]?.length);
  if (!region) { evidence.push({ service, result: "unavailable", reason: "No eligible region" }); continue; }
  const modes = directory.billingModes[service][region];
  const billingMode = modes.includes("ONDEMAND") ? "ONDEMAND" : modes[0];
  let state: NativeState | undefined;
  try {
    state = await nativeRequest<NativeState>({ action: "open", service, region, billingMode });
    const result = { service, region, billingMode, result: state.quote && !state.diagnostics.length ? "pass" : "blocked",
      amount: state.quote?.amount, diagnostics: state.diagnostics, priceError: state.priceError, fields: state.fields.length };
    evidence.push(result); console.log(JSON.stringify(result));
  } catch (error) { const result = { service, region, billingMode, result: "error", error: error instanceof Error ? error.message : String(error) }; evidence.push(result); console.log(JSON.stringify(result)); }
  finally { if (state) await nativeRequest({ action: "close", session: state.session }); }
  await writeFile(process.env.NATIVE_COVERAGE_FILE ?? "/tmp/neo-native-coverage.json", JSON.stringify({ elapsedSeconds: (Date.now() - started) / 1000, evidence }, null, 2));
}
const blocked = evidence.filter(value => ["blocked", "error"].includes((value as { result: string }).result));
console.log(`Checked ${evidence.length} services; ${blocked.length} need attention`);
if (blocked.length) process.exitCode = 1;
