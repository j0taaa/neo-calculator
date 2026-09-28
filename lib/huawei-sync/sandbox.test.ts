import { expect, test } from "bun:test";
import { runIsolated } from "./sandbox";
import { evaluateForm } from "./engine";
import { enumerateScenarios } from "./scenarios";

const source = await Bun.file("tests/fixtures/huawei-sync/nat.js.txt").text();
const products = await Bun.file("tests/fixtures/huawei-sync/nat-products.json").json();

test("upstream functions cannot access host capabilities or nondeterministic globals", async () => {
  expect(await runIsolated("", "() => [typeof process, typeof require, typeof fetch, typeof Date, typeof Math.random]", {})).toEqual(Array(5).fill("undefined"));
  await expect(runIsolated("while(true) {}", "() => null", {}, 25)).rejects.toThrow();
  await expect(runIsolated("", "() => new Array(100000000).fill('large')", {}, 100)).rejects.toThrow();
});

test("separate evaluations do not share mutable state", async () => {
  expect(await runIsolated("var value=0", "() => ++value", {})).toBe(1);
  expect(await runIsolated("var value=0", "() => ++value", {})).toBe(1);
});

test("NAT uses upstream choices, dependent selections and duration measurement units", async () => {
  const publicForm = await evaluateForm(source, products, { region: "ap-southeast-1", values: {} });
  expect(publicForm.fields.map(f => f.label)).toEqual(["Gateway", "Type"]);
  expect(publicForm.inquiry?.productInfos).toEqual([{ id: "0", cloudServiceType: "hws.service.type.natgateway", resourceType: "hws.resource.type.natgateway", resourceSpecCode: "natgateway_small", productNum: 1, usageFactor: "duration", usageValue: 1, usageMeasureId: 0 }]);
  const privateForm = await evaluateForm(source, products, { region: "ap-southeast-1", values: { "calculator_nat_type.nattype": "dataInfo_7_", "calculator_nat_radio.type": "dataInfo_4_" }, duration: 2 });
  expect(privateForm.duration.measureId).toBe(4);
  expect(privateForm.inquiry?.productInfos[0].resourceSpecCode).toBe("privatenat_xlarge");
  expect(privateForm.inquiry?.productInfos[0].usageValue).toBe(2);
});

test("reachable state enumeration covers all NAT combinations and enforces its budget", async () => {
  expect(await enumerateScenarios(source, products, "ap-southeast-1")).toHaveLength(8);
  await expect(enumerateScenarios(source, products, "ap-southeast-1", 2)).rejects.toThrow("Coverage budget exceeded");
});

test("invalid usage, missing catalogs and unsupported controls cannot silently yield verified quotes", async () => {
  await expect(evaluateForm(source, products, { region: "ap-southeast-1", values: {}, duration: -1 })).rejects.toThrow("Invalid duration");
  expect((await evaluateForm(source, { product: {} }, { region: "ap-southeast-1", values: {} })).inquiry).toBeNull();
  const changed = source.replace('type: "CommonSelect"', 'type: "NewHuaweiControl"');
  expect((await evaluateForm(changed, products, { region: "ap-southeast-1", values: {} })).diagnostics.join()).toContain("Unsupported component");
});
