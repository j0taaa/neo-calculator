const billingOptions = ["Pay-per-use", "RI", "Yearly/Monthly", "One-time"] as const;
const definitionStatuses = ["pilot", "active", "deprecated"] as const;
const fieldTypes = ["select", "number", "checkbox"] as const;
const fieldInputModes = ["numeric", "decimal"] as const;
const metricQuantitySources = ["field", "expression"] as const;
const serviceImplementations = ["config-pilot", "configurable"] as const;

type ConfigScalar = string | number | boolean | null;

export {
  billingOptions,
  definitionStatuses,
  fieldTypes,
  fieldInputModes,
  metricQuantitySources,
  serviceImplementations,
};

export type { ConfigScalar };

export type BillingOption = (typeof billingOptions)[number];
export type DefinitionStatus = (typeof definitionStatuses)[number];
export type ServiceFieldType = (typeof fieldTypes)[number];
export type ServiceFieldInputMode = (typeof fieldInputModes)[number];
export type MetricQuantitySource = (typeof metricQuantitySources)[number];
export type ServiceImplementation = (typeof serviceImplementations)[number];

export type ServiceCatalogEntry = {
  name: string;
  code: string;
  icon: string;
};

export type ServiceDefinitionRegistryEntry = {
  serviceCode: string;
  definitionId: string;
  serviceDefinitionPath: string;
  pricingDefinitionPath: string;
  status: DefinitionStatus;
};

export type ServiceRegistryDocument = {
  version: 1;
  services: ServiceCatalogEntry[];
  supportedCalculatorServiceCodes: string[];
  supportedBatchAddServiceCodes: string[];
  freeAlwaysServiceCodes: string[];
  definitions: ServiceDefinitionRegistryEntry[];
};

export type ServiceFieldCondition = {
  field: string;
  equals?: Exclude<ConfigScalar, null>;
  notEquals?: Exclude<ConfigScalar, null>;
  in?: Array<Exclude<ConfigScalar, null>>;
};

export type ServiceFieldDefinition = {
  id: string;
  type: ServiceFieldType;
  label: string;
  description?: string;
  required?: boolean;
  unit?: string;
  inputMode?: ServiceFieldInputMode;
  step?: number;
  min?: number;
  max?: number;
  minSource?: string;
  maxSource?: string;
  options?: Array<string | number>;
  optionsSource?: string;
  visibleWhen?: ServiceFieldCondition;
  visibleWhenAll?: ServiceFieldCondition[];
};

export type ServiceDefinition = {
  version: 1;
  definitionId: string;
  serviceCode: string;
  serviceName: string;
  icon: string;
  implementation: ServiceImplementation;
  billingOptions: BillingOption[];
  defaults: Record<string, ConfigScalar>;
  fields: ServiceFieldDefinition[];
  summary?: {
    selectionTemplate?: string;
    notes?: string[];
  };
  batchAdd?: {
    supported?: boolean;
    example?: unknown[];
    notes?: string[];
  };
};

export type PricingMetricDefinition = {
  id: string;
  label: string;
  rateSource: string;
  quantity: {
    source: MetricQuantitySource;
    field?: string;
    expression?: string;
  };
  unit?: string;
  enabledWhen?: ServiceFieldCondition;
  notes?: string[];
};

export type PricingDefinition = {
  version: 1;
  definitionId: string;
  serviceCode: string;
  serviceName: string;
  catalogAdapter: string;
  rateSources: Record<string, { catalogKey: string; description?: string }>;
  metrics: PricingMetricDefinition[];
};

export type ConfigurableServiceBundle = {
  metadata: ServiceDefinitionRegistryEntry;
  service: ServiceDefinition;
  pricing: PricingDefinition;
};

export type ServiceFieldRuntimeValues = Record<string, ConfigScalar | undefined>;
