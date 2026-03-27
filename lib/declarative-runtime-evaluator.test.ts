import { expect, test } from "bun:test";

import { declarativeRuntimeHelpers } from "@/lib/declarative-runtime-helpers";
import { evaluateDeclarativeDerivedValues, evaluateDeclarativeValue } from "@/lib/declarative-runtime-evaluator";
import { and, call, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

test("evaluateDeclarativeValue resolves refs, helper calls, and templates", () => {
  const scope = {
    helpers: declarativeRuntimeHelpers,
    values: {
      type: "Shared EIP",
      chargeMode: "Enhanced 95",
      bandwidthMbit: "200",
    },
  };

  const derived = evaluateDeclarativeDerivedValues([
    { key: "showBandwidth", value: and(eq(ref("values.type"), "Shared EIP"), eq(ref("values.chargeMode"), "Enhanced 95")) },
    { key: "bandwidth", value: ifElse(ref("derived.showBandwidth"), call("clampInteger", ref("values.bandwidthMbit"), 300), 0) },
  ], scope);

  const summary = evaluateDeclarativeValue<string>(
    template("Selected specifications: {type} | {mode} | {bandwidth} Mbit/s", {
      type: ref("values.type"),
      mode: ref("values.chargeMode"),
      bandwidth: ref("derived.bandwidth"),
    }),
    {
      ...scope,
      derived,
      catalogView: derived,
    },
  );

  expect(derived.showBandwidth).toBe(true);
  expect(derived.bandwidth).toBe(300);
  expect(summary).toBe("Selected specifications: Shared EIP | Enhanced 95 | 300 Mbit/s");
});
