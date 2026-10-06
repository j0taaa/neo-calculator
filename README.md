# Neo Calculator

A better version of the Huawei Cloud pricing calculator. Uses the Huawei Cloud calculator API to fetch real-time pricing for 40+ Huawei Cloud products and presents them in a streamlined dashboard.

## Features

- Real-time pricing from the Huawei Cloud calculator API
- 40+ supported cloud services with declarative configuration
- Huawei live: pay-per-use, yearly/monthly, reserved instances and one-time billing, with regional availability and current purchase/payment options
- Save configurations into projects
- Clone carts across regions and billing modes
- Export projects as JSON or Excel
- Share projects via links

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Runtime:** Bun
- **UI:** React + shadcn/ui + Tailwind CSS
- **Database:** SQLite (better-auth sessions)
- **Testing:** Bun test + Playwright (E2E)

## Getting Started

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running Tests

```bash
bun test
```

## Adding a New Service

Services are defined declaratively in `config/services/<service>/bundle.ts`. Each bundle contains:

1. **service** - UI field definitions, billing options, defaults
2. **pricing** - Rate sources and pricing metrics
3. **catalogDefinition** - How to fetch and parse raw Huawei API data
4. **runtime** - Reactive runtime logic for computed values, estimates, hydration

See `config/services/dcs/bundle.ts` as the reference implementation.

## Docker

```bash
docker build -t neo-calculator .
docker run -p 3000:3000 -e BETTER_AUTH_SECRET=your-secret-here neo-calculator
```

## Project Structure

| Directory | Purpose |
|---|---|
| `app/` | Next.js pages and API routes |
| `config/services/` | Declarative service bundles |
| `lib/` | Core engine, pricing, catalog fetchers |
| `components/` | UI components |
| `tests/` | Pricing and E2E tests |

## Architecture and regression checks

`config/services/bundles.ts` is the single list of configurable implementations.
Register a bundle there to expose its definition, runtime, declarative catalog fetcher,
and `/api/catalog/<runtime.catalog.route>` endpoint. The catalog directory in
`config/services/index.ts` also lists products without calculators; keep that display
metadata up to date when adding a product.

- `lib/service-runtime.ts` provides the pure evaluation scope and catalog-view logic
  shared by browser and server pricing. React state and effects stay in
  `lib/use-configurable-service-runtime.ts`.
- `lib/catalog-fetch-registry.ts` derives fetchers from bundle catalog definitions.
  Its explicit adapters are for existing custom response parsers.
- The dynamic catalog route preserves existing endpoint names. ECS, full export,
  and Global Accelerator retain their specialized routes.
- Older bundles still use `legacy-runtime-converter.ts`; their converted definitions
  go through the same runtime interface. New bundles should follow DCS.
- `service-registry.test.ts` checks every service directory, runtime, helper reference,
  and catalog adapter. `service-runtime.test.ts` checks calculations, saved products,
  and edit hydration against fixed pre-refactor results.

Run `bun run test`, `bunx tsc --noEmit --incremental false`, and `bun run lint`.
The deterministic fixtures test regressions, not current Huawei price freshness;
`bun run test:pricing` checks the existing VPN cases against Huawei's inquiry API.

For browser regressions, run an isolated local instance with an empty database,
then run `NEO_TEST_URL=http://127.0.0.1:3308 bunx playwright test --config tests/playwright.config.ts`.
This suite creates temporary accounts and carts, verifies saving/editing and batch
pricing, exercises both clone endpoints and API-key pricing, and checks sharing
and export/import. Its calculator fixtures avoid dependence on changing prices;
the catalog route and API-key scenarios still require Huawei network access.

## Unified calculator and Huawei synchronization

The unified Calculator tab uses Huawei's official renderer in a private Chromium sidecar. Services, regions, dependent controls and billing modes are discovered from Huawei's sources; prices are fetched freshly after changes and again on save. Shared source collection and caching live in `lib/huawei-native`; no QuickJS publication worker is required.

The former `/synchronized` calculator has been retired. Old links redirect into the live workspace. Imported old estimates remain readable and preserve their original configuration; edit them in the Calculator tab and review the reselected options before saving a freshly verified replacement. Old calculator option IDs cannot safely be treated as live replay instructions.

See the [live calculator guide](docs/huawei-native-calculator.md) and [retirement and compatibility notes](docs/synced-calculator-retirement.md).

The Calculator and Batch add tabs share one service selection. ECS flavor search applies real Huawei options and verifies the exact SKU. Queue configured items from any service, region or billing mode for a batch; the server checks fresh prices when saving. Existing saved estimates and text batches remain compatible without a second calculator tab. Old `tab=huawei-live` bookmarks normalize to `tab=calculator`.

See [the consolidation design](docs/calculator-consolidation.md) for the module layout and compatibility paths.
