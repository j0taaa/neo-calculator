import type { CatalogProduct, ScopeSnapshot } from "./types";

type Value = number | string;
export type PriceExpression =
  | { literal: Value }
  | { variable: string }
  | { field: string }
  | { operator: string; left: PriceExpression; right: PriceExpression }
  | { condition: PriceExpression; yes: PriceExpression; no: PriceExpression };
export type PriceStatement =
  | { assign: string; value: PriceExpression }
  | { field: string; value: PriceExpression }
  | { condition: PriceExpression; yes: PriceStatement[]; no: PriceStatement[] };

/** A bounded arithmetic program compiled from the official configuration, never executable JS. */
export function evaluatePrice(
  program: PriceStatement[],
  resource: Record<string, unknown>,
) {
  const variables: Record<string, Value> = Object.create(null),
    fields: Record<string, Value> = {
      resourceSpecCode: String(resource.resourceSpecCode),
      usageValue: Number(resource.usageValue),
    };
  function expression(node: PriceExpression): Value | boolean {
    if ("literal" in node) return node.literal;
    if ("variable" in node) {
      if (!(node.variable in variables))
        throw new Error("Uninitialized local price variable");
      return variables[node.variable];
    }
    if ("field" in node) {
      if (!(node.field in fields)) throw new Error("Unknown local price input");
      return fields[node.field];
    }
    if ("condition" in node)
      return expression(node.condition)
        ? expression(node.yes)
        : expression(node.no);
    const left = expression(node.left),
      right = expression(node.right);
    switch (node.operator) {
      case "+":
        return Number(left) + Number(right);
      case "-":
        return Number(left) - Number(right);
      case "*":
        return Number(left) * Number(right);
      case "/":
        return Number(left) / Number(right);
      case ">":
        return Number(left) > Number(right);
      case ">=":
        return Number(left) >= Number(right);
      case "<":
        return Number(left) < Number(right);
      case "<=":
        return Number(left) <= Number(right);
      case "===":
        return left === right;
      case "&&":
        return Boolean(left && right);
      case "||":
        return Boolean(left || right);
      default:
        throw new Error("Unsupported local price operation");
    }
  }
  function execute(statements: PriceStatement[]) {
    for (const statement of statements) {
      if ("condition" in statement)
        execute(expression(statement.condition) ? statement.yes : statement.no);
      else {
        const value = expression(statement.value);
        if (typeof value === "boolean")
          throw new Error("Invalid local price assignment");
        if ("assign" in statement) variables[statement.assign] = value;
        else fields[statement.field] = value;
      }
    }
  }
  execute(program);
  return fields;
}
export function supportPrice(
  snapshot: ScopeSnapshot,
  product: Record<string, unknown>,
  months: number,
) {
  const program = snapshot.customPricing?.support;
  const rows = Object.values(snapshot.products.product)
    .flat()
    .filter(
      (row: CatalogProduct) =>
        row.resourceSpecCode === product.resourceSpecCode &&
        row.resourceType === product.resourceType &&
        row.cloudServiceType === product.cloudServiceType,
    );
  const usageValue = Number(product.usageValue);
  if (
    !program ||
    !rows.length ||
    !Number.isFinite(usageValue) ||
    usageValue < 0 ||
    product.productNum !== 1
  )
    throw new Error("Unverified custom pricing resource");
  const calculated = evaluatePrice(program, {
    resourceSpecCode: rows[0].resourceSpecCode,
    usageValue,
  });
  const amount = Number(calculated.supportAmount) * months;
  if (
    calculated.inquiryTag !== "support" ||
    !Number.isFinite(amount) ||
    amount < 0
  )
    throw new Error("Invalid custom pricing result");
  return amount;
}
