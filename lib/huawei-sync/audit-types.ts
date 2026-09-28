import type { FormState } from "./types";

export type ObservedField = { label: string; selected: string; options: string[] };
export type ObservedComponent = { id: string; type: string; text: string; fields: ObservedField[] };
export type AuditCase = {
  service: string; region: string; checkedAt: string; officialUrl: string;
  configHash: string; productsHash: string;
  catalog?: { productCount: number; resources: string[]; specCodes: string[] };
  neo?: FormState; neoError?: string; auditError?: string;
  official?: ObservedComponent[]; screenshot?: string;
  variants?: { name: string; components: ObservedComponent[] }[];
  verified?: boolean; cases?: number; diagnostics?: string[]; releaseId?: string;
  defaultCheck?: { result: string; cases?: number; error?: string };
};
export type AuditReport = { generatedAt: string; services: string[]; regions: string[]; results: AuditCase[] };
