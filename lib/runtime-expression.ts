import type { buildRuntimeScope } from "./service-runtime";
import type { HuaweiRegionKey } from "./huawei-regions";
import type { AppProduct } from "./calculator-types";
import type { DeclarativeEstimateRecord } from "./declarative-service-runtime-types";

export type RuntimeContext<Catalog, Derived = unknown> = Omit<
  ReturnType<typeof buildRuntimeScope>,
  | "regionValue"
  | "catalog"
  | "catalogView"
  | "derived"
  | "product"
  | "estimate"
  | "requestBodiesCount"
  | "extraRequestBodiesCount"
  | "createdCount"
  | "expandedCount"
> & {
  regionValue: HuaweiRegionKey;
  catalog: Catalog | null;
  catalogView: Derived;
  derived: Derived;
  product: AppProduct;
  estimate: DeclarativeEstimateRecord | null;
  requestBodiesCount: number;
  extraRequestBodiesCount: number;
  createdCount: number;
  expandedCount: number;
};

/** Callbacks are compiled application code, never expressions supplied by a network response. */
export function runtimeExpression<Context>(
  evaluate: (scope: Context) => unknown,
): (scope: Record<string, unknown>) => unknown {
  return (scope) => evaluate(scope as Context);
}
