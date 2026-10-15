import ts from "typescript";
import type { PriceExpression, PriceStatement } from "./custom-pricing";

/** Only arithmetic, bounded conditionals and named scalar assignments are accepted. */
export function compileSupportPricing(config: string) {
  const source = ts.createSourceFile(
    "config.js",
    config,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let handler: ts.FunctionExpression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(source) === "id" &&
          ts.isStringLiteral(property.initializer) &&
          property.initializer.text === "calculator_support_radio",
      )
    ) {
      const property = node.properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(source) === "function",
      );
      if (
        property &&
        ts.isPropertyAssignment(property) &&
        ts.isFunctionExpression(property.initializer)
      )
        handler = property.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!handler) return undefined;
  const reject = (): never => {
    throw new Error("The official custom pricing rule uses unsupported syntax");
  };
  let callback: ts.FunctionExpression | undefined;
  function findCallback(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.getText(source) === "source.forEach" &&
      node.arguments.length === 1 &&
      ts.isFunctionExpression(node.arguments[0])
    )
      callback = node.arguments[0];
    ts.forEachChild(node, findCallback);
  }
  findCallback(handler.body);
  if (
    !callback ||
    callback.parameters.length !== 1 ||
    callback.parameters[0].name.getText(source) !== "data"
  )
    reject();
  const variables = new Set<string>();
  const fields = new Set([
    "resourceSpecCode",
    "usageValue",
    "inputValue",
    "supportAmount",
    "inquiryTag",
  ]);
  function expression(node: ts.Expression): PriceExpression {
    if (ts.isParenthesizedExpression(node)) return expression(node.expression);
    if (ts.isNumericLiteral(node)) return { literal: Number(node.text) };
    if (ts.isStringLiteral(node)) return { literal: node.text };
    if (ts.isIdentifier(node) && variables.has(node.text))
      return { variable: node.text };
    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.getText(source) === "data" &&
      fields.has(node.name.text)
    )
      return { field: node.name.text };
    if (ts.isConditionalExpression(node))
      return {
        condition: expression(node.condition),
        yes: expression(node.whenTrue),
        no: expression(node.whenFalse),
      };
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.getText(source);
      if (
        !["+", "-", "*", "/", ">", ">=", "<", "<=", "===", "&&", "||"].includes(
          operator,
        )
      )
        reject();
      return {
        operator,
        left: expression(node.left),
        right: expression(node.right),
      };
    }
    return reject();
  }
  function statements(node: ts.Statement): PriceStatement[] {
    if (ts.isBlock(node)) return node.statements.flatMap(statements);
    if (ts.isVariableStatement(node))
      return node.declarationList.declarations.map((declaration) => {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
          return reject();
        variables.add(declaration.name.text);
        return {
          assign: declaration.name.text,
          value: expression(declaration.initializer),
        };
      });
    if (ts.isIfStatement(node))
      return [
        {
          condition: expression(node.expression),
          yes: statements(node.thenStatement),
          no: node.elseStatement ? statements(node.elseStatement) : [],
        },
      ];
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const { left, right } = node.expression;
      if (ts.isIdentifier(left) && variables.has(left.text))
        return [{ assign: left.text, value: expression(right) }];
      if (
        ts.isPropertyAccessExpression(left) &&
        left.expression.getText(source) === "data" &&
        ["inputValue", "supportAmount", "inquiryTag"].includes(left.name.text)
      )
        return [{ field: left.name.text, value: expression(right) }];
    }
    return reject();
  }
  // Reject extra effects around the known per-resource transform rather than ignoring new code.
  if (
    handler.body.statements.length !== 2 ||
    !ts.isIfStatement(handler.body.statements[0]) ||
    handler.body.statements[0].expression.getText(source).replace(/\s/g, "") !==
      "source&&source.length>0" ||
    !ts.isBlock(handler.body.statements[0].thenStatement) ||
    handler.body.statements[0].thenStatement.statements.length !== 1 ||
    handler.body.statements[0].elseStatement ||
    !ts.isReturnStatement(handler.body.statements[1]) ||
    handler.body.statements[1].expression?.getText(source) !== "source"
  )
    reject();
  const outer = (handler.body.statements[0] as ts.IfStatement)
    .thenStatement as ts.Block;
  if (
    !ts.isExpressionStatement(outer.statements[0]) ||
    !ts.isCallExpression(outer.statements[0].expression) ||
    outer.statements[0].expression.arguments[0] !== callback
  )
    reject();
  return statements(callback!.body);
}
