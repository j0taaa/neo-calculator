import { expect, test } from "@playwright/test";
import { readFormInDocument } from "../lib/huawei-native/native-dom";

test("empty official selectors remain noninteractive while populated selectors still require a selection", async ({ page }) => {
  await page.setContent(`<div id="selector"><label>Edition</label><div class="base-radio-group"></div></div>`);
  await page.evaluate(() => {
    (window as unknown as { viewConfig: unknown }).viewConfig = {
      calc_view: { components: [{ id: "selector", type: "CommonRadioGroup" }] },
    };
  });
  const empty = await page.evaluate(readFormInDocument);
  expect(empty.diagnostics).toEqual([]);
  expect(empty.fields[0]).toMatchObject({ disabled: true, options: [], value: "-1" });
  await page.locator(".base-radio-group").evaluate(el => {
    el.innerHTML = `<li><button>Basic</button></li><li><button>Professional</button></li>`;
  });
  const incomplete = await page.evaluate(readFormInDocument);
  expect(incomplete.fields[0].disabled).toBe(false);
  expect(incomplete.diagnostics).toContain("No selected option for Specification");
  await page.locator("li").first().evaluate(el => el.classList.add("active"));
  const selected = await page.evaluate(readFormInDocument);
  expect(selected.diagnostics).toEqual([]);
  expect(selected.fields[0]).toMatchObject({ disabled: false, value: "0" });
});
