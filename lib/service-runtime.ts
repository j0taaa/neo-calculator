import { declarativeRuntimeHelpers } from "@/lib/declarative-runtime-helpers";
import { evaluateDeclarativeDerivedValues, evaluateDeclarativeValue } from "@/lib/declarative-runtime-evaluator";
import type { DeclarativeEstimateRecord } from "@/lib/declarative-service-runtime-types";
import type { TypedDeclarativeRuntimeDefinition, TypedDeclarativeValue } from "@/lib/typed-declarative-runtime-types";
import type { ServiceDefinition, BillingOption } from "@/lib/service-config-types";
import type { AppProduct } from "@/lib/calculator-types";
import { huaweiRegions } from "@/lib/huawei-regions";

export function stringifyConfigValue(value: unknown) {
  if (value == null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}


export function buildDefaultValues(definition: ServiceDefinition) {
  return Object.fromEntries(
    definition.fields.map((field) => [field.id, stringifyConfigValue(definition.defaults[field.id])]),
  ) as Record<string, string>;
}


export function buildRuntimeScope(input: {
  definition: ServiceDefinition;
  selectedServiceCode: string;
  selectedService: string;
  values: Record<string, string>;
  catalog: unknown;
  catalogRegionId: string | null;
  pricingError: string;
  regionValue: string;
  billingMode: BillingOption;
  usageHours: string;
  usageHoursValue: number;
  instanceCountValue: number;
  item?: unknown;
  product?: AppProduct;
  catalogView?: unknown;
  estimate?: DeclarativeEstimateRecord | null;
  requestBodiesCount?: number;
  extraRequestBodiesCount?: number;
  createdCount?: number;
  expandedCount?: number;
  derived?: unknown;
}) {
  const runtimeDerived = input.derived ?? input.catalogView ?? null;

  return {
    helpers: declarativeRuntimeHelpers,
    definition: input.definition,
    selectedServiceCode: input.selectedServiceCode,
    selectedService: input.selectedService,
    values: input.values,
    catalog: input.catalog,
    catalogRegionId: input.catalogRegionId,
    pricingError: input.pricingError,
    regionValue: input.regionValue,
    billingMode: input.billingMode,
    usageHours: input.usageHours,
    usageHoursValue: input.usageHoursValue,
    instanceCountValue: input.instanceCountValue,
    item: input.item,
    product: input.product,
    catalogView: runtimeDerived,
    derived: runtimeDerived,
    estimate: input.estimate,
    requestBodiesCount: input.requestBodiesCount,
    extraRequestBodiesCount: input.extraRequestBodiesCount,
    createdCount: input.createdCount,
    expandedCount: input.expandedCount,
    huaweiRegions,
  };
}


export function evaluateRuntimeValue<T>(value: TypedDeclarativeValue | undefined, scope: Record<string, unknown> | null): T | null {
  return value === undefined || !scope ? null : evaluateDeclarativeValue<T>(value, scope);
}

export function evaluateCatalogView(runtime: TypedDeclarativeRuntimeDefinition | null, scope: Record<string, unknown>) {
  if (!runtime) return null;
  return runtime.catalogView
    ? evaluateDeclarativeValue(runtime.catalogView, scope)
    : evaluateDeclarativeDerivedValues(runtime.derived, scope);
}
