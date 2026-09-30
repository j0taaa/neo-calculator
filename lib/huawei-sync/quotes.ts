import { sendHttpRequest } from "@/lib/huawei-http";
import { canonical, hash } from "./store";
import type { Inquiry, Quote } from "./types";

export type InquiryResponse = { amount: number; currency: string; perAmount?: number; productRatingResult: { id: string; amount: number; perAmount?: number; [key: string]: unknown }[]; [key: string]: unknown };
export type QuoteTransport = (request: Inquiry) => Promise<InquiryResponse>;
export const INQUIRY_URL = "https://portal-intl.huaweicloud.com/api/cbc/global/rest/BSS/billing/ratingservice/v2/inquiry/resource";

export class TransientQuoteError extends Error {}

export const requestInquiry: QuoteTransport = async request => {
  const response = await sendHttpRequest({ method: "POST", url: INQUIRY_URL, timeoutMs: 30_000,
    headers: { "content-type": "application/json; charset=UTF-8", origin: "https://www.huaweicloud.com", referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html" },
    body: JSON.stringify(request) }).catch(() => { throw new TransientQuoteError("Network error contacting Huawei pricing"); });
  if (response.status === 429 || response.status >= 500 || response.status === 0) throw new TransientQuoteError(`Huawei quote temporarily unavailable (${response.status})`);
  if (!response.ok) throw new Error(`Huawei quote unavailable (${response.status})`);
  return JSON.parse(response.bodyText);
};

export class QuoteGateway {
  private cache = new Map<string, Quote>();
  private pending = new Map<string, Promise<Quote>>();
  constructor(private readonly request: QuoteTransport = requestInquiry, private readonly now = Date.now) {}
  /** Full validated responses are also consumed by Huawei's installment/mixed-mode aggregator. */
  async inquire(inquiry: Inquiry): Promise<InquiryResponse> {
    if (!inquiry.productInfos.length || inquiry.productInfos.length > 100) throw new Error("Invalid quote product count");
    const response = await this.request(inquiry).catch(async error => {
      if (!(error instanceof TransientQuoteError)) throw error;
      await new Promise(resolve => setTimeout(resolve, 300));
      return this.request(inquiry);
    });
    if (!Number.isFinite(response.amount) || response.amount < 0 || response.currency !== "USD" || !Array.isArray(response.productRatingResult)) throw new Error("Huawei returned an invalid quote");
    const expected = new Set(inquiry.productInfos.map(p => p.id));
    if (expected.size !== inquiry.productInfos.length || response.productRatingResult.length !== expected.size) throw new Error("Incomplete Huawei quote");
    for (const item of response.productRatingResult) {
      if (!expected.delete(item.id) || !Number.isFinite(item.amount) || item.amount < 0) throw new Error("Incomplete Huawei quote components");
      if (item.perAmount != null && (!Number.isFinite(item.perAmount) || item.perAmount < 0)) throw new Error("Invalid Huawei recurring price");
    }
    if (response.perAmount != null && (!Number.isFinite(response.perAmount) || response.perAmount < 0)) throw new Error("Invalid Huawei recurring price");
    return response;
  }
  async quote(releaseId: string, inquiry: Inquiry, fresh = false): Promise<Quote> {
    if (!inquiry.productInfos.length || inquiry.productInfos.length > 100) throw new Error("Invalid quote product count");
    const requestHash = hash(canonical(inquiry));
    const key = `${releaseId}:${requestHash}`;
    const cached = this.cache.get(key);
    if (!fresh && cached && this.now() - Date.parse(cached.quotedAt) < 60_000) return cached;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const pending = (async () => {
      const response = await this.inquire(inquiry);
      const quote: Quote = { amount: response.amount, currency: response.currency, quotedAt: new Date(this.now()).toISOString(), releaseId, requestHash, source: "huawei-inquiry", breakdown: response.productRatingResult.map(p => ({ id: p.id, amount: p.amount })) };
      if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, quote);
      return quote;
    })();
    this.pending.set(key, pending);
    try { return await pending; } finally { this.pending.delete(key); }
  }
}
