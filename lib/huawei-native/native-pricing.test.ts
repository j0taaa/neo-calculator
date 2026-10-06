import { expect, test } from "bun:test";
import { buildNativeQuote, instrumentNativePricing, type NativePricing, type NativeInquiryQuote } from "./native-pricing";
import { nativeBillingModes, type NativeBillingMode } from "./native-billing";

const scope = { service: "ecs", region: "ap-southeast-1", billingMode: "RI" as NativeBillingMode, releaseId: "pinned" };
function fixture(mode: NativeBillingMode = "RI") {
  const ri = mode === "RI";
  const pricing: NativePricing = {
    epoch: 1, pending: false,
    selectedProduct: { region: scope.region, serviceCode: "ecs", chargeMode: mode, timeTag: 123, periodType: 3, periodNum: 1, subscriptionNum: 1,
      productAllInfos: [
        { productId: "vm", selectIndex: 0, resourceSpecCode: "c7n", productNum: 1, inquiryTag: "normal", ...(ri ? {perPrice: 10, perEffectivePrice: 0.02} : {}) },
        { productId: "disk", selectIndex: 1, resourceSpecCode: "ssd", productNum: 1, inquiryTag: "normal", ...(ri ? {_injectedMode: "ONDEMAND"} : {}) },
      ],
    },
    result: { amount: ri ? 180 : 15, timeTag: 123, productRatingResult: [{id: "123-0-vm", amount: ri ? 120 : 10}, {id: "123-1-disk", amount: ri ? 60 : 5}],
      ...(ri ? {installAmount: 0, perAmount: 10, installNum: 12, installPeriodType: "MONTH", injectedAmount: {ONDEMAND: {amount: 60, perAmount: 5}}} : {}),
    },
  };
  const captured: NativeInquiryQuote[] = pricing.selectedProduct.productAllInfos.map((product, index) => ({
    inquiry: {regionId: scope.region, siteCode: "HWC", chargingMode: nativeBillingModes[(product._injectedMode ?? mode) as NativeBillingMode].chargingMode,
      periodType: 4, periodNum: 1, subscriptionNum: 1,
      productInfos: [{id: `123-${index}-${product.productId}`, cloudServiceType: "compute", resourceType: "vm", resourceSpecCode: product.resourceSpecCode, productNum: 1}],
    },
    response: {currency: "USD", amount: ri && index === 0 ? 0 : index === 0 ? 10 : 5,
      productRatingResult: [{id: `123-${index}-${product.productId}`, amount: ri && index === 0 ? 0 : index === 0 ? 10 : 5, ...(ri && index === 0 ? {perAmount: 0.02} : {})}],
    },
  }));
  return {pricing, captured};
}

