import { sendHttpRequest } from "@/lib/huawei-http";

export type HuaweiBillingInquiryRequest = {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type HuaweiBillingInquiryResponse = {
  amount: number;
  discountAmount: number;
  originalAmount: number;
  currency: string;
  productRatingResult: Array<{
    id?: string;
    productId?: string;
    amount?: number;
    discountAmount?: number;
    originalAmount?: number;
  }>;
};

const DEFAULT_HEADERS = {
  accept: "application/json, text/plain, */*",
  "content-type": "application/json; charset=UTF-8",
  origin: "https://www.huaweicloud.com",
  referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
  "user-agent": "Mozilla/5.0",
} as const;

async function postJsonDirect(url: string, headers: Record<string, string>, body: string, timeoutMs: number) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    bodyText: await response.text(),
  };
}

function summarizeBody(bodyText: string) {
  const normalized = bodyText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "empty response body";
  }

  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function buildAuthHeaders() {
  const headers: Record<string, string> = {};
  const cookie = process.env.HWC_BILLING_COOKIE?.trim();
  const csrf = process.env.HWC_BILLING_CSRF?.trim();

  if (cookie) {
    headers.cookie = cookie;
  }
  if (csrf) {
    headers.csrf = csrf;
  }

  return headers;
}

export async function fetchHuaweiBillingInquiry(input: HuaweiBillingInquiryRequest): Promise<HuaweiBillingInquiryResponse> {
  const headers = {
    ...DEFAULT_HEADERS,
    ...buildAuthHeaders(),
    ...(input.headers ?? {}),
  };
  const requestBody = JSON.stringify(input.body);
  const timeoutMs = input.timeoutMs ?? 30_000;

  let response: {
    ok: boolean;
    status: number;
    statusText: string;
    bodyText: string;
  };

  try {
    const httpResponse = await sendHttpRequest({
      method: "POST",
      url: input.url,
      headers,
      body: requestBody,
      timeoutMs,
    });
    response = httpResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("SOCKS5 connect request ack")) {
      throw error;
    }

    response = await postJsonDirect(input.url, headers, requestBody, timeoutMs);
  }

  if (!response.ok) {
    throw new Error(`Huawei billing inquiry failed: ${response.status} ${response.statusText}: ${summarizeBody(response.bodyText)}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("Huawei billing inquiry returned an empty response");
  }

  let body: unknown;
  try {
    body = JSON.parse(response.bodyText);
  } catch {
    throw new Error(`Huawei billing inquiry returned invalid JSON: ${summarizeBody(response.bodyText)}`);
  }

  if (typeof body !== "object" || body === null) {
    throw new Error("Huawei billing inquiry returned a non-object JSON payload");
  }

  const parsed = body as Partial<HuaweiBillingInquiryResponse>;
  const amount = typeof parsed.amount === "number" && Number.isFinite(parsed.amount) ? parsed.amount : null;
  const originalAmount = typeof parsed.originalAmount === "number" && Number.isFinite(parsed.originalAmount)
    ? parsed.originalAmount
    : amount;
  const discountAmount = typeof parsed.discountAmount === "number" && Number.isFinite(parsed.discountAmount)
    ? parsed.discountAmount
    : originalAmount != null && amount != null
      ? Number((originalAmount - amount).toFixed(5))
      : 0;
  const currency = typeof parsed.currency === "string" && parsed.currency.trim().length > 0 ? parsed.currency : "USD";

  if (amount == null) {
    throw new Error(`Huawei billing inquiry response did not include a numeric amount: ${summarizeBody(response.bodyText)}`);
  }

  return {
    amount,
    originalAmount: originalAmount ?? amount,
    discountAmount,
    currency,
    productRatingResult: Array.isArray(parsed.productRatingResult) ? parsed.productRatingResult : [],
  };
}
