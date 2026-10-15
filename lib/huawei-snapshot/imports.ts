import ts from "typescript";
export type AssetImport = { start: number; end: number; url: string };
/** Parse imports as JavaScript. Documentation comments can also contain fake import paths. */
export function assetImports(body: string, original: string): AssetImport[] {
  const errors = ts
    .transpileModule(body, {
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
      },
    })
    .diagnostics?.filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
  if (errors?.length)
    throw new Error("Invalid synchronized calculator JavaScript");
  const file = ts.createSourceFile(
      original,
      body,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    ),
    imports: AssetImport[] = [];
  function add(node: ts.Node | undefined) {
    if (!node || !ts.isStringLiteral(node)) return;
    if (!node.text.startsWith("./") && !node.text.startsWith("../"))
      throw new Error(`Unsupported calculator module dependency: ${node.text}`);
    imports.push({
      start: node.getStart(file) + 1,
      end: node.getEnd() - 1,
      url: new URL(node.text, original).href,
    });
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      add(node.moduleSpecifier);
    else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0]))
        throw new Error("Unsupported dynamic calculator import");
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imports;
}
