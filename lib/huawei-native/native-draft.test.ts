import { expect, test } from "bun:test";
import { nativeDraft } from "./native-draft";
import type { NativeState } from "./native-types";
const state = { service: "nat", region: "ap-southeast-1", billingMode: "PERIOD", session: "temporary", revision: 4,
  selection: { version: 2 }, quote: { amount: 100 }, diagnostics: [] } as unknown as NativeState;
test("queued configurations keep durable selections and never trust captured prices or sessions", () => {
  const draft = nativeDraft(state, "NAT Gateway", "Office NAT", true);
  expect(draft.pricing).toBeNull();
  expect(draft.config).toEqual({ runtime: "huawei-native", region: "ap-southeast-1", billingMode: "Yearly/Monthly", selection: state.selection });
  expect(nativeDraft(state, "NAT Gateway").config).toMatchObject({ session: "temporary", revision: 4 });
});
test("incomplete official responses cannot become saved or queued configurations", () => {
  expect(() => nativeDraft({ ...state, quote: null }, "NAT")).toThrow("complete Huawei price");
  expect(() => nativeDraft({ ...state, diagnostics: ["Unknown control"] }, "NAT")).toThrow("complete Huawei price");
});
