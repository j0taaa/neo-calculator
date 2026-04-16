import {
  findServiceCatalogEntry,
  getConfigurableServiceBundleByCode,
  serviceCatalog,
  type ServiceFieldDefinition,
  type ConfigurableServiceBundle,
} from "@/lib/service-config";
import { systemDiskOptions } from "@/lib/configurable-runtime-utils";
import { flexusLPlans } from "@/lib/flexus-l-catalog";

export const revalidate = 3600;
export const runtime = "nodejs";

type JsonSchema = Record<string, unknown>;

const ECS_SERVICE_CODE = "ECS";
const FLEXUS_L_SERVICE_CODE = "Flexus L";

function fieldToSchema(field: ServiceFieldDefinition): JsonSchema {
  switch (field.type) {
    case "select": {
      if (field.options && field.options.length > 0) {
        return {
          type: "string",
          enum: [...field.options.map(String)],
          description: field.label,
        };
      }
      return {
        type: "string",
        description: `${field.label} (values from catalog)`,
      };
    }
    case "number": {
      const schema: JsonSchema = {
        type: "integer",
        description: field.label,
      };
      if (field.min !== undefined) schema.minimum = field.min;
      if (field.max !== undefined) schema.maximum = field.max;
      if (field.step !== undefined) schema.multipleOf = field.step;
      if (field.unit) schema.description = `${field.label} (${field.unit})`;
      return schema;
    }
    case "checkbox":
      return {
        type: "boolean",
        description: field.label,
      };
  }
}

function buildConfigSchema(bundle: ConfigurableServiceBundle): JsonSchema {
  const { service } = bundle;
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  const commonFields: Record<string, JsonSchema> = {
    region: {
      type: "string",
      description:
        "Huawei Cloud region key (e.g. 'ap-southeast-1', 'la-sao-paulo1')",
    },
    billingMode: {
      type: "string",
      enum: service.billingOptions,
      description: "Billing mode for this product",
    },
  };

  if (service.defaults.usageHours !== undefined) {
    commonFields.usageHours = {
      type: "integer",
      minimum: 1,
      maximum: 87600,
      description: "Usage duration in hours",
    };
  }

  for (const field of service.fields) {
    const schema = fieldToSchema(field);
    if (field.required) {
      required.push(field.id);
    }
    properties[field.id] = schema;
  }

  for (const [key, schema] of Object.entries(commonFields)) {
    if (!(key in properties)) {
      properties[key] = schema;
    }
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: true,
  };
}

function buildPricingSchema(bundle: ConfigurableServiceBundle): JsonSchema {
  const { pricing } = bundle;
  const properties: Record<string, JsonSchema> = {
    total: {
      type: "string",
      description: "Formatted total price (e.g. 'USD 19.00/mo')",
    },
  };

  for (const metric of pricing.metrics) {
    properties[metric.id] = {
      type: "string",
      description: metric.label + (metric.unit ? ` (${metric.unit})` : ""),
    };
  }

  return {
    type: "object",
    properties,
    additionalProperties: true,
    description: "Optional pricing metadata for display purposes",
  };
}

function buildDefaultsObject(bundle: ConfigurableServiceBundle): Record<string, unknown> {
  const { service } = bundle;
  const defaults: Record<string, unknown> = {};

  for (const field of service.fields) {
    const defaultValue = service.defaults[field.id];
    if (defaultValue !== undefined) {
      defaults[field.id] = defaultValue;
    }
  }

  return defaults;
}

