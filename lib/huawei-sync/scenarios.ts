import { evaluateForm } from "./engine";
import { canonical } from "./store";
import type { FormInput, FormState } from "./types";

export type Scenario = { input: FormInput; form: FormState };

/** Enumerate reachable selector states; refuse promotion when the declared budget is insufficient. */
export async function enumerateScenarios(source: string, products: unknown, region: string, limit = 128, timeBudgetMs = 30_000): Promise<Scenario[]> {
  const deadline = performance.now() + timeBudgetMs;
  let evaluations = 0;
  const queue: FormInput[] = [{ region, values: {} }];
  const seen = new Set<string>();
  const queued = new Set<string>();
  const result: Scenario[] = [];
  while (queue.length) {
    if (performance.now() >= deadline) throw new Error("Coverage time budget exceeded; scope requires targeted scenario generation");
    if (++evaluations > limit * 4) throw new Error("Coverage evaluation budget exceeded; scope requires targeted scenario generation");
    const input = queue.shift()!;
    const form = await evaluateForm(source, products, input);
    if (form.diagnostics.length || !form.inquiry) throw new Error(form.diagnostics.join("; ") || "No quote mapping");
    const key = canonical(form.values);
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > limit) throw new Error(`Coverage budget exceeded (${limit} reachable states)`);
    result.push({ input: { ...input, values: form.values }, form });
    for (const field of form.fields) {
      const choices = field.type === "number" ? [...new Set([field.value, field.min ?? 1, Math.min(field.max ?? 9999, (field.min ?? 1) + (field.step ?? 1)), field.max ?? 9999])] : (field.options ?? []).map(option => option.value);
      for (const choice of choices) {
        const values = { ...form.values, [field.id]: choice };
        const candidate = canonical(values);
        if (!queued.has(candidate)) { queued.add(candidate); queue.push({ region, values }); }
      }
    }
  }
  return result;
}
