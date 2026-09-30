# Reliable complex forms: use Huawei's renderer

The ECS, ELB and DCS audit exposed a limit of the QuickJS interpreter: service configuration is only part of Huawei's behavior. The shared renderer implements dependent defaults, image filtering, repeatable disks, checkbox constraints, unit conversion and derived LCU quantities. Enumerating every flavor and numeric combination is both expensive and insufficient to recover those rules.

The isolated preview at `https://calculator-lab.hwctools.site/sync-lab` now uses a browser adapter. A short-lived anonymous Chromium context runs the official renderer; Neo renders its visible controls and sends validated interactions back to that context. The existing application and verified QuickJS path are preserved. The earlier captured comparison is available at `/sync-lab/audit`.

## Data and price flow

1. Discover the service directory and international HWC regions from Huawei's menu. This currently includes 97 calculator services and 24 eligible regions; the code does not maintain those lists manually.
2. Fetch the chosen service/region's configuration and products, plus the menu, calculator page and shared framework. Store immutable, content-addressed source snapshots. Menu, configuration and framework refresh on demand after six hours; product data refreshes after fifteen minutes. Prices are requested live.
3. Pin those source versions into an anonymous official calculator page. Source hashes accompany every returned state. The calculator HTML is pinned with its framework, preventing a fresh page from loading a different framework than the cached manifest. The requested region is checked against the product response and the resulting pricing request; a fallback to a different region cannot silently quote.
4. Read visible radio/select options, selection state, disabled choices, numeric bounds and units, checkboxes, repeatable disk actions, duration, quantity, purchase terms and payment options. Hidden fields are excluded. Unknown component types, unmapped inputs, unfamiliar interactive markup and missing selections block pricing.
5. Apply one validated action through the native control. Huawei computes the dependent fields and full pricing request, including every resource component. Neo does not implement ECS image rules or ELB LCU formulas a second time.
6. Observe Huawei’s own `queryPrice` aggregation through a version-checked framework wrapper. Each official inquiry receives a fresh, validated `QuoteGateway` response, preserving recurring rates and vendor metadata. Aggregate totals, complete component IDs, billing modes, scope, payment schedules and RI recurring rates are checked together. Network errors, HTTP 429 and server errors retry once; invalid requests and incomplete quote bodies do not. A later response cannot replace a newer selection. Changes during repricing invalidate the result. Saving reruns the vendor aggregation without altering controls.

No Cartesian enumeration is required to open a service. New services and regions enter the directory automatically. Services using supported controls can open immediately; a new control format fails closed rather than being published with guessed behavior. This does not guarantee support for every future Huawei widget without an adapter change.

## Boundaries and recovery

`NativeCalculator` owns source collection, browser sessions, interactions and pricing. `native-dom.ts` is the small seam tied to Huawei's UI markup. The Next.js API proxies a private sidecar; it never accepts client-supplied selectors, JavaScript, pricing payloads or source URLs.

Each session has an unpredictable ID, a revision, a single in-flight operation, a ten-minute idle limit and a thirty-minute absolute limit. Stale revisions, disabled options and out-of-range values are rejected. There are at most six sessions/openings per adapter process. Failed interactions close the affected context. Expired sessions are swept, and a disconnected browser is recreated on the next request. HTTP, browser and source operations have bounded timeouts; client failures are explicit, with no zero-price fallback. Requests are rate-limited at the app boundary.

The sidecar has a separate token, database and Docker network, no exposed host port, a memory/PID limit, health check and restart policy. It has no app account or cart volume. Browser traffic is restricted to Huawei domains and read-only pricing POSTs. The official page runs anonymously, not in a user's browser session.

The UI clears the previous quote as soon as a selection or numeric draft changes. Controls lock during evaluation. Invalid numeric drafts remain editable; valid changes replace the complete form and quote together. Closing the page releases the renderer; abandoned sessions expire automatically.

## Validation and reproduction

The live audit drives a separate official page with explicit Playwright clicks/fills, independently of the adapter's interaction driver. It compares semantic full inquiries, total amounts, every component amount and visible numeric input coverage. Both executions receive the same source snapshots to avoid mixing updates during a comparison. This is an independent execution comparison, not proof of every possible input combination.

```sh
HWC_SOCKS5_PROXY=socks5h://172.17.0.1:40001 bun scripts/audit-native-calculator.ts
bun run test
bunx playwright test --config tests/native-dom.config.ts
bunx playwright test --config tests/sync-lab.config.ts
bunx tsc --noEmit
bun run lint
```

The final run passed **81 independent comparisons in 337.5 seconds**: 30 ECS, 24 ELB, 15 DCS and 12 NAT cases. [The recorded validation summary](huawei-native-validation.json) includes source hashes, case names and amounts. The same version passed 282 unit tests, three browser fixture tests and four public-preview tests.

The integration audit covers ECS, ELB, DCS and NAT in Hong Kong, São Paulo and Singapore. ECS cases include Kunpeng, adding/resizing/removing disks, quantity and no EIP. ELB cases include derived TCP LCUs, HTTP, fixed and shared variants. DCS cases include version, master/standby and quantity. NAT cases include public/private and size. Every scope also changes duration. JSON evidence records source hashes and exact configurations, rather than claiming an entire region passed from a single default.

Browser fixture tests cover inline controls, disabled choices, repeated disk actions, globals omitted from service metadata, new widgets and unmapped inputs. Public preview tests cover the actual Neo UI, immediate price invalidation, invalid numeric drafts, mobile layout, directory discovery and API contract rejection. Existing unit suites continue to cover partial/duplicate/invalid quote responses and the earlier synchronization pipeline.

