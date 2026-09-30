import { expect, test } from "bun:test";
import { NativeCalculator } from "./native-session";
import type { HuaweiCollector } from "./collector";
import { selectionField, selectionFields, type NativeSelection } from "./native-selection";
import type { NativeAction, NativeState, NativeField } from "./native-types";

const field: NativeField = {
  id: "duration:0",
  component: "duration",
  label: "Duration",
  type: "number",
  value: 1,
  disabled: false,
};
const initial = selectionFields({ fields: [field], notes: [], diagnostics: [] });
const selection: NativeSelection = {
  version: 1,
  service: "nat",
  region: "ap-southeast-1",
  initial,
  steps: [{ before: selectionField(field), value: 2 }],
  fields: [selectionField({ ...field, value: 2 })],
};
class ReplayHarness extends NativeCalculator {
  closed = false;
  openedMode: string | undefined;
  actions: NativeAction[] = [];
  constructor(
    readonly initialField = field,
    readonly resultField = { ...field, value: 2 },
  ) {
    super({} as HuaweiCollector);
  }
  override async open(_service?: string, _region?: string, billingMode?: import("./native-billing").NativeBillingMode) {
    this.openedMode = billingMode;
    return {
      session: "new-session",
      revision: 0,
      fields: [this.initialField],
      notes: [],
      diagnostics: [],
    } as unknown as NativeState;
  }
  override async act(action: NativeAction) {
    this.actions.push(action);
    return {
      session: "new-session",
      revision: 1,
      fields: [this.resultField],
      notes: [],
      diagnostics: [],
    } as unknown as NativeState;
  }
  override async remove() {
    this.closed = true;
  }
}
test("saved selection replays validated actions in a new session", async () => {
  const calc = new ReplayHarness();
  const result = await calc.restore(selection);
  expect(result.fields[0].value).toBe(2);
  expect(calc.actions).toEqual([{ session: "new-session", revision: 0, field: "duration:0", value: 2 }]);
  expect(calc.closed).toBe(false);
});
test("replay rejects changed defaults, changed control identity and changed results, and closes failed sessions", async () => {
  for (const calc of [
    new ReplayHarness({ ...field, value: 3 }),
    new ReplayHarness({ ...field, label: "Different" }),
    new ReplayHarness(field, { ...field, value: 4 }),
  ]) {
    await expect(calc.restore(selection)).rejects.toThrow();
    expect(calc.closed).toBe(true);
  }
  const calc = new ReplayHarness();
  await expect(
    calc.restore({ ...selection, steps: [{ before: { ...selection.initial[0], label: "Forged" }, value: 2 }] }),
  ).rejects.toThrow();
  expect(calc.actions.length).toBe(0);
  expect(calc.closed).toBe(true);
});


test("replay opens the saved billing mode and maps legacy histories to pay-per-use", async () => {
  for (const billingMode of ["PERIOD","ONETIME","RI"] as const) {
    const calc = new ReplayHarness();
    await calc.restore({...selection,version:2,billingMode});
    expect(calc.openedMode).toBe(billingMode);
  }
  const calc = new ReplayHarness();
  await calc.restore(selection);
  expect(calc.openedMode).toBe("ONDEMAND");
});
