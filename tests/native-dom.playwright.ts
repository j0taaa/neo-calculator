import { expect, test } from "@playwright/test";
import { readNativeForm, setNativeValue } from "../lib/huawei-native/native-dom";

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

test("disabled empty controls need no choice, while incomplete selectable controls still fail", async ({ page }) => {
  await page.setContent(`<div id="calculator_ims_select">
    <div class="base-select"><span title="Image"></span><input disabled><div class="tiny-select-dropdown"></div></div>
    <div class="base-select"><span title="Image version"></span><input disabled><div class="tiny-select-dropdown"></div></div>
  </div>`);
  await page.evaluate(() => Object.assign(window, { viewConfig: { calc_view: { components: [{ id: "calculator_ims_select", type: "CommonSelect" }] } } }));
  const unavailable = await readNativeForm(page);
  expect(unavailable.diagnostics).toEqual([]);
  expect(unavailable.fields).toHaveLength(2);
  for (const field of unavailable.fields) {
    expect(field).toMatchObject({ disabled: true, value: "-1", options: [] });
    await expect(setNativeValue(page, field, "0")).rejects.toThrow("disabled by Huawei");
  }
  // A disabled control with choices but no selection remains incomplete.
  await page.locator(".tiny-select-dropdown").first().evaluate(el => el.innerHTML = '<li class="tiny-select-dropdown__item">Linux</li>');
  expect((await readNativeForm(page)).diagnostics).toEqual(["No selected option for Image"]);
  // Empty enabled selectors must still block a quote.
  await page.locator("input").nth(1).evaluate(el => (el as HTMLInputElement).disabled = false);
  expect((await readNativeForm(page)).diagnostics).toEqual(["No selected option for Image", "No selected option for Image version"]);
  // When a flavor supports images again, expose its actual choices and selection.
  await page.locator("input").first().evaluate(el => (el as HTMLInputElement).disabled = false);
  await page.locator(".tiny-select-dropdown").first().evaluate(el => el.firstElementChild!.classList.add("selected"));
  await page.locator(".tiny-select-dropdown").nth(1).evaluate(el => el.innerHTML = '<li class="tiny-select-dropdown__item selected">Ubuntu</li>');
  const available = await readNativeForm(page);
  expect(available.diagnostics).toEqual([]);
  expect(available.fields[0]).toMatchObject({ disabled: false, value: "0", options: [{ label: "Linux" }] });
  expect(available.fields[1]).toMatchObject({ disabled: false, value: "0", options: [{ label: "Ubuntu" }] });
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
  const {setNativeValue} = await import("../lib/huawei-native/native-dom");
  await setNativeValue(page,form.fields[0],"2");
  await setNativeValue(page,form.fields[1],"1");
});

test("combined packages expose their controls and still reject unknown nested widgets", async ({ page }) => {
  await page.setContent(`<div id="calculator_bundle"><div class="base-radio-group" id="calculator_bundle_0_1"><li class="active"><button>2 vCPUs | 4 GB</button></li><li><button>4 vCPUs | 8 GB</button></li></div>
    <label class="tiny-checkbox"><input type="checkbox"><span class="tiny-checkbox__label">Data Disk(EVS)</span></label>
    <input class="tiny-numeric__input-inner" value="40" min="40" max="1024"></div>`);
  await page.evaluate(() => Object.assign(window, { viewConfig: { calc_view: { components: [{ id: "calculator_bundle", type: "FuncCombine", subComponents: [{ type: "CommonRadioGroup", optionKeys: ["vmType", "vm_spec"] }, { type: "CommonStepper" }] }] } } }));
  const form = await readNativeForm(page);
  expect(form.diagnostics).toEqual([]);
  expect(form.fields.map(field => field.type)).toEqual(["select", "checkbox", "number"]);
  expect(form.fields[0].label).toBe("Specification");
  await setNativeValue(page, form.fields[1], true);
  expect((await readNativeForm(page)).fields[1].value).toBe(true);
  await page.evaluate(() => (window as unknown as { viewConfig: { calc_view: { components: { subComponents: { type: string }[] }[] } } }).viewConfig.calc_view.components[0].subComponents.push({ type: "UnknownNestedWidget" }));
  expect((await readNativeForm(page)).diagnostics).toContain("Unsupported Huawei control: UnknownNestedWidget");
  await page.locator("#calculator_bundle").evaluate(element => element.insertAdjacentHTML("beforeend", '<input value="unmapped">'));
  expect((await readNativeForm(page)).diagnostics).toContain("Unmapped input in calculator_bundle");
});

test("numeric CommonInput controls preserve vendor rules and block rejected or nonnumeric values", async ({ page }) => {
  await page.setContent(`<div id="calculator_capacity" class="common-input"><div class="tiny-form-item"><label class="tiny-form-item__label">Capacity (TB)</label><div class="tiny-input"><input class="tiny-input__inner" value="3.6" errormessage="Use multiples of 1.2 between 3.6 and 1023.6."></div></div></div>`);
  await page.evaluate(() => Object.assign(window, { viewConfig: { calc_view: { components: [{ id: "calculator_capacity", type: "CommonInput" }] } } }));
  const form = await readNativeForm(page);
  expect(form.diagnostics).toEqual([]);
  expect(form.fields[0]).toMatchObject({ type: "number", value: 3.6, hint: "Use multiples of 1.2 between 3.6 and 1023.6." });
  await setNativeValue(page, form.fields[0], 4.8);
  expect((await readNativeForm(page)).fields[0].value).toBe(4.8);
  await page.locator(".tiny-input").evaluate(el => el.classList.add("common-input-is-error"));
  expect((await readNativeForm(page)).diagnostics).toContain(form.fields[0].hint);
  await page.locator("input").fill("not a number");
  expect((await readNativeForm(page)).diagnostics).toContain("Unsupported nonnumeric input in calculator_capacity");
});
