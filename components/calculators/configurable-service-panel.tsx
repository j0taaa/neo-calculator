"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type GroupedPanelField =
  | { kind: "single"; field: ConfigurableServicePanelField }
  | { kind: "number-with-unit-select"; field: ConfigurableServicePanelField; unitField: ConfigurableServicePanelField };

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

function matchesUnitFieldPair(field: ConfigurableServicePanelField, unitField: ConfigurableServicePanelField) {
  if (field.definition.type !== "number" || unitField.definition.type !== "select") {
    return false;
  }

  const candidates = [
    field.definition.id.replace(/Amount$/, "Unit"),
    `${field.definition.id}Unit`,
  ];

  return candidates.includes(unitField.definition.id);
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
  const groupedFields: GroupedPanelField[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const nextField = fields[index + 1];

    if (nextField && matchesUnitFieldPair(field, nextField)) {
      groupedFields.push({ kind: "number-with-unit-select", field, unitField: nextField });
      index += 1;
      continue;
    }

    groupedFields.push({ kind: "single", field });
  }

  return (
    <>
      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium">{definition.serviceName}</p>
          <p className="mt-1 text-sm text-zinc-500">Rendered from the JSON service definition for this calculator.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {groupedFields.map((group) => {
            const field = group.field;
            const hint = getFieldHint(field);

            return (
              <div key={field.definition.id} className={field.definition.type === "checkbox" ? "space-y-2 md:col-span-2" : "space-y-2"}>
                {field.definition.type === "checkbox" ? (
                  <label className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700">
                    <Checkbox
                      checked={field.value === "true"}
                      disabled={field.disabled}
                      onCheckedChange={(checked) => field.onChange(checked === true ? "true" : "false")}
                    />
                    <span className="space-y-1">
                      <span className="block font-medium text-zinc-900">{field.definition.label}</span>
                      {hint ? <span className="block text-xs text-zinc-500">{hint}</span> : null}
                    </span>
                  </label>
                ) : (
                  <>
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
                          {group.kind === "number-with-unit-select" ? (
                            <Select
                              value={group.unitField.value}
                              disabled={group.unitField.disabled}
                              onValueChange={(value) => {
                                if (value) {
                                  group.unitField.onChange(value);
                                }
                              }}
                            >
                              <SelectTrigger className="h-11 w-[92px] rounded-none border-0 border-l border-zinc-200 bg-white shadow-none focus:ring-0">
                                <SelectValue>
                                  {group.unitField.options?.find((option) => option.value === group.unitField.value)?.label ?? group.unitField.value}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {(group.unitField.options ?? []).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </div>
                        {group.kind === "single" && field.definition.unit ? <span className="text-sm font-medium text-zinc-500">{field.definition.unit}</span> : null}
                      </div>
                    )}
                    {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
                  </>
                )}
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
