import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configuredBillingModes } from "./availability";
import { Decimal } from "./decimal";
import { acquireSyncLease } from "./lease";
import { localState } from "./state";
import type { ScopeSnapshot } from "./types";
test("regional configuration narrows menu modes without removing modes in other regions", () => {
  const rules = [
    { hideChargeModeMap: { PERIOD: ["sa-brazil-1"] } },
    { tag: "general.online.beta", hideChargeModeList: ["RI"] },
  ];
  expect(
    configuredBillingModes(["ONDEMAND", "PERIOD", "RI"], "sa-brazil-1", rules),
  ).toEqual(["ONDEMAND", "RI"]);
  expect(
    configuredBillingModes(
      ["ONDEMAND", "PERIOD", "RI"],
      "ap-southeast-1",
      rules,
    ),
  ).toEqual(["ONDEMAND", "PERIOD", "RI"]);
});
test("decimal rational rates preserve unit conversions and truncated currency boundaries", () => {
  expect(Decimal.of(0.899).mul(2).truncated(2)).toBe(1.79);
  expect(
    Decimal.of("3.47222e-5").mul(720).mul(0.025).div(0.024999984).truncated(6),
  ).toBe(0.025);
  expect(Decimal.of(0.1).add(Decimal.of(0.2)).truncated(6)).toBe(0.3);
  expect(() => Decimal.of(1).div(0)).toThrow();
});
test("an invalid official default retains controls but never presents a zero price or save proof", () => {
  const scope = {
    service: "service",
    region: "region",
    source: {},
  } as ScopeSnapshot;
  const state = localState(
    {
      fields: [
        {
          id: "kind",
          component: "kind",
          label: "Type",
          type: "select",
          value: "0",
          disabled: false,
        },
      ],
      notes: [],
      diagnostics: [],
    },
    scope,
    "release",
    "session",
    "ONDEMAND",
    null,
    undefined,
    null,
    [],
    "Choose another specification",
  );
  expect(state.fields).toHaveLength(1);
  expect(state.quote).toBeNull();
  expect(state.local).toBeUndefined();
  expect(state.priceError).toBe("Choose another specification");
});
test("a lease rejects concurrent syncs and recovers a terminated worker", async () => {
  const root = await mkdtemp(join(tmpdir(), "neo-sync-lease-")),
    path = join(root, "sync.lock");
  try {
    const handle = await acquireSyncLease(path);
    await expect(acquireSyncLease(path)).rejects.toThrow("already running");
    await handle.close();
    await rm(path);
    await writeFile(path, JSON.stringify({ pid: 2147483647, started: "0" }));
    const recovered = await acquireSyncLease(path);
    await recovered.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
