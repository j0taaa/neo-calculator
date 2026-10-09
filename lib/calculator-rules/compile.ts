import ts from "typescript";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { createHash } from "node:crypto";
import type { CompiledRules, Operation, RuleFunction } from "./program";
type Callable = (...args: never[]) => unknown;
const compiled = new Map<string, string>();

/** Only the synchronization worker imports this compiler. The application receives JSON. */
export function compileRules(config: string): CompiledRules {
  const hash = createHash("sha256").update(config).digest("hex");
  let model = compiled.get(hash);
  if (!model) {
    model = JSON.stringify(extractRules(config));
    if (compiled.size >= 256) compiled.delete(compiled.keys().next().value!);
    compiled.set(hash, model);
  }
  // Every scope gets independent mutable extraction metadata.
  return JSON.parse(model);
}

function extractRules(config: string): CompiledRules {
  // Bun's vm shim does not preserve isolated globals consistently, and repeated
  // contexts can crash its JIT. Node owns extraction; no compiler runs in the app.
  if (process.versions.bun) {
    const script = `const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');const file=process.argv[1];const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));mod._compile(compiled.outputText,file);process.stdout.write(JSON.stringify(mod.exports.compileRules(fs.readFileSync(0,'utf8'))));`;
    const result = spawnSync("node", ["-e", script, resolve("lib/calculator-rules/compile.ts")], { input: config, encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.error?.message ?? result.stderr.trim() ?? "Rule extraction failed");
    return JSON.parse(result.stdout);
  }
  const sandbox: Record<string, unknown> = Object.create(null);
  const context = createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  // Keep callbacks inside the VM. A host function would expose its host Function
  // constructor to downloaded configuration despite the VM's code-generation guard.
  runInContext("globalThis.__neoClosures = new WeakMap(); globalThis.__neoCapture = (fn, captured) => { __neoClosures.set(fn, captured); return fn; };", context);
  const closures = sandbox.__neoClosures as WeakMap<Callable, Record<string, unknown>>;
  const configSource = ts.createSourceFile("config.js", config, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const bindings = (owner: ts.Node) => {
    const names = new Set<string>();
    const pattern = (n: ts.Node) => { if (ts.isIdentifier(n)) names.add(n.text); else if (ts.isArrayBindingPattern(n) || ts.isObjectBindingPattern(n)) n.elements.forEach(e => { if (ts.isBindingElement(e)) pattern(e.name); }); };
    const visit = (n: ts.Node) => {
      if (n !== owner && ts.isFunctionLike(n)) return;
      if (ts.isVariableDeclaration(n) || ts.isParameter(n)) pattern(n.name);
      ts.forEachChild(n, visit);
    };
    visit(owner); return names;
  };
  const transformed = ts.transform(configSource, [context => {
    const visit: ts.Visitor = n => {
      if (ts.isFunctionExpression(n) || ts.isArrowFunction(n)) {
        const local = bindings(n), outer = new Set<string>(), referenced = new Set<string>();
        for (let parent = n.parent; parent; parent = parent.parent) if (ts.isFunctionLike(parent)) for (const key of bindings(parent)) outer.add(key);
        const find = (child: ts.Node) => { if (ts.isIdentifier(child)) referenced.add(child.text); ts.forEachChild(child, find); };
        find(n);
        const captured = [...outer].filter(key => referenced.has(key) && !local.has(key));
        const fn = ts.visitEachChild(n, visit, context) as ts.Expression;
        if (!captured.length) return fn;
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__neoCapture"), undefined, [fn, ts.factory.createObjectLiteralExpression(captured.map(key => ts.factory.createShorthandPropertyAssignment(key)))]);
      }
      return ts.visitEachChild(n, visit, context);
    };
    return source => ts.visitNode(source, visit) as ts.SourceFile;
  }]);
  const captureSource = ts.createPrinter().printFile(transformed.transformed[0]);
  transformed.dispose();
  runInContext(captureSource, context, { timeout: 2000 });
  const references = new Set<string>();
  function compileFunction(fn: Callable): RuleFunction {
    const source = ts.createSourceFile("rule.js", `(${fn.toString()})`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const expression = (source.statements[0] as ts.ExpressionStatement).expression as ts.ParenthesizedExpression;
    const callable = expression.expression as ts.FunctionExpression;
    const reject = (node: ts.Node): never => { throw new Error(`Unsupported synchronized rule: ${ts.SyntaxKind[node.kind]}: ${node.getText(source).slice(0, 100)}`); };
    const node = (n: ts.Node): Operation => {
      if (ts.isParenthesizedExpression(n)) return node(n.expression);
      if (ts.isIdentifier(n)) { references.add(n.text); return ["name", n.text]; }
      if (ts.isNumericLiteral(n)) return ["literal", Number(n.text)];
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return ["literal", n.text];
      switch (n.kind) {
        case ts.SyntaxKind.TrueKeyword: return ["literal", true];
        case ts.SyntaxKind.FalseKeyword: return ["literal", false];
        case ts.SyntaxKind.NullKeyword: return ["literal", null];
        case ts.SyntaxKind.ThisKeyword: return ["name", "this"];
        case ts.SyntaxKind.RegularExpressionLiteral: {
          const text = n.getText(source), end = text.lastIndexOf("/");
          return ["regex", text.slice(1, end), text.slice(end + 1)];
        }
      }
      if (ts.isPropertyAccessExpression(n)) {
        if (ts.isIdentifier(n.expression) && n.expression.text === "window") {
          const environment: Record<string, string> = { calcLanguage: "en-us", calcStation: "zh-HK", calcUnit: "USD" };
          if (!(n.name.text in environment)) return reject(n);
          return ["literal", environment[n.name.text]];
        }
        return ["get", node(n.expression), ["literal", n.name.text]];
      }
      if (ts.isElementAccessExpression(n)) return ["get", node(n.expression), node(n.argumentExpression)];
      if (ts.isArrayLiteralExpression(n)) return ["array", n.elements.map(node)];
      if (ts.isOmittedExpression(n)) return ["undefined"];
      if (ts.isSpreadElement(n) || ts.isSpreadAssignment(n)) return ["spread", node(n.expression)];
      if (ts.isObjectLiteralExpression(n)) return ["object", n.properties.map(p => {
        if (ts.isSpreadAssignment(p)) return node(p);
        if (ts.isShorthandPropertyAssignment(p)) return ["property", ["literal", p.name.text], node(p.name)];
        if (!ts.isPropertyAssignment(p)) return reject(p);
        return ["property", ts.isComputedPropertyName(p.name) ? node(p.name.expression) : ["literal", ts.isIdentifier(p.name) ? p.name.text : (p.name as ts.StringLiteral).text], node(p.initializer)];
      })];
      if (ts.isFunctionExpression(n) || ts.isArrowFunction(n)) return ["function", n.parameters.map(p => node(p)), node(n.body), n.name?.getText(source)];
      if (ts.isCallExpression(n)) {
        if (ts.isIdentifier(n.expression) && n.expression.text === "__neoCapture") return node(n.arguments[0]);
        return ["call", node(n.expression), n.arguments.map(node)];
      }
      if (ts.isNewExpression(n)) return ["new", node(n.expression), (n.arguments ?? []).map(node)];
      if (ts.isBinaryExpression(n)) return ["binary", n.operatorToken.getText(source), node(n.left), node(n.right)];
      if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) return ["unary", ts.tokenToString(n.operator), node(n.operand), ts.isPostfixUnaryExpression(n)];
      if (ts.isTypeOfExpression(n)) return ["unary", "typeof", node(n.expression)];
      if (ts.isVoidExpression(n)) return ["unary", "void", node(n.expression)];
      if (ts.isDeleteExpression(n)) return ["delete", node(n.expression)];
      if (ts.isConditionalExpression(n)) return ["conditional", node(n.condition), node(n.whenTrue), node(n.whenFalse)];
      if (ts.isTemplateExpression(n)) return ["template", n.head.text, n.templateSpans.map(p => [node(p.expression), p.literal.text])];
      if (ts.isBlock(n)) return ["block", n.statements.map(node)];
      if (ts.isExpressionStatement(n)) return node(n.expression);
      if (ts.isReturnStatement(n)) return ["return", n.expression ? node(n.expression) : ["undefined"]];
      if (ts.isVariableStatement(n)) return node(n.declarationList);
      if (ts.isVariableDeclarationList(n)) return ["declare", n.declarations.map(d => [node(d.name), d.initializer ? node(d.initializer) : ["undefined"]])];
      if (ts.isIfStatement(n)) return ["if", node(n.expression), node(n.thenStatement), n.elseStatement ? node(n.elseStatement) : ["block", []]];
      if (ts.isForStatement(n)) return ["for", n.initializer ? node(n.initializer) : null, n.condition ? node(n.condition) : null, n.incrementor ? node(n.incrementor) : null, node(n.statement)];
      if (ts.isForOfStatement(n) || ts.isForInStatement(n)) return [ts.isForOfStatement(n) ? "forOf" : "forIn", node(n.initializer), node(n.expression), node(n.statement)];
      if (ts.isWhileStatement(n)) return ["while", node(n.expression), node(n.statement)];
      if (ts.isDoStatement(n)) return ["do", node(n.expression), node(n.statement)];
      if (ts.isBreakStatement(n)) return ["break"];
      if (ts.isContinueStatement(n)) return ["continue"];
      if (ts.isEmptyStatement(n)) return ["block", []];
      if (ts.isSwitchStatement(n)) return ["switch", node(n.expression), n.caseBlock.clauses.map(c => [ts.isCaseClause(c) ? node(c.expression) : null, c.statements.map(node)])];
      if (ts.isTryStatement(n)) return ["try", node(n.tryBlock), n.catchClause ? [n.catchClause.variableDeclaration ? node(n.catchClause.variableDeclaration.name) : null, node(n.catchClause.block)] : null, n.finallyBlock ? node(n.finallyBlock) : null];
      if (ts.isThrowStatement(n)) return ["throw", node(n.expression)];
      if (ts.isFunctionDeclaration(n)) return ["declareFunction", n.name!.text, n.parameters.map(p => node(p)), node(n.body!)];
      if (ts.isArrayBindingPattern(n)) return ["arrayBinding", n.elements.map(e => ts.isOmittedExpression(e) ? null : node(e))];
      if (ts.isObjectBindingPattern(n)) return ["objectBinding", n.elements.map(e => [e.propertyName ? e.propertyName.getText(source) : e.name.getText(source), node(e)])];
      if (ts.isParameter(n)) return [n.dotDotDotToken ? "restBinding" : "binding", node(n.name), n.initializer ? node(n.initializer) : null];
      if (ts.isBindingElement(n)) return [n.dotDotDotToken ? "restBinding" : "binding", node(n.name), n.initializer ? node(n.initializer) : null];
      return reject(n);
    };
    return { $rule: { parameters: callable.parameters.map(p => node(p)), body: node(callable.body), name: callable.name?.text, ...(closures.has(fn) ? { closure: encode(closures.get(fn)) as Record<string, unknown> } : {}) } };
  }
  function encode(value: unknown): unknown {
    if (typeof value === "function") return compileFunction(value as Callable);
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === "object") {
      if (Object.prototype.toString.call(value) === "[object RegExp]") {
        const regex = value as RegExp;
        return { $regex: regex.source, flags: regex.flags };
      }
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    }
    return value;
  }
  const views = sandbox.viewConfig as { calc_view?: { components?: Record<string, unknown>[]; showConfigs?: Record<string, unknown>[] } };
  const data = sandbox.dataConfig as { dataSources?: Record<string, unknown>[] };
  const functions = sandbox.funcConfig as { calc?: { parseSelectProduct?: Record<string, unknown>[] } };
  if (!views?.calc_view || !data) throw new Error("Missing synchronized calculator schema");
  const ids = new Set((views.calc_view.components ?? []).map(c => c.id));
  const result = {
    version: 1 as const,
    components: encode(views.calc_view.components ?? []),
    sources: encode((data.dataSources ?? []).filter(s => (s.ids as string[]).some(id => ids.has(id)))),
    visibility: encode(views.calc_view.showConfigs ?? []),
    transforms: encode(functions?.calc?.parseSelectProduct ?? []),
    globals: {} as Record<string, unknown>,
    language: encode(sandbox.lang ?? {}),
  } as Omit<CompiledRules, "fingerprint">;
  // Capture constants referenced by the pure business rules, excluding Babel implementation helpers.
  const handled = new Set<string>();
  for (const reference of references) {
    if (handled.has(reference) || reference.startsWith("_") || !(reference in sandbox) || ["dataConfig", "viewConfig", "funcConfig", "lang"].includes(reference)) continue;
    handled.add(reference);
    result.globals[reference] = encode(sandbox[reference]);
  }
  const fingerprint = createHash("sha256").update(JSON.stringify(result)).digest("hex");
  return { ...result, fingerprint };
}
