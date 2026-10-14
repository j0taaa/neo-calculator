import Ajv from "ajv/dist/2020";
import type { SnapshotRelease } from "../huawei-snapshot/types";
import { nativeBillingModes } from "../huawei-native/native-billing";
import { ResourceDocumentError } from "./types";

const text = { type: "string", minLength: 1, maxLength: 300, pattern: "\\S" };
const hash = { type: "string", pattern: "^[a-f0-9]{64}$" };
const ref = (name: string) => ({ $ref: `#/$defs/${name}` });
const product = {
  type: "object", additionalProperties: false,
  required: ["serviceCode", "region", "billingMode", "choices"],
  properties: {
    serviceCode: text, region: text, billingMode: { enum: Object.keys(nativeBillingModes) }, title: text,
    choices: { type: "array", maxItems: 200, items: ref("choice"), description: "Ordered changes, applied to the current controls. An empty array explicitly accepts all defaults. Rediscover controls after a choice changes dependencies." },
  },
};
const cart = { type: "object", additionalProperties: false, required: ["name", "products"],
  properties: { name: text, products: { type: "array", maxItems: 1000, items: ref("product") } } };

/** A standard, self-contained JSON Schema. No external $refs or UI state required. */
export const resourceDocumentSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "NeoCalculator resource document",
  description: "Generate a cart or project from local published calculator options. Validate its structure with this schema, then submit it to the validation endpoint for conditional options and authoritative local prices. Prices are output, never input.",
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "resourceType"],
  properties: {
    $schema: { type: "string" }, schemaVersion: { const: 2 }, releaseId: hash,
    resourceType: { enum: ["cart", "project"] }, cart: ref("cart"), project: ref("project"),
  },
  oneOf: [
    { required: ["cart"], properties: { resourceType: { const: "cart" } }, not: { required: ["project"] } },
    { required: ["project"], properties: { resourceType: { const: "project" } }, not: { required: ["cart"] } },
  ],
  $defs: {
    choice: {
      type: "object", additionalProperties: false, required: ["field"],
      properties: {
        field: { ...text, description: "Exact field ID returned by configure. Repeated IDs are allowed for actions or dependency changes." },
        label: { ...text, description: "Optional exact label guard: reject if the same field ID now refers to a different control." },
        option: { ...text, maxLength: 2000, description: "Exact enabled option label returned by configure; preferred for select controls." },
        value: { type: ["string", "number", "boolean"], description: "Number for numeric controls, boolean for checkboxes, true to invoke an action, or a select's exact option value from this release." },
      },
      oneOf: [{ required: ["option"], not: { required: ["value"] } }, { required: ["value"], not: { required: ["option"] } }],
    },
    product, cart,
    project: {
      type: "object", additionalProperties: false, required: ["name", "lists"],
      properties: { name: text, description: { type: ["string", "null"], maxLength: 4000 }, lists: { type: "array", maxItems: 100, items: ref("cart") } },
    },
    configureRequest: {
      type: "object", additionalProperties: false, required: ["product"],
      properties: { releaseId: hash, product: ref("product") },
    },
  },
};

// Saved files keep their original metadata. Configuration and money are checked
// by the same engine as v2 intents, rather than inferred from loose JSON types.
const savedProduct = { type: "object", required: ["serviceCode", "serviceName", "productType", "title", "quantity", "config"],
  properties: { serviceCode: text, serviceName: text, productType: text, title: text,
    quantity: { type: "integer", minimum: 1, maximum: 9999 }, config: { type: "object" }, pricing: {},
  } };
const savedCart = { type: "object", required: ["name", "products"], properties: {
  name: text, products: { type: "array", maxItems: 1000, items: savedProduct },
} };
export const savedDocumentSchema = {
  $schema: resourceDocumentSchema.$schema, type: "object", required: ["resourceType"],
  properties: { schemaVersion: { const: 1 } },
  oneOf: [
    { required: ["cart"], properties: { resourceType: { const: "cart" }, cart: savedCart } },
    { required: ["project"], properties: { resourceType: { const: "project" }, project: {
      type: "object", required: ["name", "lists"], properties: {
        name: text, description: { type: ["string", "null"], maxLength: 4000 }, lists: { type: "array", maxItems: 100, items: savedCart },
      },
    } } },
  ],
};
const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
const validators = {
  intent: ajv.compile(resourceDocumentSchema),
  saved: ajv.compile(savedDocumentSchema),
  configure: ajv.compile({ ...resourceDocumentSchema, required: ["product"], properties: resourceDocumentSchema.$defs.configureRequest.properties, oneOf: undefined }),
};
export function assertDocumentStructure(value: unknown, kind: keyof typeof validators) {
  const validate = validators[kind];
  if (!validate(value)) throw new ResourceDocumentError((validate.errors ?? []).slice(0, 30).map(error => ({
    path: error.instancePath + (error.keyword === "required" ? `/${error.params.missingProperty}` : error.keyword === "additionalProperties" ? `/${error.params.additionalProperty}` : ""),
    code: `schema.${error.keyword}`, message: error.message ?? "Invalid JSON structure",
  })));
}

