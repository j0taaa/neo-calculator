import type { ComponentProps } from "react";

import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";
import {
  isServiceFieldVisible,
  type ServiceDefinition,
  type ServiceFieldRuntimeValues,
} from "@/lib/service-config";

export type ConfigurableFieldList = ComponentProps<typeof ConfigurableServicePanel>["fields"];

type SelectOption = NonNullable<ConfigurableFieldList[number]["options"]>[number];

type BuildConfiguredFieldsInput = {
  enabled: boolean;
  definition: ServiceDefinition | null;
  runtimeValues?: ServiceFieldRuntimeValues;
  values: Record<string, string>;
  optionsByFieldId?: Record<string, SelectOption[] | undefined>;
  minByFieldId?: Record<string, number | undefined>;
  maxByFieldId?: Record<string, number | undefined>;
  disabledByFieldId?: Record<string, boolean | undefined>;
  onChangeByFieldId: Record<string, (value: string) => void>;
  onBlurByFieldId?: Record<string, (() => void) | undefined>;
  onStepByFieldId?: Record<string, ((delta: number) => void) | undefined>;
};

export function buildConfiguredFields({
  enabled,
  definition,
  runtimeValues = {},
  values,
  optionsByFieldId = {},
  minByFieldId = {},
  maxByFieldId = {},
  disabledByFieldId = {},
  onChangeByFieldId,
  onBlurByFieldId = {},
  onStepByFieldId = {},
}: BuildConfiguredFieldsInput): ConfigurableFieldList {
  if (!enabled || !definition) {
    return [];
  }

  return definition.fields
    .filter((field) => isServiceFieldVisible(field, runtimeValues))
    .map((field) => ({
      definition: field,
      value: values[field.id] ?? "",
      options: optionsByFieldId[field.id],
      min: minByFieldId[field.id] ?? field.min,
      max: maxByFieldId[field.id] ?? field.max,
      disabled: disabledByFieldId[field.id] ?? false,
      onChange: onChangeByFieldId[field.id] ?? (() => {}),
      onBlur: field.type === "number" ? onBlurByFieldId[field.id] : undefined,
      onStep: field.type === "number" ? onStepByFieldId[field.id] : undefined,
    }));
}
