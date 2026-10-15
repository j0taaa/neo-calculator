import { CalculatorEngine } from "../calculator-rules/engine";
import { isSavedHuaweiProduct } from "../huawei-carts/preserved";
import { verifySavedHuaweiProduct } from "../huawei-carts/preserved-server";
import { apiService } from "../calculator/api";
import type { ProductMutationBody } from "../calculator-types";
import type { NativeField, NativeState } from "../huawei-native/native-types";
import { nativeDraft } from "../huawei-native/native-draft";
import { productFromIndependentState, verifySnapshotProduct } from "../huawei-snapshot/product";
import { SnapshotStore } from "../huawei-snapshot/store";
import type { ScopeSnapshot, SnapshotRelease } from "../huawei-snapshot/types";
import { isRecord } from "../product-input";
import { assertDocumentStructure } from "./schema";
import { ResourceDocumentError, type DocumentIssue, type ImportedResourcePayload, type ResourceIntent, type ResourceDocument } from "./types";

const problem = (path: string, message: string, code = "configuration") => new ResourceDocumentError([{ path, code, message }]);

/** One release per operation, including projects and batches crossing many scopes. */
export class ResourceCompiler {
  private scopes = new Map<string, Promise<ScopeSnapshot>>();
  private menu: unknown;
  constructor(readonly release: SnapshotRelease, readonly store = new SnapshotStore()) { this.menu = JSON.parse(release.menu); }
  checkRelease(id?: unknown) {
    if (id !== undefined && id !== this.release.id) throw new ResourceDocumentError([{ path: "/releaseId", code: "catalog.changed", message: "The published catalog changed. Fetch the schema and rediscover choices before validating or importing." }], this.release.id);
  }
  private scope(service: string, region: string) {
    const key = `${service}/${region}`;
    if (!this.scopes.has(key)) this.scopes.set(key, this.store.scope(this.release, service, region, false));
    return this.scopes.get(key)!;
  }
  async configure(intent: ResourceIntent, path = "/product") {
    const service = apiService(this.release.directory, intent.serviceCode);
    if (!service) throw problem(`${path}/serviceCode`, "Unknown published service", "service.unknown");
    if (intent.serviceCode !== `HUAWEI:${service.id}`) throw problem(`${path}/serviceCode`, `Use the canonical serviceCode HUAWEI:${service.id} from the schema`, "service.canonical");
    if (!this.release.scopes[`${service.id}/${intent.region}`]) throw problem(`${path}/region`, "This service has no published calculator in this region", "scope.unavailable");
    const scope = await this.scope(service.id, intent.region);
    if (!this.release.engine || !scope.rules || !scope.rulesChecks) throw problem(path, "Independently verified calculator rules are unavailable");
    if (!scope.modes.includes(intent.billingMode)) throw problem(`${path}/billingMode`, "This billing mode is unavailable in this region", "mode.unavailable");
    const engine = new CalculatorEngine(scope.rules, scope, this.menu, this.release.id, intent.billingMode);
    const requested = new Map<string, { field: NativeField; value: string | number | boolean; path: string }>();
    for (const [index, choice] of intent.choices.entries()) {
      const choicePath = `${path}/choices/${index}`;
      const field = engine.state.fields.find(field => field.id === choice.field);
      if (!field || field.disabled) throw problem(`${choicePath}/field`, "This control is unavailable. Configure the preceding choices to discover the current controls.", "control.unavailable");
      if (choice.label !== undefined && choice.label !== field.label) throw problem(`${choicePath}/label`, `The current label is ${JSON.stringify(field.label)}`, "control.changed");
      let value = choice.value;
      if (choice.option !== undefined) {
        if (field.type !== "select") throw problem(`${choicePath}/option`, "Option labels can only be used with select controls");
        const matches = field.options?.filter(option => option.label === choice.option && !option.disabled) ?? [];
        if (matches.length !== 1) throw problem(`${choicePath}/option`, matches.length ? "Ambiguous option label; use its exact value from configure" : "This option is unavailable; use an enabled option from configure", "option.unavailable");
        value = matches[0].value;
      }
      if (field.type === "action" && value !== true) throw problem(`${choicePath}/value`, "Actions must use value:true");
      try {
        engine.change(field.id, value!);
      } catch (error) {
        throw problem(`${choicePath}/${choice.option !== undefined ? "option" : "value"}`, error instanceof Error ? error.message : "Invalid control value");
      }
      if (field.type !== "action") requested.set(field.id, { field, value: field.type === "select" ? field.options!.find(option => option.value === value)!.label : value!, path: choicePath });
    }
    // Parent selections can reset child controls. Never silently price a different
    // resource than the one explicitly requested by the document.
    for (const { field, value, path: choicePath } of requested.values()) {
      const final = engine.state.fields.find(f => f.id === field.id && f.type === field.type && f.label === field.label);
      const selected = final?.type === "select" ? final.options?.find(o => o.value === final.value)?.label : final?.value;
      if (!final || selected !== value) throw problem(choicePath, "A later choice reset or removed this control. Set dependent controls after their parent options.", "choice.reset");
    }
    return { state: engine.state, scope, service };
  }
  async intentProduct(intent: ResourceIntent, path: string): Promise<ProductMutationBody> {
    const { state, scope, service } = await this.configure(intent, path);
    if (!state.quote || !state.local || state.diagnostics.length) throw problem(path, state.priceError ?? `This configuration cannot be quoted (${state.availability ?? "incomplete"})`, "price.unavailable");
    return productFromIndependentState(nativeDraft(state, service.name, intent.title ?? service.name, true), state, scope, this.release);
  }
  async savedProduct(input: ProductMutationBody, path: string) {
    if (isSavedHuaweiProduct(input)) {
      try { return verifySavedHuaweiProduct(input); }
      catch (error) { throw problem(path, error instanceof Error ? error.message : "Invalid preserved Huawei resource"); }
    }
    const service = apiService(this.release.directory, input.serviceCode);
    if (!service) throw problem(`${path}/serviceCode`, "Unknown published service", "service.unknown");
    try {
      // Exported IDs/timestamps belong to the source account/cart. Import must
      // create fresh records, even when the file is imported into the same app.
      const product = await verifySnapshotProduct({ serviceCode: `HUAWEI:${service.id}`, serviceName: service.name,
        productType: "huawei-native", title: input.title.trim(), quantity: input.quantity, config: input.config, pricing: null }, this.store, true, this.release);
      if (input.quantity !== product.quantity) throw new Error("Saved quantity disagrees with the calculator configuration");
      return product;
    } catch (error) {
      throw problem(`${path}/config`, error instanceof Error ? error.message : "Invalid saved calculator configuration");
    }
  }
  async document(input: unknown) {
    const intent = isRecord(input) && input.schemaVersion === 2;
    assertDocumentStructure(input, intent ? "intent" : "saved");
    const data = input as ResourceDocument;
    this.checkRelease(data.releaseId);
    const sourceLists = data.resourceType === "cart" ? [data.cart] : data.project.lists;
    if (sourceLists.reduce((sum, list) => sum + list.products.length, 0) > 1000) throw problem("/", "A document can contain at most 1000 products", "document.tooLarge");
    const issues: DocumentIssue[] = [];
    const lists = [];
    for (const [listIndex, list] of sourceLists.entries()) {
      const path = data.resourceType === "cart" ? "/cart" : `/project/lists/${listIndex}`;
      const products: ProductMutationBody[] = [];
      for (const [productIndex, product] of list.products.entries()) {
        try {
          products.push(intent ? await this.intentProduct(product, `${path}/products/${productIndex}`) : await this.savedProduct(product as unknown as ProductMutationBody, `${path}/products/${productIndex}`));
        } catch (error) {
          issues.push(...(error instanceof ResourceDocumentError ? error.issues : [{ path: `${path}/products/${productIndex}`, code: "configuration", message: error instanceof Error ? error.message : "Cannot calculate product" }]));
        }
      }
      lists.push({ name: list.name.trim(), products });
    }
    if (issues.length) throw new ResourceDocumentError(issues, this.release.id);
    const payload: ImportedResourcePayload = data.resourceType === "cart" ? { resourceType: "cart", ...lists[0] } :
      { resourceType: "project", name: data.project.name.trim(), description: data.project.description?.trim() || null, lists };
    const totals: Record<string, number> = {};
    for (const list of lists) for (const product of list.products) {
      const pricing = product.pricing as { amount: number; currency: string };
      totals[pricing.currency] = (totals[pricing.currency] ?? 0) + pricing.amount;
    }
    for (const currency of Object.keys(totals)) totals[currency] = Number(totals[currency].toFixed(6));
    const normalized = payload.resourceType === "cart" ? { schemaVersion: 1, resourceType: "cart", cart: { name: payload.name, products: payload.products } } :
      { schemaVersion: 1, resourceType: "project", project: { name: payload.name, description: payload.description, lists: payload.lists } };
    return { payload, normalized, totals, productCount: lists.reduce((sum, list) => sum + list.products.length, 0) };
  }
}

