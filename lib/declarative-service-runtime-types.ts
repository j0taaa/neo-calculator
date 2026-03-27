import type { ServiceDefinition } from "@/lib/service-config";

export type DefinitionExpression = string;

export type DeclarativeCatalogSource = {
  route: string;
  catalogPath?: string;
  regionIdPath?: string;
  errorPath?: string;
  loadingMessage?: string;
};

export type DeclarativeFieldRuntimeDefinition = {
  optionsExpression?: DefinitionExpression;
  minExpression?: DefinitionExpression;
  maxExpression?: DefinitionExpression;
  disabledExpression?: DefinitionExpression;
  normalizeExpression?: DefinitionExpression;
};

export type DeclarativeBatchPanelDefinition = {
  placeholderExpression: DefinitionExpression;
  descriptionExpression: DefinitionExpression;
  defaultsExpression: DefinitionExpression;
  validationExpression: DefinitionExpression;
};

export type DeclarativeEstimateRecord = {
  currency: string;
  amount: number;
  suffix: string;
  notes?: string[];
  breakdown?: Array<{ label: string; amount: number }>;
  monthlyAverageAmount?: number | null;
  [key: string]: unknown;
};

export type DeclarativeHydrationResult = {
  handled: boolean;
  error?: string;
  nextRegion?: string;
  nextBillingMode?: string;
  nextUsageHours?: string;
  nextInstanceCount?: string;
  values?: Record<string, string>;
};

export type DeclarativeRuntimeDefinition = {
  quantityLabel: string;
  showGlobalQuantityControl: boolean;
  usesSharedBillingHeader: boolean;
  catalog?: DeclarativeCatalogSource;
  catalogViewExpression?: DefinitionExpression;
  visibilityContextExpression?: DefinitionExpression;
  syncValuesExpression?: DefinitionExpression;
  activeBillingOptionsExpression?: DefinitionExpression;
  showSharedUsageHoursExpression?: DefinitionExpression;
  addToListErrorExpression?: DefinitionExpression;
  estimateExpression?: DefinitionExpression;
  panelNotesExpression?: DefinitionExpression;
  selectionSummaryExpression?: DefinitionExpression;
  selectionNotesExpression?: DefinitionExpression;
  referenceNoteExpression?: DefinitionExpression;
  addSuccessMessageExpression?: DefinitionExpression;
  updateSuccessMessageExpression?: DefinitionExpression;
  batchSuccessMessageExpression?: DefinitionExpression;
  buildRequestBodiesExpression?: DefinitionExpression;
  buildBatchRequestBodiesExpression?: DefinitionExpression;
  hydrateExpression?: DefinitionExpression;
  fieldRuntime?: Record<string, DeclarativeFieldRuntimeDefinition>;
  batchPanel?: DeclarativeBatchPanelDefinition;
};

export type DeclarativeServiceRuntimeBundle = {
  definition: ServiceDefinition;
  runtime: DeclarativeRuntimeDefinition;
};
