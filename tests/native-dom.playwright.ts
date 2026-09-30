import { expect, test } from "@playwright/test";
import { readNativeForm } from "../lib/huawei-sync/native-dom";

test("covers inline selects, disk actions, checkboxes, numeric bounds and unlisted globals", async ({ page }) => {
  await page.setContent(`<div id="calculator_disk"><div class="tiny-form-item"><label class="tiny-form-item__label">Data Disk</label>
    <div class="base-select"><input readonly value="SSD"><li class="tiny-select-dropdown__item selected">SSD</li><li class="tiny-select-dropdown__item is-disabled">HDD</li></div>
    <div class="base-stepper"><input class="tiny-numeric__input-inner" value="100" min="10" max="32000"><span class="base-stepper-span-unit">GiB</span></div>
    <span class="common-addible-delete">Delete</span></div><div class="common-addible-addDisk"></div></div>
    <div id="calculator_protocol"><label class="tiny-checkbox"><input type="checkbox" checked disabled><span class="tiny-checkbox__label">TCP</span></label></div>
    <div id="global_ONDEMANDTIME"><input class="tiny-numeric__input-inner" value="1" min="1" max="9999"></div>
    <div id="calculator_hidden" style="display:none"><input></div>`);
  await page.evaluate(() => Object.assign(window, { viewConfig: { calc_view: { components: [{ id: "calculator_disk", type: "CommonAddible" }, { id: "calculator_protocol", type: "CommonCheckboxGroup" }, { id: "calculator_hidden", type: "Unknown" }] } } }));
  const form = await readNativeForm(page);
  expect(form.diagnostics).toEqual([]);
  expect(form.fields.map(f => f.type)).toEqual(["select", "number", "action", "action", "checkbox", "number"]);
  expect(form.fields[0].options?.[1].disabled).toBe(true);
  expect(form.fields[1]).toMatchObject({ value: 100, min: 10, max: 32000, unit: "GiB" });
  expect(form.fields[2].label).toBe("Remove data disk");
  expect(form.fields[4]).toMatchObject({ value: true, disabled: true });
  expect(form.fields[5].component).toBe("global_ONDEMANDTIME");
});

test("fails closed on new component types, unmapped inputs, or missing selection", async ({ page }) => {
  await page.setContent(`<div id="calculator_new"><input value="unmapped"></div><div id="calculator_select"><div class="base-select"><input readonly><li class="tiny-select-dropdown__item">No selection</li></div></div>`);
  await page.evaluate(() => Object.assign(window, { viewConfig: { calc_view: { components: [{ id: "calculator_new", type: "NewHuaweiControl" }, { id: "calculator_select", type: "CommonSelect" }] } } }));
  const form = await readNativeForm(page);
  expect(form.diagnostics).toEqual(expect.arrayContaining(["Unsupported Huawei control: NewHuaweiControl", "Unmapped input in calculator_new", "No selected option for Unit"]));
});

test("retains dropdown options after Huawei moves its menu into a body portal", async ({ page }) => {
  await page.setContent(`<div id="calculator_select"><div class="base-select"><input readonly><div class="tiny-select-dropdown"><li class="tiny-select-dropdown__item selected">Small</li><li class="tiny-select-dropdown__item">Large</li></div></div></div>`);
  await page.evaluate(() => Object.assign(window, { viewConfig: { calc_view: { components: [{ id: "calculator_select", type: "CommonSelect" }] } } }));
  const before = await readNativeForm(page);
  await page.evaluate(() => document.body.append(document.querySelector(".tiny-select-dropdown")!));
  const after = await readNativeForm(page);
  expect(after).toEqual(before);
  expect(await page.locator('[data-neo-option="calculator_select:0:1"]').textContent()).toBe("Large");
});

test("purchase terms and installment choices are exposed even when Huawei uses idheader wrappers", async ({page}) => {
  await page.setContent(`<div idheader="global_PERIODTIME"><div class="base-radio-group"><li class="active"><button>1 month</button></li><li><button>1 year</button></li><li><button>3 years</button></li></div></div>
    <div id="global_FEEINSTALLMODE"><div class="base-radio-group"><li class="active"><button>No Upfront</button></li><li><button>Partial Upfront</button></li><li><button>All Upfront</button></li></div></div>`);
  await page.evaluate(() => Object.assign(window,{viewConfig:{calc_view:{components:[]}}}));
  const form = await readNativeForm(page);
  expect(form.diagnostics).toEqual([]);
  expect(form.fields.map(f=>f.component)).toEqual(["global_PERIODTIME","global_FEEINSTALLMODE"]);
  expect(form.fields[0].options?.map(o=>o.label)).toEqual(["1 month","1 year","3 years"]);
  const {setNativeValue} = await import("../lib/huawei-sync/native-dom");
  await setNativeValue(page,form.fields[0],"2");
  await setNativeValue(page,form.fields[1],"1");
});
