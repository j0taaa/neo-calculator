import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";

import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";
import { buildConfiguredFields } from "@/lib/configurable-service-fields";
import { getDeclarativeRuntimeDefinitionByCode, getTypedDeclarativeRuntimeDefinitionByCode } from "@/lib/declarative-service-runtime-registry";
import { evaluateDeclarativeDerivedValues, evaluateDeclarativeValue, evaluateDefinitionExpression } from "@/lib/declarative-runtime-evaluator";
import { declarativeRuntimeHelpers } from "@/lib/declarative-runtime-helpers";
import type { DeclarativeCatalogSource, DeclarativeEstimateRecord } from "@/lib/declarative-service-runtime-types";
import { formatFlavorAmount, type AppProduct, type BillingOption, type ProductMutationBody } from "@/lib/calculator-page-helpers";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import {
  getConfigurableServiceDefinitionByCode,
  type ServiceDefinition,
  type ServiceFieldRuntimeValues,
} from "@/lib/service-config";
import type { TypedDeclarativeValue } from "@/lib/typed-declarative-runtime-types";

type ConfigurablePanelProps = ComponentProps<typeof ConfigurableServicePanel>;

type UseConfigurableServiceRuntimeInput = {
  selectedServiceCode: string;
  selectedService: string;
  selectedServiceDefinition: ServiceDefinition | null;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  setBillingMode: (value: BillingOption) => void;
  usageHours: string;
  usageHoursValue: number;
  updateUsageHours: (value: string) => void;
  instanceCountValue: number;
};

type EditHydrationResult = {
  handled: boolean;
  error?: string;
  nextRegion?: HuaweiRegionKey;
  nextBillingMode?: BillingOption;
  nextUsageHours?: string;
  nextInstanceCount?: string;
};

export type DeclarativeBatchPanelContent = {
  placeholder: string;
  description: string;
  defaults: string;
  validation: string;
};

type UseConfigurableServiceRuntimeResult = {
  isConfigurableService: boolean;
  usesSharedBillingHeader: boolean;
  activeBillingOptions: BillingOption[] | null;
  panelProps: ConfigurablePanelProps | null;
  selectedEstimate: string;
  quantityLabel: string;
  showGlobalQuantityControl: boolean;
  showSharedUsageHours: boolean;
  addToListError: string | null;
  buildRequestBodies: () => ProductMutationBody | ProductMutationBody[] | null;
  buildBatchRequestBodies: (item: unknown) => ProductMutationBody[] | null;
  getAddSuccessMessage: (input: { requestBodiesCount: number }) => string | null;
  getUpdateSuccessMessage: (input: { requestBodiesCount: number; extraRequestBodiesCount: number }) => string | null;
  getBatchSuccessMessage: (input: { createdCount: number; expandedCount: number }) => string | null;
  applyDefaultsForServiceCode: (serviceCode: string) => void;
  hydrateProduct: (product: AppProduct) => EditHydrationResult;
  batchPanel: DeclarativeBatchPanelContent | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyConfigValue(value: unknown) {
  if (value == null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function normalizeBatchFieldValue(fieldType: ServiceDefinition["fields"][number]["type"], value: unknown) {
  if (fieldType === "checkbox") {
    return value === true || value === "true" || value === "Enabled" ? "true" : "false";
  }

  return stringifyConfigValue(value);
}

function toPositiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function toPositiveNumberString(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? value : fallback;
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }

  return fallback;
}

function parseBatchExampleValue(fieldType: ServiceDefinition["fields"][number]["type"], value: unknown) {
  if (value == null) {
    return fieldType === "checkbox" ? false : value;
  }

  if (fieldType === "checkbox") {
    return value === true || value === "true" || value === "Enabled";
  }

  if (fieldType === "number") {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return value;
}

function toBillingMode(value: unknown, fallback: BillingOption): BillingOption {
  return value === "RI" || value === "Yearly/Monthly" || value === "Pay-per-use" || value === "One-time" ? value : fallback;
}

function buildDefaultValues(definition: ServiceDefinition) {
  return Object.fromEntries(
    definition.fields.map((field) => [field.id, stringifyConfigValue(definition.defaults[field.id])]),
  ) as Record<string, string>;
}

function buildGenericBatchPlaceholder(definition: ServiceDefinition, values: Record<string, string>) {
  const example = Object.fromEntries(
    definition.fields.map((field) => {
      const activeValue = values[field.id];
      const defaultValue = definition.defaults[field.id];
      return [field.id, parseBatchExampleValue(field.type, activeValue !== undefined && activeValue !== "" ? activeValue : defaultValue)];
    }),
  );

  return JSON.stringify([example], null, 2);
}

function buildGenericBatchDefaults(definition: ServiceDefinition, values: Record<string, string>, billingMode: BillingOption, usageHours: string) {
  const lines = [
    "Unspecified keys use the current calculator values.",
    `billingMode: ${billingMode}`,
  ];

  if (usageHours.trim().length > 0) {
    lines.push(`usageHours: ${usageHours}`);
  }

  for (const field of definition.fields) {
    const value = values[field.id];
    if (value == null || value === "") {
      continue;
    }
    lines.push(`${field.id}: ${value}`);
  }

  return lines.join("\n");
}

function buildGenericBatchValidation(definition: ServiceDefinition) {
  return [
    "Provide a non-empty JSON array of objects.",
    "Each object may override any field id for this service.",
    `Supported field ids: ${definition.fields.map((field) => field.id).join(", ")}`,
  ].join("\n");
}

function readPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), value);
}

