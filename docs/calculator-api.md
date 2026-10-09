# Calculator API

The REST calculator and API-key product saves reconstruct prices with the same local snapshot engine used by the standalone calculator. They do not open a server browser or contact Huawei while calculating. Huawei access belongs to the daily synchronization worker.

## Discovery and configuration

- `GET /api/v1/public/services` lists published services, aliases, schema URLs and calculator metadata. `pricingUrl` is `/api/v1/calculate` and `pricingMethod` is `POST`.
- `GET /api/v1/public/regions` lists only regions in the published snapshot. `id` and `catalogRegionId` are canonical Huawei IDs; `code` preserves a legacy alias where available.
- `GET /api/v1/public/services/{serviceCode}/schema` resolves service aliases to a canonical `HUAWEI:<id>` code and describes the required product configuration. Its calculator metadata includes billing availability by region, a local calculator URL and catalog URL. It never advertises a server session.
- `GET /api/v1/public/catalog/{service}?region=<region>` returns that scope's raw product catalog, conditional configuration, billing modes and snapshot identity. If region is omitted, it chooses the service's first published region. Unknown regions return 400; unavailable service/region combinations return 422. Native region IDs and legacy region aliases are accepted.
- The previously advertised `/api/v1/public/catalog/{service}/pricing` remains a compatibility alias for the catalog endpoint.

Configuration must include `config.region`, `config.billingMode`, `config.selection` and `config.local`. `local` contains the snapshot `release`, selected pricing products and captured pricing `inquiries` emitted by the local calculator. The conditional fields come from Huawei's synchronized rules and vary by service, region and billing mode; a flat legacy configuration containing only a flavor name is insufficient.

Use the complete configuration produced by the calculator. The server verifies its pricing scope and reconstructs resource prices from snapshot rates. Client monetary totals, currencies and top-level quantities are not authoritative. The saved global quantity must agree with Huawei's purchase quantity and scaled component counts. Resource-specific quantities in services without a global quantity remain part of their pricing components.

## Calculation

`POST /api/v1/calculate` requires an `X-API-Key` header and accepts `{ "products": [product, ...], "region": "optional-region-constraint" }`. Each product requires `serviceCode` and `config`; service name and title can be supplied. The batch must contain 1–100 products. The optional region constraint is validated against every product and never silently falls back to another region.

A successful entry contains canonical service identity, verified quantity, normalized configuration and `pricing.amount`, `pricing.currency`, `pricing.total`, the component breakdown and any RI/installment payment schedule. No additional multiplication by top-level quantity is needed: the returned amount already includes the configured quantities, duration and resources.

All entries use one captured, complete published snapshot, including when a daily synchronization publishes a new release during the request. API calculation and API-key saves use current rates. Existing selections can be repriced when conditional rules are unchanged; if their conditional configuration, framework or bridge changes, they must be reopened before repricing. Session-authenticated UI saves preserve the snapshot shown in the UI, so a pinned quote can intentionally retain its original price after a daily rate update.

| Status | Meaning |
| --- | --- |
| 200 | Every product was verified and priced. |
| 207 | Mixed batch: successful entries plus per-product errors. Failed entries have `pricing: null`. |
| 400 | Malformed JSON/body/product, invalid quantity, invalid region or batch bounds. The batch is not calculated. |
| 401 | Missing or invalid API key. |
| 422 | No products could be verified; `results` contains the reasons. |
| 503 | No published snapshot is available. |

## Saving and updating

API-key creation and update routes use the same current-rate verification. A service alias accompanied by local snapshot configuration is canonicalized before pricing and cannot fall through to the legacy pricing implementation. Session-authenticated creation and update routes apply the same input and quantity checks while retaining the UI's pinned snapshot.

Malformed identities, titles, configurations and top-level quantities return client errors rather than throwing string-access exceptions. Monetary tampering cannot replace server-calculated prices. Inconsistent form/purchase/component quantities return 422 instead of persisting a count that disagrees with its price.

## Regression coverage

`tests/standalone-api.playwright.ts` exercises discovery/schema URLs, catalog compatibility, region validation, repeated calculations, both authentication methods' saves and updates, multi-instance configurations, malformed and tampered inputs, aliases, mixed batches and API documentation. `tests/standalone-all-services.playwright.ts` compares API prices with each quotable published service's local form, including global quantity edits where available; official informational/unavailable states remain unpriced.

Unit tests cover shared input validation, service identity resolution, quantity reconstruction and pinned/current/batch snapshot transitions. Run browser tests against an isolated local deployment with its own database and a complete validated snapshot, never against production accounts.
