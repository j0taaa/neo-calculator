import { expect, test } from "bun:test";
import { getServiceBundle } from "@/config/services/bundles";
import { parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import type { GaussDbPricingCatalog } from "@/lib/gaussdb-catalog";

test("GaussDB uses a supported extractor for CPU counts", () => {
  const definition = getServiceBundle("GaussDB")!.catalogDefinition!;
  const record = {
    cloudServiceType: "hws.service.type.gaussdb",
    specType: "GaussDB_Basic_Edition",
    productSpecSysDesc: "Basic Edition 16 vCPUs 64 GB",
    specDesc: "",
    resourceSpecCode: "gaussdb.basic.16.64",
    mem: 64,
    planList: [{ billingMode: "ONDEMAND", amount: 0.5, productId: "gaussdb-test" }],
  };
  for (const cpu of [16, "16", undefined]) {
    const catalog = parseDeclarativePricingCatalog<GaussDbPricingCatalog>(definition, { product: [{ ...record, cpu }] }, "ap-southeast-1");
    expect(catalog.tiers).toHaveLength(1);
    expect(catalog.tiers[0].vCpus).toBe(16);
    expect(catalog.tiers[0].memoryGb).toBe(64);
    expect(catalog.tiers[0].prices.ONDEMAND).toBe(0.5);
  }
});

test("a missing optional path does not invoke a nonexistent template", () => {
  const catalog = parseDeclarativePricingCatalog<{ tiers: unknown[] }>({
    source: { displayName: "Test", urlPath: "test", tab: "calc" },
    parser: {
      kind: "recursive-grouped-records", currency: "USD", rootPath: "product", collectionKey: "tiers",
      fields: [{ key: "label", required: true, extractor: { kind: "path", path: "resourceSpecCode" } }],
      dedupeBy: ["label"], sort: [],
    },
  }, { product: [{ planList: [{ billingMode: "ONDEMAND", amount: 1 }] }] }, "ap-southeast-1");
  expect(catalog.tiers).toEqual([]);
});
