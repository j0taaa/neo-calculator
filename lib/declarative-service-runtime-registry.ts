import { getServiceBundle } from "@/config/services/bundles";

export function getTypedDeclarativeRuntimeDefinitionByCode(serviceCode: string) {
  return getServiceBundle(serviceCode)?.runtime ?? null;
}
