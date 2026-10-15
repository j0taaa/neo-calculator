# Resource JSON for agents

Download `GET /api/v1/cart/schema` (or `?download=1`). The document is a self-contained JSON Schema draft 2020-12 with no external `$ref`s. It includes all published services, regions, billing modes, an example, and `x-neo` instructions and endpoint URLs. Availability follows each published daily snapshot automatically, including new services. No hand-written service schemas are needed.

The schema validates structure and service/region/billing combinations. Service rules can reveal controls and change option lists after a choice. These conditions and prices are evaluated by Neo's local engine through the endpoints below, rather than pretending that a static list of fields proves a valid quotation. An agent needs HTTP access to Neo to discover choices and verify its document; it does not need the UI, Chromium, a Huawei API, or a fabricated price proof.

The **Import Cart** and **Import Project** menus open a shared popup on both the calculator and Projects page. It fetches the current published schema each time it opens, with copy, download, preview and refresh controls. Select **Choose JSON file** to continue importing. A schema loading failure does not block an existing-file import, and cancelling the file picker keeps the popup open.

## Agent workflow

1. Fetch the schema. Choose a canonical `HUAWEI:<service>` code and a supported region and mode. Use its `x-neo.releaseId` throughout drafting to detect a daily publication.
2. POST `/api/v1/cart/configure` with `{ "releaseId": "<schema release>", "product": { "serviceCode": "HUAWEI:ecs", "region": "ap-southeast-1", "billingMode": "ONDEMAND", "choices": [] } }`. Use a scope actually listed in the downloaded schema. Read `controls`, including labels, enabled options, limits and defaults. `nextChoiceSchema` describes the next choice for this state.
3. Add choices in dependency order and send the complete choices array again. Use `{ "field": "<returned id>", "option": "<exact enabled label>" }` for selects, `{ "field": "<id>", "value": 720 }` for numbers and booleans for checkboxes. Actions require `value:true`; they can expose repeatable controls such as additional data disks. Discover again after changing a parent. Optional `label` guards against an ID referring to a different control. Exact option values are also accepted for selects; they belong to that release and state, so labels are preferred. For detailed specifications such as ECS vCPUs/RAM, use the returned `catalogUrl` and match `resourceSpecCode` and `productSpecSysDesc` to enabled choices. The catalog comes from the local snapshot; `specDesc` is empty.
4. Assemble a cart or project and POST the entire document to `/api/v1/cart/validate`. No authentication is needed, and nothing is saved. `valid:true` returns canonical, independently priced `normalized` JSON and `totals` grouped by currency. On HTTP 422, use the `errors[].path` JSON Pointers and messages to fix the document. Dependency changes that reset a requested child value are rejected. Explicitly restate that child after its parent.
5. Import the JSON file in the signed-in application, or POST `/api/v1/private/import` with `X-API-Key` and `{ "payload": document, "targetProjectId": "<project id>" }` for a cart. A project needs only `{ "payload": document }`. The signed-in `/api/import` uses the same validator. The original v2 document preserves the release guard; normalized v1 output is a portable saved export and is repriced against the active release when imported.

```json
{
  "schemaVersion": 2,
  "resourceType": "cart",
  "cart": {
    "name": "Application servers",
    "products": [
      {
        "serviceCode": "HUAWEI:ecs",
        "region": "ap-southeast-1",
        "billingMode": "ONDEMAND",
        "title": "Web servers",
        "choices": [
          { "field": "global_ONDEMANDTIME:0", "value": 720 },
          { "field": "global_QUANTITY:0", "value": 2 }
        ]
      }
    ]
  }
}
```

An empty `choices` array explicitly accepts calculator defaults. Different products can use different services, regions and billing modes. A project replaces `cart` with `project: { name, description?, lists: [cart, ...] }` and `resourceType` with `project`. Empty carts/projects are permitted. Limits: 1,000 total products, 100 carts in a project, 200 choices per product, 2 MB per endpoint request. A calculator field called Quantity is part of the configuration; there is no separate outer multiplier. Returned prices already include quantities and duration. Mixed currencies are never added together.

## Saved export compatibility and atomic imports

Existing schemaVersion:1 cart/project exports remain importable when they contain a replayable independent configuration or a supported former live selection. Metadata and copied monetary totals never determine prices. Imports reconstruct every product using one active release before writing anything. Negative/fractional quantities, unknown services, unsupported scopes, unavailable choices and malformed configurations are rejected; any failed item rejects the whole document. Older flat configurations that cannot be reconstructed receive an explicit error instead of importing an unverified price. Reopen and save those items in the independent calculator to obtain a replayable export.

`releaseId` is an optional active-release guard, not permission to use arbitrary old prices. A stale guard returns `catalog.changed`. Missing local rules/catalog returns 503; invalid JSON or configurations return 422; exceeding request size or total product limits returns 413. Read-only validation is stateless and performs no upstream requests.
