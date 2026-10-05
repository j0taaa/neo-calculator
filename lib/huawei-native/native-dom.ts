import type { Page } from "playwright";
import type { NativeField, NativeForm } from "./native-types";

/** Runs inside the upstream page. Only the normalized data leaves the browser. */
export async function readNativeForm(page: Page): Promise<NativeForm> {
  return page.evaluate(() => {
    const fields: NativeField[] = [], notes: string[] = [], diagnostics: string[] = [];
    const bridge = window as unknown as { __neoDropdowns?: WeakMap<Element, HTMLElement> };
    const dropdowns = bridge.__neoDropdowns ??= new WeakMap<Element, HTMLElement>();
    const visible = (el: Element) => !!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
    const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
    const config = (window as unknown as { viewConfig?: { calc_view: { components: { id: string; type: string; optionKeys?: string[] }[] } } }).viewConfig;
    if (!config?.calc_view?.components) return { fields, notes, diagnostics: ["Huawei form metadata is unavailable"] };
    document.querySelectorAll("[data-neo-control]").forEach(el => el.removeAttribute("data-neo-control"));
    document.querySelectorAll("[data-neo-option]").forEach(el => el.removeAttribute("data-neo-option"));
    const allowed = new Set(["CommonRadioGroup", "CommonSelect", "CommonStepper", "CommonRadioStepper", "CommonCheckboxGroup", "CommonAddible", "CommonSwitch", "CommonTip"]);
    const components = [...config.calc_view.components];
    const globals = ["global_ONDEMANDTIME", "global_QUANTITY", "global_PERIODTIME", "global_FEEINSTALLMODE"];
    for (const id of globals) if (!components.some(c => c.id === id)) components.push({ id, type: "CommonStepper" });
    for (const component of components) {
      if (component.id.startsWith("global_") && !globals.includes(component.id)) continue;
      const root = document.getElementById(component.id) ?? document.querySelector<HTMLElement>(`[idheader="${component.id}"]`);
      if (!root || !visible(root)) continue;
      if (!allowed.has(component.type) && !component.id.startsWith("global_")) diagnostics.push(`Unsupported Huawei control: ${component.type}`);
      if (component.type === "CommonTip") { const text = clean(root.innerText); if (text) notes.push(text); }
      const before = fields.length;
      const handled = new Set<Element>();
      const controls = root.querySelectorAll<HTMLElement>(".base-radio-group, .base-select, .tiny-numeric__input-inner, .tiny-checkbox, .common-addible-addDisk, .common-addible-delete");
      let index = 0;
      for (const el of controls) {
        if (!visible(el)) continue;
        const id = `${component.id}:${index++}`;
        const item = el.closest(".tiny-form-item");
        const itemLabel = clean(item?.querySelector(".tiny-form-item__label")?.textContent);
        let label = itemLabel || clean(el.querySelector("[title]")?.getAttribute("title")) || "";
        const field: NativeField = { id, component: component.id, label, type: "select", value: "", disabled: el.matches(".is-disabled, [disabled]") };
        if (el.matches(".base-radio-group")) {
          const options = [...el.querySelectorAll<HTMLElement>("li")].filter(visible);
          field.options = options.map((option, i) => ({ value: String(i), label: clean(option.innerText), disabled: option.matches(".disabled, .is-disabled") || !!option.querySelector("button:disabled") }));
          field.value = String(options.findIndex(option => option.classList.contains("active")));
          if (!label) {
            const key = component.optionKeys?.[Number(el.id.split("_").at(-1))] || clean(el.getAttribute("optionkey"));
            const labels: Record<string, string> = { cpu: "vCPUs", mem: "Memory", generation: "Generation" };
            label = labels[key] || key?.replace(/([a-z])([A-Z])/g, "$1 $2") || "Specification";
          }
        } else if (el.matches(".base-select")) {
          const input = el.querySelector<HTMLInputElement>("input");
          if (input) handled.add(input);
          const localDropdown = el.querySelector<HTMLElement>(".tiny-select-dropdown");
          if (localDropdown) dropdowns.set(el, localDropdown);
          // TinyVue moves an opened dropdown to document.body. Keep its identity across that move.
          const dropdown = localDropdown ?? dropdowns.get(el);
          const options = [...(dropdown?.isConnected ? dropdown.querySelectorAll<HTMLElement>(".tiny-select-dropdown__item") : el.querySelectorAll<HTMLElement>(".tiny-select-dropdown__item"))];
          options.forEach((option, i) => option.setAttribute("data-neo-option", `${id}:${i}`));
          field.options = options.map((option, i) => ({ value: String(i), label: clean(option.innerText || option.textContent), disabled: option.matches(".disabled, .is-disabled") }));
          field.value = String(options.findIndex(option => option.classList.contains("selected")));
          field.disabled ||= !!input?.disabled;
          const key = el.querySelector("[optionkey]")?.getAttribute("optionkey");
          if (key === "name" && component.id === "calculator_ims_select") label = "Image version";
          if (!label) label = key || "Unit";
        } else if (el.matches(".tiny-checkbox")) {
          const input = el.querySelector<HTMLInputElement>("input");
          if (input) handled.add(input);
          field.type = "checkbox"; field.value = !!input?.checked;
          field.disabled ||= !!input?.disabled;
          label = clean(el.querySelector(".tiny-checkbox__label")?.textContent) || label;
        } else if (el.matches(".tiny-numeric__input-inner")) {
          const input = el as HTMLInputElement;
          handled.add(input);
          field.type = "number"; field.value = Number(input.value); field.disabled ||= input.disabled || input.readOnly;
          if (input.hasAttribute("min")) field.min = Number(input.min);
          if (input.hasAttribute("max")) field.max = Number(input.max);
          if (field.min !== undefined && field.min === field.max) field.disabled = true;
          field.unit = clean(el.closest(".base-stepper")?.querySelector(".base-stepper-span-unit")?.textContent);
          label ||= "Value";
          if (item?.querySelector(".base-select, .base-radio-group")) label += " amount";
        } else {
          field.type = "action"; field.value = false;
          label = el.matches(".common-addible-addDisk") ? "Add data disk" : "Remove data disk";
          field.disabled ||= !!el.closest(".is-disabled, .disabled");
        }
        field.label = label;
        // Huawei intentionally leaves some controls unavailable (for example aC8 images).
        // A disabled empty control requires no selection; populated or enabled controls still do.
        const unavailable = field.disabled && field.options?.length === 0;
        if (field.options && !unavailable && (!field.options.length || field.value === "-1")) diagnostics.push(`No selected option for ${label}`);
        el.setAttribute("data-neo-control", id);
        fields.push(field);
      }
      if (component.type !== "CommonTip" && fields.length === before && root.getBoundingClientRect().height > 0) diagnostics.push(`Unrecognized control markup in ${component.id}`);
      for (const widget of root.querySelectorAll("[role=switch], [role=slider], [role=checkbox]")) {
        if (visible(widget) && !widget.closest("[data-neo-control]")) diagnostics.push(`Unmapped interactive control in ${component.id}`);
      }
      for (const input of root.querySelectorAll("input, select, textarea")) {
        // Checkbox inputs can be visually hidden; their visible label was handled above.
        if (visible(input) && !handled.has(input) && !input.closest(".tiny-select-dropdown")) diagnostics.push(`Unmapped input in ${component.id}`);
      }
    }
    if (!fields.length) diagnostics.push("Huawei returned no controls");
    return { fields, notes, diagnostics: [...new Set(diagnostics)] };
  });
}

export function validateNativeValue(field: NativeField, value: unknown) {
  if (field.disabled) throw new Error("This control is disabled by Huawei");
  if (field.type === "select" && !field.options?.some(option => option.value === value && !option.disabled)) throw new Error("Invalid option");
  if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value) || (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))) throw new Error("Value is outside Huawei's allowed range");
  if ((field.type === "checkbox" || field.type === "action") && typeof value !== "boolean") throw new Error("Invalid control value");
}

export async function setNativeValue(page: Page, field: NativeField, value: string | number | boolean) {
  validateNativeValue(field, value);
  // IDs are generated by our reader; never accept a client-supplied selector.
  const control = page.locator(`[data-neo-control=${JSON.stringify(field.id)}]`);
  if (field.type === "select") {
    if (await control.evaluate(el => el.matches(".base-radio-group"))) await control.locator("li").nth(Number(value)).click();
    else { await control.locator("input").click(); await page.locator(`[data-neo-option=${JSON.stringify(`${field.id}:${value}`)}]`).click(); }
  } else if (field.type === "number") {
    await control.fill(String(value)); await control.press("Tab");
  } else if (field.type === "checkbox") {
    if (field.value !== value) await control.click();
  } else await control.click();
}