/** Resolve public links without leaking the proxy's internal origin or port. */
export function resourceSchemaOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol === "https" || forwardedProtocol === "http" ? forwardedProtocol : url.protocol.slice(0, -1);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ?? request.headers.get("host") ?? url.host;
  // Parse a fresh URL: assigning URL.host on an internal :3000 URL retains
  // that port when a forwarded public host contains no explicit port.
  return new URL(`${protocol}://${host}`).origin;
}
/** Availability is regenerated from the published release, including new services. */
export function publishedResourceSchema(release: SnapshotRelease, baseUrl: string) {
  const services = release.directory.services.filter(service => Object.keys(release.scopes).some(scope => scope.startsWith(`${service.id}/`)));
  const availability = services.map(service => ({
    serviceCode: `HUAWEI:${service.id}`, name: service.name,
    catalogUrl: `${baseUrl}/api/v1/public/catalog/${encodeURIComponent(`HUAWEI:${service.id}`)}`,
    regions: Object.entries(release.directory.billingModes[service.id] ?? {})
      .filter(([region]) => Boolean(release.scopes[`${service.id}/${region}`]))
      .map(([region, billingModes]) => ({ region, billingModes })),
  }));
  const definitions = { ...resourceDocumentSchema.$defs, product: {
    ...product, properties: { ...product.properties, serviceCode: { enum: availability.map(service => service.serviceCode) } },
    allOf: availability.map(service => ({
      if: { properties: { serviceCode: { const: service.serviceCode } } },
      then: { oneOf: service.regions.map(scope => ({ properties: { region: { const: scope.region }, billingMode: { enum: scope.billingModes } } })) },
    })),
  } };
  const exampleScope = availability.find(service => service.serviceCode === "HUAWEI:ecs") ?? availability[0];
  const example = exampleScope?.regions[0];
  return {
    ...resourceDocumentSchema, $id: `${baseUrl}/api/v1/cart/schema`, $defs: definitions,
    examples: example ? [{ schemaVersion: 2, releaseId: release.id, resourceType: "cart", cart: { name: "Generated quotation", products: [{ serviceCode: exampleScope.serviceCode, region: example.region, billingMode: example.billingModes[0], choices: [] }] } }] : [],
    "x-neo": {
      releaseId: release.id, publishedAt: release.createdAt,
      regions: release.directory.regions, services: availability,
      endpoints: {
        configure: { method: "POST", url: `${baseUrl}/api/v1/cart/configure`, requestSchema: "#/$defs/configureRequest", authentication: "none", description: "Send {releaseId, product}. Returns all current controls, enabled options, limits, defaults and a schema for the next choice. Replay the full choices array on every request; no browser or session required." },
        validate: { method: "POST", url: `${baseUrl}/api/v1/cart/validate`, authentication: "none", description: "Send the entire resource document. HTTP 200 valid:true returns normalized importable JSON and locally calculated totals by currency. HTTP 422 valid:false returns JSON Pointer errors. Does not save anything." },
        import: { method: "POST", url: `${baseUrl}/api/v1/private/import`, authentication: "X-API-Key", description: "Send {payload: document, targetProjectId} for a cart, or {payload: document} for a project. Revalidates and calculates all items before writing. The signed-in UI accepts the same JSON file." },
      },
      workflow: [
        "Choose a serviceCode, region and billingMode from the schema. Include releaseId to reject catalog changes while drafting.",
        "Call configure with choices:[] to discover the scope's controls and defaults. Informational or unavailable scopes cannot be quoted.",
        "For detailed specification attributes (for example ECS vCPUs/RAM), fetch the service's catalogUrl with ?region=<region>. Match resourceSpecCode and productSpecSysDesc to the current enabled choices. specDesc is empty; do not use it. The catalog is local snapshot data.",
        "Add choices in dependency order using field IDs and exact option labels. Call configure again after changing a parent option or adding an action to discover newly visible controls. Never invent option indexes or prices.",
        "Numeric values must respect reported limits. Quantity is a calculator field, not a multiplier outside the configuration. Actions use value:true and may reveal repeatable controls, such as additional data disks.",
        "The nextChoiceSchema is valid only for the returned state. Missing choices explicitly keep defaults. A later dependency change that resets an earlier requested value is rejected; restate that field after the change.",
        "Validate the final cart or project. Fix errors until valid:true, then import it using your account or API key. Prices are always reconstructed locally; no upstream requests occur.",
        "This schema checks structure and published scope availability. Conditional choices and prices require the configure/validate endpoints; JSON Schema alone does not execute service rules.",
      ],
      limits: { totalProducts: 1000, choicesPerProduct: 200, documentBytes: 2000000 },
    },
  };
}
