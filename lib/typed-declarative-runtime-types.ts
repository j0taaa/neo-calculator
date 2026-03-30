import type { DeclarativeCatalogSource } from "@/lib/declarative-service-runtime-types";

export type TypedDeclarativePrimitive = string | number | boolean | null;

export type TypedDeclarativeValue =
  | TypedDeclarativePrimitive
  | TypedDeclarativeOperation
  | TypedDeclarativeValue[]
  | { [key: string]: TypedDeclarativeValue | undefined };

export type TypedDeclarativeOperation =
  | { op: "ref"; path: string }
  | { op: "call"; helper: string; args?: TypedDeclarativeValue[] }
  | { op: "if"; condition: TypedDeclarativeValue; then: TypedDeclarativeValue; else?: TypedDeclarativeValue }
  | { op: "coalesce"; values: TypedDeclarativeValue[] }
  | { op: "eq"; left: TypedDeclarativeValue; right: TypedDeclarativeValue }
  | { op: "ne"; left: TypedDeclarativeValue; right: TypedDeclarativeValue }
  | { op: "in"; value: TypedDeclarativeValue; values: TypedDeclarativeValue }
  | { op: "and"; values: TypedDeclarativeValue[] }
  | { op: "or"; values: TypedDeclarativeValue[] }
  | { op: "not"; value: TypedDeclarativeValue }
  | { op: "lt"; left: TypedDeclarativeValue; right: TypedDeclarativeValue }
  | { op: "lte"; left: TypedDeclarativeValue; right: TypedDeclarativeValue }
  | { op: "gt"; left: TypedDeclarativeValue; right: TypedDeclarativeValue }
  | { op: "gte"; left: TypedDeclarativeValue; right: TypedDeclarativeValue }
  | { op: "min"; values: TypedDeclarativeValue[] }
  | { op: "max"; values: TypedDeclarativeValue[] }
  | { op: "floor"; value: TypedDeclarativeValue }
  | { op: "template"; template: string; values?: Record<string, TypedDeclarativeValue> };

export type TypedDeclarativeDerivedValue = {
  key: string;
  value: TypedDeclarativeValue;
};

export type TypedDeclarativeFieldRuntimeDefinition = {
  options?: TypedDeclarativeValue;
  min?: TypedDeclarativeValue;
  max?: TypedDeclarativeValue;
  disabled?: TypedDeclarativeValue;
  normalize?: TypedDeclarativeValue;
};

export type TypedDeclarativeBatchPanelDefinition = {
  placeholder: TypedDeclarativeValue;
  description: TypedDeclarativeValue;
  defaults: TypedDeclarativeValue;
  validation: TypedDeclarativeValue;
};

export type TypedDeclarativeRuntimeDefinition = {
  quantityLabel: string;
  showGlobalQuantityControl: boolean;
  usesSharedBillingHeader: boolean;
  catalog?: DeclarativeCatalogSource;
  catalogView?: TypedDeclarativeValue;
  derived?: TypedDeclarativeDerivedValue[];
  syncValues?: TypedDeclarativeValue;
  activeBillingOptions?: TypedDeclarativeValue;
  showSharedUsageHours?: TypedDeclarativeValue;
  visibilityContext?: TypedDeclarativeValue;
  addToListError?: TypedDeclarativeValue;
  estimate?: TypedDeclarativeValue;
  panelNotes?: TypedDeclarativeValue;
  selectionSummary?: TypedDeclarativeValue;
  selectionNotes?: TypedDeclarativeValue;
  referenceNote?: TypedDeclarativeValue;
  addSuccessMessage?: TypedDeclarativeValue;
  updateSuccessMessage?: TypedDeclarativeValue;
  batchSuccessMessage?: TypedDeclarativeValue;
  buildRequestBodies?: TypedDeclarativeValue;
  buildBatchRequestBodies?: TypedDeclarativeValue;
  hydrate?: TypedDeclarativeValue;
  fieldRuntime?: Record<string, TypedDeclarativeFieldRuntimeDefinition>;
  batchPanel?: TypedDeclarativeBatchPanelDefinition;
};
