import { FORM_PROGRAM, INSPECT_PROGRAM } from "./program";
import { runIsolated } from "./sandbox";
import type { FormInput, FormState } from "./types";

export async function evaluateForm(source: string, products: unknown, input: FormInput, language: unknown = {}): Promise<FormState> {
  const form = await runIsolated<FormState>(source, FORM_PROGRAM, { ...input, products, language });
  if (!Array.isArray(form.fields) || !Array.isArray(form.diagnostics) || !form.values || !form.duration) throw new Error("Invalid form state");
  if (form.fields.length > 250) throw new Error("Too many form fields");
  for (const field of form.fields) {
    if (!field.id || !["select", "number"].includes(field.type)) throw new Error("Invalid form field");
  }
  return form;
}

export async function inspectConfig(source: string) {
  return runIsolated<{ components: { id: string; type: string }[]; callbacks: { path: string[]; source: string }[] }>(source, INSPECT_PROGRAM, {});
}