function buildEcsConfigSchema(): JsonSchema {
  return {
    type: "object",
    description: "ECS instance configuration",
    properties: {
      region: {
        type: "string",
        description: "Huawei Cloud region key (e.g. 'ap-southeast-1', 'la-sao-paulo1')",
      },
      billingMode: {
        type: "string",
        enum: ["Pay-per-use", "Yearly/Monthly", "RI"],
        description: "Billing mode for this ECS instance",
      },
      usageHours: {
        type: ["integer", "null"],
        minimum: 1,
        maximum: 87600,
        description: "Usage duration in hours. Required when billingMode is 'Pay-per-use', null otherwise.",
      },
      description: {
        type: "string",
        description: "Flavor description or service name",
      },
      flavor: {
        type: "string",
        description: "ECS flavor resourceSpecCode (e.g. 'c7.large.2'). Values come from the ECS flavor catalog.",
      },
      vcpu: {
        type: "integer",
        minimum: 1,
        description: "Number of vCPUs",
      },
      ramGiB: {
        type: "integer",
        minimum: 1,
        description: "RAM in GiB",
      },
      systemDisk: {
        type: "object",
        description: "System disk configuration",
        properties: {
          type: {
            type: "string",
            enum: [...systemDiskOptions],
            description: "System disk type",
          },
          sizeGiB: {
            type: "integer",
            minimum: 40,
            maximum: 1024,
            description: "System disk size in GiB",
          },
          iops: {
            type: "integer",
            minimum: 3000,
            maximum: 128000,
            description: "IOPS. Only applicable when type is 'General Purpose SSD V2'. Max is min(128000, floor(sizeGiB * 500)).",
          },
          throughput: {
            type: "integer",
            minimum: 125,
            maximum: 1000,
            description: "Throughput in MB/s. Only applicable when type is 'General Purpose SSD V2'. Max is min(1000, floor(iops / 4)).",
          },
        },
        required: ["type", "sizeGiB"],
        additionalProperties: false,
      },
    },
    required: ["region", "billingMode", "flavor", "vcpu", "ramGiB", "systemDisk"],
    additionalProperties: true,
  };
}

function buildEcsPricingSchema(): JsonSchema {
  return {
    type: "object",
    description: "Optional pricing metadata for display purposes",
    properties: {
      total: {
        type: "string",
        description: "Formatted total price including flavor and disk (e.g. 'USD 42.50/mo')",
      },
      flavor: {
        type: ["string", "null"],
        description: "Formatted flavor-only price (e.g. 'USD 32.00/mo')",
      },
      disk: {
        type: ["string", "null"],
        description: "Formatted disk-only price (e.g. 'USD 10.50/mo')",
      },
    },
    additionalProperties: true,
  };
}

function buildFlexusLConfigSchema(): JsonSchema {
  return {
    type: "object",
    description: "Flexus L Instance configuration. Billing mode is always 'Yearly/Monthly'.",
    properties: {
      region: {
        type: "string",
        description: "Huawei Cloud region key (e.g. 'ap-southeast-1')",
      },
      billingMode: {
        type: "string",
        const: "Yearly/Monthly",
        description: "Flexus L only supports Yearly/Monthly billing",
      },
      description: {
        type: "string",
        description: "Service name",
      },
      planId: {
        type: "string",
        enum: flexusLPlans.map((p) => p.id),
        description: "Flexus L plan identifier",
      },
      planTitle: {
        type: "string",
        description: "Human-readable plan title (e.g. '2 vCPUs | 2 GiB')",
      },
      vcpu: {
        type: "integer",
        enum: [2, 4],
        description: "Number of vCPUs",
      },
      ramGiB: {
        type: "integer",
        enum: [2, 4, 8, 16],
        description: "RAM in GiB",
      },
      systemDiskGiB: {
        type: "integer",
        enum: [60, 80, 160, 240, 320],
        description: "System disk size in GiB (included in plan)",
      },
      peakBandwidthMbit: {
        type: "integer",
        const: 30,
        description: "Peak bandwidth in Mbit/s (always 30)",
      },
      dataPackageTiB: {
        type: "integer",
        enum: [3, 4, 5, 6, 7],
        description: "Monthly data package in TiB",
      },
      referenceRegion: {
        type: "string",
        const: "ap-southeast-3",
        description: "Pricing reference region",
      },
    },
    required: ["region", "billingMode", "planId", "planTitle", "vcpu", "ramGiB", "systemDiskGiB", "peakBandwidthMbit", "dataPackageTiB", "referenceRegion"],
    additionalProperties: true,
  };
}

