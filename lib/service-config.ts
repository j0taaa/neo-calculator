import { serviceRegistryDocument } from "@/config/services/index";
import { pricingDefinition as apigPricingDefinitionDocument, serviceDefinition as apigServiceDefinitionDocument } from "@/config/services/apig/bundle";
import { pricingDefinition as cbhPricingDefinitionDocument, serviceDefinition as cbhServiceDefinitionDocument } from "@/config/services/cbh/bundle";
import { pricingDefinition as cbrPricingDefinitionDocument, serviceDefinition as cbrServiceDefinitionDocument } from "@/config/services/cbr/bundle";
import { pricingDefinition as ccePricingDefinitionDocument, serviceDefinition as cceServiceDefinitionDocument } from "@/config/services/cce/bundle";
import { pricingDefinition as cciPricingDefinitionDocument, serviceDefinition as cciServiceDefinitionDocument } from "@/config/services/cci/bundle";
import { pricingDefinition as dcsPricingDefinitionDocument, serviceDefinition as dcsServiceDefinitionDocument } from "@/config/services/dcs/bundle";
import { pricingDefinition as dcPricingDefinitionDocument, serviceDefinition as dcServiceDefinitionDocument } from "@/config/services/dc/bundle";
import { pricingDefinition as eipPricingDefinitionDocument, serviceDefinition as eipServiceDefinitionDocument } from "@/config/services/eip/bundle";
import { pricingDefinition as elbPricingDefinitionDocument, serviceDefinition as elbServiceDefinitionDocument } from "@/config/services/elb/bundle";
import { pricingDefinition as evsPricingDefinitionDocument, serviceDefinition as evsServiceDefinitionDocument } from "@/config/services/evs/bundle";
import { pricingDefinition as erPricingDefinitionDocument, serviceDefinition as erServiceDefinitionDocument } from "@/config/services/er/bundle";
import { pricingDefinition as flexusRdsPricingDefinitionDocument, serviceDefinition as flexusRdsServiceDefinitionDocument } from "@/config/services/flexus-rds/bundle";
import { pricingDefinition as functionGraphPricingDefinitionDocument, serviceDefinition as functionGraphServiceDefinitionDocument } from "@/config/services/functiongraph/bundle";
import { pricingDefinition as modelartsPricingDefinitionDocument, serviceDefinition as modelartsServiceDefinitionDocument } from "@/config/services/modelarts/bundle";
import { pricingDefinition as natPricingDefinitionDocument, serviceDefinition as natServiceDefinitionDocument } from "@/config/services/nat/bundle";
import { pricingDefinition as obsPricingDefinitionDocument, serviceDefinition as obsServiceDefinitionDocument } from "@/config/services/obs/bundle";
import { pricingDefinition as rdsPricingDefinitionDocument, serviceDefinition as rdsServiceDefinitionDocument } from "@/config/services/rds/bundle";
import { pricingDefinition as sfsPricingDefinitionDocument, serviceDefinition as sfsServiceDefinitionDocument } from "@/config/services/sfs/bundle";
import { pricingDefinition as vpcepPricingDefinitionDocument, serviceDefinition as vpcepServiceDefinitionDocument } from "@/config/services/vpcep/bundle";
import { pricingDefinition as vpnPricingDefinitionDocument, serviceDefinition as vpnServiceDefinitionDocument } from "@/config/services/vpn/bundle";
import { pricingDefinition as workspacePricingDefinitionDocument, serviceDefinition as workspaceServiceDefinitionDocument } from "@/config/services/workspace/bundle";
import {
  billingOptions,
  definitionStatuses,
  fieldInputModes,
  fieldTypes,
  metricQuantitySources,
  serviceImplementations,
  type BillingOption,
  type ConfigScalar,
  type ConfigurableServiceBundle,
  type DefinitionStatus,
  type MetricQuantitySource,
  type PricingDefinition,
  type PricingMetricDefinition,
  type ServiceCatalogEntry,
  type ServiceDefinition,
  type ServiceDefinitionRegistryEntry,
  type ServiceFieldCondition,
  type ServiceFieldDefinition,
  type ServiceFieldInputMode,
  type ServiceFieldRuntimeValues,
  type ServiceFieldType,
  type ServiceImplementation,
  type ServiceRegistryDocument,
} from "@/lib/service-config-types";

