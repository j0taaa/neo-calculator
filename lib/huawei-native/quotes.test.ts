import { expect, test } from "bun:test";
import { QuoteGateway, TransientQuoteError } from "./quotes";
import type { Inquiry } from "./types";

const inquiry: Inquiry = { regionId: "ap-southeast-1", chargingMode: 1, periodType: 4, periodNum: 1, subscriptionNum: 1, siteCode: "HWC", productInfos: [{ id: "0", cloudServiceType: "compute", resourceType: "vm", resourceSpecCode: "small", productNum: 1 }] };

test("every inquiry fetches a fresh complete Huawei response", async () => {
  let calls = 0;
  const gateway = new QuoteGateway(async () => ({ amount: ++calls, currency: "USD", productRatingResult: [{ id: "0", amount: calls }] }));
  expect((await gateway.inquire(inquiry)).amount).toBe(1);
  expect((await gateway.inquire(inquiry)).amount).toBe(2);
});

test("partial, duplicated and invalid quote responses fail instead of becoming zero", async () => {
  for (const response of [
    { amount: 0, currency: "USD", productRatingResult: [] },
    { amount: 1, currency: "CNY", productRatingResult: [{ id: "0", amount: 1 }] },
    { amount: 1, currency: "USD", productRatingResult: [{ id: "other", amount: 1 }] },
    { amount: NaN, currency: "USD", productRatingResult: [{ id: "0", amount: 1 }] },
  ]) await expect(new QuoteGateway(async () => response).inquire(inquiry)).rejects.toThrow();
});


test("transient inquiry failures retry once and permanent failures are not retried", async () => {
  let calls = 0;
  const gateway = new QuoteGateway(async () => {
    if (++calls === 1) throw new TransientQuoteError("503");
    return { amount: 2, currency: "USD", productRatingResult: [{ id: "0", amount: 2 }] };
  });
  expect((await gateway.inquire(inquiry)).amount).toBe(2);
  expect(calls).toBe(2);
  let failures = 0;
  const unavailable = new QuoteGateway(async () => { failures++; throw new TransientQuoteError("503"); });
  await expect(unavailable.inquire(inquiry)).rejects.toThrow("503"); expect(failures).toBe(2);
  await expect(unavailable.inquire(inquiry)).rejects.toThrow("503"); expect(failures).toBe(4);
  let permanent = 0;
  await expect(new QuoteGateway(async () => { permanent++; throw new Error("Invalid inquiry"); }).inquire(inquiry)).rejects.toThrow();
  expect(permanent).toBe(1);
});

test("fresh inquiries preserve RI installments and reject invalid recurring rates", async () => {
  const response = {amount:0, currency:"USD", perAmount:0.0476, productRatingResult:[{id:"0",amount:0,perAmount:0.0476,officialExtra:"retained"}]};
  let calls = 0;
  const gateway = new QuoteGateway(async () => {calls++;return response;});
  expect(await gateway.inquire(inquiry)).toEqual(response);
  expect(await gateway.inquire(inquiry)).toEqual(response);
  expect(calls).toBe(2);
  for (const perAmount of [NaN,Infinity,-1]) {
    await expect(new QuoteGateway(async () => ({...response,perAmount})).inquire(inquiry)).rejects.toThrow();
    await expect(new QuoteGateway(async () => ({...response,productRatingResult:[{id:"0",amount:0,perAmount}]})).inquire(inquiry)).rejects.toThrow();
  }
});
