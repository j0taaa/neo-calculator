import type { Page } from "playwright";
import { validateAggregatedQuote } from "./native-quote";
import type { NativeBillingMode } from "./native-billing";
import { canonical, hash } from "./store";
import type { Inquiry } from "./types";
import type { InquiryResponse } from "./quotes";

export type NativePricing = {
  epoch: number;
  pending: boolean;
  selectedProduct: {
    region: string; serviceCode: string; chargeMode: NativeBillingMode; timeTag: number;
    periodType: number; periodNum: number; subscriptionNum: number;
    productAllInfos: { productId?: string; selectIndex: number; resourceSpecCode: string; productNum: number; _injectedMode?: string; inquiryTag: string | false; [key: string]: unknown }[];
  };
  result: {
    amount: number; timeTag: number; wrongTag?: unknown;
    perAmount?: number; installAmount?: number; installNum?: number; installPeriodType?: string | number;
    injectedAmount?: Record<string, { amount: number; perAmount: number }>;
    productRatingResult: { id: string; productId?: string; amount: number; [key: string]: unknown }[];
  } | null;
};

/** Observe and rerun Huawei's own aggregator, including RI and mixed billing, without copying its formulas. */
export function instrumentNativePricing(source: string) {
  const start = "const queryPrice = (selectedInfo, queryOptions) => {";
  const end = "const funcPriceboardSetup =";
  const offset = source.indexOf(start), finish = source.indexOf(end, offset);
  if (offset < 0 || finish < 0 || source.indexOf(start, offset + 1) >= 0)
    throw new Error("Huawei's pricing renderer changed; its aggregation adapter needs updating");
  const original = source.slice(offset, finish).replace(start, "const neoOriginalQueryPrice = (selectedInfo, queryOptions) => {");
  const wrapper = `
const queryPrice = (selectedInfo, queryOptions) => {
  const bridge = window.__neoNativePricing ||= { epoch: 0 };
  const epoch = ++bridge.epoch;
  bridge.pending = true;
  bridge.result = null;
  bridge.selectedProduct = JSON.parse(JSON.stringify(selectedInfo.selectedProduct));
  bridge.refresh = () => queryPrice(selectedInfo, queryOptions);
  const promise = neoOriginalQueryPrice(selectedInfo, queryOptions);
  promise.then(result => {
    if (bridge.epoch === epoch) { bridge.result = result; bridge.pending = false; }
  }, () => { if (bridge.epoch === epoch) { bridge.result = null; bridge.pending = false; } });
  return promise;
};
`;
  return source.slice(0, offset) + original + wrapper + source.slice(finish);
}
export async function readNativePricing(page: Page): Promise<NativePricing | null> {
  return page.evaluate(() => {
    const bridge = (window as unknown as { __neoNativePricing?: NativePricing }).__neoNativePricing;
    if (!bridge) return null;
    const { epoch, pending, selectedProduct, result } = bridge;
    return { epoch, pending, selectedProduct, result };
  });
}
export async function refreshNativePricing(page: Page) {
  await page.evaluate(async () => {
    const bridge = (window as unknown as { __neoNativePricing?: { refresh: () => Promise<unknown> } }).__neoNativePricing;
    if (!bridge?.refresh) throw new Error("Huawei pricing renderer is unavailable");
    await bridge.refresh();
  });
}

export type NativeInquiryQuote = { inquiry: Inquiry; response: InquiryResponse };
export function buildNativeQuote(...args: Parameters<typeof validateAggregatedQuote>) {
  return validateAggregatedQuote(args[0], args[1], args[2], value => hash(canonical(value)));
}
