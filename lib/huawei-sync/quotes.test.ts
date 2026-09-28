import { expect, test } from "bun:test";
import { QuoteGateway, TransientQuoteError } from "./quotes";
import type { Inquiry } from "./types";

const inquiry: Inquiry = { regionId: "ap-southeast-1", chargingMode: 1, periodType: 4, periodNum: 1, subscriptionNum: 1, siteCode: "HWC", productInfos: [{ id: "0", cloudServiceType: "compute", resourceType: "vm", resourceSpecCode: "small", productNum: 1 }] };

test("quote cache includes complete configuration and release, deduplicates requests, and supports fresh saves", async () => {
  let calls = 0, now = 0;
  const gateway = new QuoteGateway(async () => { calls++; await Promise.resolve(); return { amount: 2, currency: "USD", productRatingResult: [{ id: "0", amount: 2 }] }; }, () => now);
  await Promise.all([gateway.quote("a", inquiry), gateway.quote("a", inquiry)]);
  expect(calls).toBe(1);
  await gateway.quote("a", inquiry); expect(calls).toBe(1);
  await gateway.quote("b", inquiry); expect(calls).toBe(2);
  await gateway.quote("a", { ...inquiry, productInfos: [{ ...inquiry.productInfos[0], productNum: 2 }] }); expect(calls).toBe(3);
  await gateway.quote("a", inquiry, true); expect(calls).toBe(4);
  now = 61_000; await gateway.quote("a", inquiry); expect(calls).toBe(5);
});

test("partial, duplicated and invalid quote responses fail instead of being cached as zero", async () => {
  for (const response of [
    { amount: 0, currency: "USD", productRatingResult: [] },
    { amount: 1, currency: "CNY", productRatingResult: [{ id: "0", amount: 1 }] },
    { amount: 1, currency: "USD", productRatingResult: [{ id: "other", amount: 1 }] },
    { amount: NaN, currency: "USD", productRatingResult: [{ id: "0", amount: 1 }] },
  ]) await expect(new QuoteGateway(async () => response).quote("a", inquiry)).rejects.toThrow();
});


test("transient quote failures retry once, share the retry, and never cache a failure", async () => {
  let calls = 0;
  const gateway = new QuoteGateway(async () => {
    if (++calls === 1) throw new TransientQuoteError("503");
    return { amount: 2, currency: "USD", productRatingResult: [{ id: "0", amount: 2 }] };
  });
  const quotes = await Promise.all([gateway.quote("a", inquiry), gateway.quote("a", inquiry)]);
  expect(calls).toBe(2); expect(quotes[0].amount).toBe(2); expect(quotes[1]).toEqual(quotes[0]);
  let failures = 0;
  const unavailable = new QuoteGateway(async () => { failures++; throw new TransientQuoteError("503"); });
  await expect(unavailable.quote("a", inquiry)).rejects.toThrow("503"); expect(failures).toBe(2);
  await expect(unavailable.quote("a", inquiry)).rejects.toThrow("503"); expect(failures).toBe(4);
  let permanent = 0;
  await expect(new QuoteGateway(async () => { permanent++; throw new Error("Invalid inquiry"); }).quote("a", inquiry)).rejects.toThrow();
  expect(permanent).toBe(1);
});
