import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";

import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";
import type { CalculatorProductSource } from "@/lib/calculator-cart";
import { formatFlavorAmount } from "@/lib/calculator-page-helpers";
import type { AppProduct, BillingOption, ProductMutationBody } from "@/lib/calculator-types";
import { buildConfiguredFields } from "@/lib/configurable-service-fields";
import { declarativeRuntimeHelpers } from "@/lib/declarative-runtime-helpers";
import { getTypedDeclarativeRuntimeDefinitionByCode } from "@/lib/declarative-service-runtime-registry";
import type { DeclarativeCatalogSource } from "@/lib/declarative-service-runtime-types";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import {
  getConfigurableServiceDefinitionByCode,
  type ServiceDefinition,
  type ServiceFieldRuntimeValues,
} from "@/lib/service-config";
import {
  buildDefaultValues,
  buildRuntimeScope,
  evaluateRuntimeValue,
  evaluateServiceConfiguration,
  stringifyConfigValue,
} from "@/lib/service-runtime";
import type { TypedDeclarativeValue } from "@/lib/typed-declarative-runtime-types";

type ConfigurablePanelProps = ComponentProps<typeof ConfigurableServicePanel>;

type UseConfigurableServiceRuntimeInput = {
  enabled?: boolean;
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

type UseConfigurableServiceRuntimeResult = CalculatorProductSource & {
  isConfigurableService: boolean;
  usesSharedBillingHeader: boolean;
  activeBillingOptions: BillingOption[] | null;
  panelProps: ConfigurablePanelProps | null;
  selectedEstimate: string;
  quantityLabel: string;
  showGlobalQuantityControl: boolean;
  showSharedUsageHours: boolean;
  addToListError: string | null;
  applyDefaultsForServiceCode: (serviceCode: string) => void;
  hydrateProduct: (product: AppProduct) => EditHydrationResult;
  batchPanel: DeclarativeBatchPanelContent | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  return value === "RI" || value === "Yearly/Monthly" || value === "Pay-per-use" || value === "One-time"
    ? value
    : fallback;
}

function buildGenericBatchPlaceholder(definition: ServiceDefinition, values: Record<string, string>) {
  const example = Object.fromEntries(
    definition.fields.map((field) => {
      const activeValue = values[field.id];
      const defaultValue = definition.defaults[field.id];
      return [
        field.id,
        parseBatchExampleValue(
          field.type,
          activeValue !== undefined && activeValue !== "" ? activeValue : defaultValue,
        ),
      ];
    }),
  );

  return JSON.stringify([example], null, 2);
}

function buildGenericBatchDefaults(
  definition: ServiceDefinition,
  values: Record<string, string>,
  billingMode: BillingOption,
  usageHours: string,
) {
  const lines = ["Unspecified keys use the current calculator values.", `billingMode: ${billingMode}`];

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

function normalizeHydrationResult(value: unknown): EditHydrationResult {
  if (!isRecord(value)) {
    return { handled: false, error: "This product cannot be edited from the calculator." };
  }

  return {
    handled: value.handled === true,
    error: typeof value.error === "string" ? value.error : undefined,
    nextRegion:
      typeof value.nextRegion === "string" && value.nextRegion in huaweiRegions
        ? (value.nextRegion as HuaweiRegionKey)
        : undefined,
    nextBillingMode:
      value.nextBillingMode === "Pay-per-use" ||
      value.nextBillingMode === "Yearly/Monthly" ||
      value.nextBillingMode === "RI" ||
      value.nextBillingMode === "One-time"
        ? value.nextBillingMode
        : undefined,
    nextUsageHours: typeof value.nextUsageHours === "string" ? value.nextUsageHours : undefined,
    nextInstanceCount: typeof value.nextInstanceCount === "string" ? value.nextInstanceCount : undefined,
  };
}

export function useConfigurableServiceRuntime({
  enabled = true,
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
  const [catalogs, setCatalogs] = useState<
    Record<string, { data: unknown; regionId: string | null; loading: boolean; error: string }>
  >({});
  const catalogKey = `${selectedServiceCode}:${regionValue}`;

  const typedRuntimeDefinition = getTypedDeclarativeRuntimeDefinitionByCode(selectedServiceCode);
  const isConfigurableService =
    selectedServiceDefinition?.implementation === "configurable" ||
    selectedServiceDefinition?.implementation === "config-pilot";

  const replaceServiceValues = useCallback((serviceCode: string, values: Record<string, string>) => {
    setServiceValuesByCode((current) => ({ ...current, [serviceCode]: values }));
  }, []);

  useEffect(() => {
    if (!selectedServiceDefinition) {
      return;
    }

    setServiceValuesByCode((current) =>
      current[selectedServiceCode]
        ? current
        : { ...current, [selectedServiceCode]: buildDefaultValues(selectedServiceDefinition) },
    );
  }, [selectedServiceCode, selectedServiceDefinition]);

  useEffect(() => {
    const catalogSource = typedRuntimeDefinition?.catalog as DeclarativeCatalogSource | undefined;

    if (!enabled || !isConfigurableService || !catalogSource) {
      return;
    }

    const activeCatalogSource = catalogSource;

    let cancelled = false;

    async function loadCatalog() {
      setCatalogs((current) => ({
        ...current,
        [catalogKey]: { data: null, regionId: null, loading: true, error: "" },
      }));

      try {
        const response = await fetch(
          `/api/catalog/${activeCatalogSource.route}?region=${encodeURIComponent(regionValue)}`,
          { cache: "no-store" },
        );
        const rawBody = await response.text();
        let payload: Record<string, unknown> = {};
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            const contentType = response.headers.get("content-type") ?? "unknown content-type";
            throw new Error(
              `Failed to load ${selectedServiceCode} pricing: received non-JSON response (${contentType})`,
            );
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

        setCatalogs((current) => ({
          ...current,
          [catalogKey]: {
            data: catalog,
            regionId: typeof catalogRegionId === "string" ? catalogRegionId : null,
            loading: false,
            error: "",
          },
        }));
      } catch (error) {
        if (!cancelled)
          setCatalogs((current) => ({
            ...current,
            [catalogKey]: {
              data: null,
              regionId: null,
              loading: false,
              error: error instanceof Error ? error.message : "Unable to load catalog",
            },
          }));
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [enabled, catalogKey, isConfigurableService, regionValue, selectedServiceCode, typedRuntimeDefinition?.catalog]);

  const activeValues = useMemo(
    () =>
      selectedServiceDefinition
        ? (serviceValuesByCode[selectedServiceCode] ?? buildDefaultValues(selectedServiceDefinition))
        : {},
    [selectedServiceCode, selectedServiceDefinition, serviceValuesByCode],
  );

  const pricingError = catalogs[catalogKey]?.error ?? "";
  const catalog = catalogs[catalogKey]?.data ?? null;
  const catalogRegionId = catalogs[catalogKey]?.regionId ?? null;

  const scope = useMemo(
    () =>
      selectedServiceDefinition
        ? evaluateServiceConfiguration(typedRuntimeDefinition, {
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
          })
        : null,
    [
      selectedServiceDefinition,
      typedRuntimeDefinition,
      selectedServiceCode,
      selectedService,
      activeValues,
      catalog,
      catalogRegionId,
      pricingError,
      regionValue,
      billingMode,
      usageHours,
      usageHoursValue,
      instanceCountValue,
    ],
  );
  const catalogView = scope?.catalogView ?? null;
  const estimate = scope?.estimate ?? null;

  useEffect(() => {
    if (!selectedServiceDefinition || !typedRuntimeDefinition?.syncValues) {
      return;
    }

    const nextValues = evaluateRuntimeValue<Record<string, unknown>>(
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

    selectedService,
    selectedServiceCode,
    selectedServiceDefinition,
    typedRuntimeDefinition,
    typedRuntimeDefinition?.syncValues,
    usageHours,
    usageHoursValue,
  ]);

  const activeBillingOptions = useMemo(() => {
    if (!selectedServiceDefinition) {
      return null;
    }
    const computed = evaluateRuntimeValue<unknown[]>(typedRuntimeDefinition?.activeBillingOptions, scope);
    if (
      Array.isArray(computed) &&
      computed.every(
        (entry) => entry === "Pay-per-use" || entry === "RI" || entry === "Yearly/Monthly" || entry === "One-time",
      )
    ) {
      return computed as BillingOption[];
    }
    return selectedServiceDefinition.billingOptions as BillingOption[];
  }, [scope, selectedServiceDefinition, typedRuntimeDefinition?.activeBillingOptions]);

  useEffect(() => {
    if (enabled && !activeBillingOptions?.includes(billingMode) && activeBillingOptions?.[0]) {
      setBillingMode(activeBillingOptions[0]);
    }
  }, [enabled, activeBillingOptions, billingMode, setBillingMode]);

  const showSharedUsageHours = useMemo(() => {
    if (!selectedServiceDefinition) {
      return true;
    }
    const computed = evaluateRuntimeValue<boolean>(typedRuntimeDefinition?.showSharedUsageHours, scope);
    return computed == null ? true : Boolean(computed);
  }, [scope, selectedServiceDefinition, typedRuntimeDefinition?.showSharedUsageHours]);

  const runtimeValues = useMemo(() => {
    if (!selectedServiceDefinition) {
      return {};
    }
    const computed =
      evaluateRuntimeValue<ServiceFieldRuntimeValues>(typedRuntimeDefinition?.visibilityContext, scope) ?? {};
    return {
      ...Object.fromEntries(Object.entries(activeValues).map(([key, value]) => [key, value])),
      ...(isRecord(computed) ? computed : {}),
      billingMode,
    };
  }, [activeValues, billingMode, scope, selectedServiceDefinition, typedRuntimeDefinition?.visibilityContext]);

  const setActiveFieldValue = useCallback(
    (fieldId: string, nextValue: string) => {
      setServiceValuesByCode((current) => ({
        ...current,
        [selectedServiceCode]: {
          ...(current[selectedServiceCode] ?? {}),
          [fieldId]: nextValue,
        },
      }));
    },
    [selectedServiceCode],
  );

  const { fieldOptionsById, fieldMinById, fieldMaxById, fieldDisabledById } = useMemo(() => {
    const fieldOptionsById: Record<string, Array<{ value: string; label: string }> | undefined> = {};
    const fieldMinById: Record<string, number | undefined> = {};
    const fieldMaxById: Record<string, number | undefined> = {};
    const fieldDisabledById: Record<string, boolean> = {};
    const sourceScope = { catalog, catalogView, values: activeValues, helpers: declarativeRuntimeHelpers };
    for (const field of selectedServiceDefinition?.fields ?? []) {
      const runtime = typedRuntimeDefinition?.fieldRuntime?.[field.id];
      const resolve = (key: "options" | "min" | "max") =>
        evaluateRuntimeValue(runtime?.[key], scope) ??
        (field[`${key}Source`] ? readPath(sourceScope, field[`${key}Source`]!) : field[key]);
      fieldOptionsById[field.id] = normalizeOptionList(resolve("options"));
      const min = resolve("min"),
        max = resolve("max");
      fieldMinById[field.id] = typeof min === "number" ? min : field.min;
      fieldMaxById[field.id] = typeof max === "number" ? max : field.max;
      fieldDisabledById[field.id] = Boolean(evaluateRuntimeValue(runtime?.disabled, scope) ?? false);
    }
    return { fieldOptionsById, fieldMinById, fieldMaxById, fieldDisabledById };
  }, [activeValues, catalog, catalogView, scope, selectedServiceDefinition, typedRuntimeDefinition?.fieldRuntime]);

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
      onChangeByFieldId: Object.fromEntries(
        selectedServiceDefinition.fields.map((field) => [
          field.id,
          (value: string) => setActiveFieldValue(field.id, value),
        ]),
      ),
      onBlurByFieldId: Object.fromEntries(
        selectedServiceDefinition.fields.map((field) => [
          field.id,
          () => {
            const typedRuntimeField = typedRuntimeDefinition?.fieldRuntime?.[field.id];
            if (!typedRuntimeField?.normalize) {
              return;
            }
            const normalized = evaluateRuntimeValue<string | number | boolean | null>(
              typedRuntimeField?.normalize,
              scope,
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

    const notes = normalizeStringList(evaluateRuntimeValue<unknown>(typedRuntimeDefinition?.panelNotes, scope));
    const effectiveNotes = notes.length > 0 ? notes : [...(selectedServiceDefinition.summary?.notes ?? [])];

    const selectionSummary =
      evaluateRuntimeValue<string>(typedRuntimeDefinition?.selectionSummary, scope) ??
      (selectedServiceDefinition.summary?.selectionTemplate
        ? buildSelectionTemplate(selectedServiceDefinition.summary.selectionTemplate, activeValues)
        : "Selected specifications:");

    const selectionNotes = normalizeStringList(
      evaluateRuntimeValue<unknown>(typedRuntimeDefinition?.selectionNotes, scope),
    );

    const referenceNote = evaluateRuntimeValue<string>(typedRuntimeDefinition?.referenceNote, scope) ?? undefined;

    return {
      definition: selectedServiceDefinition,
      fields,
      pricingError: pricingError || undefined,
      pricingLoadingMessage: catalogs[catalogKey]?.loading
        ? (typedRuntimeDefinition?.catalog?.loadingMessage ?? `Loading ${selectedServiceCode} pricing...`)
        : null,
      notes: effectiveNotes,
      selectionSummary,
      selectionNotes,
      referenceNote,
    };
  }, [
    activeValues,
    fieldDisabledById,
    fieldMaxById,
    fieldMinById,
    fieldOptionsById,
    isConfigurableService,
    pricingError,
    catalogs,
    catalogKey,
    runtimeValues,
    scope,
    selectedServiceCode,
    selectedServiceDefinition,
    setActiveFieldValue,
    typedRuntimeDefinition?.catalog?.loadingMessage,
    typedRuntimeDefinition?.fieldRuntime,
    typedRuntimeDefinition?.panelNotes,
    typedRuntimeDefinition?.referenceNote,
    typedRuntimeDefinition?.selectionNotes,
    typedRuntimeDefinition?.selectionSummary,
  ]);

  const selectedEstimate = useMemo(() => {
    if (
      !estimate ||
      typeof estimate.currency !== "string" ||
      typeof estimate.amount !== "number" ||
      typeof estimate.suffix !== "string"
    ) {
      return "USD 0.00";
    }
    return formatFlavorAmount(estimate.currency, estimate.amount, estimate.suffix);
  }, [estimate]);

  const addToListError = useMemo(() => {
    if (!selectedServiceDefinition) {
      return null;
    }
    const computed = evaluateRuntimeValue<string | null>(typedRuntimeDefinition?.addToListError, scope);
    return typeof computed === "string" ? computed : null;
  }, [scope, selectedServiceDefinition, typedRuntimeDefinition?.addToListError]);

  const applyDefaultsForServiceCode = useCallback(
    (serviceCode: string) => {
      const definition = getConfigurableServiceDefinitionByCode(serviceCode);
      if (!definition) {
        return;
      }

      const nextValues = buildDefaultValues(definition);
      replaceServiceValues(serviceCode, nextValues);
      const nextBillingMode = toBillingMode(
        nextValues.billingMode || definition.billingOptions[0],
        definition.billingOptions[0] ?? "Pay-per-use",
      );
      setBillingMode(nextBillingMode);
      if (typeof nextValues.usageHours === "string" && nextValues.usageHours) {
        updateUsageHours(nextValues.usageHours);
      }
    },
    [replaceServiceValues, setBillingMode, updateUsageHours],
  );

  const buildScopedCatalogView = useCallback(
    (
      values: Record<string, string>,
      nextBillingMode: BillingOption,
      nextUsageHours: string,
      nextUsageHoursValue: number,
      nextInstanceCountValue: number,
    ) => {
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

      return evaluateServiceConfiguration(typedRuntimeDefinition, baseScope).catalogView;
    },
    [
      catalog,
      catalogRegionId,
      pricingError,
      regionValue,

      selectedService,
      selectedServiceCode,
      selectedServiceDefinition,
      typedRuntimeDefinition,
    ],
  );

  const buildBatchScopeForItem = useCallback(
    (item: unknown) => {
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
        const nextCatalogView = buildScopedCatalogView(
          values,
          nextBillingMode,
          nextUsageHours,
          nextUsageHoursValue,
          nextInstanceCountValue,
        );
        const syncedValues = evaluateRuntimeValue<Record<string, unknown>>(
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
        catalogView: buildScopedCatalogView(
          values,
          nextBillingMode,
          nextUsageHours,
          nextUsageHoursValue,
          nextInstanceCountValue,
        ),
      };
    },
    [
      activeValues,
      billingMode,
      buildScopedCatalogView,
      catalog,
      catalogRegionId,
      instanceCountValue,
      pricingError,
      regionValue,

      selectedService,
      selectedServiceCode,
      selectedServiceDefinition,
      typedRuntimeDefinition,
      usageHours,
      usageHoursValue,
    ],
  );

  const buildRequestBodies = useCallback((): ProductMutationBody | ProductMutationBody[] | null => {
    if (!selectedServiceDefinition || !typedRuntimeDefinition?.buildRequestBodies) {
      return null;
    }

    return evaluateRuntimeValue<ProductMutationBody | ProductMutationBody[] | null>(
      typedRuntimeDefinition?.buildRequestBodies,
      scope,
    );
  }, [scope, selectedServiceDefinition, typedRuntimeDefinition?.buildRequestBodies]);

  const buildBatchRequestBodies = useCallback(
    (item: unknown): ProductMutationBody[] | null => {
      if (!selectedServiceDefinition) {
        return null;
      }

      if (typedRuntimeDefinition?.buildBatchRequestBodies) {
        const result = evaluateRuntimeValue<ProductMutationBody[] | ProductMutationBody | null>(
          typedRuntimeDefinition?.buildBatchRequestBodies,
          { ...scope, item },
        );

        if (!result) {
          return null;
        }
        return Array.isArray(result) ? result : [result];
      }

      if (!typedRuntimeDefinition?.buildRequestBodies) {
        return null;
      }

      const batchScope = buildBatchScopeForItem(item);
      if (!batchScope) {
        return null;
      }

      const result = evaluateRuntimeValue<ProductMutationBody[] | ProductMutationBody | null>(
        typedRuntimeDefinition.buildRequestBodies,
        evaluateServiceConfiguration(typedRuntimeDefinition, {
          definition: selectedServiceDefinition,
          selectedServiceCode,
          selectedService,
          catalog,
          catalogRegionId,
          pricingError,
          regionValue,
          ...batchScope,
          item,
        }),
      );

      if (!result) {
        return null;
      }
      return Array.isArray(result) ? result : [result];
    },
    [
      selectedServiceDefinition,
      typedRuntimeDefinition,
      buildBatchScopeForItem,
      selectedServiceCode,
      selectedService,
      catalog,
      catalogRegionId,
      pricingError,
      regionValue,
      scope,
    ],
  );

  const getAddSuccessMessage = useCallback(
    (input: { requestBodiesCount: number }) => {
      if (!selectedServiceDefinition || !typedRuntimeDefinition?.addSuccessMessage) {
        return null;
      }

      const result = evaluateRuntimeValue<string | null>(typedRuntimeDefinition?.addSuccessMessage, {
        ...scope,
        requestBodiesCount: input.requestBodiesCount,
      });

      return typeof result === "string" ? result : null;
    },
    [scope, selectedServiceDefinition, typedRuntimeDefinition?.addSuccessMessage],
  );

  const getUpdateSuccessMessage = useCallback(
    (input: { requestBodiesCount: number; extraRequestBodiesCount: number }) => {
      if (!selectedServiceDefinition || !typedRuntimeDefinition?.updateSuccessMessage) {
        return null;
      }

      const result = evaluateRuntimeValue<string | null>(typedRuntimeDefinition?.updateSuccessMessage, {
        ...scope,
        requestBodiesCount: input.requestBodiesCount,
        extraRequestBodiesCount: input.extraRequestBodiesCount,
      });

      return typeof result === "string" ? result : null;
    },
    [scope, selectedServiceDefinition, typedRuntimeDefinition?.updateSuccessMessage],
  );

  const getBatchSuccessMessage = useCallback(
    (input: { createdCount: number; expandedCount: number }) => {
      if (!selectedServiceDefinition || !typedRuntimeDefinition?.batchSuccessMessage) {
        return null;
      }

      const result = evaluateRuntimeValue<string | null>(typedRuntimeDefinition?.batchSuccessMessage, {
        ...scope,
        createdCount: input.createdCount,
        expandedCount: input.expandedCount,
      });

      return typeof result === "string" ? result : null;
    },
    [scope, selectedServiceDefinition, typedRuntimeDefinition?.batchSuccessMessage],
  );

  const hydrateProduct = useCallback(
    (product: AppProduct): EditHydrationResult => {
      if (!selectedServiceDefinition || !typedRuntimeDefinition?.hydrate) {
        return { handled: false, error: "This product cannot be edited from the calculator." };
      }

      const result = evaluateRuntimeValue<unknown>(typedRuntimeDefinition?.hydrate, { ...scope, product });

      if (isRecord(result) && isRecord(result.values)) {
        replaceServiceValues(
          selectedServiceCode,
          Object.fromEntries(Object.entries(result.values).map(([key, value]) => [key, stringifyConfigValue(value)])),
        );
      }

      return normalizeHydrationResult(result);
    },
    [replaceServiceValues, scope, selectedServiceCode, selectedServiceDefinition, typedRuntimeDefinition?.hydrate],
  );

  const batchPanel = useMemo(() => {
    if (!selectedServiceDefinition) {
      return null;
    }

    const evaluateBatchExpression = (typedExpression: TypedDeclarativeValue | undefined) =>
      evaluateRuntimeValue<string>(typedExpression, scope) ?? "";

    const typedBatchPanel = typedRuntimeDefinition?.batchPanel;

    if (!typedBatchPanel) {
      if (!isConfigurableService || !typedRuntimeDefinition?.buildRequestBodies) {
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
      placeholder: evaluateBatchExpression(typedBatchPanel?.placeholder),
      description: evaluateBatchExpression(typedBatchPanel?.description),
      defaults: evaluateBatchExpression(typedBatchPanel?.defaults),
      validation: evaluateBatchExpression(typedBatchPanel?.validation),
    };
  }, [
    activeValues,
    billingMode,
    isConfigurableService,
    scope,
    selectedService,
    selectedServiceDefinition,
    typedRuntimeDefinition?.batchPanel,
    typedRuntimeDefinition?.buildRequestBodies,
    usageHours,
  ]);

  return {
    isConfigurableService,
    usesSharedBillingHeader: typedRuntimeDefinition?.usesSharedBillingHeader ?? true,
    activeBillingOptions,
    panelProps: activePanelProps,
    selectedEstimate,
    quantityLabel: typedRuntimeDefinition?.quantityLabel ?? "Instance",
    showGlobalQuantityControl: typedRuntimeDefinition?.showGlobalQuantityControl ?? true,
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