function buildSelectionTemplate(template: string | undefined, values: Record<string, string>) {
  if (!template) {
    return "Selected specifications:";
  }
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => values[key] ?? "");
}

function normalizeOptionList(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      if (typeof entry === "string" || typeof entry === "number") {
        return { value: String(entry), label: String(entry) };
      }
      if (isRecord(entry) && entry.value != null) {
        return {
          value: String(entry.value),
          label: String(entry.label ?? entry.value),
        };
      }
      return null;
    })
    .filter((entry): entry is { value: string; label: string } => entry != null);
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function buildRuntimeScope(input: {
  definition: ServiceDefinition;
  selectedServiceCode: string;
  selectedService: string;
  values: Record<string, string>;
  catalog: unknown;
  catalogRegionId: string | null;
  pricingError: string;
  regionValue: HuaweiRegionKey;
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

function normalizeHydrationResult(value: unknown): EditHydrationResult {
  if (!isRecord(value)) {
    return { handled: false, error: "This product cannot be edited from the calculator." };
  }

  return {
    handled: value.handled === true,
    error: typeof value.error === "string" ? value.error : undefined,
    nextRegion: typeof value.nextRegion === "string" && value.nextRegion in huaweiRegions ? value.nextRegion as HuaweiRegionKey : undefined,
    nextBillingMode: value.nextBillingMode === "Pay-per-use" || value.nextBillingMode === "Yearly/Monthly" || value.nextBillingMode === "RI" || value.nextBillingMode === "One-time"
      ? value.nextBillingMode
      : undefined,
    nextUsageHours: typeof value.nextUsageHours === "string" ? value.nextUsageHours : undefined,
    nextInstanceCount: typeof value.nextInstanceCount === "string" ? value.nextInstanceCount : undefined,
  };
}

function evaluateConfiguredValue<T>(
  typedRuntimeDefinition: ReturnType<typeof getTypedDeclarativeRuntimeDefinitionByCode>,
  legacyExpression: string | null | undefined,
  typedValue: TypedDeclarativeValue | undefined,
  scope: Record<string, unknown>,
) {
  if (typedRuntimeDefinition) {
    if (typedValue === undefined) {
      return null;
    }
    return evaluateDeclarativeValue<T | null>(typedValue, scope);
  }

  return evaluateDefinitionExpression<T>(legacyExpression, scope);
}

export function useConfigurableServiceRuntime({
  selectedServiceCode,
  selectedService,
  selectedServiceDefinition,
  regionValue,
  billingMode,
  setBillingMode,
  usageHours,
  usageHoursValue,
  updateUsageHours,
  instanceCountValue,
}: UseConfigurableServiceRuntimeInput): UseConfigurableServiceRuntimeResult {
  const [serviceValuesByCode, setServiceValuesByCode] = useState<Record<string, Record<string, string>>>({});
  const [catalogDataByService, setCatalogDataByService] = useState<Partial<Record<string, unknown>>>({});
  const [catalogRegionIdByService, setCatalogRegionIdByService] = useState<Partial<Record<string, string | null>>>({});
  const [pricingLoadingByService, setPricingLoadingByService] = useState<Partial<Record<string, boolean>>>({});
  const [pricingErrorByService, setPricingErrorByService] = useState<Partial<Record<string, string>>>({});

  const runtimeDefinition = getDeclarativeRuntimeDefinitionByCode(selectedServiceCode);
  const typedRuntimeDefinition = getTypedDeclarativeRuntimeDefinitionByCode(selectedServiceCode);
  const isConfigurableService = selectedServiceDefinition?.implementation === "configurable" || selectedServiceDefinition?.implementation === "config-pilot";

  const replaceServiceValues = useCallback((serviceCode: string, values: Record<string, string>) => {
    setServiceValuesByCode((current) => ({ ...current, [serviceCode]: values }));
  }, []);

  useEffect(() => {
    if (!selectedServiceDefinition) {
      return;
    }

    setServiceValuesByCode((current) => (
      current[selectedServiceCode] ? current : { ...current, [selectedServiceCode]: buildDefaultValues(selectedServiceDefinition) }
    ));
  }, [selectedServiceCode, selectedServiceDefinition]);

  useEffect(() => {
    const catalogSource = (typedRuntimeDefinition?.catalog ?? runtimeDefinition?.catalog) as DeclarativeCatalogSource | undefined;

    if (!isConfigurableService || !catalogSource) {
      return;
    }

    const activeCatalogSource = catalogSource;

    let cancelled = false;

    async function loadCatalog() {
      setPricingLoadingByService((current) => ({ ...current, [selectedServiceCode]: true }));
      setPricingErrorByService((current) => ({ ...current, [selectedServiceCode]: "" }));

      try {
        const response = await fetch(`/api/catalog/${activeCatalogSource.route}?region=${encodeURIComponent(regionValue)}`, { cache: "no-store" });
        const rawBody = await response.text();
        let payload: Record<string, unknown> = {};
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            const contentType = response.headers.get("content-type") ?? "unknown content-type";
            throw new Error(`Failed to load ${selectedServiceCode} pricing: received non-JSON response (${contentType})`);
          }
        }
        const catalogPath = activeCatalogSource.catalogPath ?? "catalog";
        const regionIdPath = activeCatalogSource.regionIdPath ?? "catalogRegionId";
        const errorPath = activeCatalogSource.errorPath ?? "error";
        const catalog = readPath(payload, catalogPath);
        const catalogRegionId = readPath(payload, regionIdPath);
        const error = readPath(payload, errorPath);

        if (!response.ok || catalog == null) {
          throw new Error(typeof error === "string" ? error : `Failed to load ${selectedServiceCode} pricing`);
        }

        if (cancelled) {
          return;
        }

        setCatalogDataByService((current) => ({ ...current, [selectedServiceCode]: catalog }));
        setCatalogRegionIdByService((current) => ({ ...current, [selectedServiceCode]: typeof catalogRegionId === "string" ? catalogRegionId : null }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCatalogDataByService((current) => ({ ...current, [selectedServiceCode]: null }));
        setCatalogRegionIdByService((current) => ({ ...current, [selectedServiceCode]: null }));
        setPricingErrorByService((current) => ({
          ...current,
          [selectedServiceCode]: error instanceof Error ? error.message : `Failed to load ${selectedServiceCode} pricing`,
        }));
      } finally {
        if (!cancelled) {
          setPricingLoadingByService((current) => ({ ...current, [selectedServiceCode]: false }));
        }
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [isConfigurableService, regionValue, runtimeDefinition?.catalog, selectedServiceCode, typedRuntimeDefinition?.catalog]);

  const activeValues = useMemo(
    () => selectedServiceDefinition ? (serviceValuesByCode[selectedServiceCode] ?? buildDefaultValues(selectedServiceDefinition)) : {},
    [selectedServiceCode, selectedServiceDefinition, serviceValuesByCode],
  );

  const pricingError = pricingErrorByService[selectedServiceCode] ?? "";
  const catalog = catalogDataByService[selectedServiceCode] ?? null;
  const catalogRegionId = catalogRegionIdByService[selectedServiceCode] ?? null;

  const catalogView = useMemo(
    () => {
      if (!selectedServiceDefinition) {
        return null;
      }

      const baseScope = buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
      });

      if (typedRuntimeDefinition) {
        if (typedRuntimeDefinition.catalogView) {
          return evaluateDeclarativeValue(typedRuntimeDefinition.catalogView, baseScope);
        }
        return evaluateDeclarativeDerivedValues(typedRuntimeDefinition.derived, baseScope);
      }

      if (!runtimeDefinition?.catalogViewExpression) {
        return null;
      }

      return evaluateDefinitionExpression(
        runtimeDefinition.catalogViewExpression,
        baseScope,
      );
    },
    [
      activeValues,
      billingMode,
      catalog,
      catalogRegionId,
      instanceCountValue,
      pricingError,
      regionValue,
      runtimeDefinition?.catalogViewExpression,
      selectedService,
      selectedServiceCode,
      selectedServiceDefinition,
      typedRuntimeDefinition,
      usageHours,
      usageHoursValue,
    ],
  );

  useEffect(() => {
    if (!selectedServiceDefinition || (!runtimeDefinition?.syncValuesExpression && !typedRuntimeDefinition?.syncValues)) {
      return;
    }

    const nextValues = evaluateConfiguredValue<Record<string, unknown>>(
      typedRuntimeDefinition,
      runtimeDefinition?.syncValuesExpression,
      typedRuntimeDefinition?.syncValues,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
      }),
    );

    if (!nextValues || !isRecord(nextValues)) {
      return;
    }

    const normalizedValues = Object.fromEntries(
      Object.entries(nextValues).map(([key, value]) => [key, stringifyConfigValue(value)]),
    ) as Record<string, string>;

    const hasDiff = Object.keys(normalizedValues).some((key) => activeValues[key] !== normalizedValues[key]);
    if (!hasDiff) {
      return;
    }

    setServiceValuesByCode((current) => ({
      ...current,
      [selectedServiceCode]: {
        ...(current[selectedServiceCode] ?? buildDefaultValues(selectedServiceDefinition)),
        ...normalizedValues,
      },
    }));
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.syncValuesExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    typedRuntimeDefinition?.syncValues,
    usageHours,
    usageHoursValue,
  ]);

  const estimate = useMemo(
    () => {
      if (!selectedServiceDefinition) {
        return null;
      }

      return evaluateConfiguredValue<DeclarativeEstimateRecord>(
        typedRuntimeDefinition,
        runtimeDefinition?.estimateExpression,
        typedRuntimeDefinition?.estimate,
        buildRuntimeScope({
          definition: selectedServiceDefinition,
          selectedServiceCode,
          selectedService,
          values: activeValues,
          catalog,
          catalogRegionId,
          pricingError,
          regionValue,
          billingMode,
          usageHours,
          usageHoursValue,
          instanceCountValue,
          derived: catalogView,
        }),
      );
    },
    [
      activeValues,
      billingMode,
      catalog,
      catalogRegionId,
      catalogView,
      instanceCountValue,
      pricingError,
      regionValue,
      runtimeDefinition?.estimateExpression,
      selectedService,
      selectedServiceCode,
      selectedServiceDefinition,
      typedRuntimeDefinition,
      usageHours,
      usageHoursValue,
    ],
  );

  const activeBillingOptions = useMemo(() => {
    if (!selectedServiceDefinition) {
      return null;
    }
    const computed = evaluateConfiguredValue<unknown[]>(
      typedRuntimeDefinition,
      runtimeDefinition?.activeBillingOptionsExpression,
      typedRuntimeDefinition?.activeBillingOptions,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
      }),
    );
    if (Array.isArray(computed) && computed.every((entry) => entry === "Pay-per-use" || entry === "RI" || entry === "Yearly/Monthly" || entry === "One-time")) {
      return computed as BillingOption[];
    }
    return selectedServiceDefinition.billingOptions as BillingOption[];
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.activeBillingOptionsExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  useEffect(() => {
    if (!activeBillingOptions?.includes(billingMode) && activeBillingOptions?.[0]) {
      setBillingMode(activeBillingOptions[0]);
    }
  }, [activeBillingOptions, billingMode, setBillingMode]);

  const showSharedUsageHours = useMemo(() => {
    if (!selectedServiceDefinition) {
      return true;
    }
    const computed = evaluateConfiguredValue<boolean>(
      typedRuntimeDefinition,
      runtimeDefinition?.showSharedUsageHoursExpression,
      typedRuntimeDefinition?.showSharedUsageHours,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
      }),
    );
    return computed == null ? true : Boolean(computed);
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.showSharedUsageHoursExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const runtimeValues = useMemo(() => {
    if (!selectedServiceDefinition) {
      return {};
    }
    const computed = evaluateConfiguredValue<ServiceFieldRuntimeValues>(
      typedRuntimeDefinition,
      runtimeDefinition?.visibilityContextExpression,
      typedRuntimeDefinition?.visibilityContext,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
      }),
    ) ?? {};
    return {
      ...Object.fromEntries(Object.entries(activeValues).map(([key, value]) => [key, value])),
      ...(isRecord(computed) ? computed : {}),
      billingMode,
    };
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.visibilityContextExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const setActiveFieldValue = useCallback((fieldId: string, nextValue: string) => {
    setServiceValuesByCode((current) => ({
      ...current,
      [selectedServiceCode]: {
        ...(current[selectedServiceCode] ?? {}),
        [fieldId]: nextValue,
      },
    }));
  }, [selectedServiceCode]);

  const fieldOptionsById = useMemo(() => {
    if (!selectedServiceDefinition) {
      return {};
    }

    return Object.fromEntries(
      selectedServiceDefinition.fields.map((field) => {
        const runtimeField = runtimeDefinition?.fieldRuntime?.[field.id];
        const typedRuntimeField = typedRuntimeDefinition?.fieldRuntime?.[field.id];
        const computed = evaluateConfiguredValue<unknown>(
          typedRuntimeDefinition,
          runtimeField?.optionsExpression,
          typedRuntimeField?.options,
          buildRuntimeScope({
            definition: selectedServiceDefinition,
            selectedServiceCode,
            selectedService,
            values: activeValues,
            catalog,
            catalogRegionId,
            pricingError,
            regionValue,
            billingMode,
            usageHours,
            usageHoursValue,
            instanceCountValue,
            derived: catalogView,
            estimate,
          }),
        ) ?? (field.optionsSource
          ? readPath({ catalog, catalogView, values: activeValues, helpers: declarativeRuntimeHelpers }, field.optionsSource)
          : field.options);

        return [field.id, normalizeOptionList(computed)];
      }),
    ) as Record<string, Array<{ value: string; label: string }> | undefined>;
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.fieldRuntime,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const fieldMinById = useMemo(() => {
    if (!selectedServiceDefinition) {
      return {};
    }

    return Object.fromEntries(
      selectedServiceDefinition.fields.map((field) => {
        const runtimeField = runtimeDefinition?.fieldRuntime?.[field.id];
        const typedRuntimeField = typedRuntimeDefinition?.fieldRuntime?.[field.id];
        const computed = evaluateConfiguredValue<number>(
          typedRuntimeDefinition,
          runtimeField?.minExpression,
          typedRuntimeField?.min,
          buildRuntimeScope({
            definition: selectedServiceDefinition,
            selectedServiceCode,
            selectedService,
            values: activeValues,
            catalog,
            catalogRegionId,
            pricingError,
            regionValue,
            billingMode,
            usageHours,
            usageHoursValue,
            instanceCountValue,
            derived: catalogView,
            estimate,
          }),
        ) ?? (field.minSource
          ? readPath({ catalog, catalogView, values: activeValues, helpers: declarativeRuntimeHelpers }, field.minSource)
          : field.min);
        return [field.id, typeof computed === "number" ? computed : field.min];
      }),
    ) as Record<string, number | undefined>;
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.fieldRuntime,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const fieldMaxById = useMemo(() => {
    if (!selectedServiceDefinition) {
      return {};
    }

    return Object.fromEntries(
      selectedServiceDefinition.fields.map((field) => {
        const runtimeField = runtimeDefinition?.fieldRuntime?.[field.id];
        const typedRuntimeField = typedRuntimeDefinition?.fieldRuntime?.[field.id];
        const computed = evaluateConfiguredValue<number>(
          typedRuntimeDefinition,
          runtimeField?.maxExpression,
          typedRuntimeField?.max,
          buildRuntimeScope({
            definition: selectedServiceDefinition,
            selectedServiceCode,
            selectedService,
            values: activeValues,
            catalog,
            catalogRegionId,
            pricingError,
            regionValue,
            billingMode,
            usageHours,
            usageHoursValue,
            instanceCountValue,
            derived: catalogView,
            estimate,
          }),
        ) ?? (field.maxSource
          ? readPath({ catalog, catalogView, values: activeValues, helpers: declarativeRuntimeHelpers }, field.maxSource)
          : field.max);
        return [field.id, typeof computed === "number" ? computed : field.max];
      }),
    ) as Record<string, number | undefined>;
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.fieldRuntime,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const fieldDisabledById = useMemo(() => {
    if (!selectedServiceDefinition) {
      return {};
    }

    return Object.fromEntries(
      selectedServiceDefinition.fields.map((field) => {
        const runtimeField = runtimeDefinition?.fieldRuntime?.[field.id];
        const typedRuntimeField = typedRuntimeDefinition?.fieldRuntime?.[field.id];
        const computed = evaluateConfiguredValue<boolean>(
          typedRuntimeDefinition,
          runtimeField?.disabledExpression,
          typedRuntimeField?.disabled,
          buildRuntimeScope({
            definition: selectedServiceDefinition,
            selectedServiceCode,
            selectedService,
            values: activeValues,
            catalog,
            catalogRegionId,
            pricingError,
            regionValue,
            billingMode,
            usageHours,
            usageHoursValue,
            instanceCountValue,
            derived: catalogView,
            estimate,
          }),
        ) ?? false;
        return [field.id, Boolean(computed)];
      }),
    ) as Record<string, boolean | undefined>;
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.fieldRuntime,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const activePanelProps = useMemo<ConfigurablePanelProps | null>(() => {
    if (!isConfigurableService || !selectedServiceDefinition) {
      return null;
    }

    const fields = buildConfiguredFields({
      enabled: true,
      definition: selectedServiceDefinition,
      runtimeValues,
      values: activeValues,
      optionsByFieldId: fieldOptionsById,
      minByFieldId: fieldMinById,
      maxByFieldId: fieldMaxById,
      disabledByFieldId: fieldDisabledById,
      onChangeByFieldId: Object.fromEntries(selectedServiceDefinition.fields.map((field) => [field.id, (value: string) => setActiveFieldValue(field.id, value)])),
      onBlurByFieldId: Object.fromEntries(
        selectedServiceDefinition.fields.map((field) => [
          field.id,
          () => {
            const runtimeField = runtimeDefinition?.fieldRuntime?.[field.id];
            const typedRuntimeField = typedRuntimeDefinition?.fieldRuntime?.[field.id];
            if (!runtimeField?.normalizeExpression && !typedRuntimeField?.normalize) {
              return;
            }
            const normalized = evaluateConfiguredValue<string | number | boolean | null>(
              typedRuntimeDefinition,
              runtimeField?.normalizeExpression,
              typedRuntimeField?.normalize,
              buildRuntimeScope({
                definition: selectedServiceDefinition,
                selectedServiceCode,
                selectedService,
                values: activeValues,
                catalog,
                catalogRegionId,
                pricingError,
                regionValue,
                billingMode,
                usageHours,
                usageHoursValue,
                instanceCountValue,
                derived: catalogView,
                estimate,
              }),
            );
            if (normalized != null) {
              setActiveFieldValue(field.id, stringifyConfigValue(normalized));
            }
          },
        ]),
      ),
      onStepByFieldId: Object.fromEntries(
        selectedServiceDefinition.fields.map((field) => [
          field.id,
          (delta: number) => {
            const currentValue = Number(activeValues[field.id] || fieldMinById[field.id] || 0);
            setActiveFieldValue(field.id, String(currentValue + delta));
          },
        ]),
      ),
    });

    const notes = normalizeStringList(
      evaluateConfiguredValue<unknown>(
        typedRuntimeDefinition,
        runtimeDefinition?.panelNotesExpression,
        typedRuntimeDefinition?.panelNotes,
        buildRuntimeScope({
          definition: selectedServiceDefinition,
          selectedServiceCode,
          selectedService,
          values: activeValues,
          catalog,
          catalogRegionId,
          pricingError,
          regionValue,
          billingMode,
          usageHours,
          usageHoursValue,
          instanceCountValue,
          derived: catalogView,
          estimate,
        }),
      ),
    );
    const effectiveNotes = notes.length > 0
      ? notes
      : [...(selectedServiceDefinition.summary?.notes ?? [])];

    const selectionSummary = evaluateConfiguredValue<string>(
      typedRuntimeDefinition,
      runtimeDefinition?.selectionSummaryExpression,
      typedRuntimeDefinition?.selectionSummary,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
      }),
    ) ?? (
      selectedServiceDefinition.summary?.selectionTemplate
        ? buildSelectionTemplate(selectedServiceDefinition.summary.selectionTemplate, activeValues)
        : "Selected specifications:"
    );

    const selectionNotes = normalizeStringList(
      evaluateConfiguredValue<unknown>(
        typedRuntimeDefinition,
        runtimeDefinition?.selectionNotesExpression,
        typedRuntimeDefinition?.selectionNotes,
        buildRuntimeScope({
          definition: selectedServiceDefinition,
          selectedServiceCode,
          selectedService,
          values: activeValues,
          catalog,
          catalogRegionId,
          pricingError,
          regionValue,
          billingMode,
          usageHours,
          usageHoursValue,
          instanceCountValue,
          derived: catalogView,
          estimate,
        }),
      ),
    );

    const referenceNote = evaluateConfiguredValue<string>(
      typedRuntimeDefinition,
      runtimeDefinition?.referenceNoteExpression,
      typedRuntimeDefinition?.referenceNote,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
      }),
    ) ?? undefined;

    return {
      definition: selectedServiceDefinition,
      fields,
      pricingError: pricingError || undefined,
      pricingLoadingMessage: pricingLoadingByService[selectedServiceCode]
        ? ((typedRuntimeDefinition?.catalog?.loadingMessage ?? runtimeDefinition?.catalog?.loadingMessage) ?? `Loading ${selectedServiceCode} pricing...`)
        : null,
      notes: effectiveNotes,
      selectionSummary,
      selectionNotes,
      referenceNote,
    };
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    fieldDisabledById,
    fieldMaxById,
    fieldMinById,
    fieldOptionsById,
    instanceCountValue,
    isConfigurableService,
    pricingError,
    pricingLoadingByService,
    regionValue,
    runtimeDefinition,
    runtimeValues,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    setActiveFieldValue,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const selectedEstimate = useMemo(() => {
    if (!estimate || typeof estimate.currency !== "string" || typeof estimate.amount !== "number" || typeof estimate.suffix !== "string") {
      return "USD 0.00";
    }
    return formatFlavorAmount(estimate.currency, estimate.amount, estimate.suffix);
  }, [estimate]);

  const addToListError = useMemo(() => {
    if (!selectedServiceDefinition) {
      return null;
    }
    const computed = evaluateConfiguredValue<string | null>(
      typedRuntimeDefinition,
      runtimeDefinition?.addToListErrorExpression,
      typedRuntimeDefinition?.addToListError,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
      }),
    );
    return typeof computed === "string" ? computed : null;
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.addToListErrorExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const applyDefaultsForServiceCode = useCallback((serviceCode: string) => {
    const definition = getConfigurableServiceDefinitionByCode(serviceCode);
    if (!definition) {
      return;
    }

    const nextValues = buildDefaultValues(definition);
    replaceServiceValues(serviceCode, nextValues);
    const nextBillingMode = toBillingMode(nextValues.billingMode || definition.billingOptions[0], definition.billingOptions[0] ?? "Pay-per-use");
    setBillingMode(nextBillingMode);
    if (typeof nextValues.usageHours === "string" && nextValues.usageHours) {
      updateUsageHours(nextValues.usageHours);
    }
  }, [replaceServiceValues, setBillingMode, updateUsageHours]);

  const buildScopedCatalogView = useCallback((values: Record<string, string>, nextBillingMode: BillingOption, nextUsageHours: string, nextUsageHoursValue: number, nextInstanceCountValue: number) => {
    if (!selectedServiceDefinition) {
      return null;
    }

    const baseScope = buildRuntimeScope({
      definition: selectedServiceDefinition,
      selectedServiceCode,
      selectedService,
      values,
      catalog,
      catalogRegionId,
      pricingError,
      regionValue,
      billingMode: nextBillingMode,
      usageHours: nextUsageHours,
      usageHoursValue: nextUsageHoursValue,
      instanceCountValue: nextInstanceCountValue,
    });

    if (typedRuntimeDefinition) {
      if (typedRuntimeDefinition.catalogView) {
        return evaluateDeclarativeValue(typedRuntimeDefinition.catalogView, baseScope);
      }
      return evaluateDeclarativeDerivedValues(typedRuntimeDefinition.derived, baseScope);
    }

    if (!runtimeDefinition?.catalogViewExpression) {
      return null;
    }

    return evaluateDefinitionExpression(runtimeDefinition.catalogViewExpression, baseScope);
  }, [
    catalog,
    catalogRegionId,
    pricingError,
    regionValue,
    runtimeDefinition?.catalogViewExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
  ]);

  const buildBatchScopeForItem = useCallback((item: unknown) => {
    if (!selectedServiceDefinition || !isRecord(item)) {
      return null;
    }

    const itemConfig = isRecord(item.config) ? item.config : null;
    const mergedItemValues = {
      ...(itemConfig ?? {}),
      ...item,
    };

    let values = {
      ...buildDefaultValues(selectedServiceDefinition),
      ...activeValues,
    };

    for (const field of selectedServiceDefinition.fields) {
      if (mergedItemValues[field.id] !== undefined) {
        values = {
          ...values,
          [field.id]: normalizeBatchFieldValue(field.type, mergedItemValues[field.id]),
        };
      }
    }

    let nextBillingMode = toBillingMode(
      mergedItemValues.billingMode ?? mergedItemValues.mode ?? values.billingMode ?? billingMode,
      billingMode,
    );
    let nextUsageHours = toPositiveNumberString(
      mergedItemValues.usageHours ?? mergedItemValues.hours ?? values.usageHours,
      usageHours,
    );
    let nextUsageHoursValue = toPositiveInteger(
      mergedItemValues.usageHours ?? mergedItemValues.hours ?? values.usageHours,
      usageHoursValue,
    );
    let nextInstanceCountValue = toPositiveInteger(
      mergedItemValues.instanceCount ?? mergedItemValues.quantity ?? values.quantity,
      instanceCountValue,
    );

    for (let iteration = 0; iteration < 3; iteration += 1) {
      const nextCatalogView = buildScopedCatalogView(values, nextBillingMode, nextUsageHours, nextUsageHoursValue, nextInstanceCountValue);
      const syncedValues = evaluateConfiguredValue<Record<string, unknown>>(
        typedRuntimeDefinition,
        runtimeDefinition?.syncValuesExpression,
        typedRuntimeDefinition?.syncValues,
        buildRuntimeScope({
          definition: selectedServiceDefinition,
          selectedServiceCode,
          selectedService,
          values,
          catalog,
          catalogRegionId,
          pricingError,
          regionValue,
          billingMode: nextBillingMode,
          usageHours: nextUsageHours,
          usageHoursValue: nextUsageHoursValue,
          instanceCountValue: nextInstanceCountValue,
          item,
          derived: nextCatalogView,
        }),
      );

      if (!syncedValues || !isRecord(syncedValues)) {
        return {
          values,
          billingMode: nextBillingMode,
          usageHours: nextUsageHours,
          usageHoursValue: nextUsageHoursValue,
          instanceCountValue: nextInstanceCountValue,
          catalogView: nextCatalogView,
        };
      }

      const normalizedValues = Object.fromEntries(
        Object.entries(syncedValues).map(([key, value]) => [key, stringifyConfigValue(value)]),
      ) as Record<string, string>;

      const hasDiff = Object.keys(normalizedValues).some((key) => values[key] !== normalizedValues[key]);
      if (!hasDiff) {
        return {
          values,
          billingMode: nextBillingMode,
          usageHours: nextUsageHours,
          usageHoursValue: nextUsageHoursValue,
          instanceCountValue: nextInstanceCountValue,
          catalogView: nextCatalogView,
        };
      }

      values = { ...values, ...normalizedValues };
      nextBillingMode = toBillingMode(values.billingMode || nextBillingMode, nextBillingMode);
      nextUsageHours = toPositiveNumberString(values.usageHours, nextUsageHours);
      nextUsageHoursValue = toPositiveInteger(values.usageHours, nextUsageHoursValue);
      nextInstanceCountValue = toPositiveInteger(values.quantity, nextInstanceCountValue);
    }

    return {
      values,
      billingMode: nextBillingMode,
      usageHours: nextUsageHours,
      usageHoursValue: nextUsageHoursValue,
      instanceCountValue: nextInstanceCountValue,
      catalogView: buildScopedCatalogView(values, nextBillingMode, nextUsageHours, nextUsageHoursValue, nextInstanceCountValue),
    };
  }, [
    activeValues,
    billingMode,
    buildScopedCatalogView,
    catalog,
    catalogRegionId,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.syncValuesExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const buildRequestBodies = useCallback((): ProductMutationBody | ProductMutationBody[] | null => {
    if (!selectedServiceDefinition || (!runtimeDefinition?.buildRequestBodiesExpression && !typedRuntimeDefinition?.buildRequestBodies)) {
      return null;
    }

    return evaluateConfiguredValue<ProductMutationBody | ProductMutationBody[] | null>(
      typedRuntimeDefinition,
      runtimeDefinition?.buildRequestBodiesExpression,
      typedRuntimeDefinition?.buildRequestBodies,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
      }),
    );
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.buildRequestBodiesExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const buildBatchRequestBodies = useCallback((item: unknown): ProductMutationBody[] | null => {
    if (!selectedServiceDefinition) {
      return null;
    }

    if (runtimeDefinition?.buildBatchRequestBodiesExpression || typedRuntimeDefinition?.buildBatchRequestBodies) {
      const result = evaluateConfiguredValue<ProductMutationBody[] | ProductMutationBody | null>(
        typedRuntimeDefinition,
        runtimeDefinition?.buildBatchRequestBodiesExpression,
        typedRuntimeDefinition?.buildBatchRequestBodies,
        buildRuntimeScope({
          definition: selectedServiceDefinition,
          selectedServiceCode,
          selectedService,
          values: activeValues,
          catalog,
          catalogRegionId,
          pricingError,
          regionValue,
          billingMode,
          usageHours,
          usageHoursValue,
          instanceCountValue,
          item,
          derived: catalogView,
          estimate,
        }),
      );

      if (!result) {
        return null;
      }
      return Array.isArray(result) ? result : [result];
    }

    if (!runtimeDefinition?.buildRequestBodiesExpression && !typedRuntimeDefinition?.buildRequestBodies) {
      return null;
    }

    const batchScope = buildBatchScopeForItem(item);
    if (!batchScope) {
      return null;
    }

    const batchEstimate = evaluateConfiguredValue<DeclarativeEstimateRecord>(
      typedRuntimeDefinition,
      runtimeDefinition?.estimateExpression,
      typedRuntimeDefinition?.estimate,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: batchScope.values,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode: batchScope.billingMode,
        usageHours: batchScope.usageHours,
        usageHoursValue: batchScope.usageHoursValue,
        instanceCountValue: batchScope.instanceCountValue,
        item,
        derived: batchScope.catalogView,
      }),
    );

    const result = evaluateConfiguredValue<ProductMutationBody[] | ProductMutationBody | null>(
      typedRuntimeDefinition,
      runtimeDefinition?.buildRequestBodiesExpression,
      typedRuntimeDefinition?.buildRequestBodies,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: batchScope.values,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode: batchScope.billingMode,
        usageHours: batchScope.usageHours,
        usageHoursValue: batchScope.usageHoursValue,
        instanceCountValue: batchScope.instanceCountValue,
        item,
        derived: batchScope.catalogView,
        estimate: batchEstimate,
      }),
    );

    if (!result) {
      return null;
    }
    return Array.isArray(result) ? result : [result];
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    buildBatchScopeForItem,
    runtimeDefinition?.estimateExpression,
    runtimeDefinition?.buildBatchRequestBodiesExpression,
    runtimeDefinition?.buildRequestBodiesExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const getAddSuccessMessage = useCallback((input: { requestBodiesCount: number }) => {
    if (!selectedServiceDefinition || (!runtimeDefinition?.addSuccessMessageExpression && !typedRuntimeDefinition?.addSuccessMessage)) {
      return null;
    }

    const result = evaluateConfiguredValue<string | null>(
      typedRuntimeDefinition,
      runtimeDefinition?.addSuccessMessageExpression,
      typedRuntimeDefinition?.addSuccessMessage,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
        requestBodiesCount: input.requestBodiesCount,
      }),
    );

    return typeof result === "string" ? result : null;
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.addSuccessMessageExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const getUpdateSuccessMessage = useCallback((input: { requestBodiesCount: number; extraRequestBodiesCount: number }) => {
    if (!selectedServiceDefinition || (!runtimeDefinition?.updateSuccessMessageExpression && !typedRuntimeDefinition?.updateSuccessMessage)) {
      return null;
    }

    const result = evaluateConfiguredValue<string | null>(
      typedRuntimeDefinition,
      runtimeDefinition?.updateSuccessMessageExpression,
      typedRuntimeDefinition?.updateSuccessMessage,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
        requestBodiesCount: input.requestBodiesCount,
        extraRequestBodiesCount: input.extraRequestBodiesCount,
      }),
    );

    return typeof result === "string" ? result : null;
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.updateSuccessMessageExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const getBatchSuccessMessage = useCallback((input: { createdCount: number; expandedCount: number }) => {
    if (!selectedServiceDefinition || (!runtimeDefinition?.batchSuccessMessageExpression && !typedRuntimeDefinition?.batchSuccessMessage)) {
      return null;
    }

    const result = evaluateConfiguredValue<string | null>(
      typedRuntimeDefinition,
      runtimeDefinition?.batchSuccessMessageExpression,
      typedRuntimeDefinition?.batchSuccessMessage,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        derived: catalogView,
        estimate,
        createdCount: input.createdCount,
        expandedCount: input.expandedCount,
      }),
    );

    return typeof result === "string" ? result : null;
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    runtimeDefinition?.batchSuccessMessageExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const hydrateProduct = useCallback((product: AppProduct): EditHydrationResult => {
    if (!selectedServiceDefinition || (!runtimeDefinition?.hydrateExpression && !typedRuntimeDefinition?.hydrate)) {
      return { handled: false, error: "This product cannot be edited from the calculator." };
    }

    const result = evaluateConfiguredValue<unknown>(
      typedRuntimeDefinition,
      runtimeDefinition?.hydrateExpression,
      typedRuntimeDefinition?.hydrate,
      buildRuntimeScope({
        definition: selectedServiceDefinition,
        selectedServiceCode,
        selectedService,
        values: activeValues,
        catalog,
        catalogRegionId,
        pricingError,
        regionValue,
        billingMode,
        usageHours,
        usageHoursValue,
        instanceCountValue,
        product,
        derived: catalogView,
        estimate,
      }),
    );

    if (isRecord(result) && isRecord(result.values)) {
      replaceServiceValues(
        selectedServiceCode,
        Object.fromEntries(
          Object.entries(result.values).map(([key, value]) => [key, stringifyConfigValue(value)]),
        ),
      );
    }

    return normalizeHydrationResult(result);
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    pricingError,
    regionValue,
    replaceServiceValues,
    runtimeDefinition?.hydrateExpression,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  const batchPanel = useMemo(() => {
    if (!selectedServiceDefinition) {
      return null;
    }

    const evaluateBatchExpression = (legacyExpression: string | undefined, typedExpression: TypedDeclarativeValue | undefined) => (
      evaluateConfiguredValue<string>(
        typedRuntimeDefinition,
        legacyExpression,
        typedExpression,
        buildRuntimeScope({
          definition: selectedServiceDefinition,
          selectedServiceCode,
          selectedService,
          values: activeValues,
          catalog,
          catalogRegionId,
          pricingError,
          regionValue,
          billingMode,
          usageHours,
          usageHoursValue,
          instanceCountValue,
          derived: catalogView,
          estimate,
        }),
      ) ?? ""
    );

    const legacyBatchPanel = runtimeDefinition?.batchPanel;
    const typedBatchPanel = typedRuntimeDefinition?.batchPanel;

    if (!legacyBatchPanel && !typedBatchPanel) {
      if (!isConfigurableService || (!runtimeDefinition?.buildRequestBodiesExpression && !typedRuntimeDefinition?.buildRequestBodies)) {
        return null;
      }

      return {
        placeholder: buildGenericBatchPlaceholder(selectedServiceDefinition, activeValues),
        description: `Add a JSON array of ${selectedService} configurations. Each row can override any field id for this service.`,
        defaults: buildGenericBatchDefaults(selectedServiceDefinition, activeValues, billingMode, usageHours),
        validation: buildGenericBatchValidation(selectedServiceDefinition),
      };
    }

    return {
      placeholder: evaluateBatchExpression(legacyBatchPanel?.placeholderExpression, typedBatchPanel?.placeholder),
      description: evaluateBatchExpression(legacyBatchPanel?.descriptionExpression, typedBatchPanel?.description),
      defaults: evaluateBatchExpression(legacyBatchPanel?.defaultsExpression, typedBatchPanel?.defaults),
      validation: evaluateBatchExpression(legacyBatchPanel?.validationExpression, typedBatchPanel?.validation),
    };
  }, [
    activeValues,
    billingMode,
    catalog,
    catalogRegionId,
    catalogView,
    estimate,
    instanceCountValue,
    isConfigurableService,
    pricingError,
    regionValue,
    runtimeDefinition?.buildRequestBodiesExpression,
    runtimeDefinition?.batchPanel,
    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    usageHours,
    usageHoursValue,
  ]);

  return {
    isConfigurableService,
    usesSharedBillingHeader: typedRuntimeDefinition?.usesSharedBillingHeader ?? runtimeDefinition?.usesSharedBillingHeader ?? true,
    activeBillingOptions,
    panelProps: activePanelProps,
    selectedEstimate,
    quantityLabel: typedRuntimeDefinition?.quantityLabel ?? runtimeDefinition?.quantityLabel ?? "Instance",
    showGlobalQuantityControl: typedRuntimeDefinition?.showGlobalQuantityControl ?? runtimeDefinition?.showGlobalQuantityControl ?? true,
    showSharedUsageHours,
    addToListError,
    buildRequestBodies,
    buildBatchRequestBodies,
    getAddSuccessMessage,
    getUpdateSuccessMessage,
    getBatchSuccessMessage,
    applyDefaultsForServiceCode,
    hydrateProduct,
    batchPanel,
  };
}
