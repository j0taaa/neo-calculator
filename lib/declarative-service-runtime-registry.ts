import { configurableServiceBundle as dcsBundle } from "@/config/services/dcs/bundle";
import { configurableServiceBundle as eipBundle } from "@/config/services/eip/bundle";
import { configurableServiceBundle as natBundle } from "@/config/services/nat/bundle";
import { configurableRuntimeDefinitions } from "@/config/services/runtime";
import type { TypedDeclarativeRuntimeDefinition } from "@/lib/typed-declarative-runtime-types";

const typedRuntimeDefinitions = {
  NAT: natBundle.runtime,
  EIP: eipBundle.runtime,
  DCS: dcsBundle.runtime,
} as const;

export function getTypedDeclarativeRuntimeDefinitionByCode(serviceCode: string): TypedDeclarativeRuntimeDefinition | null {
  return (typedRuntimeDefinitions[serviceCode as keyof typeof typedRuntimeDefinitions] ?? null) as TypedDeclarativeRuntimeDefinition | null;
}

export function getDeclarativeRuntimeDefinitionByCode(serviceCode: string) {
  return configurableRuntimeDefinitions[serviceCode] ?? null;
}
