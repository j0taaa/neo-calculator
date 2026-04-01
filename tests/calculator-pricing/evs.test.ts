import { expect, test } from "bun:test";

import { buildEvsProductMutationBodies, buildEvsSplitNotice, evsDiskSizeBounds, splitEvsDiskSizes } from "@/lib/configurable-runtime-utils";
import type { DiskPricing } from "@/lib/calculator-page-helpers";

const diskPricing: DiskPricing<"High I/O"> = {
  currency: "USD",
  prices: {
    "High I/O": {
      ONDEMAND: 0.001,
    },
  },
};

test("EVS enforces the live minimum disk size", () => {
  expect(evsDiskSizeBounds.min).toBe(10);
  expect(buildEvsSplitNotice(1)).toBeNull();
  expect(() => splitEvsDiskSizes(1)).toThrow("EVS disk size must be between 10");
  expect(() =>
    buildEvsProductMutationBodies({
      serviceCode: "EVS",
      serviceName: "Elastic Volume Service",
      serviceTitle: "Elastic Volume Service",
      region: "la-sao-paulo1",
      billingMode: "Pay-per-use",
      usageHours: 744,
      durationMonths: 1,
      quantity: 1,
      description: "Test volume",
      diskType: "High I/O",
      diskSizeGiB: 1,
      requestedIops: null,
      requestedThroughput: null,
      diskPricing,
    }),
  ).toThrow("EVS disk size must be between 10");
});
