import type { Inquiry, Quote, HuaweiService } from "./types";
import type { NativeBillingMode } from "./native-billing";

export type NativeField = {
  id: string;
  component: string;
  label: string;
  type: "select" | "number" | "checkbox" | "action";
  presentation?: "options";
  value: string | number | boolean;
  disabled: boolean;
  unit?: string;
  unitSelector?: boolean;
  hint?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string; disabled: boolean }[];
};
export type NativeForm = { availability?: "information" | "unavailable"; fields: NativeField[]; notes: string[]; diagnostics: string[] };
export type NativeState = NativeForm & {
  /** Extraction evidence only; the application never needs a vendor runtime. */
  ruleOrder?: string[];
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
  local?: { release: string; pricing: import("./native-pricing").NativePricing; inquiries: Inquiry[] };
};
export type NativeAction = { session: string; revision: number; field: string; value: string | number | boolean };
export type NativeDirectory = { services: HuaweiService[]; regions: { id: string; name: string }[]; billingModes: Record<string, Record<string, NativeBillingMode[]>> };