export function describeConfiguration(state: NativeState) {
  const enabled = state.fields.filter(field => !field.disabled && (field.type !== "select" || field.options?.some(option => !option.disabled)));
  return {
    controls: state.fields, notes: state.notes, diagnostics: state.diagnostics, availability: state.availability ?? null,
    quote: state.diagnostics.length ? null : state.quote, priceError: state.priceError ?? (state.diagnostics.length ? state.diagnostics.join("; ") : null),
    nextChoiceSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      oneOf: enabled.length ? enabled.map(field => ({
        type: "object", additionalProperties: false, required: ["field"],
        properties: {
          field: { const: field.id }, label: { const: field.label },
          ...(field.type === "select" ? {
            option: { enum: [...new Set(field.options!.filter(option => !option.disabled).map(option => option.label))] },
            value: { enum: field.options!.filter(option => !option.disabled).map(option => option.value) },
          } : { value: field.type === "number" ? { type: "number", ...(field.min !== undefined ? { minimum: field.min } : {}), ...(field.max !== undefined ? { maximum: field.max } : {}), ...(field.component === "global_QUANTITY" ? { multipleOf: 1 } : {}) } : field.type === "action" ? { const: true } : { type: "boolean" } }),
        },
        ...(field.type === "select" ? { oneOf: [{ required: ["option"], not: { required: ["value"] } }, { required: ["value"], not: { required: ["option"] } }] } : { required: ["field", "value"] }),
      })) : [false],
    },
  };
}