export type {
  BillingOption,
  ConfigScalar,
  ConfigurableServiceBundle,
  DefinitionStatus,
  MetricQuantitySource,
  PricingDefinition,
  PricingMetricDefinition,
  ServiceCatalogEntry,
  ServiceDefinition,
  ServiceDefinitionRegistryEntry,
  ServiceFieldCondition,
  ServiceFieldDefinition,
  ServiceFieldInputMode,
  ServiceFieldRuntimeValues,
  ServiceFieldType,
  ServiceImplementation,
  ServiceRegistryDocument,
} from "@/lib/service-config-types";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid service config: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isConfigScalar(value: unknown): value is ConfigScalar {
  return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUrlString(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseStringArray(value: unknown, path: string): string[] {
  invariant(Array.isArray(value), `${path} must be an array`);
  const normalized = value.map((entry, index) => {
    invariant(isNonEmptyString(entry), `${path}[${index}] must be a non-empty string`);
    return entry;
  });
  return normalized;
}

function parseCondition(value: unknown, path: string): ServiceFieldCondition {
  invariant(isRecord(value), `${path} must be an object`);
  invariant(isNonEmptyString(value.field), `${path}.field must be a non-empty string`);
  const condition: ServiceFieldCondition = { field: value.field };

  if ("equals" in value) {
    invariant(value.equals !== null && isConfigScalar(value.equals), `${path}.equals must be a string, number, or boolean`);
    condition.equals = value.equals;
  }
  if ("notEquals" in value) {
    invariant(value.notEquals !== null && isConfigScalar(value.notEquals), `${path}.notEquals must be a string, number, or boolean`);
    condition.notEquals = value.notEquals;
  }
  if ("in" in value) {
    invariant(Array.isArray(value.in) && value.in.length > 0, `${path}.in must be a non-empty array`);
    condition.in = value.in.map((entry, index) => {
      invariant(entry !== null && isConfigScalar(entry), `${path}.in[${index}] must be a string, number, or boolean`);
      return entry as Exclude<ConfigScalar, null>;
    });
  }

  return condition;
}

function parseFieldDefinition(value: unknown, path: string): ServiceFieldDefinition {
  invariant(isRecord(value), `${path} must be an object`);
  invariant(isNonEmptyString(value.id), `${path}.id must be a non-empty string`);
  invariant(isNonEmptyString(value.label), `${path}.label must be a non-empty string`);
  invariant(typeof value.type === "string" && fieldTypes.includes(value.type as ServiceFieldType), `${path}.type is invalid`);

  const field: ServiceFieldDefinition = {
    id: value.id,
    type: value.type as ServiceFieldType,
    label: value.label,
  };

  if ("description" in value) {
    invariant(typeof value.description === "string", `${path}.description must be a string`);
    field.description = value.description;
  }
  if ("required" in value) {
    invariant(typeof value.required === "boolean", `${path}.required must be a boolean`);
    field.required = value.required;
  }
  if ("unit" in value) {
    invariant(typeof value.unit === "string", `${path}.unit must be a string`);
    field.unit = value.unit;
  }
  if ("inputMode" in value) {
    invariant(
      typeof value.inputMode === "string" && fieldInputModes.includes(value.inputMode as ServiceFieldInputMode),
      `${path}.inputMode is invalid`,
    );
    field.inputMode = value.inputMode as ServiceFieldInputMode;
  }
  if ("step" in value) {
    invariant(isFiniteNumber(value.step), `${path}.step must be a finite number`);
    field.step = value.step;
  }
  if ("min" in value) {
    invariant(isFiniteNumber(value.min), `${path}.min must be a finite number`);
    field.min = value.min;
  }
  if ("max" in value) {
    invariant(isFiniteNumber(value.max), `${path}.max must be a finite number`);
    field.max = value.max;
  }
  if ("minSource" in value) {
    invariant(isNonEmptyString(value.minSource), `${path}.minSource must be a non-empty string`);
    field.minSource = value.minSource;
  }
  if ("maxSource" in value) {
    invariant(isNonEmptyString(value.maxSource), `${path}.maxSource must be a non-empty string`);
    field.maxSource = value.maxSource;
  }
  if ("options" in value) {
    invariant(Array.isArray(value.options), `${path}.options must be an array`);
    field.options = value.options.map((entry, index) => {
      invariant(typeof entry === "string" || isFiniteNumber(entry), `${path}.options[${index}] must be a string or number`);
      return entry;
    });
  }
  if ("optionsSource" in value) {
    invariant(isNonEmptyString(value.optionsSource), `${path}.optionsSource must be a non-empty string`);
    field.optionsSource = value.optionsSource;
  }
  if ("visibleWhen" in value) {
    field.visibleWhen = parseCondition(value.visibleWhen, `${path}.visibleWhen`);
  }
  if ("visibleWhenAll" in value) {
    invariant(Array.isArray(value.visibleWhenAll), `${path}.visibleWhenAll must be an array`);
    field.visibleWhenAll = value.visibleWhenAll.map((entry, index) => parseCondition(entry, `${path}.visibleWhenAll[${index}]`));
  }

  return field;
}

function parseServiceRegistryDocument(value: unknown): ServiceRegistryDocument {
  invariant(isRecord(value), "service registry root must be an object");
  invariant(value.version === 1, "service registry version must be 1");
  invariant(Array.isArray(value.services) && value.services.length > 0, "services must be a non-empty array");

  const services = value.services.map((entry, index) => {
    invariant(isRecord(entry), `services[${index}] must be an object`);
    invariant(isNonEmptyString(entry.name), `services[${index}].name must be a non-empty string`);
    invariant(isNonEmptyString(entry.code), `services[${index}].code must be a non-empty string`);
    invariant(isUrlString(entry.icon), `services[${index}].icon must be a valid URL`);
    return {
      name: entry.name,
      code: entry.code,
      icon: entry.icon,
    } satisfies ServiceCatalogEntry;
  });

  const seenCodes = new Set<string>();
  for (const service of services) {
    invariant(!seenCodes.has(service.code), `service code ${service.code} is duplicated`);
    seenCodes.add(service.code);
  }

  const supportedCalculatorServiceCodes = parseStringArray(value.supportedCalculatorServiceCodes, "supportedCalculatorServiceCodes");
  const supportedBatchAddServiceCodes = parseStringArray(value.supportedBatchAddServiceCodes, "supportedBatchAddServiceCodes");

  for (const serviceCode of [...supportedCalculatorServiceCodes, ...supportedBatchAddServiceCodes]) {
    invariant(seenCodes.has(serviceCode), `${serviceCode} is referenced as supported but missing from services`);
  }

  invariant(Array.isArray(value.definitions), "definitions must be an array");
  const definitions = value.definitions.map((entry, index) => {
    invariant(isRecord(entry), `definitions[${index}] must be an object`);
    invariant(isNonEmptyString(entry.serviceCode), `definitions[${index}].serviceCode must be a non-empty string`);
    invariant(seenCodes.has(entry.serviceCode), `definitions[${index}].serviceCode must match a service in the registry`);
    invariant(isNonEmptyString(entry.definitionId), `definitions[${index}].definitionId must be a non-empty string`);
    invariant(isNonEmptyString(entry.serviceDefinitionPath), `definitions[${index}].serviceDefinitionPath must be a non-empty string`);
    invariant(isNonEmptyString(entry.pricingDefinitionPath), `definitions[${index}].pricingDefinitionPath must be a non-empty string`);
    invariant(
      typeof entry.status === "string" && definitionStatuses.includes(entry.status as DefinitionStatus),
      `definitions[${index}].status is invalid`,
    );
    return {
      serviceCode: entry.serviceCode,
      definitionId: entry.definitionId,
      serviceDefinitionPath: entry.serviceDefinitionPath,
      pricingDefinitionPath: entry.pricingDefinitionPath,
      status: entry.status as DefinitionStatus,
    } satisfies ServiceDefinitionRegistryEntry;
  });

  return {
    version: 1,
    services,
    supportedCalculatorServiceCodes,
    supportedBatchAddServiceCodes,
    definitions,
  };
}

function parseServiceDefinition(value: unknown): ServiceDefinition {
  invariant(isRecord(value), "service definition root must be an object");
  invariant(value.version === 1, "service definition version must be 1");
  invariant(isNonEmptyString(value.definitionId), "service definition definitionId must be a non-empty string");
  invariant(isNonEmptyString(value.serviceCode), "service definition serviceCode must be a non-empty string");
  invariant(isNonEmptyString(value.serviceName), "service definition serviceName must be a non-empty string");
  invariant(isUrlString(value.icon), "service definition icon must be a valid URL");
  invariant(
    typeof value.implementation === "string" && serviceImplementations.includes(value.implementation as ServiceImplementation),
    "service definition implementation is invalid",
  );
  invariant(Array.isArray(value.billingOptions) && value.billingOptions.length > 0, "service definition billingOptions must be a non-empty array");

  const parsedBillingOptions = value.billingOptions.map((entry, index) => {
    invariant(typeof entry === "string" && billingOptions.includes(entry as BillingOption), `billingOptions[${index}] is invalid`);
    return entry as BillingOption;
  });

  invariant(isRecord(value.defaults), "service definition defaults must be an object");
  const defaults = Object.fromEntries(
    Object.entries(value.defaults).map(([key, entry]) => {
      invariant(isConfigScalar(entry), `defaults.${key} must be a scalar value`);
      return [key, entry];
    }),
  );

  invariant(Array.isArray(value.fields) && value.fields.length > 0, "service definition fields must be a non-empty array");
  const fields = value.fields.map((entry, index) => parseFieldDefinition(entry, `fields[${index}]`));

  const seenFieldIds = new Set<string>();
  for (const field of fields) {
    invariant(!seenFieldIds.has(field.id), `field id ${field.id} is duplicated`);
    seenFieldIds.add(field.id);
  }

  const definition: ServiceDefinition = {
    version: 1,
    definitionId: value.definitionId,
    serviceCode: value.serviceCode,
    serviceName: value.serviceName,
    icon: value.icon,
    implementation: value.implementation as ServiceImplementation,
    billingOptions: parsedBillingOptions,
    defaults,
    fields,
  };

  if ("summary" in value) {
    invariant(isRecord(value.summary), "service definition summary must be an object");
    definition.summary = {};
    if ("selectionTemplate" in value.summary) {
      invariant(typeof value.summary.selectionTemplate === "string", "summary.selectionTemplate must be a string");
      definition.summary.selectionTemplate = value.summary.selectionTemplate;
    }
    if ("notes" in value.summary) {
      definition.summary.notes = parseStringArray(value.summary.notes, "summary.notes");
    }
  }

  if ("batchAdd" in value) {
    invariant(isRecord(value.batchAdd), "service definition batchAdd must be an object");
    definition.batchAdd = {};
    if ("supported" in value.batchAdd) {
      invariant(typeof value.batchAdd.supported === "boolean", "batchAdd.supported must be a boolean");
      definition.batchAdd.supported = value.batchAdd.supported;
    }
    if ("example" in value.batchAdd) {
      invariant(Array.isArray(value.batchAdd.example), "batchAdd.example must be an array");
      definition.batchAdd.example = value.batchAdd.example;
    }
    if ("notes" in value.batchAdd) {
      definition.batchAdd.notes = parseStringArray(value.batchAdd.notes, "batchAdd.notes");
    }
  }

  return definition;
}

function parsePricingDefinition(value: unknown): PricingDefinition {
  invariant(isRecord(value), "pricing definition root must be an object");
  invariant(value.version === 1, "pricing definition version must be 1");
  invariant(isNonEmptyString(value.definitionId), "pricing definition definitionId must be a non-empty string");
  invariant(isNonEmptyString(value.serviceCode), "pricing definition serviceCode must be a non-empty string");
  invariant(isNonEmptyString(value.serviceName), "pricing definition serviceName must be a non-empty string");
  invariant(isNonEmptyString(value.catalogAdapter), "pricing definition catalogAdapter must be a non-empty string");
  invariant(isRecord(value.rateSources), "pricing definition rateSources must be an object");

  const rateSources = Object.fromEntries(
    Object.entries(value.rateSources).map(([key, entry]) => {
      invariant(isRecord(entry), `rateSources.${key} must be an object`);
      invariant(isNonEmptyString(entry.catalogKey), `rateSources.${key}.catalogKey must be a non-empty string`);
      if ("description" in entry) {
        invariant(typeof entry.description === "string", `rateSources.${key}.description must be a string`);
      }
      return [
        key,
        {
          catalogKey: entry.catalogKey,
          ...(typeof entry.description === "string" ? { description: entry.description } : {}),
        },
      ];
    }),
  );

  invariant(Array.isArray(value.metrics) && value.metrics.length > 0, "pricing definition metrics must be a non-empty array");
  const metrics = value.metrics.map((entry, index) => {
    invariant(isRecord(entry), `metrics[${index}] must be an object`);
    invariant(isNonEmptyString(entry.id), `metrics[${index}].id must be a non-empty string`);
    invariant(isNonEmptyString(entry.label), `metrics[${index}].label must be a non-empty string`);
    invariant(isNonEmptyString(entry.rateSource), `metrics[${index}].rateSource must be a non-empty string`);
    invariant(isRecord(entry.quantity), `metrics[${index}].quantity must be an object`);
    invariant(
      typeof entry.quantity.source === "string" && metricQuantitySources.includes(entry.quantity.source as MetricQuantitySource),
      `metrics[${index}].quantity.source is invalid`,
    );
    if (entry.quantity.source === "field") {
      invariant(isNonEmptyString(entry.quantity.field), `metrics[${index}].quantity.field must be a non-empty string`);
    }
    if (entry.quantity.source === "expression") {
      invariant(isNonEmptyString(entry.quantity.expression), `metrics[${index}].quantity.expression must be a non-empty string`);
    }
    if ("unit" in entry) {
      invariant(typeof entry.unit === "string", `metrics[${index}].unit must be a string`);
    }
    if ("enabledWhen" in entry) {
      parseCondition(entry.enabledWhen, `metrics[${index}].enabledWhen`);
    }
    if ("notes" in entry) {
      parseStringArray(entry.notes, `metrics[${index}].notes`);
    }

    return {
      id: entry.id,
      label: entry.label,
      rateSource: entry.rateSource,
      quantity: {
        source: entry.quantity.source as MetricQuantitySource,
        ...(isNonEmptyString(entry.quantity.field) ? { field: entry.quantity.field } : {}),
        ...(isNonEmptyString(entry.quantity.expression) ? { expression: entry.quantity.expression } : {}),
      },
      ...(typeof entry.unit === "string" ? { unit: entry.unit } : {}),
      ...(entry.enabledWhen ? { enabledWhen: parseCondition(entry.enabledWhen, `metrics[${index}].enabledWhen`) } : {}),
      ...(entry.notes ? { notes: parseStringArray(entry.notes, `metrics[${index}].notes`) } : {}),
    } satisfies PricingMetricDefinition;
  });

  for (const metric of metrics) {
    invariant(rateSources[metric.rateSource], `pricing definition metric ${metric.id} references missing rate source ${metric.rateSource}`);
  }

  return {
    version: 1,
    definitionId: value.definitionId,
    serviceCode: value.serviceCode,
    serviceName: value.serviceName,
    catalogAdapter: value.catalogAdapter,
    rateSources,
    metrics,
  };
}

const serviceRegistry = parseServiceRegistryDocument(serviceRegistryDocument);

const definitionDocuments = {
  apig: {
    service: parseServiceDefinition(apigServiceDefinitionDocument),
    pricing: parsePricingDefinition(apigPricingDefinitionDocument),
  },
  cbh: {
    service: parseServiceDefinition(cbhServiceDefinitionDocument),
    pricing: parsePricingDefinition(cbhPricingDefinitionDocument),
  },
  cbr: {
    service: parseServiceDefinition(cbrServiceDefinitionDocument),
    pricing: parsePricingDefinition(cbrPricingDefinitionDocument),
  },
  cce: {
    service: parseServiceDefinition(cceServiceDefinitionDocument),
    pricing: parsePricingDefinition(ccePricingDefinitionDocument),
  },
  cci: {
    service: parseServiceDefinition(cciServiceDefinitionDocument),
    pricing: parsePricingDefinition(cciPricingDefinitionDocument),
  },
  dcs: {
    service: parseServiceDefinition(dcsServiceDefinitionDocument),
    pricing: parsePricingDefinition(dcsPricingDefinitionDocument),
  },
  dc: {
    service: parseServiceDefinition(dcServiceDefinitionDocument),
    pricing: parsePricingDefinition(dcPricingDefinitionDocument),
  },
  elb: {
    service: parseServiceDefinition(elbServiceDefinitionDocument),
    pricing: parsePricingDefinition(elbPricingDefinitionDocument),
  },
  eip: {
    service: parseServiceDefinition(eipServiceDefinitionDocument),
    pricing: parsePricingDefinition(eipPricingDefinitionDocument),
  },
  evs: {
    service: parseServiceDefinition(evsServiceDefinitionDocument),
    pricing: parsePricingDefinition(evsPricingDefinitionDocument),
  },
  er: {
    service: parseServiceDefinition(erServiceDefinitionDocument),
    pricing: parsePricingDefinition(erPricingDefinitionDocument),
  },
  functiongraph: {
    service: parseServiceDefinition(functionGraphServiceDefinitionDocument),
    pricing: parsePricingDefinition(functionGraphPricingDefinitionDocument),
  },
  "flexus-rds": {
    service: parseServiceDefinition(flexusRdsServiceDefinitionDocument),
    pricing: parsePricingDefinition(flexusRdsPricingDefinitionDocument),
  },
  nat: {
    service: parseServiceDefinition(natServiceDefinitionDocument),
    pricing: parsePricingDefinition(natPricingDefinitionDocument),
  },
  modelarts: {
    service: parseServiceDefinition(modelartsServiceDefinitionDocument),
    pricing: parsePricingDefinition(modelartsPricingDefinitionDocument),
  },
  obs: {
    service: parseServiceDefinition(obsServiceDefinitionDocument),
    pricing: parsePricingDefinition(obsPricingDefinitionDocument),
  },
  rds: {
    service: parseServiceDefinition(rdsServiceDefinitionDocument),
    pricing: parsePricingDefinition(rdsPricingDefinitionDocument),
  },
  sfs: {
    service: parseServiceDefinition(sfsServiceDefinitionDocument),
    pricing: parsePricingDefinition(sfsPricingDefinitionDocument),
  },
  vpcep: {
    service: parseServiceDefinition(vpcepServiceDefinitionDocument),
    pricing: parsePricingDefinition(vpcepPricingDefinitionDocument),
  },
  vpn: {
    service: parseServiceDefinition(vpnServiceDefinitionDocument),
    pricing: parsePricingDefinition(vpnPricingDefinitionDocument),
  },
  workspace: {
    service: parseServiceDefinition(workspaceServiceDefinitionDocument),
    pricing: parsePricingDefinition(workspacePricingDefinitionDocument),
  },
} as const;

const configurableServiceBundles = new Map<string, ConfigurableServiceBundle>();

for (const metadata of serviceRegistry.definitions) {
  const bundle = definitionDocuments[metadata.definitionId as keyof typeof definitionDocuments];
  invariant(bundle, `missing imported definition bundle for ${metadata.definitionId}`);
  invariant(bundle.service.definitionId === metadata.definitionId, `${metadata.definitionId} service definitionId does not match registry metadata`);
  invariant(bundle.pricing.definitionId === metadata.definitionId, `${metadata.definitionId} pricing definitionId does not match registry metadata`);
  invariant(bundle.service.serviceCode === metadata.serviceCode, `${metadata.definitionId} service code does not match registry metadata`);
  invariant(bundle.pricing.serviceCode === metadata.serviceCode, `${metadata.definitionId} pricing code does not match registry metadata`);

  configurableServiceBundles.set(metadata.serviceCode, {
    metadata,
    service: bundle.service,
    pricing: bundle.pricing,
  });
}

export const serviceCatalog = serviceRegistry.services;
export const supportedCalculatorServiceCodes = [...serviceRegistry.supportedCalculatorServiceCodes];
export const supportedBatchAddServiceCodes = [...serviceRegistry.supportedBatchAddServiceCodes];
export const configurableServiceCodes = [...configurableServiceBundles.keys()];

export function findServiceCatalogEntry(serviceCode: string, serviceName?: string) {
  return serviceCatalog.find((service) => service.code === serviceCode)
    ?? (serviceName ? serviceCatalog.find((service) => service.name === serviceName) : null)
    ?? null;
}

export function getConfigurableServiceBundleByCode(serviceCode: string) {
  return configurableServiceBundles.get(serviceCode) ?? null;
}

export function getConfigurableServiceDefinitionByCode(serviceCode: string) {
  return getConfigurableServiceBundleByCode(serviceCode)?.service ?? null;
}

export function getConfigurablePricingDefinitionByCode(serviceCode: string) {
  return getConfigurableServiceBundleByCode(serviceCode)?.pricing ?? null;
}

export function getConfiguredBillingOptions(serviceCode: string): BillingOption[] | null {
  const definition = getConfigurableServiceDefinitionByCode(serviceCode);
  return definition ? [...definition.billingOptions] : null;
}

function scalarMatchesConditionValue(left: ConfigScalar | undefined, right: Exclude<ConfigScalar, null>) {
  if (left == null) {
    return false;
  }

  return String(left) === String(right);
}

export function matchesServiceFieldCondition(values: ServiceFieldRuntimeValues, condition: ServiceFieldCondition) {
  const actualValue = values[condition.field];

  if (condition.equals !== undefined && !scalarMatchesConditionValue(actualValue, condition.equals)) {
    return false;
  }

  if (condition.notEquals !== undefined && scalarMatchesConditionValue(actualValue, condition.notEquals)) {
    return false;
  }

  if (condition.in && !condition.in.some((candidate) => scalarMatchesConditionValue(actualValue, candidate))) {
    return false;
  }

  return true;
}

export function isServiceFieldVisible(field: ServiceFieldDefinition, values: ServiceFieldRuntimeValues) {
  if (field.visibleWhen && !matchesServiceFieldCondition(values, field.visibleWhen)) {
    return false;
  }

  if (field.visibleWhenAll && !field.visibleWhenAll.every((condition) => matchesServiceFieldCondition(values, condition))) {
    return false;
  }

  return true;
}
