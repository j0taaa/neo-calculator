"use client";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { NativeField } from "@/lib/huawei-native/native-types";
export function NativeNumericField({
  field,
  change,
  invalidate,
}: {
  field: NativeField;
  change: (value: number) => void;
  invalidate: () => void;
}) {
  const [draft, setDraft] = useState(String(field.value));
  const [error, setError] = useState("");
  const dirty = useRef(false);
  const submit = () => {
    if (!dirty.current) return;
    const value = Number(draft);
    if (field.component === "global_QUANTITY" && !Number.isSafeInteger(value)) {
      setError("Enter a whole purchase quantity."); return;
    }
    if (
      !draft.trim() ||
      !Number.isFinite(value) ||
      (field.min !== undefined && value < field.min) ||
      (field.max !== undefined && value > field.max)
    ) {
      setError(`Enter a value from ${field.min ?? "the minimum"} to ${field.max ?? "the maximum"}.`);
      return;
    }
    setError("");
    change(value);
  };
  return (
    <>
      <Input
        aria-invalid={!!error}
        data-field-id={field.id}
        aria-label={field.label}
        type="number"
        disabled={field.disabled}
        min={field.min}
        max={field.max}
        step="any"
        value={draft}
        onChange={(event) => {
          dirty.current = true;
          setDraft(event.target.value);
          invalidate();
        }}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
