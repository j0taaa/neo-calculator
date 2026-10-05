import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { getServiceBundle } from "@/config/services/bundles";
import { evaluateRuntimeValue, evaluateServiceConfiguration } from "./service-runtime";
import type { BillingOption } from "./calculator-types";
import type { TypedDeclarativeValue } from "./typed-declarative-runtime-types";
import cases from "@/tests/fixtures/runtime/compiled-runtime-parity.json";

// Captured from commit 68d08e2 before removing the expression interpreter.
for (const item of cases)
  test(`${item.code} compiled runtime matches previous ${item.billingMode} ${item.varied ? "varied" : "default"} configuration`, () => {
    const bundle = getServiceBundle(item.code)!;
    const path = `tests/fixtures/runtime/${item.code.toLowerCase()}.json`;
    const catalog = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
    const scope = evaluateServiceConfiguration(bundle.runtime, {
      definition: bundle.service,
      selectedServiceCode: item.code,
      selectedService: bundle.service.serviceName,
      values: item.values as Record<string, string>,
      catalog,
      catalogRegionId: "sa-brazil-1",
      pricingError: "",
      regionValue: "la-sao-paulo1",
      billingMode: item.billingMode as BillingOption,
      usageHours: "744",
      usageHoursValue: 744,
      instanceCountValue: 2,
    });
    const evaluate = (value: TypedDeclarativeValue | undefined) => evaluateRuntimeValue(value, scope);
    const product = evaluate(bundle.runtime.buildRequestBodies);
    const hooks = Object.fromEntries(
      Object.keys(item.hooks).map((key) => [
        key,
        evaluate(bundle.runtime[key as keyof typeof bundle.runtime] as TypedDeclarativeValue),
      ]),
    );
    const fields = Object.fromEntries(
      Object.entries(bundle.runtime.fieldRuntime ?? {}).map(([id, runtime]) => [
        id,
        Object.fromEntries(
          (["options", "min", "max", "disabled", "normalize"] as const).map((key) => [key, evaluate(runtime[key])]),
        ),
      ]),
    );
    const hydration =
      product && !Array.isArray(product) ? evaluateRuntimeValue(bundle.runtime.hydrate, { ...scope, product }) : null;
    const json = (value: unknown) => JSON.parse(JSON.stringify(value));
    expect(json({ estimate: scope.estimate, product, hooks, fields, hydration })).toEqual({
      estimate: item.estimate,
      product: item.product,
      hooks: item.hooks,
      fields: item.fields,
      hydration: item.hydration,
    });
  });
