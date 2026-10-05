import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { serviceBundles } from "@/config/services/bundles";
import { configurableServiceCodes, getConfigurableServiceDefinitionByCode, supportedCalculatorServiceCodes } from "@/lib/service-config";
import { getTypedDeclarativeRuntimeDefinitionByCode } from "@/lib/declarative-service-runtime-registry";
import { getCatalogFetchFn } from "@/lib/catalog-fetch-registry";
import { generateCatalogRoute } from "@/lib/generate-catalog-route";
import { declarativeRuntimeHelpers } from "@/lib/declarative-runtime-helpers";

test("every service directory is registered exactly once", () => {
  const directories = readdirSync(new URL("../config/services/", import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  expect(serviceBundles.map(({ service }) => service.definitionId).sort()).toEqual(directories);
  expect(new Set(serviceBundles.map(({ service }) => service.serviceCode)).size).toBe(serviceBundles.length);
});

for (const bundle of serviceBundles) {
  const code = bundle.service.serviceCode;
  test(`${code} is wired through the form, runtime, and catalog interfaces`, () => {
    expect(configurableServiceCodes).toContain(code);
    expect(supportedCalculatorServiceCodes).toContain(code);
    expect(getConfigurableServiceDefinitionByCode(code)).not.toBeNull();
    const runtime = getTypedDeclarativeRuntimeDefinitionByCode(code);
    expect(runtime).toBeDefined();
    expect(runtime).not.toBeNull();
    expect(runtime?.buildRequestBodies).toBeDefined();
    expect(runtime?.hydrate).toBeDefined();
    if (runtime?.catalog) {
      expect(runtime.estimate).toBeDefined();
      expect(getCatalogFetchFn(code)).toBeFunction();
      expect(generateCatalogRoute(runtime.catalog.route)).toBeFunction();
    }
  });
  test(`${code} runtime references existing helpers`, () => {
    function visit(value: unknown) {
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      if (record.op === "call") {
        expect(typeof declarativeRuntimeHelpers[record.helper as keyof typeof declarativeRuntimeHelpers]).toBe("function");
      }
      if (record.op === "ref" && typeof record.path === "string" && record.path.startsWith("helpers.")) {
        const key = record.path.split(".")[1];
        expect(Object.hasOwn(declarativeRuntimeHelpers, key)).toBe(true);
      }
      Object.values(value).forEach(visit);
    }
    visit(bundle.runtime);
  });
}

test("EVS route response and form agree on the catalog property", () => {
  expect(getTypedDeclarativeRuntimeDefinitionByCode("EVS")?.catalog?.catalogPath).toBe("diskPricing");
});
