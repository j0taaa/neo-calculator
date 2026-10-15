import { expect, test } from "bun:test";
import { compileRules } from "./compile";
import { RuleEvaluator } from "./evaluate";

function rule(source: string) {
  const model = JSON.parse(JSON.stringify(compileRules(`var dataConfig={dataSources:[]};var viewConfig={calc_view:{components:[]}};var funcConfig={calc:{parseSelectProduct:[{id:'test',inputs:[],function:${source}}]}};`)));
  return { evaluator: new RuleEvaluator(model.globals), program: model.transforms[0].function };
}
test("JSON rules preserve control flow, mutation, numeric coercion and undefined", () => {
  const source = `function(rows){var unset;var total=0;for(var i=0;i<rows.length;i++){if(rows[i].skip)continue;total+=Number(rows[i].value);rows[i].value*=2;}return {total:total,missing:typeof unset,values:rows.map(function(row){return row.value}),matched:/large/i.test('LARGE')};}`;
  const { evaluator, program } = rule(source);
  expect(evaluator.run(program, [[{ value: "3" }, { value: 7, skip: true }, { value: 5 }]])).toEqual({ total: 8, missing: "undefined", values: [6, 7, 10], matched: true });
});
test("closures created by service factories survive serialization", () => {
  const source = `var dataConfig={dataSources:[]};var viewConfig={calc_view:{components:[]}};var funcConfig={calc:{parseSelectProduct:['tcp','udp'].map(function(protocol){return {id:protocol,function:function(rows){return rows.filter(function(row){return row.protocol===protocol})}}})}};`;
  const model = JSON.parse(JSON.stringify(compileRules(source)));
  const evaluator = new RuleEvaluator(model.globals);
  expect(evaluator.run(model.transforms[1].function, [[{ protocol: "tcp" }, { protocol: "udp" }]])).toEqual([{ protocol: "udp" }]);
});
test("rules have no network, DOM, dynamic-code or prototype access", () => {
  for (const source of ["function(){return fetch('https://example.com')}", "function(){return document.body}", "function(){return eval('1')}", "function(){return [].constructor.constructor('return process')()}"]) {
    const { evaluator, program } = rule(source);
    expect(() => evaluator.run(program, [])).toThrow();
  }
});
test("an unbounded rule cannot hang the calculator", () => {
  const { evaluator, program } = rule("function(){while(true){}}");
  expect(() => evaluator.run(program, [])).toThrow("operation budget");
});
test("unknown syntax fails compilation instead of silently omitting a condition", () => {
  expect(() => rule("function(){class Unsupported{};return Unsupported}")).toThrow("Unsupported synchronized rule");
});

test("defaults, destructured arguments and rest values retain their business semantics", () => {
  const { evaluator, program } = rule("function({count=2}={},...extras){return count+extras.reduce(function(total,value){return total+value},0)}");
  expect(evaluator.run(program, [])).toBe(2);
  expect(evaluator.run(program, [{}, 3, 4])).toBe(9);
  expect(evaluator.run(program, [{ count: 0 }, 3])).toBe(3);
});

test("a failed recursive rule does not poison subsequent evaluations", () => {
  const { evaluator, program } = rule("function recur(count){return count?recur(count-1):7}");
  expect(() => evaluator.run(program, [100])).toThrow("call depth");
  expect(evaluator.run(program, [3])).toBe(7);
});

test("downloaded configuration cannot escape the worker VM through the capture callback", () => {
  expect(() => compileRules("__neoCapture.constructor('return process')();")).toThrow("Code generation from strings disallowed");
});