The older isolated preview deployment exposes **pay-per-use** only. The main Huawei live workspace supports all four billing families in Huawei’s international calculator menu: **pay-per-use, yearly/monthly, RI and one-time**. It depends on Huawei availability and Chromium, with a higher per-session resource cost than QuickJS. It is integrated into the main saved-cart flow through the Huawei live tab. It is not a guarantee of every flavor/region/billing-mode combination, or a claim that the older interpreter now supports ECS/ELB. Unsupported upstream changes stop quotes and require adapter support.

## Deployment

Set `SYNC_LAB_AUTH_SECRET`, a separate random `SYNC_LAB_NATIVE_TOKEN` (32+ characters), and `SYNC_LAB_DATA_DIR` in an external env file. The audit directory retains the earlier captured report and database for `/sync-lab/audit`.

```sh
docker compose --env-file /home/neo-calculator-lab.env -p neo-sync-lab -f compose.sync-lab.yml up -d --build
```

The sidecar listens only on the private Compose network. Traefik provides HTTPS and `noindex` for the app. To roll back, redeploy the previous app image and disable the native sidecar; production calculator data is separate.


## Main application deployment and saved configurations

The main application uses its own native sidecar, token and data volume. Set a random 32+ character `HUAWEI_NATIVE_TOKEN` in `/home/neo-calculator-native.env` (mode 0600). `compose.native.yml` documents the production overlay; the VPS parent Compose also references its sidecar service so normal app restarts preserve connectivity. No sidecar port is published. The app explicitly sets `traefik.docker.network=home_web`; otherwise Traefik can choose its private sidecar network after a recreate and lose public connectivity.

Native selections persist initial controls, an ordered action history and expected final controls. Reopening replays them against current collected sources, checking control identities and selected labels throughout. Saving refreshes the exact session revision on the server; stale revisions, incomplete quotes, changed defaults and unavailable choices reject the operation. The server strips session IDs before persistence. Sessions remain anonymous and contain no account/cart database access.

The main workspace preserves the legacy runtime and saved products alongside the native integration. New services are discoverable in the Huawei live service selector without adding local definitions. Unknown Huawei widgets continue to fail closed.

The integration rerun recorded **81 independent comparisons** across ECS, ELB, DCS and NAT in Hong Kong, São Paulo and Singapore; see `huawei-native-integration-validation.json`. São Paulo's ECS default aC8 currently renders empty disabled image selectors in Huawei. Neo blocks pricing for that incomplete form. The São Paulo ECS audit explicitly selects C7n and then exercises images, disks, Kunpeng, quantities and duration; the default aC8 state is not counted as a supported quote.

The integrated application also passes 335 unit tests and 16 isolated main-workspace scenarios, including native selection replay and authenticated/private API repricing. Invalid saved edit links display a recoverable configuration error. These checks complement the native DOM and preview suites; they do not establish exhaustive coverage of every service/region combination.

## Billing modes and payment schedules

Billing-mode availability is discovered from `regionOnline[region].common` in Huawei’s menu. Unsupported service/region/mode combinations are rejected before opening a browser. Yearly/monthly terms and RI payment/term choices are read from the official form, including globals rendered with `idheader` instead of an element ID. Modes are not inferred from a fixed local list of services.

RI prices can combine a zero upfront VM quote, recurring VM installments, and pay-per-use disks, images or EIP. Neo uses Huawei’s renderer to aggregate these components and displays the upfront/installment/extras schedule separately. It does not treat the latest single inquiry as the full price. RI product data refreshes on every open; recurring inquiry rates must match that catalog snapshot or the quote is blocked until reopened. Catalog-calculated components retain their vendor values and provenance. An unknown aggregation format fails closed.

Version 2 saved selections include the billing mode, term and payment-control history. Version 1 saved selections continue to replay as pay-per-use. All saves and edits receive a fresh server quote.

Run the independent billing audit with:

```sh
HWC_SOCKS5_PROXY=socks5h://172.17.0.1:40001 bun scripts/audit-native-billing.ts
```

The oracle uses the **unmodified** official pricing framework, pinned to the same public source versions. It compares complete inquiry sets, displayed totals and exact API totals for ordinary modes; RI installment totals are independently reconstructed from the official displayed upfront, recurring, extra and installment-count values. The audit also replays and freshly prices saved configurations.

Huawei’s current Hong Kong ECS RI data offers No Upfront for the checked flavors. Partial/All Upfront schedules are validated with unit fixtures and are exposed if the official service/region/flavor offers them. Empty image selectors in the official aC8 defaults continue to block quotes; the RI tests select C7n. Coverage is recorded in `huawei-native-billing-validation.json`; it does not establish exhaustive correctness for every service or future widget.

The billing run passed **24 independent official comparisons and 10 saved-selection replay checks**, plus three live regional/mode rejection checks, in 230.6 seconds. It covers ECS RI in Hong Kong and São Paulo, ECS/ELB/NAT yearly-monthly in Hong Kong, DCS yearly-monthly in Singapore, CCM/DEW one-time purchases in Hong Kong, and NAT pay-per-use. All four modes passed main-cart save/edit tests; regional choices and switching an open mode were also tested. The resulting suite has 347 passing unit tests, four DOM fixtures and 20 distinct isolated app scenarios.

The additional pay-per-use regression passed **27 independent comparisons in 101.0 seconds** across ECS, ELB, DCS and NAT in Hong Kong. It verifies complete inquiries, exact totals and charged components; the full renderer also retains zero-price catalog image components that the rating API omits.
