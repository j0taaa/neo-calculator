import type { TypedDeclarativeValue } from "@/lib/typed-declarative-runtime-types";

export function ref(path: string): TypedDeclarativeValue {
  return { op: "ref", path };
}

export function call(helper: string, ...args: TypedDeclarativeValue[]): TypedDeclarativeValue {
  return { op: "call", helper, args };
}

export function ifElse(condition: TypedDeclarativeValue, thenValue: TypedDeclarativeValue, elseValue: TypedDeclarativeValue = null): TypedDeclarativeValue {
  return { op: "if", condition, then: thenValue, else: elseValue };
}

export function coalesce(...values: TypedDeclarativeValue[]): TypedDeclarativeValue {
  return { op: "coalesce", values };
}

export function eq(left: TypedDeclarativeValue, right: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "eq", left, right };
}

export function ne(left: TypedDeclarativeValue, right: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "ne", left, right };
}

export function isIn(value: TypedDeclarativeValue, values: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "in", value, values };
}

export function and(...values: TypedDeclarativeValue[]): TypedDeclarativeValue {
  return { op: "and", values };
}

export function or(...values: TypedDeclarativeValue[]): TypedDeclarativeValue {
  return { op: "or", values };
}

export function not(value: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "not", value };
}

export function lt(left: TypedDeclarativeValue, right: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "lt", left, right };
}

export function lte(left: TypedDeclarativeValue, right: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "lte", left, right };
}

export function gt(left: TypedDeclarativeValue, right: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "gt", left, right };
}

export function gte(left: TypedDeclarativeValue, right: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "gte", left, right };
}

export function min(...values: TypedDeclarativeValue[]): TypedDeclarativeValue {
  return { op: "min", values };
}

export function max(...values: TypedDeclarativeValue[]): TypedDeclarativeValue {
  return { op: "max", values };
}

export function floor(value: TypedDeclarativeValue): TypedDeclarativeValue {
  return { op: "floor", value };
}

export function template(templateValue: string, values?: Record<string, TypedDeclarativeValue>): TypedDeclarativeValue {
  return { op: "template", template: templateValue, values };
}
