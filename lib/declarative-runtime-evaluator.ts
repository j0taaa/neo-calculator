import type { DefinitionExpression } from "@/lib/declarative-service-runtime-types";

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
