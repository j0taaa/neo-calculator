/* eslint-disable @typescript-eslint/no-explicit-any -- Published schemas have service-defined product attributes. */
import type { NativeBillingMode } from "../huawei-native/native-billing";
import type { NativeState, NativeForm } from "../huawei-native/native-types";
import type { ScopeSnapshot, CatalogProduct } from "../huawei-snapshot/types";
import { localState } from "../huawei-snapshot/state";
import { selectionField } from "../huawei-native/native-selection";
import type { NativeSelection, NativeSelectionField } from "../huawei-native/native-selection";
import { category, matchingRows, ruleLanguage } from "./catalog";
import { buildControls, type ControlContext, type ControlResult } from "./controls";
import { RuleEvaluator, isRule } from "./evaluate";
import type { CompiledRules } from "./program";
import { periodChoices } from "./periods";
import { priceSelection } from "./selection-pricing";
import { bundleControls } from "./bundles";
import { clusterControls, mediaControls, tableControls } from "./specialized";

/** Neo's own state machine. It can run identically in a browser or on the server. */
export class CalculatorEngine {
  readonly token: string;
  private chosen = new Map<string, any>();
  private bindings: ControlContext["bindings"] = new Map();
  private evaluator: RuleEvaluator;
  private language: ReturnType<typeof ruleLanguage>;
  private values: Record<string, any> = {};
  private products: Record<string, CatalogProduct[]> = {};
  private current: NativeState | null = null;
  private rowCache = new Map<string, CatalogProduct[]>();
  constructor(readonly rules: CompiledRules, readonly scope: ScopeSnapshot, readonly menu: any, readonly release: string, readonly mode: NativeBillingMode, token = crypto.randomUUID()) {
    if (rules.version !== 1 || !scope.modes.includes(mode)) throw new Error("Unavailable compiled calculator scope");
    this.token = token;
    this.evaluator = new RuleEvaluator(rules.globals);
    this.language = ruleLanguage(rules, menu);
    const location = scope.commonModes?.includes(mode) === false ? Object.keys(scope.locationModes ?? {}).find(code => scope.locationModes![code].includes(mode)) : "common";
    this.chosen = new Map(Object.entries(structuredClone(scope.defaults?.[`${mode}/${location}`] ?? {})));
  }
  private globalInfo() {
    const locationType = this.chosen.get("global_LOCATIONTYPE") ?? (this.scope.commonModes?.includes(this.mode) === false ? "homeZoneAZ" : "commonAZ");
    const codes = Object.keys(this.scope.locationModes ?? {}).filter(code => this.scope.locationModes![code].includes(this.mode));
    let locationCode = locationType === "homeZoneAZ" ? this.chosen.get("global_LOCATIONCODE") : undefined;
    if (locationType === "homeZoneAZ" && !codes.includes(locationCode)) locationCode = codes[0];
    this.chosen.set("global_LOCATIONTYPE", locationType); this.chosen.set("global_LOCATIONCODE", locationCode);
    return { region: this.scope.region, serviceCode: this.scope.service, chargeMode: this.mode, locationType, locationCode, language: "en-us", sign: "common", tag: this.scope.tag ?? "general.online.portal" };
  }
  private rows(key: string, inject?: any): CatalogProduct[] {
    const info = this.globalInfo();
    const selectedMode = inject?.transedChargeModes?.includes(this.mode) ? inject.originalChargeMode : this.mode;
    const cacheKey = `${key}/${selectedMode}/${info.locationType}/${info.locationCode ?? ""}`;
    const cached = this.rowCache.get(cacheKey);
    if (cached) return cached;
    const rows = (category(this.scope.products.product, key) ?? []).flatMap(row => {
      if (key.endsWith("vm.image.special")) return [row];
      if (row.locationType !== (info.locationType === "homeZoneAZ" ? "2" : undefined) || row.locationCode !== info.locationCode) return [];
      const planList = row.planList?.filter(p => selectedMode === "PERIOD" ? ["MONTHLY", "YEARLY"].includes(p.billingMode) : p.billingMode === selectedMode);
      if (row.planList && !planList?.length) return [];
      return [{ ...row, ...(planList ? { planList } : {}), ...(selectedMode !== this.mode ? { _injectedMode: selectedMode } : {}) }];
    });
    this.rowCache.set(cacheKey, rows); return rows;
  }
  private input(key: string, inject?: any): any {
    if (key === "global_REGIONINFO") return this.globalInfo();
    if (/^(dataInfo|calc|detail)_\d+_/.test(key)) return this.language.translate(key);
    if (key.startsWith("hws.resource.type.") || key in this.scope.products.product) return this.rows(key, inject);
    if (key in this.products) {
      const config = this.rules.components.find(c => c.id === key);
      if (!["CommonSwitch", "CommonCheckboxGroup", "CommonTip"].includes(String(config?.type))) return this.products[key];
      if (this.products[key].length) return this.products[key];
    }
    if (key in this.values) return this.values[key];
    // Uninitialized component dependencies are empty until the fixed point is reached.
    if (this.rules.components.some(c => c.id === key)) return [];
    return key;
  }
  private source(config: any) {
    const definitions = this.rules.sources.filter(s => (s.ids as string[]).includes(config.id));
    const definition: any = definitions.findLast(s => s.cascadedSource) ?? definitions[0];
    if (!definition) return [];
    let source: any[];
    if (definition.cascadedSource) {
      const rule = definition.cascadedSource;
      source = this.evaluator.run(rule.function, structuredClone(rule.inputs.map((key: string) => this.input(key, definition.injectConfig))));
    } else source = (definition.sources ?? []).flatMap((s: any) => {
      const rules = s.rules?.filter((r: any) => (!r.regions || r.regions.includes(this.scope.region)) && (!r.chargeModes || r.chargeModes.includes(this.mode)) && (!r.tags || r.tags.includes(this.scope.tag ?? "general.online.portal")));
      if (s.rules && !rules.length) return [];
      return /(?:dataInfo|calc|detail)_\d+_/.test(s.param) ? [s.param] : matchingRows(this.rows(s.param, definition.injectConfig), rules);
    });
    if (!Array.isArray(source)) source = source === undefined || source === null ? [] : [source];
    if (definition.inquiryTag) source = source.map(row => row && typeof row === "object" ? { ...row, inquiryTag: definition.inquiryTag } : row);
    return source;
  }
  private configuration(original: any) {
    if (!original.cascadedViewConfig) return original;
    const { cascadedViewConfig, ...defaultViewConfig } = original;
    const config = this.evaluator.run(cascadedViewConfig.function, cascadedViewConfig.inputs.map((key: string) => this.input(key)), { defaultViewConfig: structuredClone(defaultViewConfig) });
    if (config === undefined || config === null) return null;
    if (typeof config !== "object") throw new Error(`Invalid compiled view rule: ${original.id}`);
    return { ...defaultViewConfig, ...config, id: original.id };
  }
  private visible(id: string) {
    const conditions = new Map<string, boolean>();
    for (const rule of this.rules.visibility as any[]) {
      if (!rule.ids.includes(id)) continue;
      if (rule.defaultShow === false) return false;
      if (rule.sign && rule.sign !== "common") return false;
      const environment = { ...this.globalInfo(), regions: this.scope.region } as Record<string, unknown>;
      const keys = Object.keys(environment).filter(key => key !== "sign" && key in rule);
      const matches = (expected: any, value: unknown) => Array.isArray(expected) ? expected.includes(value) : expected === value;
      if (keys.length && !keys.some(key => matches(rule[key], environment[key]))) return false;
      if (rule.switchs || rule.checkboxs) {
        for (const test of rule.switchs ?? []) {
          if (this.rules.visibility.some((r: any) => r.ids.includes(test.id) && r.sign && r.sign !== "common")) continue;
          const current = this.values[test.id], candidates = current && typeof current === "object" && !Array.isArray(current) ? Object.values(current) : [current], active = candidates.some(v => test.values.includes(v));
          conditions.set(`switch:${test.id}`, test.type === "inverse" ? !active : active);
        }
        for (const test of rule.checkboxs ?? []) {
          const raw = this.values[test.id], selected = raw && typeof raw === "object" && !Array.isArray(raw) ? Object.values(raw)[0] : raw;
          conditions.set(`checkbox:${test.id}`, (Array.isArray(selected) || typeof selected === "string") && selected.includes(test.value));
        }
      }
      if (rule.otherDataSource) {
        const target = this.rules.components.find(c => c.id === rule.otherDataSource);
        if (!target || !this.source(target).length) return false;
      }
    }
    return [...conditions.values()].every(Boolean);
  }
  private control(config: any, source: any[], namespace = config.id): ControlResult {
    const context: ControlContext = { chosen: this.chosen, bindings: this.bindings, environment: this.globalInfo(), ...this.language };
    if (!source.length && !this.rules.visibility.some((r: any) => r.ids.includes(config.id) && r.alwaysShow)) return { fields: [], products: [], value: [], notes: [] };
    config = { ...config, ...(config.prefixs ? { prefixs: config.prefixs.filter((p: any) => !p.monthlyBill) } : {}), ...(config.steppers ? { steppers: config.steppers.map((s: any) => ({ ...s, prefixs: s.prefixs?.filter((p: any) => !p.monthlyBill) })) } : {}) };
    if (config.type === "FuncCombine") return bundleControls(config, source, context, this.evaluator, (c, rows, name) => this.control(c, rows, name));
    if (config.type === "CustomMRSNodeRadio") return clusterControls(config, source, context, (c, rows, name) => this.control(c, rows, name));
    if (config.type === "CustomVODMultiSelect") return mediaControls(config, source, context, (c, rows, name) => this.control(c, rows, name));
    if (config.type === "CalculatorStepperWithSelect") config = { ...config, type: "CommonSelect", optionKeys: [config.optionKey], titles: [config.title], defaultValues: [config.default], sortMethods: [config.sortMethod] };
    if (config.type === "FuncTableCalc") return tableControls(config, source, context);
    if (config.type === "CommonAddible") {
      const countKey = namespace + ":count", count = this.chosen.get(countKey) ?? 0;
      const parts = [this.control({ ...config.main, id: config.id }, source, namespace + ":main")];
      for (let i = 0; i < count; i++) parts.push(this.control({ ...config.main, ...config.addible?.[0], id: config.id }, source, `${namespace}:extra:${i}`));
      const fields = parts.flatMap(p => p.fields);
      // Renumber combined controls, while preserving their internal semantic bindings.
      const mapped = parts.flatMap(p => p.fields.map(f => ({ field: f, binding: this.bindings.get(f.id)! })));
      mapped.forEach(({ field, binding }, i) => { field.id = `${config.id}:${i}`; this.bindings.set(field.id, binding); });
      for (let i = 0; i < count; i++) {
        const id = `${config.id}:${fields.length}`;
        fields.push({ id, component: config.id, label: "Remove data disk", type: "action", value: false, disabled: false });
        this.bindings.set(id, { key: countKey, action: () => {
          for (let n = i; n < count - 1; n++) {
            const from = `${namespace}:extra:${n + 1}`, to = `${namespace}:extra:${n}`;
            for (const [key, value] of [...this.chosen]) if (key.startsWith(from + ":")) this.chosen.set(to + key.slice(from.length), value);
          }
          for (const key of [...this.chosen.keys()]) if (key.startsWith(`${namespace}:extra:${count - 1}:`)) this.chosen.delete(key);
          this.chosen.set(countKey, count - 1);
        } });
      }
      const id = `${config.id}:${fields.length}`;
      fields.push({ id, component: config.id, label: "Add data disk", type: "action", value: false, disabled: count >= (config.max ?? 10) });
      this.bindings.set(id, { key: countKey, action: () => this.chosen.set(countKey, count + 1) });
      return { fields, products: parts.flatMap(p => p.products), value: parts.map(p => p.value), notes: parts.flatMap(p => p.notes) };
    }
    const result = buildControls(config, source, context, config.id, namespace);
    if (config.type === "CommonInput" && config.rule) {
      const validate = isRule(config.rule) ? (value: string | number | boolean) => Boolean(this.evaluator.run(config.rule, [value])) : config.rule.$regex ? (value: string | number | boolean) => new RegExp(config.rule.$regex, config.rule.flags).test(String(value)) : undefined;
      if (!validate) throw new Error(`Unsupported input validation: ${config.id}`);
      for (const field of result.fields) this.bindings.get(field.id)!.validate = validate;
    }
    return result;
  }
  private globalControls(form: NativeForm) {
    const info = this.globalInfo();
    const select = (id: string, key: string, label: string, options: { value: any; label: string; disabled?: boolean }[]) => {
      let selected = this.chosen.get(key);
      if (!options.some(o => o.value === selected && !o.disabled)) selected = options.find(o => !o.disabled)?.value;
      this.chosen.set(key, selected);
      const fieldId = `${id}:0`;
      this.bindings.set(fieldId, { key, options: options.map(o => o.value) });
      form.fields.push({ id: fieldId, component: id, label, type: "select", presentation: "options", value: String(options.findIndex(o => o.value === selected)), disabled: !options.some(o => !o.disabled), options: options.map((o, i) => ({ value: String(i), label: o.label, disabled: Boolean(o.disabled) })) });
      return selected;
    };
    const zones = Object.keys(this.scope.locationModes ?? {});
    if (zones.length) {
      select("global_LOCATIONTYPE", "global_LOCATIONTYPE", "AZ", [
        { value: "commonAZ", label: "General AZ", disabled: this.scope.commonModes?.includes(this.mode) === false },
        { value: "homeZoneAZ", label: "HomeZones", disabled: !zones.some(code => this.scope.locationModes![code].includes(this.mode)) },
      ]);
      if (this.chosen.get("global_LOCATIONTYPE") === "homeZoneAZ") select("global_LOCATIONCODE", "global_LOCATIONCODE", "Availability zone", zones.map(code => ({ value: code, label: this.menu.global?.[code] ?? code, disabled: !this.scope.locationModes![code].includes(this.mode) })));
    }
    if (this.mode === "PERIOD") {
      const plans = Object.values(this.products).flat().filter(p => p.planList?.length).map(p => p.planList!.map(plan => ({ feeInstallMode: plan.feeInstallMode ?? "ALL_PAY", installPeriodType: plan.installPeriodType })));
      const options = plans[0]?.filter((plan, i, list) => list.findIndex(p => p.feeInstallMode === plan.feeInstallMode && p.installPeriodType === plan.installPeriodType) === i && plans.every(list => list.some(p => p.feeInstallMode === plan.feeInstallMode && p.installPeriodType === plan.installPeriodType))) ?? [];
      if (options.some(o => o.feeInstallMode !== "ALL_PAY")) {
        const selected = select("global_FEEINSTALLMODE", "global_FEEINSTALLMODE", "Payment", options.map(o => ({ value: `${o.feeInstallMode}/${o.installPeriodType ?? ""}`, label: `${o.feeInstallMode === "ALL_PAY" ? "All upfront" : o.feeInstallMode === "HALF_PAY" ? "Partial upfront" : "No upfront"}${o.installPeriodType ? ` (${o.installPeriodType.toLowerCase()})` : ""}` })));
        const [feeInstallMode, installPeriodType] = selected.split("/"); this.values.global_FEEINSTALLMODE = { feeInstallMode, installPeriodType: installPeriodType || undefined };
      } else delete this.values.global_FEEINSTALLMODE;
    }
    const globalDefaults: any[] = [
      ...(this.mode === "ONDEMAND" ? [{ id: "global_ONDEMANDTIME", type: "CommonStepper", title: "Required Duration", prefixs: [{ min: 1, max: 9999, defaultValue: 1, measureId: 4 }] }] : []),
      { id: "global_QUANTITY", type: "CommonStepper", title: "Quantity", prefixs: [{ min: 1, max: 99, defaultValue: 1, measureId: 41 }] },
    ];
    for (const base of globalDefaults) {
      const custom = this.rules.components.find(c => c.id === base.id) ?? {};
      const config = this.configuration({ ...base, ...custom });
      if (!config) continue;
      if (!this.visible(config.id)) continue;
      const control = this.control(config, [{}]);
      form.fields.push(...control.fields); this.values[config.id] = control.value;
    }
    if (this.mode === "PERIOD" && this.visible("global_PERIODTIME")) {
      const service = this.menu.menuInfos.flatMap((c: any) => c.subCategoryLists).find((s: any) => s.urlPath === this.scope.service);
      const main = service?.mainProductList ?? service?.mainProduct;
      let choices: any[] = [];
      const selectedProducts = this.products;
      const priority = this.chosen.get("global_PERIODCOMPONENT");
      const dependencyOrder: string[] | undefined = this.chosen.get("global_PERIODORDER");
      const rank = (id: string) => dependencyOrder?.includes(id) ? dependencyOrder.indexOf(id) : dependencyOrder?.length ?? 0;
      const ordered = Object.entries(selectedProducts).sort(([a], [b]) => dependencyOrder ? rank(a) - rank(b) : Number(a === priority) - Number(b === priority));
      for (const row of ordered.flatMap(([, rows]) => rows)) {
        if (row._additionProduct) continue;
        if (!row.resourceType) continue;
        const list = category(this.scope.products.period as Record<string, any[][]> ?? {}, row.resourceType)?.[Number(row.periodList)] ?? [];
        const isMain = !main?.length || main.some((p: any) => p.resourceType === row.resourceType && p.cloudServiceType === row.cloudServiceType);
        const same = (a: any, b: any) => Number(a.backValue ?? a.value) === Number(b.backValue ?? b.value) && a.periodType === b.periodType;
        if (isMain) choices = list.map(p => ({ ...p, hasPromotion: p.hasPromotion || choices.find(q => same(p, q))?.hasPromotion }));
        else choices = choices.map(p => ({ ...p, disabled: p.disabled || !list.some(q => same(p, q)) }));

      }
      if ((main ?? service?.categoryInfos)?.some((p: any) => p.supportCombine)) choices = Array.from({ length: 9 }, (_, i) => ({ value: i + 1, periodType: "MONTH" })).concat([{ value: 1, periodType: "YEAR" }]);
      const unique = periodChoices(choices.sort((a, b) => a.periodType === b.periodType ? Number(a.value) - Number(b.value) : a.periodType === "MONTH" ? -1 : 1));
      if (unique.length) {
        const key = "global_PERIODTIME:period", options = unique.map(p => p.key);
        let selected = this.chosen.get(key);
        if (!options.includes(selected)) selected = options[0];
        this.chosen.set(key, selected);
        const [measureValue, measureId] = selected.split("_").map(Number);
        this.values.global_PERIODTIME = { UNSET_PeriodTime: { measureValue, measureId } };
        const id = "global_PERIODTIME:0";
        this.bindings.set(id, { key, options });
        form.fields.push({ id, component: "global_PERIODTIME", type: "select", presentation: "options", label: "Required Duration", value: String(options.indexOf(selected)), disabled: false, options: unique.map((p, i) => ({ value: String(i), label: p.label, disabled: p.disabled })) });
      } else form.fields.push({ id: "global_PERIODTIME:0", component: "global_PERIODTIME", type: "select", label: "Required Duration", value: "-1", disabled: true, options: [] });
    }
    this.values.global_REGIONINFO = info;
  }
  evaluate(): NativeState {
    const empty = this.scope.emptyForms?.[this.mode];
    if (empty) {
      const form = structuredClone(empty);
      for (const field of form.fields) {
        const key = `empty:${field.id}`;
        if (this.chosen.has(key)) field.value = this.chosen.get(key);
        this.bindings.set(field.id, { key, options: field.options?.map(o => o.value) });
      }
      this.current = localState(form, this.scope, this.release, this.token, this.mode, this.current);
      return this.current;
    }
    let form: NativeForm = { fields: [], notes: [], diagnostics: [] };
    let signature = "";
    for (let pass = 0; pass < 30; pass++) {
      form = { fields: [], notes: [], diagnostics: [] }; this.bindings.clear();
      this.values.global_REGIONINFO = this.globalInfo();
      const globals: NativeForm = { fields: [], notes: [], diagnostics: [] };
      this.globalControls(globals);
      for (const original of this.rules.components as any[]) {
        if (original.id.startsWith("global_")) continue;
        if (!this.visible(original.id)) { delete this.products[original.id]; delete this.values[original.id]; continue; }
        const config = this.configuration(original);
        if (!config) { delete this.products[original.id]; delete this.values[original.id]; continue; }
        const control = this.control(config, this.source(config));
        form.fields.push(...control.fields); form.notes.push(...control.notes);
        if (control.fields.length || control.products.length || control.notes.length) { this.products[config.id] = control.products; this.values[config.id] = control.value; }
        else { delete this.products[config.id]; delete this.values[config.id]; }
      }
      form.fields.push(...globals.fields);
      const next = JSON.stringify([form, this.values]);
      if (next === signature) break;
      signature = next;
      if (pass === 29) throw new Error("Compiled option dependencies did not converge");
    }
    const result = priceSelection(this.scope, this.rules, this.evaluator, this.products, this.values, this.globalInfo(), this.language.translate, this.release);
    const unavailable = this.scope.modeAvailability?.[this.mode];
    if (unavailable) form.availability = unavailable;
    const state = localState(form, this.scope, this.release, this.token, this.mode, this.current, unavailable ? undefined : result.pricing, unavailable ? null : result.quote, unavailable ? [] : result.inquiries, unavailable ? undefined : result.error);
    this.current = state;
    return state;
  }
  change(fieldId: string, value: string | number | boolean): NativeState {
    if (!this.current) this.evaluate();
    const field = this.current!.fields.find(f => f.id === fieldId), binding = this.bindings.get(fieldId);
    if (!field || !binding || field.disabled) throw new Error("Unavailable calculator control");
    const checkpoint = { chosen: structuredClone(this.chosen), products: structuredClone(this.products), values: structuredClone(this.values), bindings: new Map(this.bindings), current: this.current };
    try {
    if (binding.validate && !binding.validate(value)) throw new Error(field.hint || "Invalid calculator value");
    if (field.type === "select") {
      const option = field.options?.find(o => o.value === value && !o.disabled);
      if (!option) throw new Error("Invalid calculator option");
      this.chosen.set(binding.key, binding.options![Number(value)]);
    } else if (field.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < (field.min ?? 0) || value > (field.max ?? Infinity)) throw new Error("Calculator value is outside its allowed range");
      if (field.component === "global_QUANTITY" && !Number.isSafeInteger(value)) throw new Error("Enter a whole purchase quantity");
      this.chosen.set(binding.key, value);
    } else if (typeof value !== "boolean") throw new Error("Invalid calculator control value");
    else if (binding.action) binding.action();
    else this.chosen.set(binding.key, value);
    const previous = this.current!, next = this.evaluate();
    next.selection.steps = [...previous.selection.steps, { before: selectionField(field), value, ...(field.type === "select" ? { optionLabel: field.options!.find(o => o.value === value)!.label } : {}) }];
    return next;
    } catch (error) {
      this.chosen = checkpoint.chosen; this.products = checkpoint.products; this.values = checkpoint.values; this.bindings = checkpoint.bindings; this.current = checkpoint.current;
      throw error;
    }
  }
  get state() { return this.current ?? this.evaluate(); }
  /** Merge ordering evidence from different visible branches into the published rule model. */
  learnDependencyOrder(reference: NativeState) {
    if (!reference.ruleOrder) return;
    const order: string[] = [...(this.chosen.get("global_PERIODORDER") ?? [])];
    for (let i = 0; i < reference.ruleOrder.length; i++) {
      const id = reference.ruleOrder[i];
      if (order.includes(id)) continue;
      const next = reference.ruleOrder.slice(i + 1).find(key => order.includes(key));
      if (next) order.splice(order.indexOf(next), 0, id);
      else order.push(id);
    }
    this.chosen.set("global_PERIODORDER", order);
    return order;
  }
  /** Daily extraction records defaults as choices; the runtime still computes every dependency itself. */
  learnDefaults(reference: NativeState): Record<string, unknown> {
    this.learnDependencyOrder(reference);
    if (reference.availability && !reference.quote) (this.scope.modeAvailability ??= {})[this.mode] = reference.availability;
    if (reference.availability && reference.fields.every(f => f.component.startsWith("global_"))) {
      (this.scope.emptyForms ??= {})[this.mode] = { availability: reference.availability, fields: structuredClone(reference.fields), notes: [...reference.notes], diagnostics: [...reference.diagnostics] };
    }
    const selected = reference.local?.pricing.selectedProduct;
    if (selected?.locationCode) {
      this.chosen.set("global_LOCATIONTYPE", "homeZoneAZ");
      this.chosen.set("global_LOCATIONCODE", selected.locationCode);
    }
    this.evaluate();
    for (const saved of reference.fields) {
      const fields = this.state.fields.filter(f => f.component === saved.component && f.type === saved.type);
      const specialized = String(this.rules.components.find(c => c.id === saved.component)?.type).startsWith("Custom");
      const field = fields.find(f => f.id === saved.id && f.label === saved.label) ?? (specialized ? fields.find(f => f.id === saved.id) : undefined) ?? fields.find(f => f.label === saved.label);
      if (!field || field.disabled || field.type === "action") continue;
      let value = saved.value;
      if (field.type === "select") {
        const label = saved.options?.find(o => o.value === String(saved.value))?.label;
        const option = field.options?.find(o => o.label.toLowerCase() === label?.toLowerCase());
        if (!option) continue;
        value = option.value;
      }
      if (value !== field.value) this.change(field.id, value);
    }
    const specifications = reference.local?.pricing.selectedProduct.productAllInfos.map(p => p.resourceSpecCode) ?? [];
    for (const field of this.state.fields) {
      const binding = this.bindings.get(field.id);
      if (!binding?.key.endsWith(":row") || !binding.options) continue;
      const selected = binding.options.find(v => specifications.some(spec => String(v).startsWith(`${spec}_`)));
      if (selected !== undefined) this.chosen.set(binding.key, selected);
    }
    this.evaluate();
    // Extract which priced component determines terms when the service does not
    // declare a main product. This is rule metadata, never a cached form replay.
    if (this.mode === "PERIOD" && !reference.ruleOrder) {
      const expected = reference.fields.find(f => f.component === "global_PERIODTIME");
      const terms = (field: typeof expected) => JSON.stringify(field?.options?.map(o => [o.label.toLowerCase().replace(/\s+/g, "").replace(/^(\d+)$/, "$1months").replace(/(months|years)$/, unit => unit.slice(0, -1)), o.disabled]));
      if (expected && terms(expected) !== terms(this.state.fields.find(f => f.component === "global_PERIODTIME"))) {
        for (const id of Object.keys(this.products)) {
          this.chosen.set("global_PERIODCOMPONENT", id); this.evaluate();
          if (terms(expected) === terms(this.state.fields.find(f => f.component === "global_PERIODTIME"))) break;
        }
      }
    }
    return Object.fromEntries(this.chosen);
  }
  restore(selection: NativeSelection): NativeState {
    if (selection.service !== this.scope.service || selection.region !== this.scope.region || (selection.billingMode ?? "ONDEMAND") !== this.mode) throw new Error("Saved configuration belongs to another scope");
    this.evaluate();
    const labelKey = (label: string) => label.toLowerCase().replace(/\s+/g, "");
    const apply = (saved: NativeSelectionField, value: string | number | boolean, optionLabel?: string, required = true) => {
      const fields = this.state.fields.filter(f => f.component === saved.component && f.type === saved.type);
      const specialized = String(this.rules.components.find(c => c.id === saved.component)?.type).startsWith("Custom");
      const field = fields.find(f => f.id === saved.id && labelKey(f.label) === labelKey(saved.label)) ?? (specialized ? fields.find(f => f.id === saved.id) : undefined) ?? fields.find(f => labelKey(f.label) === labelKey(saved.label));
      if (!field) { if (required) throw new Error(`The synchronized calculator no longer has this control: ${saved.label}`); return; }
      if (field.type === "select") {
        if (field.disabled && !field.options?.length && saved.value === "-1") return;
        const unitLabel = (label: string) => labelKey(label).replace(/^(months|years|days|hours|minutes|seconds)$/, text => text.slice(0, -1));
        const option = field.options?.find(o => !o.disabled && (labelKey(o.label) === labelKey(optionLabel ?? "") || field.component === "global_PERIODTIME" && labelKey(o.label) === `${optionLabel}months` || field.unitSelector && unitLabel(o.label) === unitLabel(optionLabel ?? "")));
        if (!option) throw new Error(`The synchronized calculator no longer offers: ${optionLabel}`);
        value = option.value;
      }
      if (field.type !== "action" && field.value === value) return;
      if (field.disabled) throw new Error(`The saved value is no longer available: ${saved.label}`);
      this.change(field.id, value);
    };
    for (const field of selection.initial) if (field.type !== "action") apply(field, field.value, field.optionLabel, false);
    for (const step of selection.steps) apply(step.before, step.value, step.optionLabel);
    // Final fields are also verified, including configurations imported without a change history.
    for (const field of selection.fields) if (field.type !== "action") apply(field, field.value, field.optionLabel);
    return this.state;
  }
}
