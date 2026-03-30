import type {
  DeclarativeBatchPanelDefinition,
  DeclarativeFieldRuntimeDefinition,
  DeclarativeRuntimeDefinition,
} from "@/lib/declarative-service-runtime-types";
import { call, ref } from "@/lib/typed-declarative-runtime-ops";
import type {
  TypedDeclarativeBatchPanelDefinition,
  TypedDeclarativeFieldRuntimeDefinition,
  TypedDeclarativeRuntimeDefinition,
  TypedDeclarativeValue,
} from "@/lib/typed-declarative-runtime-types";

function buildLegacyScopeValue(): TypedDeclarativeValue {
  return {
    definition: ref("definition"),
    selectedServiceCode: ref("selectedServiceCode"),
    selectedService: ref("selectedService"),
    values: ref("values"),
    catalog: ref("catalog"),
    catalogRegionId: ref("catalogRegionId"),
    pricingError: ref("pricingError"),
    regionValue: ref("regionValue"),
    billingMode: ref("billingMode"),
    usageHours: ref("usageHours"),
    usageHoursValue: ref("usageHoursValue"),
    instanceCountValue: ref("instanceCountValue"),
    item: ref("item"),
    product: ref("product"),
    catalogView: ref("derived"),
    derived: ref("derived"),
    estimate: ref("estimate"),
    requestBodiesCount: ref("requestBodiesCount"),
    extraRequestBodiesCount: ref("extraRequestBodiesCount"),
    createdCount: ref("createdCount"),
    expandedCount: ref("expandedCount"),
    huaweiRegions: ref("huaweiRegions"),
  };
}

function wrapLegacyExpression(expression: string | undefined) {
  if (!expression?.trim()) {
    return undefined;
  }

  return call("runLegacyDefinitionExpression", expression, buildLegacyScopeValue());
}

function wrapLegacyFieldRuntimeDefinition(
  definition: DeclarativeFieldRuntimeDefinition | undefined,
): TypedDeclarativeFieldRuntimeDefinition | undefined {
  if (!definition) {
    return undefined;
  }

  return {
    options: wrapLegacyExpression(definition.optionsExpression),
    min: wrapLegacyExpression(definition.minExpression),
    max: wrapLegacyExpression(definition.maxExpression),
    disabled: wrapLegacyExpression(definition.disabledExpression),
    normalize: wrapLegacyExpression(definition.normalizeExpression),
  };
}

function wrapLegacyBatchPanelDefinition(
  definition: DeclarativeBatchPanelDefinition | undefined,
): TypedDeclarativeBatchPanelDefinition | undefined {
  if (!definition) {
    return undefined;
  }

  return {
    placeholder: wrapLegacyExpression(definition.placeholderExpression) ?? "",
    description: wrapLegacyExpression(definition.descriptionExpression) ?? "",
    defaults: wrapLegacyExpression(definition.defaultsExpression) ?? "",
    validation: wrapLegacyExpression(definition.validationExpression) ?? "",
  };
}

export function convertLegacyRuntimeDefinition(
  definition: DeclarativeRuntimeDefinition,
): TypedDeclarativeRuntimeDefinition {
  return {
    quantityLabel: definition.quantityLabel,
    showGlobalQuantityControl: definition.showGlobalQuantityControl,
    usesSharedBillingHeader: definition.usesSharedBillingHeader,
    catalog: definition.catalog,
    catalogView: wrapLegacyExpression(definition.catalogViewExpression),
    syncValues: wrapLegacyExpression(definition.syncValuesExpression),
    activeBillingOptions: wrapLegacyExpression(definition.activeBillingOptionsExpression),
    showSharedUsageHours: wrapLegacyExpression(definition.showSharedUsageHoursExpression),
    visibilityContext: wrapLegacyExpression(definition.visibilityContextExpression),
    addToListError: wrapLegacyExpression(definition.addToListErrorExpression),
    estimate: wrapLegacyExpression(definition.estimateExpression),
    panelNotes: wrapLegacyExpression(definition.panelNotesExpression),
    selectionSummary: wrapLegacyExpression(definition.selectionSummaryExpression),
    selectionNotes: wrapLegacyExpression(definition.selectionNotesExpression),
    referenceNote: wrapLegacyExpression(definition.referenceNoteExpression),
    addSuccessMessage: wrapLegacyExpression(definition.addSuccessMessageExpression),
    updateSuccessMessage: wrapLegacyExpression(definition.updateSuccessMessageExpression),
    batchSuccessMessage: wrapLegacyExpression(definition.batchSuccessMessageExpression),
    buildRequestBodies: wrapLegacyExpression(definition.buildRequestBodiesExpression),
    buildBatchRequestBodies: wrapLegacyExpression(definition.buildBatchRequestBodiesExpression),
    hydrate: wrapLegacyExpression(definition.hydrateExpression),
    fieldRuntime: Object.fromEntries(
      Object.entries(definition.fieldRuntime ?? {})
        .map(([key, value]) => [key, wrapLegacyFieldRuntimeDefinition(value)])
        .filter(([, value]) => value != null),
    ),
    batchPanel: wrapLegacyBatchPanelDefinition(definition.batchPanel),
  };
}