function buildFlexusLPricingSchema(): JsonSchema {
  return {
    type: "object",
    description: "Optional pricing metadata for display purposes",
    properties: {
      total: {
        type: "string",
        description: "Formatted total price (e.g. 'USD 59.00/mo')",
      },
      flavor: {
        type: ["string", "null"],
        description: "Formatted plan price (e.g. 'USD 59.00/mo')",
      },
    },
    additionalProperties: true,
  };
}

const flexusLPlanCatalog = flexusLPlans.map((p) => ({
  planId: p.id,
  planTitle: p.title,
  vcpu: p.vcpu,
  ramGiB: p.ramGiB,
  systemDiskGiB: p.systemDiskGiB,
  peakBandwidthMbit: p.peakBandwidthMbit,
  dataPackageTiB: p.dataPackageTiB,
  monthlyPriceUsd: p.monthlyPriceUsd,
}));

function buildFullProductSchema(
  serviceCode: string,
  configSchema: JsonSchema,
  pricingSchema: JsonSchema,
): JsonSchema {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `Product Body for ${serviceCode}`,
    description: `Request body schema for adding a ${serviceCode} product to a list via POST /api/v1/private/lists/{listId}/products`,
    type: "object",
    properties: {
      serviceCode: {
        type: "string",
        const: serviceCode,
        description: "The service code identifying the product type",
      },
      serviceName: {
        type: "string",
        description: "Human-readable service name",
      },
      productType: {
        type: "string",
        description: "Product type discriminator used by the calculator",
      },
      title: {
        type: "string",
        description: "Human-readable title combining service name and key specs",
      },
      quantity: {
        type: "integer",
        minimum: 1,
        default: 1,
        description: "Number of units",
      },
      config: configSchema,
      pricing: pricingSchema,
    },
    required: ["serviceCode", "serviceName", "productType", "title"],
    additionalProperties: false,
  };
}

function resolveServiceCode(raw: string): string | null {
  const lower = raw.toLowerCase();
  const match = serviceCatalog.find((s) => s.code.toLowerCase() === lower);
  return match?.code ?? null;
}

