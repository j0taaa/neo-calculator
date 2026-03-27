import type { DefinitionExpression } from "@/lib/declarative-service-runtime-types";
import type { TypedDeclarativeDerivedValue, TypedDeclarativeOperation, TypedDeclarativeValue } from "@/lib/typed-declarative-runtime-types";

type EvaluatorScope = Record<string, unknown>;

const evaluatorCache = new Map<string, (scope: EvaluatorScope) => unknown>();

export function evaluateDefinitionExpression<T>(expression: DefinitionExpression | null | undefined, scope: EvaluatorScope): T | null {
  if (!expression?.trim()) {
    return null;
  }

  let evaluator = evaluatorCache.get(expression);
  if (!evaluator) {
    evaluator = new Function("scope", `with (scope) { return (${expression}); }`) as (scope: EvaluatorScope) => unknown;
    evaluatorCache.set(expression, evaluator);
  }

  return evaluator(scope) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTypedOperation(value: unknown): value is TypedDeclarativeOperation {
  return isRecord(value) && typeof value.op === "string";
}

function readPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), value);
}

function evaluateNumberList(values: TypedDeclarativeValue[], scope: EvaluatorScope) {
  return values
    .map((value) => evaluateDeclarativeValue<number | null | undefined>(value, scope))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export function evaluateDeclarativeValue<T>(value: TypedDeclarativeValue | undefined, scope: EvaluatorScope): T {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => evaluateDeclarativeValue(entry, scope)) as T;
  }

  if (isTypedOperation(value)) {
    switch (value.op) {
      case "ref":
        return readPath(scope, value.path) as T;
      case "call": {
        const helper = readPath(scope.helpers, value.helper);
        if (typeof helper !== "function") {
          throw new Error(`Unknown declarative runtime helper: ${value.helper}`);
        }
        const args = (value.args ?? []).map((entry) => evaluateDeclarativeValue(entry, scope));
        return helper(...args) as T;
      }
      case "if":
        return evaluateDeclarativeValue(Boolean(evaluateDeclarativeValue(value.condition, scope)) ? value.then : value.else, scope);
      case "coalesce": {
        for (const entry of value.values) {
          const resolved = evaluateDeclarativeValue(entry, scope);
          if (resolved !== null && resolved !== undefined) {
            return resolved as T;
          }
        }
        return null as T;
      }
      case "eq":
        return (evaluateDeclarativeValue(value.left, scope) === evaluateDeclarativeValue(value.right, scope)) as T;
      case "ne":
        return (evaluateDeclarativeValue(value.left, scope) !== evaluateDeclarativeValue(value.right, scope)) as T;
      case "in": {
        const target = evaluateDeclarativeValue(value.value, scope);
        const options = evaluateDeclarativeValue<unknown>(value.values, scope);
        return (Array.isArray(options) && options.includes(target)) as T;
      }
      case "and":
        return value.values.every((entry) => Boolean(evaluateDeclarativeValue(entry, scope))) as T;
      case "or":
        return value.values.some((entry) => Boolean(evaluateDeclarativeValue(entry, scope))) as T;
      case "not":
        return (!Boolean(evaluateDeclarativeValue(value.value, scope))) as T;
      case "lt":
        return (Number(evaluateDeclarativeValue(value.left, scope)) < Number(evaluateDeclarativeValue(value.right, scope))) as T;
      case "lte":
        return (Number(evaluateDeclarativeValue(value.left, scope)) <= Number(evaluateDeclarativeValue(value.right, scope))) as T;
      case "gt":
        return (Number(evaluateDeclarativeValue(value.left, scope)) > Number(evaluateDeclarativeValue(value.right, scope))) as T;
      case "gte":
        return (Number(evaluateDeclarativeValue(value.left, scope)) >= Number(evaluateDeclarativeValue(value.right, scope))) as T;
      case "min": {
        const values = evaluateNumberList(value.values, scope);
        return (values.length > 0 ? Math.min(...values) : null) as T;
      }
      case "max": {
        const values = evaluateNumberList(value.values, scope);
        return (values.length > 0 ? Math.max(...values) : null) as T;
      }
      case "floor": {
        const resolved = Number(evaluateDeclarativeValue(value.value, scope));
        return (Number.isFinite(resolved) ? Math.floor(resolved) : null) as T;
      }
      case "template": {
        const values = Object.fromEntries(
          Object.entries(value.values ?? {}).map(([key, entry]) => [key, evaluateDeclarativeValue(entry, scope)]),
        );
        return value.template.replace(/\{([^}]+)\}/g, (_, key: string) => String(values[key] ?? "")) as T;
      }
      default:
        return null as T;
    }
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, evaluateDeclarativeValue(entry as TypedDeclarativeValue, scope)]),
  ) as T;
}

export function evaluateDeclarativeDerivedValues(
  values: TypedDeclarativeDerivedValue[] | undefined,
  scope: EvaluatorScope,
) {
  const derived: Record<string, unknown> = {};

  for (const entry of values ?? []) {
    derived[entry.key] = evaluateDeclarativeValue(entry.value, {
      ...scope,
      derived,
      catalogView: derived,
    });
  }

  return derived;
}
