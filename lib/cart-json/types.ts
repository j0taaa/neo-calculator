import type { NativeBillingMode } from "../huawei-native/native-billing";
import type { ProductMutationBody } from "../calculator-types";

export type ResourceChoice = { field: string; label?: string } &
  ({ option: string; value?: never } | { value: number | boolean | string; option?: never });
export type ResourceIntent = {
  serviceCode: string;
  region: string;
  billingMode: NativeBillingMode;
  title?: string;
  choices: ResourceChoice[];
};
export type ResourceDocument = {
  schemaVersion: 2;
  releaseId?: string;
} & ({ resourceType: "cart"; cart: { name: string; products: ResourceIntent[] } } |
  { resourceType: "project"; project: { name: string; description?: string | null; lists: { name: string; products: ResourceIntent[] }[] } });
export type ImportedList = { name: string; products: ProductMutationBody[] };
export type ImportedResourcePayload =
  { resourceType: "cart"; name: string; products: ProductMutationBody[] } |
  { resourceType: "project"; name: string; description: string | null; lists: ImportedList[] };
export type DocumentIssue = { path: string; code: string; message: string };
export class ResourceDocumentError extends Error {
  constructor(readonly issues: DocumentIssue[], readonly releaseId?: string) {
    super(issues.map(issue => `${issue.path || "/"}: ${issue.message}`).join("; "));
  }
}
