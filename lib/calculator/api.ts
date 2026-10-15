import type { NativeDirectory } from "../huawei-native/native-types";
import { nativeBillingModes } from "../huawei-native/native-billing";
import { huaweiServiceId } from "./service-directory";

export function apiService(directory: NativeDirectory, code: string) {
  const id = huaweiServiceId(code.trim());
  return directory.services.find(service => service.id.toLowerCase() === id.toLowerCase());
}

export function calculatorApi(directory: NativeDirectory, serviceId: string) {
  const serviceCode = `HUAWEI:${serviceId}`;
  const billingModes = directory.billingModes[serviceId] ?? {};
  return {
    runtime: "huawei-snapshot",
    serviceCode,
    serviceId,
    directoryUrl: "/api/calculator/native",
    calculatorUrl: `/?service=${encodeURIComponent(serviceCode)}`,
    catalogUrl: `/api/v1/public/catalog/${encodeURIComponent(serviceCode)}`,
    resourceDocumentSchemaUrl: "/api/v1/cart/schema",
    configureUrl: "/api/v1/cart/configure",
    validateCartUrl: "/api/v1/cart/validate",
    calculationUrl: "/api/v1/calculate",
    calculationMethod: "POST",
    billingModes,
    regions: directory.regions.filter(region => billingModes[region.id]?.length),
    instructions: "Agents can fetch resourceDocumentSchemaUrl, discover current controls through configureUrl and build a cart from ordered choices for validateCartUrl without using the UI. The legacy calculation endpoint accepts config.region, config.billingMode, config.selection and config.local from a saved calculator configuration. Client monetary totals are ignored. No server browser session is required.",
  };
}

export function snapshotProductSchema(serviceCode: string) {
  return {
    type: "object",
    required: ["serviceCode", "serviceName", "config"],
    properties: {
      serviceCode: { const: serviceCode },
      serviceName: { type: "string", minLength: 1 },
      productType: { const: "huawei-native" },
      title: { type: "string" },
      quantity: { type: "integer", minimum: 1, maximum: 9999, description: "The server derives the saved quantity from the verified configuration." },
      config: {
        type: "object", required: ["region", "billingMode", "selection", "local"],
        properties: {
          region: { type: "string", description: "Huawei region ID; must agree with the selection and pricing scope." },
          billingMode: { enum: Object.values(nativeBillingModes).map(mode => mode.label) },
          selection: { type: "object", required: ["version", "service", "region", "initial", "steps", "fields"],
            properties: { version: { enum: [1, 2] }, service: { const: serviceCode.slice(7) },
              billingMode: { enum: Object.keys(nativeBillingModes) } },
            allOf: [{ if: { properties: { version: { const: 2 } } }, then: { required: ["billingMode"] } }],
            description: "Durable selection emitted by the local calculator, including its billing mode and conditional fields." },
          local: { type: "object", required: ["release", "pricing", "inquiries"], properties: {
            release: { type: "string", pattern: "^[a-f0-9]{64}$" },
            pricing: { type: "object", required: ["selectedProduct"], description: "Selected resources and billing dimensions; client result amounts are not trusted." },
            inquiries: { type: "array", maxItems: 100, items: { type: "object" }, description: "Captured local pricing inquiries. The server reconstructs their amounts from snapshot rates." },
          } },
        },
      },
    },
  };
}
