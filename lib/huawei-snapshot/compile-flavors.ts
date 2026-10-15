import ts from "typescript";

/** Read only the declarative ECS choices; downloaded JavaScript is never evaluated on the server. */
export function compileFlavorGenerations(config: string): string[] {
  const source = ts.createSourceFile("config.js", config, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const property = (object: ts.ObjectLiteralExpression, key: string) => {
    const entry = object.properties.find(item => ts.isPropertyAssignment(item) &&
      (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name) || ts.isNumericLiteral(item.name)) && item.name.text === key);
    return entry && ts.isPropertyAssignment(entry) ? entry.initializer : undefined;
  };
  const strings = (node: ts.Node | undefined) => node && ts.isArrayLiteralExpression(node) &&
    node.elements.every(ts.isStringLiteralLike) ? node.elements.map(item => (item as ts.StringLiteral).text) : undefined;
  const view = source.statements.flatMap(statement => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [])
    .find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === "viewConfig")?.initializer;
  const calc = view && ts.isObjectLiteralExpression(view) ? property(view, "calc_view") : undefined;
  const components = calc && ts.isObjectLiteralExpression(calc) ? property(calc, "components") : undefined;
  const radio = components && ts.isArrayLiteralExpression(components) ? components.elements.find(node => {
    if (!ts.isObjectLiteralExpression(node)) return false;
    const id = property(node, "id");
    return id && ts.isStringLiteralLike(id) && id.text === "calculator_ecs_radio";
  }) : undefined;
  if (radio && ts.isObjectLiteralExpression(radio)) {
    const index = strings(property(radio, "optionKeys"))?.indexOf("generation"),
      sort = property(radio, "sortMethods");
    const generations = index !== undefined && index >= 0 && sort && ts.isObjectLiteralExpression(sort)
      ? strings(property(sort, String(index))) : undefined;
    if (generations?.length) return generations;
  }
  throw new Error("The official flavor-generation choices use unsupported syntax");
}
