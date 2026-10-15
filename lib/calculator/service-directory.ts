import type { ServiceCatalogEntry } from "@/lib/service-config-types";
import type { NativeDirectory } from "@/lib/huawei-native/native-types";
import { huaweiRegions } from "@/lib/huawei-regions";
import { nativeBillingModes, type NativeBillingMode } from "@/lib/huawei-native/native-billing";

// Identity aliases only. Input visibility and billing availability always come from Huawei.
const aliases: Record<string, string> = {
  "Flexus L": "hcss", "Flexus X": "hecs", DCS: "redis", DMS: "kafka",
  "DMS Kafka": "kafka", "DMS RabbitMQ": "rabbitMQ", "DMS RocketMQ": "reliability",
  FunctionGraph: "function", "SFS Turbo": "sfsturbo", DC: "dline", CSS: "search",
  "Flexus RDS": "hrds", GeminiDB: "nosql", TaurusDB: "taurusdb", DGC: "dlg",
  "Lake Formation": "lakeformation", SecMaster: "ssa", DDoS: "aad", EventGrid: "eg",
};
export type CalculatorService = ServiceCatalogEntry & { huaweiId?: string };
export type CalculatorScope = { service: string; region: string; billingMode: NativeBillingMode };
export function huaweiServiceId(code: string) {
  return /^HUAWEI:/i.test(code) ? code.slice(7) : /^HWC:/i.test(code) ? code.slice(4) :
    Object.entries(aliases).find(([alias]) => alias.toLowerCase() === code.toLowerCase())?.[1] ?? code.toLowerCase();
}
export function calculatorServices(original: ServiceCatalogEntry[], directory: NativeDirectory | null): CalculatorService[] {
  const available = new Map(directory?.services.map(s => [s.id, s]) ?? []);
  const matched = new Set<string>();
  const result: CalculatorService[] = original.map(service => {
    const id = huaweiServiceId(service.code);
    if (!available.has(id)) return service;
    matched.add(id);
    return { ...service, huaweiId: id };
  });
  for (const service of available.values()) {
    if (!matched.has(service.id)) result.push({ code: `HUAWEI:${service.id}`, name: result.some(entry => entry.name === service.name) ? `${service.name} · ${service.id}` : service.name, icon: "/globe.svg", huaweiId: service.id });
  }
  return result;
}
export function nativeRegion(region: string) {
  return huaweiRegions[region as keyof typeof huaweiRegions]?.catalogRegionId ?? region;
}
export function legacyRegion(region: string) {
  return Object.keys(huaweiRegions).find(key => key === region || huaweiRegions[key as keyof typeof huaweiRegions].catalogRegionId === region);
}
export function nativeMode(label: string): NativeBillingMode {
  return (Object.keys(nativeBillingModes) as NativeBillingMode[]).find(key => nativeBillingModes[key].label === label) ?? "ONDEMAND";
}
export function availableMode(directory: NativeDirectory, scope: CalculatorScope) {
  const modes = directory.billingModes[scope.service]?.[scope.region] ?? [];
  return modes.includes(scope.billingMode) ? scope.billingMode : modes.includes("ONDEMAND") ? "ONDEMAND" : modes[0] ?? scope.billingMode;
}
