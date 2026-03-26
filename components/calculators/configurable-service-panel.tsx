"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ServiceDefinition, type ServiceFieldDefinition } from "@/lib/service-config";

type ConfigurableServicePanelField = {
  definition: ServiceFieldDefinition;
  value: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onStep?: (delta: number) => void;
};

type ConfigurableServicePanelProps = {
  definition: ServiceDefinition;
  fields: ConfigurableServicePanelField[];
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  notes: string[];
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote?: string;
};

function sanitizeNumberInput(value: string, inputMode: ServiceFieldDefinition["inputMode"]) {
  if (inputMode === "decimal") {
    const normalized = value.replace(/[^\d.]/g, "");
    const [whole, ...fractionParts] = normalized.split(".");
    if (fractionParts.length === 0) {
      return normalized;
    }

    return `${whole}.${fractionParts.join("")}`;
  }

  return value.replace(/[^\d]/g, "");
}

function getFieldHint(field: ConfigurableServicePanelField) {
  const parts: string[] = [];

  if (field.min != null && field.max != null) {
    parts.push(`${field.min}-${field.max}${field.definition.unit ? ` ${field.definition.unit}` : ""}`);
  } else if (field.min != null) {
    parts.push(`Minimum ${field.min}${field.definition.unit ? ` ${field.definition.unit}` : ""}`);
  } else if (field.max != null) {
    parts.push(`Maximum ${field.max}${field.definition.unit ? ` ${field.definition.unit}` : ""}`);
  }

  if (field.definition.description) {
    parts.push(field.definition.description);
  }

  return parts.join(". ");
}

export function ConfigurableServicePanel({
  definition,
  fields,
  pricingError,
  pricingLoadingMessage,
  notes,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: ConfigurableServicePanelProps) {
  return (
    <>
      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium">{definition.serviceName}</p>
          <p className="mt-1 text-sm text-zinc-500">Rendered from the JSON service definition for this calculator.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => {
            const hint = getFieldHint(field);

            return (
              <div key={field.definition.id} className="space-y-2">
                <p className="text-sm font-medium">{field.definition.label}</p>
                {field.definition.type === "select" ? (
                  <Select
                    value={field.value}
                    disabled={field.disabled}
                    onValueChange={(value) => {
                      if (value) {
                        field.onChange(value);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>{field.options?.find((option) => option.value === field.value)?.label ?? field.value}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 rounded-none px-3"
                        onClick={() => field.onStep?.(-(field.definition.step ?? 1))}
                        disabled={!field.onStep}
                      >
                        -
                      </Button>
                      <Input
                        value={field.value}
                        onChange={(event) => field.onChange(sanitizeNumberInput(event.target.value, field.definition.inputMode))}
                        onBlur={field.onBlur}
                        inputMode={field.definition.inputMode ?? "numeric"}
                        placeholder={field.min != null && field.max != null ? `${field.min}-${field.max}` : undefined}
                        className="h-11 w-24 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                        disabled={field.disabled}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 rounded-none px-3"
                        onClick={() => field.onStep?.(field.definition.step ?? 1)}
                        disabled={!field.onStep}
                      >
                        +
                      </Button>
                    </div>
                    {field.definition.unit ? <span className="text-sm font-medium text-zinc-500">{field.definition.unit}</span> : null}
                  </div>
                )}
                {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
              </div>
            );
          })}
        </div>

        {pricingError ? <p className="text-sm text-red-600">{pricingError}</p> : null}
        {pricingLoadingMessage ? <p className="text-sm text-zinc-500">{pricingLoadingMessage}</p> : null}
        {notes.map((note) => (
          <p key={note} className="text-sm text-zinc-500">
            {note}
          </p>
        ))}
      </section>

      <div className="rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-600">
        {selectionSummary}
        {selectionNotes.map((note) => (
          <p key={note} className="mt-2 text-xs text-zinc-500">
            {note}
          </p>
        ))}
      </div>

      {referenceNote ? <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">{referenceNote}</div> : null}
    </>
  );
}
