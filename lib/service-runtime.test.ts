import { expect, test } from "bun:test";
import { getConfigurableServiceDefinitionByCode } from "@/lib/service-config";
import { getTypedDeclarativeRuntimeDefinitionByCode } from "@/lib/declarative-service-runtime-registry";
import { buildDefaultValues, buildRuntimeScope, evaluateCatalogView, evaluateRuntimeValue } from "@/lib/service-runtime";
import type { BillingOption } from "@/lib/service-config-types";
import type { DeclarativeEstimateRecord } from "@/lib/declarative-service-runtime-types";
import type { ProductMutationBody } from "@/lib/calculator-page-helpers";
import expected from "@/tests/fixtures/runtime/expected.json";

// Captured from the pre-refactor runtime using fixed Huawei catalog responses.
// Both price calculations and saved product payloads must retain their behavior.
for (const fixture of expected) {
  test(`${fixture.code}: ${fixture.name} retains its estimate and saved configuration`, async () => {
    const catalog = await Bun.file(new URL(`../tests/fixtures/runtime/${fixture.code.toLowerCase()}.json`, import.meta.url)).json();
    const definition = getConfigurableServiceDefinitionByCode(fixture.code)!;
    const runtime = getTypedDeclarativeRuntimeDefinitionByCode(fixture.code)!;
    const scope = buildRuntimeScope({
      definition, selectedServiceCode: fixture.code, selectedService: definition.serviceName,
      values: { ...buildDefaultValues(definition), ...fixture.values } as Record<string, string>,
      catalog, catalogRegionId: fixture.catalogRegionId, pricingError: "", regionValue: "la-sao-paulo1",
      billingMode: fixture.billingMode as BillingOption, usageHours: String(fixture.usageHours),
      usageHoursValue: fixture.usageHours, instanceCountValue: fixture.quantity,
    });
    const derived = evaluateCatalogView(runtime, scope);
    const estimateScope = { ...scope, derived, catalogView: derived };
    const estimate = evaluateRuntimeValue<DeclarativeEstimateRecord>(runtime.estimate, estimateScope);
    const product = evaluateRuntimeValue<ProductMutationBody | ProductMutationBody[]>(runtime.buildRequestBodies, { ...estimateScope, estimate });
    expect(estimate).toEqual(fixture.estimate ?? null);
    expect(product).toEqual(fixture.product ?? null);
    if (product && !Array.isArray(product)) {
      const hydration = evaluateRuntimeValue<{ handled: boolean }>(runtime.hydrate, { ...estimateScope, estimate, product });
      expect(hydration?.handled).toBe(true);
    }
  });
}
