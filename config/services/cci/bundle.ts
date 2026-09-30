import { runtimeExpression, type RuntimeContext } from "@/lib/runtime-expression";
import type { TypedDeclarativeRuntimeDefinition } from "@/lib/typed-declarative-runtime-types";
import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  version: 1,
  definitionId: "cci",
  serviceCode: "CCI",
  serviceName: "Cloud Container Instance",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use", "Yearly/Monthly"],
  defaults: {
    cpu: 1,
    memoryGiB: 1,
  },
  fields: [
    {
      id: "cpu",
      type: "number",
      label: "CPU",
      required: true,
      unit: "vCPU",
      min: 1,
      step: 1,
    },
    {
      id: "memoryGiB",
      type: "number",
      label: "Memory",
      required: true,
      unit: "GiB",
      min: 1,
      step: 1,
    },
  ],
  summary: {
    selectionTemplate: "{cpu} vCPU | {memoryGiB} GiB",
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "cci",
  serviceCode: "CCI",
  serviceName: "Cloud Container Instance",
  catalogAdapter: "cci",
  rateSources: {
    cpu: {
      catalogKey: "compute.cpuRate",
    },
    memory: {
      catalogKey: "compute.memoryRate",
    },
  },
  metrics: [
    {
      id: "cpu",
      label: "CPU",
      rateSource: "cpu",
      quantity: {
        source: "field",
        field: "cpu",
      },
      unit: "vCPU",
    },
    {
      id: "memory",
      label: "Memory",
      rateSource: "memory",
      quantity: {
        source: "field",
        field: "memoryGiB",
      },
      unit: "GiB",
    },
  ],
} satisfies PricingDefinition;

type Scope = RuntimeContext<unknown>;
const compute = runtimeExpression<Scope>;

const runtimeDefinition = {
  quantityLabel: "Instance",
  showGlobalQuantityControl: true,
  usesSharedBillingHeader: true,
  showSharedUsageHours: compute(() => true),
  fieldRuntime: {
    cpu: {
      min: compute(() => 1),
      normalize: compute(({ helpers, values }) => helpers.clampInteger(values.cpu || 1, 1)),
    },
    memoryGiB: {
      min: compute(() => 1),
      normalize: compute(({ helpers, values }) => helpers.clampInteger(values.memoryGiB || 1, 1)),
    },
  },
  selectionSummary: compute(
    ({ helpers, values }) =>
      `Selected specifications: ${helpers.clampInteger(values.cpu || 1, 1)} vCPU | ${helpers.clampInteger(values.memoryGiB || 1, 1)} GiB`,
  ),
  buildRequestBodies: compute(
    ({
      selectedServiceCode,
      selectedService,
      helpers,
      values,
      instanceCountValue,
      regionValue,
      billingMode,
      usageHoursValue,
    }) => ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: "cci",
      title: `${selectedService} ${helpers.clampInteger(values.cpu || 1, 1)} vCPU ${helpers.clampInteger(values.memoryGiB || 1, 1)} GiB`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        billingMode,
        cpu: helpers.clampInteger(values.cpu || 1, 1),
        memoryGiB: helpers.clampInteger(values.memoryGiB || 1, 1),
        usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
      },
      pricing: { total: "USD 0.00" },
    }),
  ),
  hydrate: compute(({ product, helpers, regionValue, usageHours }) =>
    (() => {
      if (product.productType !== "cci" || !helpers.isRecord(product.config)) {
        return { handled: false, error: "This product cannot be edited from the calculator." };
      }
      return {
        handled: true,
        values: {
          cpu: typeof product.config.cpu === "number" ? String(Math.max(1, Math.floor(product.config.cpu))) : "1",
          memoryGiB:
            typeof product.config.memoryGiB === "number"
              ? String(Math.max(1, Math.floor(product.config.memoryGiB)))
              : "1",
        },
        nextRegion: typeof product.config.region === "string" ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
        nextUsageHours:
          typeof product.config.usageHours === "number"
            ? String(Math.max(1, Math.floor(product.config.usageHours)))
            : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })(),
  ),
} satisfies TypedDeclarativeRuntimeDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  runtime: runtimeDefinition,
} as const satisfies ConfigurableServiceBundleDefinition;
