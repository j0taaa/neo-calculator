import { expect, test } from "bun:test";
import type { NativeSelection } from "../huawei-native/native-selection";
import type { NativePricing } from "../huawei-native/native-pricing";
import { quotationQuantity } from "./quantity";

const selection = (value: string | number | boolean = 2): NativeSelection => ({
  version: 2, service: "ecs", region: "region", billingMode: "ONDEMAND", initial: [], steps: [],
  fields: [{ id: "global_QUANTITY:0", component: "global_QUANTITY", label: "Quantity", type: "number", value }],
});
const pricing = (): NativePricing => ({
  epoch: 1, pending: false, result: null,
  selectedProduct: { region: "region", serviceCode: "ecs", chargeMode: "ONDEMAND", timeTag: 1,
    periodType: 4, periodNum: 1, subscriptionNum: 1, purchaseNum: { measureValue: 2 },
    productAllInfos: [{ selectIndex: 0, resourceSpecCode: "vm", inquiryTag: "normal", productNum: 2, selfProductNum: 1 },
      { selectIndex: 1, resourceSpecCode: "disks", inquiryTag: "normal", productNum: 6, selfProductNum: 3 }] },
});

test("multi-instance quantity agrees with purchase quantity and component counts, not subscriptionNum", () => {
  expect(quotationQuantity(selection(), pricing())).toBe(2);
  expect(quotationQuantity(selection("2"), pricing())).toBe(2);
});
test("changing or duplicating the form quantity cannot retain the price for another quantity", () => {
  expect(() => quotationQuantity(selection(999), pricing())).toThrow("does not match");
  const duplicate = selection(); duplicate.fields.push(duplicate.fields[0]);
  expect(() => quotationQuantity(duplicate, pricing())).toThrow("Invalid");
  for (const value of [0, 1.5, 10000, true, "", "NaN"])
    expect(() => quotationQuantity(selection(value), pricing())).toThrow("Invalid");
});
test("changing both visible and purchase quantities still requires matching priced components", () => {
  const p = pricing(); p.selectedProduct.purchaseNum!.measureValue = 999;
  expect(() => quotationQuantity(selection(999), p)).toThrow("priced components");
  delete p.selectedProduct.productAllInfos[0].selfProductNum;
  delete p.selectedProduct.productAllInfos[1].selfProductNum;
  expect(() => quotationQuantity(selection(999), p)).toThrow("Missing");
});
test("services without a global purchase quantity retain their resource-specific counts", () => {
  const s = selection(); s.fields = [];
  const p = pricing(); delete p.selectedProduct.purchaseNum;
  delete p.selectedProduct.productAllInfos[0].selfProductNum;
  delete p.selectedProduct.productAllInfos[1].selfProductNum;
  expect(quotationQuantity(s, p)).toBe(1);
  p.selectedProduct.purchaseNum = { measureValue: 2 };
  expect(() => quotationQuantity(s, p)).toThrow("does not match");
});
test("a fixed disabled quantity without scaling metadata stays at one", () => {
  const p = pricing(); delete p.selectedProduct.purchaseNum;
  for (const product of p.selectedProduct.productAllInfos) delete product.selfProductNum;
  expect(quotationQuantity(selection(1), p)).toBe(1);
  expect(() => quotationQuantity(selection(2), p)).toThrow("Missing priced quantity");
});
