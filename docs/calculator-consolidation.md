# One calculator workspace

The dashboard exposes **Calculator** and **Batch add**. The previous Huawei live / Price Calculator engine tabs are removed. Service search, the service selector, product heading, URL and official form use one selection. Native region and billing changes reopen an already loaded form; ordinary input changes update the same session. Opening the first form remains explicit so anonymous visitors do not consume a Chromium session just by loading the dashboard.

Huawei supplies the available inputs, regional billing modes, conditional behavior and current prices for new interactive configurations. New services appear through directory discovery. Original metadata supplies names, icons and identity aliases; aliases do not encode pricing or visibility rules. Removed-service bookmarks preserve their identity and report unavailability instead of becoming ECS.

## Module layout

| Module | Responsibility |
| --- | --- |
| `calculator/service-directory` | Service identity aliases, combined discovery metadata and region/billing identity conversion |
| `calculator/use-huawei-directory` | One directory load and retry for the dashboard; standalone preview can load its own |
| `dashboard/calculator-workspace` | One product heading, service selector and workflow tabs |
| `huawei-native/use-native-session` | Serialized interactions, scoped session lifecycle, saved selection restore and stale-response disposal |
| `huawei-native/native-draft` | A product configuration for the shared cart writer; no client price is authoritative |
| `calculators/native-calculator-panel` | Official controls, estimate and save/queue actions |
| `calculators/native-flavor-browser` / `huawei-native/native-flavor` | Catalog comparison and exact-SKU selection through actual official controls |
| `calculator/use-native-batch` / `calculators/native-batch-panel` | Mixed service/region/billing queue and acknowledged-write removal |
| `calculators/compatibility-calculator` | Original saved-item forms and services lacking an official calculator |
| `calculator/server-directory` | Public discovery and shared ECS regional scope validation |

The native session hook invalidates the displayed quote before requests. Numeric drafts invalidate it before submission. Scope changes discard old sessions; late open/restore responses are closed and cannot overwrite the current form. A saved selection is restored once, with its complete replay guards. Loading directory metadata later cannot reset that restored selection to defaults.

## Existing functionality

Original saved products retain their configuration, price, identifier and edit behavior. They open their original form within Calculator. Native saved products replay within the same workspace. Retired QuickJS imports retain the explicit review/reselect recovery flow. No saved data migration or guessed option mapping is performed.

Original text-batch formats remain available in the Batch add importer. These retain their existing parsers and compatibility pricing paths. Services without an official calculator, including the existing free-service information, retain their original behavior. These adapters are intentional backward compatibility, not another user-selectable calculator engine. Original API schemas and private pricing inputs remain accepted.

The native queue accepts configurations from all discovered services and billing modes. Each queue entry contains a durable selection without a browser session or captured client price. Saving uses fresh server verification and the shared cart writer. Each acknowledged success is removed immediately; a later failure leaves the remaining entries available for retry. Queue state lasts for the current page session; persisted cart products retain normal export/import/clone/share support.

The ECS flavor browser preserves text search, CPU/RAM filters, price/name/resource sorting, pagination and reference price comparisons. Its reference catalog loads only when expanded; reopening it reuses the same regional catalog. Catalog references cover compute only. Choosing a flavor drives Huawei's current architecture/type/generation/CPU/memory controls and verifies the exact resulting resource specification. Image variants or flavors that Huawei cannot reproduce are rejected; the official controls remain available after reopening. The complete saved estimate always comes from Huawei.

Flexus L's `FuncCombine` wrapper is supported through the same generic reader. Nested component types, unhandled inputs and widgets still block pricing. Optional EVS, HSS and CBR controls, duration and quantity remain official behavior.

Numeric `CommonInput` fields used by SFS Turbo and FunctionGraph expose Huawei's validation hint. Huawei executes the actual rule; rejected inputs block the quote. Enterprise Router and Cloud Bastion Host preserve Huawei's omission of zero-quantity inquiry components. Global Accelerator can use the billing sites present in its official product plans; every returned component must match the selected product's billing site and USD currency.

Public service discovery includes newly discovered services, native service codes, regional billing modes and the session interface. Native product schemas describe durable selections rather than pretending dynamic conditional controls have a fixed schema. Original schema URLs remain compatible. Both ECS catalog endpoints accept legacy region aliases and official region IDs; unknown IDs are rejected rather than falling back to Sao Paulo.

## Resource limits

The existing six-context sidecar capacity and inactivity/age limits remain. Forms open lazily; abandoned and stale sessions close promptly. The proxy allows twenty sequential opens/restores per IP per minute, within the existing sixty-request limit. Session cleanup remains available after the interactive limit is reached. This accommodates edits and service changes in the unified workflow without increasing concurrent Chromium capacity.

## Verification

Run all write scenarios against an isolated application database and sidecar:

- `bun run test`, `bunx tsc --noEmit`, `bun run lint`, production build. Keep Playwright specs in their Playwright runners.
- `NEO_NATIVE_TESTS=1 bunx playwright test --config tests/consolidated-calculator.config.ts`.
- `NEO_NATIVE_TESTS=1 bunx playwright test --config tests/playwright.config.ts`.
- `bunx playwright test --config tests/retired-calculator.config.ts`.
- `bunx playwright test --config tests/responsive.config.ts`.
- `bunx playwright test --config tests/native-dom.config.ts`.
- `NATIVE_BILLING_AUDIT_CASES=hcss/ap-southeast-1/PERIOD,hcss/ap-southeast-3/PERIOD bun run scripts/audit-native-billing.ts` compares Flexus L packages, optional components, annual terms and quantity against independent official calculator pages, then verifies replay and fresh saves.
- `bun run scripts/audit-native-coverage.ts` opens each previously supported paid service in an eligible official region. `NATIVE_COVERAGE_SERVICES=er,ga,cbh,sfsturbo,function` restricts the run for investigating controls. This checks one representative configuration per service; it is not an exhaustive test of every region, mode and combination.

This establishes the unified workflows and representative pricing parity. Unknown future Huawei controls and unavailable upstream pricing continue to fail closed.

The [release validation record](./calculator-consolidation-validation.json) records the service scopes, independent pricing cases, browser checks and deployed image identities from 2026-10-06.
