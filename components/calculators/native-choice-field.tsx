"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Use the same styled dropdown for service, region and official form choices. */
export function NativeChoiceField({ label, value, options, disabled, onChange, fieldId, compact = false, selectedLabel }: {
  label: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  onChange: (value: string) => void;
  fieldId?: string;
  compact?: boolean;
  selectedLabel?: string;
}) {
  return <Select value={value} disabled={disabled} onValueChange={next => { if (next !== null) onChange(next); }}>
    <SelectTrigger aria-label={label} data-value={value} data-field-id={fieldId}
      data-calculator-focus-target className={compact ? "w-full min-w-0 data-[size=default]:h-7 border-transparent bg-transparent pl-0 text-xs text-zinc-500" : "w-full min-w-0 bg-white"}>
      <SelectValue className="block min-w-0 truncate">{selectedLabel ?? options.find(option => option.value === value)?.label ?? "Not available for this configuration"}</SelectValue>
    </SelectTrigger>
    <SelectContent alignItemWithTrigger={false}>
      {options.map(option => <SelectItem key={option.value} value={option.value} data-value={option.value} disabled={option.disabled}
        className="whitespace-normal break-words [&>span]:min-w-0 [&>span]:shrink [&>span]:whitespace-normal">{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
