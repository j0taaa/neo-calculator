/* eslint-disable @typescript-eslint/no-explicit-any -- The interpreter accepts a heterogeneous, validated JSON instruction format. */
import type { Operation, RuleFunction } from "./program";

type Environment = { values: Record<string, any>; parent?: Environment };
type Callable = (...args: any[]) => any;
type Control = { control: "return" | "break" | "continue"; value?: any };
const forbidden = new Set(["__proto__", "constructor", "caller", "callee", "prototype"]);
const methods = new Set(["map", "filter", "find", "findIndex", "some", "every", "forEach", "reduce", "reduceRight", "sort", "slice", "splice", "push", "pop", "shift", "unshift", "join", "concat", "indexOf", "lastIndexOf", "includes", "entries", "keys", "values", "reverse", "flat", "flatMap", "fill", "split", "replace", "replaceAll", "match", "search", "test", "exec", "toLowerCase", "toUpperCase", "trim", "startsWith", "endsWith", "substring", "substr", "charAt", "charCodeAt", "toString", "toFixed", "toPrecision", "hasOwnProperty", "call", "apply", "bind", "s", "n", "e", "f"]);

/** A bounded interpreter for synchronized data rules. It has no DOM, I/O, eval or arbitrary globals. */
export class RuleEvaluator {
  private remaining = 2_000_000;
  private depth = 0;
  private allowed = new WeakSet<Callable>();
  private root: Environment;
  constructor(globals: Record<string, unknown> = {}) {
    const permit = <T extends Callable>(fn: T): T => { this.allowed.add(fn); return fn; };
    const object = {
      keys: permit(Object.keys), values: permit(Object.values), entries: permit(Object.entries),
      assign: permit(Object.assign), fromEntries: permit(Object.fromEntries),
      prototype: { toString: permit(Object.prototype.toString), hasOwnProperty: permit(Object.prototype.hasOwnProperty) },
    };
    const array = permit(((...args: any[]) => Array(...args)) as any);
    array.isArray = permit(Array.isArray); array.from = permit(Array.from); array.of = permit(Array.of);
    const math = Object.fromEntries(Object.getOwnPropertyNames(Math).map(k => [k, typeof (Math as any)[k] === "function" ? permit((Math as any)[k]) : (Math as any)[k]]));
    const intrinsic: Record<string, any> = {
      undefined, NaN, Infinity, Object: object, Array: array, Math: math,
      Number: permit(Number), String: permit(String), Boolean: permit(Boolean),
      parseInt: permit(parseInt), parseFloat: permit(parseFloat), isNaN: permit(isNaN), isFinite: permit(isFinite),
      RegExp: permit(RegExp), Error: permit(Error), TypeError: permit(TypeError),
      JSON: { parse: permit(JSON.parse), stringify: permit(JSON.stringify) },
      console: { log: permit(() => {}), warn: permit(() => {}), error: permit(() => {}) },
      _typeof: permit((v: any) => typeof v),
      _objectSpread: permit((target: any, ...items: any[]) => Object.assign(target, ...items)),
      _objectSpread2: permit((target: any, ...items: any[]) => Object.assign(target, ...items)),
      _slicedToArray: permit((v: any[], n: number) => v.slice(0, n)),
      _toConsumableArray: permit((v: any[]) => Array.from(v)),
      _defineProperty: permit((o: any, k: any, v: any) => { this.checkKey(k); o[k] = v; return o; }),
      _createForOfIteratorHelper: permit((value: any[]) => {
        let index = 0;
        return { s: permit(() => {}), n: permit(() => ({ done: index >= value.length, value: value[index++] })), e: permit((error: any) => { throw error; }), f: permit(() => {}) };
      }),
    };
    Object.assign(intrinsic.Number, { isFinite: permit(Number.isFinite), isNaN: permit(Number.isNaN), isInteger: permit(Number.isInteger) });
    this.root = { values: intrinsic };
    for (const [name, value] of Object.entries(globals)) this.root.values[name] = this.hydrate(value, this.root);
  }
  private tick() { if (--this.remaining < 0) throw new Error("Synchronized rule exceeded its operation budget"); }
  private checkKey(key: any) { if (forbidden.has(String(key))) throw new Error(`Forbidden rule property: ${key}`); }
  private hydrate(value: any, env: Environment): any {
    if (value?.$rule) {
      const fn = value.$rule;
      const captured = fn.closure ? { parent: env, values: this.hydrate(fn.closure, env) } : env;
      return this.callable(fn.parameters, fn.body, captured, fn.name);
    }
    if (value?.$regex) return new RegExp(value.$regex, value.flags);
    if (Array.isArray(value)) return value.map(v => this.hydrate(v, env));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => { this.checkKey(k); return [k, this.hydrate(v, env)]; }));
    return value;
  }
  run(rule: unknown, args: unknown[], context: Record<string, unknown> = {}): any {
    this.remaining = 2_000_000; this.depth = 0;
    const callable = this.hydrate(rule, this.root);
    if (typeof callable !== "function") throw new Error("Missing compiled business rule");
    const scope = this.hydrate(context, this.root);
    // Only Neo's own pure translation/formatting callbacks may be supplied by the form engine.
    for (const fn of Object.values(scope)) if (typeof fn === "function") this.allowed.add(fn as Callable);
    return callable.apply(scope, args);
  }
  private lookup(env: Environment, name: string): any {
    for (let current: Environment | undefined = env; current; current = current.parent)
      if (Object.prototype.hasOwnProperty.call(current.values, name)) return current.values[name];
    throw new Error(`Unknown synchronized rule input: ${name}`);
  }
  private reference(node: Operation, env: Environment): { get: () => any; set: (v: any) => void; delete?: () => boolean } {
    if (node[0] === "name") {
      const name = node[1] as string;
      let owner = env;
      for (let current: Environment | undefined = env; current; current = current.parent) if (Object.prototype.hasOwnProperty.call(current.values, name)) { owner = current; break; }
      return { get: () => this.lookup(env, name), set: v => { owner.values[name] = v; } };
    }
    if (node[0] !== "get") throw new Error("Invalid synchronized assignment");
    const object = this.execute(node[1] as Operation, env), key = this.execute(node[2] as Operation, env);
    this.checkKey(key);
    if (object == null) throw new Error("Missing synchronized assignment target");
    return { get: () => object[key], set: v => { object[key] = v; }, delete: () => delete object[key] };
  }
  private get(object: any, key: any): any {
    // The only supported prototype access is the two explicit, harmless Object intrinsics.
    if (key === "prototype" && object === this.root.values.Object) return object.prototype;
    this.checkKey(key);
    if (object == null) throw new Error(`Missing rule value for ${key}`);
    const value = object[key];
    if (typeof value === "function") {
      if (!this.allowed.has(value)) {
        if (!methods.has(String(key))) throw new Error(`Unsupported synchronized method: ${key}`);
        this.allowed.add(value);
      }
    }
    return value;
  }
  private bind(pattern: Operation, value: any, env: Environment) {
    if (pattern[0] === "name") { env.values[String(pattern[1])] = value; return; }
    if (pattern[0] === "binding" || pattern[0] === "restBinding") {
      this.bind(pattern[1] as Operation, value === undefined && pattern[2] ? this.execute(pattern[2] as Operation, env) : value, env); return;
    }
    if (pattern[0] === "arrayBinding") {
      (pattern[1] as (Operation | null)[]).forEach((p, i) => { if (p) this.bind(p, p[0] === "restBinding" ? value.slice(i) : value?.[i], env); }); return;
    }
    if (pattern[0] === "objectBinding") {
      for (const [key, p] of pattern[1] as [string, Operation][]) this.bind(p, value?.[key], env); return;
    }
    this.reference(pattern, env).set(value);
  }
  private callable(parameters: Operation[], body: Operation, captured: Environment, name?: string) {
    // A regular function retains the rule's explicit `this`, so the interpreter must be captured.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const evaluator = this;
    const fn = function(this: any, ...args: any[]) {
      if (evaluator.depth >= 64) throw new Error("Synchronized rule exceeded its call depth");
      evaluator.depth++;
      try {
        const env: Environment = { parent: captured, values: { this: this, arguments: args } };
        if (name) env.values[name] = fn;
        parameters.forEach((p, i) => evaluator.bind(p, p[0] === "restBinding" ? args.slice(i) : args[i], env));
        const result = evaluator.execute(body, env);
        return result?.control === "return" ? result.value : body[0] === "block" ? undefined : result;
      } finally { evaluator.depth--; }
    };
    this.allowed.add(fn);
    return fn;
  }
  private args(nodes: Operation[], env: Environment) {
    return nodes.flatMap(n => n[0] === "spread" ? this.execute(n[1] as Operation, env) : [this.execute(n, env)]);
  }
  private execute(node: Operation, env: Environment): any {
    this.tick();
    const [op, a, b, c, d] = node;
    const value = (v: unknown) => this.execute(v as Operation, env);
    switch (op) {
      case "literal": return a;
      case "undefined": return undefined;
      case "name": return this.lookup(env, a as string);
      case "regex": return new RegExp(a as string, b as string);
      case "get": return this.get(value(a), value(b));
      case "array": return this.args(a as Operation[], env);
      case "object": {
        const result: Record<string, any> = {};
        for (const item of a as Operation[]) {
          if (item[0] === "spread") Object.assign(result, value(item[1]));
          else { const key = value(item[1]); this.checkKey(key); result[key] = value(item[2]); }
        }
        return result;
      }
      case "function": return this.callable(a as Operation[], b as Operation, env, c as string | undefined);
      case "declareFunction": env.values[a as string] = this.callable(b as Operation[], c as Operation, env, a as string); return;
      case "call": case "new": {
        const callee = a as Operation;
        const receiver = callee[0] === "get" ? value(callee[1]) : undefined;
        const fn = callee[0] === "get" ? this.get(receiver, value(callee[2])) : value(callee);
        if (typeof fn !== "function" || !this.allowed.has(fn)) throw new Error(`Forbidden synchronized call: ${JSON.stringify(callee).slice(0, 180)} (${typeof fn})`);
        const args = this.args(b as Operation[], env);
        if (["call", "apply", "bind"].includes(callee[0] === "get" ? String(value(callee[2])) : "") && !this.allowed.has(receiver)) throw new Error("Forbidden indirect synchronized call");
        if (op === "new" && fn === this.root.values.Array) return Array(...args);
        const result = op === "new" ? Reflect.construct(fn, args) : fn.apply(receiver, args);
        if (typeof result === "function" && callee[0] === "get" && value(callee[2]) === "bind") this.allowed.add(result);
        return result;
      }
      case "template": return (a as string) + (b as [Operation, string][]).map(([expr, text]) => String(value(expr)) + text).join("");
      case "conditional": return value(a) ? value(b) : value(c);
      case "delete": return this.reference(a as Operation, env).delete?.() ?? false;
      case "unary": {
        if (a === "typeof" && (b as Operation)[0] === "name") { try { return typeof value(b); } catch { return "undefined"; } }
        if (a === "++" || a === "--") { const ref = this.reference(b as Operation, env), prior = Number(ref.get()), next = prior + (a === "++" ? 1 : -1); ref.set(next); return c ? prior : next; }
        const operand = value(b);
        switch (a) { case "!": return !operand; case "-": return -operand; case "+": return +operand; case "~": return ~operand; case "typeof": return typeof operand; case "void": return undefined; }
        throw new Error(`Unsupported rule unary operator: ${a}`);
      }
      case "binary": {
        const operator = a as string;
        if (operator === "=") { const result = value(c); this.reference(b as Operation, env).set(result); return result; }
        const left = value(b);
        if (operator === "&&") return left && value(c);
        if (operator === "||") return left || value(c);
        if (operator === "??") return left ?? value(c);
        const right = value(c);
        let result: any;
        switch (operator.replace(/=$/, operator.length > 1 && !["==", "===", "!=", "!==", "<=", ">="].includes(operator) ? "" : "=")) {
          case "+": result = left + right; break; case "-": result = left - right; break; case "*": result = left * right; break; case "/": result = left / right; break; case "%": result = left % right; break; case "**": result = left ** right; break;
          case "===": return left === right; case "!==": return left !== right;
          // Official rules contain coercive comparisons; retain those exact business semantics.
          case "==": return left == right; case "!=": return left != right;
          case ">": return left > right; case ">=": return left >= right; case "<": return left < right; case "<=": return left <= right;
          case "|": result = left | right; break; case "&": result = left & right; break; case "^": result = left ^ right; break; case ">>": result = left >> right; break; case "<<": result = left << right; break;
          case "in": this.checkKey(left); return left in right;
          case "instanceof": return right === this.root.values.Array ? Array.isArray(left) : right === this.root.values.Object ? left !== null && typeof left === "object" : left instanceof right;
          case ",": return right;
          default: throw new Error(`Unsupported rule binary operator: ${operator}`);
        }
        if (operator.endsWith("=")) this.reference(b as Operation, env).set(result);
        return result;
      }
      case "declare": for (const [pattern, initializer] of a as [Operation, Operation][]) this.bind(pattern, value(initializer), env); return;
      case "block": {
        for (const statement of a as Operation[]) { const result = value(statement); if (result?.control) return result; }
        return;
      }
      case "return": return { control: "return", value: value(a) };
      case "break": case "continue": return { control: op };
      case "throw": throw value(a);
      case "if": return value(a) ? value(b) : value(c);
      case "for": case "while": case "do": {
        if (op === "for" && a) value(a);
        let first = true;
        while (op === "for" ? !b || value(b) : op === "do" && first || value(a)) {
          this.tick(); first = false;
          const result: Control = value(op === "for" ? d : b);
          if (result?.control === "return") return result;
          if (result?.control === "break") break;
          if (op === "for" && c) value(c);
        }
        return;
      }
      case "forOf": case "forIn": {
        const iterable = value(b);
        const pattern = (a as Operation)[0] === "declare" ? ((a as Operation)[1] as [Operation, Operation][])[0][0] : a as Operation;
        for (const item of op === "forOf" ? iterable : Object.keys(iterable)) {
          this.tick(); this.bind(pattern, item, env);
          const result: Control = value(c);
          if (result?.control === "return") return result;
          if (result?.control === "break") break;
        }
        return;
      }
      case "switch": {
        const target = value(a); let active = false;
        for (const [condition, statements] of b as [Operation | null, Operation[]][]) {
          if (!condition || target === value(condition)) active = true;
          if (!active) continue;
          const result = value(["block", statements]);
          if (result?.control === "break") return;
          if (result?.control) return result;
        }
        return;
      }
      case "try": {
        let result: any;
        try { result = value(a); } catch (error) {
          if (!b) throw error;
          const [pattern, block] = b as [Operation | null, Operation];
          if (pattern) this.bind(pattern, error, env);
          result = value(block);
        } finally { if (c) { const final = value(c); if (final?.control) result = final; } }
        return result;
      }
      default: throw new Error(`Unsupported synchronized instruction: ${op}`);
    }
  }
}

export function isRule(value: unknown): value is RuleFunction {
  return Boolean(value && typeof value === "object" && "$rule" in value);
}