function handleCustomService(resolvedCode: string) {
  if (resolvedCode === ECS_SERVICE_CODE) {
    const configSchema = buildEcsConfigSchema();
    const pricingSchema = buildEcsPricingSchema();
    return {
      serviceCode: ECS_SERVICE_CODE,
      serviceName: "Elastic Cloud Server",
      productType: "ecs",
      billingOptions: ["Pay-per-use", "Yearly/Monthly", "RI"],
      schema: buildFullProductSchema(ECS_SERVICE_CODE, configSchema, pricingSchema),
      configDefaults: {
        region: "ap-southeast-1",
        billingMode: "Pay-per-use",
        usageHours: 744,
        flavor: "c7.large.2",
        vcpu: 2,
        ramGiB: 8,
        systemDisk: { type: "High I/O", sizeGiB: 40 },
      },
      example: {
        serviceCode: ECS_SERVICE_CODE,
        serviceName: "Elastic Cloud Server",
        productType: "ecs",
        title: "Elastic Cloud Server c7.large.2",
        quantity: 1,
        config: {
          region: "ap-southeast-1",
          billingMode: "Pay-per-use",
          usageHours: 744,
          description: "General-purpose ECS",
          flavor: "c7.large.2",
          vcpu: 2,
          ramGiB: 8,
          systemDisk: { type: "High I/O", sizeGiB: 40 },
        },
        pricing: { total: "USD 45.60/744h", flavor: "USD 37.20/744h", disk: "USD 8.40/744h" },
      },
    };
  }

  if (resolvedCode === FLEXUS_L_SERVICE_CODE) {
    const defaultPlan = flexusLPlans[1];
    const configSchema = buildFlexusLConfigSchema();
    const pricingSchema = buildFlexusLPricingSchema();
    return {
      serviceCode: FLEXUS_L_SERVICE_CODE,
      serviceName: "Flexus L Instance",
      productType: "flexus-l",
      billingOptions: ["Yearly/Monthly"],
      catalog: flexusLPlanCatalog,
      schema: buildFullProductSchema(FLEXUS_L_SERVICE_CODE, configSchema, pricingSchema),
      configDefaults: {
        region: "ap-southeast-1",
        billingMode: "Yearly/Monthly",
        planId: defaultPlan.id,
        planTitle: defaultPlan.title,
        vcpu: defaultPlan.vcpu,
        ramGiB: defaultPlan.ramGiB,
        systemDiskGiB: defaultPlan.systemDiskGiB,
        peakBandwidthMbit: defaultPlan.peakBandwidthMbit,
        dataPackageTiB: defaultPlan.dataPackageTiB,
        referenceRegion: "ap-southeast-3",
      },
      example: {
        serviceCode: FLEXUS_L_SERVICE_CODE,
        serviceName: "Flexus L Instance",
        productType: "flexus-l",
        title: `Flexus L Instance ${defaultPlan.title}`,
        quantity: 1,
        config: {
          region: "ap-southeast-1",
          billingMode: "Yearly/Monthly",
          description: "Flexus L Instance",
          planId: defaultPlan.id,
          planTitle: defaultPlan.title,
          vcpu: defaultPlan.vcpu,
          ramGiB: defaultPlan.ramGiB,
          systemDiskGiB: defaultPlan.systemDiskGiB,
          peakBandwidthMbit: defaultPlan.peakBandwidthMbit,
          dataPackageTiB: defaultPlan.dataPackageTiB,
          referenceRegion: "ap-southeast-3",
        },
        pricing: { total: `USD ${defaultPlan.monthlyPriceUsd}.00/mo`, flavor: `USD ${defaultPlan.monthlyPriceUsd}.00/mo` },
      },
    };
  }

  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ serviceCode: string }> },
) {
  const { serviceCode: rawCode } = await context.params;
  const resolvedCode = resolveServiceCode(rawCode);

  if (!resolvedCode) {
    return Response.json(
      { error: `Unknown service code: ${rawCode}`, availableServices: serviceCatalog.map((s) => s.code) },
      { status: 404 },
    );
  }

  const customResult = handleCustomService(resolvedCode);
  if (customResult) {
    return Response.json(customResult);
  }

  const catalogEntry = findServiceCatalogEntry(resolvedCode);
  const bundle = getConfigurableServiceBundleByCode(resolvedCode);
  if (!bundle) {
    return Response.json(
      {
        error: `No schema available for ${catalogEntry?.name ?? rawCode}. This service does not have a configurable definition.`,
        serviceCode: resolvedCode,
        serviceName: catalogEntry?.name,
      },
      { status: 404 },
    );
  }

  const configSchema = buildConfigSchema(bundle);
  const pricingSchema = buildPricingSchema(bundle);
  const productSchema = buildFullProductSchema(resolvedCode, configSchema, pricingSchema);
  const defaults = buildDefaultsObject(bundle);

  return Response.json({
    serviceCode: bundle.service.serviceCode,
    serviceName: bundle.service.serviceName,
    definitionId: bundle.service.definitionId,
    productType: bundle.service.definitionId,
    billingOptions: bundle.service.billingOptions,
    schema: productSchema,
    configDefaults: defaults,
    example: {
      serviceCode: bundle.service.serviceCode,
      serviceName: bundle.service.serviceName,
      productType: bundle.service.definitionId,
      title: `${bundle.service.serviceName} <specify configuration>`,
      quantity: 1,
      config: defaults,
      pricing: null,
    },
  });
}
