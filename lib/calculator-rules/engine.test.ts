import { expect, test } from "bun:test";
import { CalculatorEngine } from "./engine";
import { fixture } from "./test-fixture";
import { quotationQuantity } from "../huawei-snapshot/quantity";
import { compileRules } from "./compile";
import { buildControls } from "./controls";
import { clusterControls } from "./specialized";
import { assertIndependentState } from "./validate";

test("identical local calculations have stable component identities and quote fingerprints", () => {
  const { scope, menu } = fixture();
  const first = new CalculatorEngine(scope.rules!, scope, menu, "release", "ONDEMAND");
  const second = new CalculatorEngine(scope.rules!, scope, menu, "release", "ONDEMAND");
  expect(first.state.quote).toEqual(second.state.quote);
  expect(first.state.inquiries).toEqual(second.state.inquiries);
  const changed = second.change("global_ONDEMANDTIME:0", 2);
  expect(changed.quote?.requestHash).not.toEqual(first.state.quote?.requestHash);
});

test("informational or unavailable modes still require identical options and limits", () => {
  const { scope, menu } = fixture();
  const initial = new CalculatorEngine(scope.rules!, scope, menu, "release", "ONDEMAND").state;
  const reference = { ...initial, quote: undefined, availability: "unavailable" as const, inquiries: [] };
  const actual = structuredClone(reference);
  actual.fields.find(field => field.component === "global_QUANTITY")!.max = 4;
  expect(() => assertIndependentState(reference, actual)).toThrow("options or limits differ");
});

test("cluster regions without disks expose disabled disk choices without pricing invented disks", () => {
  const context = { chosen: new Map(), bindings: new Map(), translate: (value: unknown) => value, measure: () => "nodes" };
  const result = clusterControls({ id: "master", nodeType: "master", titlePrefix: "Master " }, [{ resourceType: "hws.resource.type.vm", resourceSpecCode: "vm.small", vmType: "General", generation: "1", nodeSize: "2 vCPU" }], context, (config, rows, namespace) => buildControls(config, rows, context, config.id, namespace));
  expect(result.fields.filter(f => f.label.includes("Disk")).map(f => [f.label, f.disabled, f.options])).toEqual([["Master System Disk", true, []], ["Master Data Disk", true, []]]);
  expect(result.products).toHaveLength(1);
  expect(result.products[0].resourceType).toBe("hws.resource.type.vm");
});

test("missing radio attributes retain the empty leading control without losing priced usage", () => {
  const result = buildControls({ id: "edition", type: "CommonRadioGroup", optionKeys: ["edition", "instances"], titles: ["Edition", "Instances"], steppers: [{ title: "Instance count", target: "Usage", prefixs: [{ measureId: 41, min: 1, max: 9999 }] }] }, [{ resourceSpecCode: "instance" }], { chosen: new Map(), bindings: new Map(), translate: value => value, measure: () => "instances" });
  expect(result.fields.map(f => [f.label, f.type, f.value, f.disabled])).toEqual([["Edition", "select", "-1", true], ["Instance count", "number", 1, false]]);
  expect(result.products[0].usageValue).toBe(1);
});

test("flavor, duration and quantity use published rates and survive save/reopen", () => {
  const { scope, menu } = fixture(), engine = new CalculatorEngine(scope.rules!, scope, menu, "release", "ONDEMAND");
  const initial = engine.evaluate();
  expect(initial.quote?.amount).toBe(4); // Alphabetical Large flavor.
  engine.change("flavor:0", "1");
  engine.change("global_ONDEMANDTIME:0", 3);
  const state = engine.change("global_QUANTITY:0", 2);
  expect(state.quote).toMatchObject({ amount: 12, source: "huawei-catalog", aggregation: "neo-engine" });
  expect(quotationQuantity(state.selection, state.local!.pricing)).toBe(2);
  const restored = new CalculatorEngine(JSON.parse(JSON.stringify(scope.rules)), scope, menu, "release", "ONDEMAND").restore(JSON.parse(JSON.stringify(state.selection)));
  expect(restored.quote?.amount).toBe(12);
  expect(restored.fields).toEqual(state.fields);
});
test("yearly terms can use monthly plans without live pricing", () => {
  const { scope, menu } = fixture(), engine = new CalculatorEngine(scope.rules!, scope, menu, "release", "PERIOD");
  const state = engine.evaluate(), years = state.fields.find(f => f.component === "global_PERIODTIME")!;
  const selected = years.options!.find(o => o.label === "1 year")!;
  expect(engine.change(years.id, selected.value).quote?.amount).toBe(1200);
});
test("invalid choices and bounds cannot manufacture a quotation", () => {
  const { scope, menu } = fixture(), engine = new CalculatorEngine(scope.rules!, scope, menu, "release", "ONDEMAND");
  engine.evaluate();
  expect(() => engine.change("flavor:0", "999")).toThrow("Invalid calculator option");
  expect(() => engine.change("global_QUANTITY:0", 100)).toThrow("allowed range");
  expect(() => engine.change("global_QUANTITY:0", 1.5)).toThrow("whole purchase quantity");
  expect(() => engine.change("global_ONDEMANDTIME:0", NaN)).toThrow("allowed range");
  expect(engine.state.quote?.amount).toBe(4);
});

test("a failing dependent rule leaves the last successful quotation and choices intact", () => {
  const { scope, menu } = fixture();
  scope.rules = compileRules(scope.config + `funcConfig.calc.parseSelectProduct=[{id:'flavor',inputs:['flavor'],function:function(rows){if(rows[0].size==='Small')throw new Error('Unavailable rule');return rows;}}];`);
  const engine = new CalculatorEngine(scope.rules, scope, menu, "release", "ONDEMAND"), original = engine.state;
  expect(() => engine.change("flavor:0", "1")).toThrow("Unavailable rule");
  expect(engine.state).toBe(original);
  expect(engine.state.fields.find(f => f.id === "flavor:0")?.value).toBe("0");
  expect(engine.change("global_ONDEMANDTIME:0", 2).quote?.amount).toBe(original.quote!.amount * 2);
});

test("regional radio bandwidth choices do not borrow another region's limits", () => {
  const { scope, menu } = fixture();
  scope.rules!.components[0].steppers = [{ target: "Resource", category: "radioGroup", enumValues: [5, 10], prefixs: [{ measureId: 15, min: 5, max: 10, defaultValue: 5 }], rules: [{ regions: ["other"] }] }, { target: "Resource", category: "radioGroup", enumValues: [5, 10, 20, 50], prefixs: [{ measureId: 15, min: 5, max: 50, defaultValue: 5 }], rules: [{ regions: ["region"] }] }];
  const engine = new CalculatorEngine(scope.rules!, scope, menu, "release", "ONDEMAND");
  expect(engine.state.fields.find(f => f.id === "flavor:1")?.options?.map(o => o.label)).toEqual(["5", "10", "20", "50"]);
  expect(engine.change("flavor:1", "3").inquiries[0].productInfos[0].resourceSize).toBe(50);
});
