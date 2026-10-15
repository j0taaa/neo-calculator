import { parseNativeSelection, selectionBillingMode } from "../huawei-native/native-selection";
import type { NativeDirectory, NativeState } from "../huawei-native/native-types";
import type { ScopeSnapshot } from "./types";
import { CalculatorEngine } from "../calculator-rules/engine";
import { isNativeBillingMode } from "../huawei-native/native-billing";

type Directory = NativeDirectory & { releaseId: string; scopes: Record<string, string>; engine?: { kind: string } };
type Model = { release: string; scope: ScopeSnapshot; menu: unknown };
const sessions = new Map<string, CalculatorEngine>();
const operations = new Map<string, AbortController>();
const models = new Map<string, Promise<Model>>();
let directory: Directory | undefined;
export function setLocalDirectory(value: Directory) { directory = value; }
const abortError = () => new DOMException("Calculation cancelled", "AbortError");
export function closeLocalSession(token: string) { sessions.delete(token); }
export function cancelLocalOperation(id: string) { operations.get(id)?.abort(); operations.delete(id); }
async function loadModel(service: string, region: string, signal?: AbortSignal): Promise<Model> {
  if (!directory) {
    const response = await fetch("/api/calculator/native", { signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "The daily calculator snapshot is unavailable");
    directory = body;
  }
  if (directory!.engine?.kind !== "neo-rules") throw new Error("An independently validated calculator snapshot is not available yet");
  const hash = directory!.scopes[`${service}/${region}`];
  if (!hash) throw new Error("This service is unavailable in the selected region");
  const key = `${directory!.releaseId}/${hash}`;
  let pending = models.get(key);
  if (!pending) {
    pending = fetch(`/api/calculator/snapshot/${directory!.releaseId}/model/${hash}`).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The synchronized calculator model is unavailable");
      return body as Model;
    });
    models.set(key, pending);
    pending.catch(() => models.delete(key));
  }
  const model = await pending;
  if (signal?.aborted) throw abortError();
  return model;
}
/** Only opening a scope loads data. Every option change and price calculation is pure local work. */
export async function localRequest(body: Record<string, unknown>, signal?: AbortSignal): Promise<NativeState> {
  if (signal?.aborted) throw abortError();
  if (body.action === "open" || body.action === "restore") {
    const saved = body.action === "restore" ? parseNativeSelection(body.selection) : undefined;
    const service = saved?.service ?? String(body.service), region = saved?.region ?? String(body.region);
    const mode = saved ? selectionBillingMode(saved) : body.billingMode;
    if (!isNativeBillingMode(mode)) throw new Error("Invalid calculator billing mode");
    const controller = new AbortController(), id = typeof body.operationId === "string" ? body.operationId : crypto.randomUUID();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true }); operations.set(id, controller);
    try {
      const model = await loadModel(service, region, controller.signal);
      if (signal?.aborted || controller.signal.aborted) throw abortError();
      if (!model.scope.rules) throw new Error("Missing independently compiled calculator rules");
      const engine = new CalculatorEngine(model.scope.rules, model.scope, model.menu, model.release, mode);
      const state = saved ? engine.restore(saved) : engine.evaluate();
      sessions.set(engine.token, engine); return state;
    } finally { operations.delete(id); signal?.removeEventListener("abort", abort); }
  }
  const engine = sessions.get(String(body.session));
  if (!engine) throw new Error("Reopen this calculator configuration");
  if (body.revision !== engine.state.revision) throw new Error("The calculator configuration changed");
  if (body.action === "refresh") return engine.evaluate();
  if (body.action !== "change" || typeof body.field !== "string" || !["string", "number", "boolean"].includes(typeof body.value)) throw new Error("Invalid calculator operation");
  return engine.change(body.field, body.value as string | number | boolean);
}
