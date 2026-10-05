import type { NativeField, NativeForm } from "./native-types";
import { isNativeBillingMode, type NativeBillingMode } from "./native-billing";

export type NativeSelectionField = Pick<NativeField, "id" | "component" | "label" | "type" | "value"> & {
  optionLabel?: string;
};
export type NativeSelection = {
  service: string;
  region: string;
  initial: NativeSelectionField[];
  steps: { before: NativeSelectionField; value: string | number | boolean; optionLabel?: string }[];
  fields: NativeSelectionField[];
} & ({ version: 1; billingMode?: never } | { version: 2; billingMode: NativeBillingMode });

export const selectionBillingMode = (selection: NativeSelection): NativeBillingMode => selection.billingMode ?? "ONDEMAND";

export function selectionField(field: NativeField): NativeSelectionField {
  return {
    id: field.id,
    component: field.component,
    label: field.label,
    type: field.type,
    value: field.value,
    ...(field.type === "select"
      ? { optionLabel: field.options?.find((option) => option.value === String(field.value))?.label }
      : {}),
  };
}
export function selectionFields(form: NativeForm) {
  return form.fields.map(selectionField);
}
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, ordered(v)]),
    );
  return value;
}
export function sameSelection(a: unknown, b: unknown) {
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
}
export function parseNativeSelection(value: unknown): NativeSelection {
  if (!value || typeof value !== "object") throw new Error("Missing saved Huawei configuration");
  const selection = value as NativeSelection;
  if (
    ![1, 2].includes(selection.version) ||
    (selection.version === 2 && !isNativeBillingMode(selection.billingMode)) ||
    (selection.version === 1 && selection.billingMode !== undefined) ||
    typeof selection.service !== "string" ||
    typeof selection.region !== "string" ||
    !Array.isArray(selection.initial) ||
    !Array.isArray(selection.fields) ||
    !Array.isArray(selection.steps) ||
    selection.steps.length > 200 ||
    JSON.stringify(value).length > 100000
  )
    throw new Error("Invalid saved Huawei configuration");
  for (const field of [...selection.initial, ...selection.fields, ...selection.steps.map((step) => step.before)]) {
    if (
      !field ||
      typeof field.id !== "string" ||
      typeof field.label !== "string" ||
      typeof field.component !== "string" ||
      !["select", "number", "checkbox", "action"].includes(field.type) ||
      !["string", "number", "boolean"].includes(typeof field.value)
    )
      throw new Error("Invalid saved Huawei control");
  }
  return selection;
}
