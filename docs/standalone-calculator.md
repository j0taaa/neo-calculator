# Daily synchronization and independent calculation

Neo owns its controls, conditional state machine, resource selection and pricing. Opening a service loads an immutable JSON model from Neo once; subsequent option, duration and quantity changes run locally. There is no iframe, Huawei/Vue/TinyVue application, live rating API, server browser session, DOM extraction or upstream JavaScript evaluation in the application. The server reconstructs submitted selections using the same engine and published rates.

## Daily worker

`bun run sync:calculator` performs an immediate synchronization. `Dockerfile.sync` runs `scripts/run-calculator-sync.ts`: jobs start every 24 hours after success, failures retry after one hour, and a process lease prevents overlapping jobs. Chromium runs exclusively in this worker as an extraction and comparison oracle; the app mounts snapshots read-only and does not contain Chromium.

Discovery reads the official international calculator menu, including services, eligible regions, partner billing sites, online/beta offers, billing modes and HomeZones. Regional configuration can further restrict those offers. Newly advertised services enter the same pipeline automatically.

The worker fetches fresh service configuration, regional products and prices. It compiles pure service functions into a restricted JSON instruction format that preserves closures, source dependencies, conditional views, resource transforms, validation and defaults. Neo's bounded interpreter evaluates those instructions using its own generic and specialized controls. It has no DOM, network, filesystem, dynamic code or arbitrary global access.

The oracle records defaults and dependency ordering across conditional branches, then compares Neo's independently generated options, limits, billing terms, resource dimensions and prices. Catalog contracts check additional unselected SKUs using proven inquiry shapes. Fresh official rating responses verify rates, tier boundaries, quantity/usage conversions, payment terms and rounding corrections. Unchanged scopes still receive fresh price checks. Support-plan arithmetic is extracted and checked against the official configuration.

Unknown syntax, widgets, rule behavior, billing modes, dependencies or prices fail validation. A complete release must pass every advertised service/region/mode and eligible zone before its pointer is atomically replaced. Failed audits retain the previous independent release. There is no live or upstream-UI fallback. Resume evidence must match source and validator fingerprints and be younger than 24 hours.

## Application

`lib/calculator-rules/engine.ts` has no I/O and runs in the browser and server. The existing React panel and ECS flavor cards display its controls. Models are cached by immutable release and content hash. Changing options, duration or quantity performs no HTTP request. Failed rule evaluation restores the last successful state.

The only calculator model route is `/api/calculator/snapshot/<release>/model/<scope-hash>`. It returns JSON rules, published products/rates and menu labels, excluding upstream configuration source and audit evidence. Frame, bridge, asset and executable-data routes return 410. The generated bridge is removed from the application image.

Versioned selections record initial choices, interactions and final choices without persistent vendor sessions. Save and repricing APIs reconstruct choices, resources and totals on the server. Client totals and resource specifications are never authoritative. Quantity proofs are checked against reconstructed counts because service transforms can change counts for duration, clusters and IOPS. Previously saved upstream-replay releases migrate through the independent engine; unavailable choices require review.

An explicit export to Huawei’s own cart remains an online integration; it is never used to calculate Neo prices.

Prices reflect the last successfully synchronized catalog. Currency arithmetic uses exact decimal ratios and independently verified Huawei rounding, tiers, discounts, installments and recurring/one-time components. A failed daily job cannot silently refresh only part of a published release.

## Verification

The current migration and deployment results are recorded in [the independent-engine validation report](independent-calculator-validation.json). Earlier iframe-based reports are historical and do not prove independence.

Run unit tests, TypeScript, lint and a production build. Run the `tests/standalone-*.playwright.ts` suite against an isolated app database, including API consistency/tampering, all-service discovery, billing modes, regional conditions, save/edit/import/export and legacy selections.

Independence must be proved with an application container on an internal Docker network and browser tests that block all HTTP after a scope opens. Check zero iframes, no vendor asset requests, no calculation POST requests and identical locally calculated prices. A partially compiled catalog is suitable only for private development tests. Historical results from the retired iframe implementation are not independent-engine validation evidence.
