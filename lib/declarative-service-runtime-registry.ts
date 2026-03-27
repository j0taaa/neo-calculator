import { configurableRuntimeDefinitions } from "@/config/services/runtime";

export function getDeclarativeRuntimeDefinitionByCode(serviceCode: string) {
  return configurableRuntimeDefinitions[serviceCode] ?? null;
}
