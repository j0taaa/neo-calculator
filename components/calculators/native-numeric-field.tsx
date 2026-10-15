"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { NativeField } from "@/lib/huawei-native/native-types";
export function NativeNumericField({
  field,
  revision,
  change,
  invalidate,
}: {
  field: NativeField;
  revision: number;
  change: (value: number) => void;
  invalidate: () => void;
}) {
  const [draft, setDraft] = useState({ text: String(field.value), error: "", revision, pendingValue: null as number | null });
  if (draft.revision !== revision) {
    // Preserve the user's text for our own update, including leading zeros.
    // Other configuration changes can reset a value or change its limits.
    setDraft({ text: draft.pendingValue === field.value ? draft.text : String(field.value), error: "", revision, pendingValue: null });
  }
  const validationError = (text: string) => {
    const value = Number(text);
    if (field.component === "global_QUANTITY" && !Number.isSafeInteger(value)) {
      return "Enter a whole purchase quantity.";
    }
    if (
      !text.trim() ||
      !Number.isFinite(value) ||
      (field.min !== undefined && value < field.min) ||
      (field.max !== undefined && value > field.max)
    ) {
      return `Enter a value from ${field.min ?? "the minimum"} to ${field.max ?? "the maximum"}.`;
    }
    return "";
  };
  return (
    <>
      <Input
        aria-invalid={!!draft.error}
        data-field-id={field.id}
        aria-label={field.label}
        type="number"
        disabled={field.disabled}
        min={field.min}
        max={field.max}
        step="any"
        value={draft.text}
        onChange={(event) => {
          const text = event.target.value;
          const invalid = !!validationError(text);
          setDraft({ text, error: "", revision, pendingValue: invalid ? null : Number(text) });
          if (invalid) invalidate();
          else {
            change(Number(text));
          }
        }}
        onBlur={() => setDraft(previous => ({ ...previous, error: validationError(previous.text) }))}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {draft.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {draft.error}
        </p>
      )}
    </>
  );
}
