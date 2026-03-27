import type { DeclarativePricingDefinition } from "@/lib/declarative-pricing-engine";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import type { TypedDeclarativeRuntimeDefinition } from "@/lib/typed-declarative-runtime-types";

export type ConfigurableServiceBundleDefinition = {
  service: ServiceDefinition;
  pricing: PricingDefinition;
  catalogDefinition?: DeclarativePricingDefinition;
  runtime?: TypedDeclarativeRuntimeDefinition;
};
