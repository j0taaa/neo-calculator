import { canonical } from "./store";
import type { Inquiry } from "./types";

/** Compare resources and usage independently of Huawei's generated request identifiers. */
export function semanticInquiry(inquiry: Inquiry) {
  return {
    ...inquiry,
    productInfos: inquiry.productInfos
      .map(product => Object.fromEntries(Object.entries(product).filter(([key]) => key !== "id")))
      .sort((a, b) => canonical(a).localeCompare(canonical(b))),
  };
}
