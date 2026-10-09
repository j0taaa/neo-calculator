import { describe, it, expect, test } from "bun:test";
import { chromium } from "playwright";
import { readNativeForm, validateNativeValue } from "./native-dom";

test("the extraction reader ignores duplicate child IDs and locates the actual MRS task component", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<script>window.viewConfig={calc_view:{components:[{id:'vpn',type:'CommonRadioGroup'},{id:'vpn_2',type:'CommonRadioGroup'},{id:'task',type:'CustomMRSNodeRadio'}]}};</script>
      <div id="vpn" class="common-radio-group"><div class="base-radio-group" id="vpn_2"><ul><li class="active"><button>5</button></li><li><button>10</button></li></ul></div></div>
      <div id="vpn_2" class="common-radio-group" style="display:none"><div class="base-radio-group"><ul><li class="active"><button>Hidden</button></li></ul></div></div>
      <div><div id="task_switch" class="common-switch">Switch wrapper</div></div>
      <div><div id="task_radio"><div class="base-radio-group" id="task_radio_0"><ul><li class="active"><button>Compute</button></li><li><button>Memory</button></li></ul></div></div><div id="task_num"><input class="tiny-numeric__input-inner" value="1" min="0" max="10"></div></div>`);
    const form = await readNativeForm(page);
    expect(form.fields.filter(f => f.component === "vpn")).toHaveLength(1);
    expect(form.fields.filter(f => f.component === "vpn_2")).toHaveLength(0);
    expect(form.fields.filter(f => f.component === "task")).toHaveLength(2);
    expect(form.diagnostics).toEqual([]);
  } finally { await browser.close(); }
});

import type { NativeField } from "./native-types";
const numeric: NativeField = { id: "duration", component: "duration", type: "number", label: "Duration", value: 1, disabled: false, min: 1, max: 9999 };
describe("native action contract", () => {
  it("rejects non-finite, coerced, and out-of-range numeric values", () => {
    for (const value of [NaN, Infinity, -1, 10000, "2", null, undefined, {}]) expect(() => validateNativeValue(numeric, value)).toThrow();
    expect(() => validateNativeValue(numeric, 1)).not.toThrow();
    expect(() => validateNativeValue(numeric, 9999)).not.toThrow();
  });
  it("accepts only an enabled option from the current form", () => {
    const select: NativeField = { ...numeric, type: "select", options: [{ value: "0", label: "Allowed", disabled: false }, { value: "1", label: "Disabled", disabled: true }] };
    for (const value of [0, "1", "2", "body", "0\"]"]) expect(() => validateNativeValue(select, value)).toThrow();
    expect(() => validateNativeValue(select, "0")).not.toThrow();
  });
  it("rejects writes to derived or disabled controls", () => {
    expect(() => validateNativeValue({ ...numeric, disabled: true }, 1)).toThrow(/disabled/);
  });
  it("does not coerce checkbox and action values", () => {
    for (const type of ["checkbox", "action"] as const) {
      for (const value of ["false", "true", 0, 1, null]) expect(() => validateNativeValue({ ...numeric, type }, value)).toThrow();
      expect(() => validateNativeValue({ ...numeric, type }, true)).not.toThrow();
    }
  });
});
