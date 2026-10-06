import type { Inquiry, Quote, HuaweiService } from "./types";
import type { NativeBillingMode } from "./native-billing";

export type NativeField = {
  id: string;
  component: string;
  label: string;
  type: "select" | "number" | "checkbox" | "action";
  value: string | number | boolean;
  disabled: boolean;
  unit?: string;
  hint?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string; disabled: boolean }[];
};
export type NativeForm = { fields: NativeField[]; notes: string[]; diagnostics: string[] };
export type NativeState = NativeForm & {
  selection: import("./native-selection").NativeSelection;
  session: string;
  revision: number;
  service: string;
  region: string;
  billingMode: NativeBillingMode;
  expiresAt: string;
  source: { page: string; config: string; products: string; framework: string; menu: string; fetchedAt: string };
  inquiry: Inquiry | null;
  inquiries: Inquiry[];
  quote: Quote | null;
  priceError?: string;
};
export type NativeAction = { session: string; revision: number; field: string; value: string | number | boolean };
export type NativeDirectory = { services: HuaweiService[]; regions: { id: string; name: string }[]; billingModes: Record<string, Record<string, NativeBillingMode[]>> };