test("all four billing modes retain the vendor's complete aggregation", () => {
  for (const billingMode of Object.keys(nativeBillingModes) as NativeBillingMode[]) {
    const {pricing, captured} = fixture(billingMode);
    const {quote, inquiries} = buildNativeQuote(pricing, captured, {...scope, billingMode});
    expect(quote.amount).toBe(billingMode === "RI" ? 180 : 15);
    expect(inquiries).toHaveLength(2);
    if (billingMode === "RI") expect(quote.payment).toEqual({upfront: 0, recurring: 10, installments: 12, period: "Month", extras: [{mode: "ONDEMAND", recurring: 5}]});
  }
});
test("zero RI upfront prices cannot conceal missing or stale recurring and mixed-mode quotes", () => {
  const {pricing, captured} = fixture();
  for (const quotes of [[], captured.slice(0,1), captured.slice(1), [...captured, captured[0]]]) expect(() => buildNativeQuote(pricing, quotes, scope)).toThrow();
  captured[0].response.productRatingResult[0].perAmount = 0.03;
  expect(() => buildNativeQuote(pricing, captured, scope)).toThrow(/recurring rate changed/);
});
test("rejects incomplete, stale, duplicated, mismatched or invalid aggregations", () => {
  const changes: ((p: NativePricing, q: NativeInquiryQuote[]) => void)[] = [
    p => {p.pending = true;}, p => {p.result!.timeTag++;}, p => {p.result!.wrongTag = true;},
    p => {p.selectedProduct.region = "elsewhere";}, p => {p.selectedProduct.chargeMode = "PERIOD";},
    p => {p.result!.productRatingResult.pop();}, p => {p.result!.productRatingResult[1].id = "123-0-vm";},
    p => {p.result!.amount = 0;}, p => {p.result!.productRatingResult[0].amount = NaN;},
    p => {p.selectedProduct.productAllInfos[0].inquiryTag = "unknown";},
    p => {p.result!.installNum = -1;}, p => {p.result!.installNum = 12.5;}, p => {p.result!.perAmount = 0;}, p => {p.result!.installPeriodType = "unknown";},
    (_,q) => {q[0].inquiry.chargingMode = 1;}, (_,q) => {q[0].response.currency = "CNY";},
    (_,q) => {q[0].inquiry.regionId = "elsewhere";},
  ];
  for (const change of changes) {
    const {pricing,captured} = fixture(); change(pricing,captured);
    expect(() => buildNativeQuote(pricing,captured,scope)).toThrow();
  }
});
test("catalog-only components are supported while inquiry components still require fresh responses", () => {
  const {pricing} = fixture("ONETIME");
  pricing.selectedProduct.productAllInfos.forEach(p => {p.inquiryTag = "listCalc";});
  expect(buildNativeQuote(pricing,[],{...scope,billingMode:"ONETIME"}).quote.source).toBe("huawei-catalog");
});
test("zero quantities omitted by Huawei do not conceal missing positive components", () => {
  const { pricing, captured } = fixture("ONDEMAND");
  pricing.selectedProduct.productAllInfos[0].productNum = 0;
  pricing.result!.productRatingResult.shift();
  pricing.result!.amount = 5;
  const currentScope = { ...scope, billingMode: "ONDEMAND" as const };
  expect(buildNativeQuote(pricing, captured.slice(1), currentScope).quote.amount).toBe(5);
  expect(() => buildNativeQuote(pricing, [], currentScope)).toThrow(/fresh Huawei component/);
  pricing.selectedProduct.productAllInfos[1].productNum = 0;
  pricing.result!.productRatingResult = [];
  pricing.result!.amount = 0;
  expect(buildNativeQuote(pricing, [], currentScope).quote.amount).toBe(0);
  pricing.result!.amount = 1;
  expect(() => buildNativeQuote(pricing, [], currentScope)).toThrow(/does not match/);
  pricing.selectedProduct.productAllInfos[0].inquiryTag = "unknown";
  expect(() => buildNativeQuote(pricing, [], currentScope)).toThrow(/Unsupported/);
});
test("global products retain their official billing site and reject a different site", () => {
  const { pricing, captured } = fixture("ONDEMAND");
  pricing.selectedProduct.productAllInfos[1].siteCode = "ALLY_HWCEU";
  captured[1].inquiry.siteCode = "ALLY_HWCEU";
  const currentScope = { ...scope, billingMode: "ONDEMAND" as const };
  expect(buildNativeQuote(pricing, captured, currentScope).quote.amount).toBe(15);
  captured[1].inquiry.siteCode = "HWC";
  expect(() => buildNativeQuote(pricing, captured, currentScope)).toThrow(/product billing site/);
});
test("instrumentation observes original pricing, ignores late results and reruns the same configuration", async () => {
  const source = `const queryPrice = (selectedInfo, queryOptions) => { return queryOptions(selectedInfo); };\nconst funcPriceboardSetup = () => {}; return queryPrice;`;
  const window = {} as {__neoNativePricing: {result: unknown; selectedProduct: {timeTag:number}; refresh:()=>Promise<unknown>; pending:boolean}};
  const query = new Function("window",instrumentNativePricing(source))(window);
  let finish!: (value: unknown) => void;
  const first = query({selectedProduct:{timeTag:1}}, () => new Promise(resolve => {finish = resolve;}));
  let calls = 0;
  const result = {amount:42};
  await query({selectedProduct:{timeTag:2}}, () => {calls++; return Promise.resolve(result);});
  finish({amount:1}); await first;
  expect(window.__neoNativePricing.result).toBe(result);
  expect(window.__neoNativePricing.selectedProduct.timeTag).toBe(2);
  await window.__neoNativePricing.refresh();
  expect(calls).toBe(2);
  expect(window.__neoNativePricing.pending).toBe(false);
  for (const changed of ["missing", source+source, source.replace("const funcPriceboardSetup =", "const changed =")]) expect(() => instrumentNativePricing(changed)).toThrow(/renderer changed/);
});


test("partial and full upfront schedules preserve totals and separately recurring extras", () => {
  for (const upfront of [60,120]) {
    const {pricing,captured}=fixture();
    pricing.result!.installAmount=upfront;
    pricing.result!.perAmount=(120-upfront)/12;
    pricing.selectedProduct.productAllInfos[0].perPrice=(120-upfront)/12;
    const quote=buildNativeQuote(pricing,captured,scope).quote;
    expect(quote.amount).toBe(180);
    expect(quote.payment!.upfront).toBe(upfront);
    expect(quote.payment!.recurring).toBe((120-upfront)/12);
  }
});
