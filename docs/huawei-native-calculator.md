> The daily standalone implementation supersedes the interactive Chromium transport described below. See [standalone calculator architecture](standalone-calculator.md) for the current implementation and rollout status. Historical validation in this document applies to the earlier transport.

> Historical documentation: the live browser renderer described below has been retired. Use [the independent daily calculator architecture](standalone-calculator.md) for current behavior and deployment.

# Reliable complex forms: use Huawei's renderer

The ECS, ELB and DCS audit exposed a limit of the QuickJS interpreter: service configuration is only part of Huawei's behavior. The shared renderer implements dependent defaults, image filtering, repeatable disks, checkbox constraints, unit conversion and derived LCU quantities. Enumerating every flavor and numeric combination is both expensive and insufficient to recover those rules.

The isolated preview at `https://calculator-lab.hwctools.site/sync-lab` now uses a browser adapter. A short-lived anonymous Chromium context runs the official renderer; Neo renders its visible controls and sends validated interactions back to that context. The main workspace uses this same adapter through its unified Calculator tab; its service, region and billing selection are shared with the dashboard. The older QuickJS calculator and captured audit UI have been retired; `/synchronized` and `/sync-lab/audit` redirect to the unified Calculator workspace.

## Data and price flow

1. Discover the service directory and international HWC regions from Huawei's menu. This currently includes 97 calculator services and 24 eligible regions; the code does not maintain those lists manually.
2. Fetch the chosen service/region's configuration and products, plus the menu, calculator page and shared framework. Store immutable, content-addressed source snapshots. Menu, configuration and framework refresh on demand after six hours; product data refreshes after fifteen minutes. Prices are requested live.
3. Pin those source versions into an anonymous official calculator page. Source hashes accompany every returned state. The calculator HTML is pinned with its framework, preventing a fresh page from loading a different framework than the cached manifest. The requested region is checked against the product response and the resulting pricing request; a fallback to a different region cannot silently quote.
4. Read visible radio/select options, selection state, disabled choices, numeric bounds and units, checkboxes, repeatable disk actions, duration, quantity, purchase terms and payment options. Hidden fields are excluded. Unknown component types, unmapped inputs, unfamiliar interactive markup and missing required selections block pricing. Empty selectors explicitly disabled by Huawei require no selection; they stay disabled and display an unavailable hint. They do not bypass price completeness checks.
5. Apply one validated action through the native control. Huawei computes the dependent fields and full pricing request, including every resource component. Neo does not implement ECS image rules or ELB LCU formulas a second time.
6. Observe Huawei’s own `queryPrice` aggregation through a version-checked framework wrapper. Each official inquiry receives a fresh, validated `QuoteGateway` response, preserving recurring rates and vendor metadata. Aggregate totals, complete component IDs, billing modes, scope, payment schedules and RI recurring rates are checked together. Network errors, HTTP 429 and server errors retry once; invalid requests and incomplete quote bodies do not. A later response cannot replace a newer selection. Changes during repricing invalidate the result. Saving reruns the vendor aggregation without altering controls.

No Cartesian enumeration is required to open a service. New services and regions enter the directory automatically. Services using supported controls can open immediately; a new control format fails closed rather than being published with guessed behavior. This does not guarantee support for every future Huawei widget without an adapter change.

## Boundaries and recovery

`NativeCalculator` owns source collection, browser sessions, interactions and pricing. `native-dom.ts` is the small seam tied to Huawei's UI markup. The Next.js API proxies a private sidecar; it never accepts client-supplied selectors, JavaScript, pricing payloads or source URLs.

Each session has an unpredictable ID, a revision, a single in-flight operation, a ten-minute idle limit and a thirty-minute absolute limit. Stale revisions, disabled options and out-of-range values are rejected. There are at most six sessions/openings per adapter process. Failed interactions close the affected context. Expired sessions are swept, and a disconnected browser is recreated on the next request. HTTP, browser and source operations have bounded timeouts; client failures are explicit, with no zero-price fallback. Requests are rate-limited at the app boundary.

The server needs headless Chromium to execute Huawei's official form and pricing logic. The sidecar includes Chromium and launches it automatically on demand; no desktop browser or browser on the user's computer is required. Directory, configuration, product and framework updates are fetched through server HTTP requests with their respective cache lifetimes. Opening or changing a live configuration runs the official logic in the server browser and sends fresh pricing inquiries. Source discovery itself does not require Chromium.

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

Browser fixture tests cover inline controls, disabled choices, repeated disk actions, globals omitted from service metadata, new widgets and unmapped inputs. Public preview tests cover the actual Neo UI, immediate price invalidation, invalid numeric drafts, mobile layout, directory discovery and API contract rejection. Unit suites cover fresh inquiries, partial/duplicate/invalid quote responses, source caching and old-estimate recovery.

An already-running older isolated preview deployment may expose **pay-per-use** only; rebuilding it uses the current adapter. The main Huawei live workspace supports all four billing families in Huawei’s international calculator menu: **pay-per-use, yearly/monthly, RI and one-time**. It depends on Huawei availability and Chromium, with a higher per-session resource cost than source-only HTTP collection. It is integrated into the main saved-cart flow through the Huawei live tab. It is not a guarantee of every flavor/region/billing-mode combination, or a claim that the older interpreter now supports ECS/ELB. Unsupported upstream changes stop quotes and require adapter support.

## Deployment

Set `SYNC_LAB_AUTH_SECRET` and a separate random `SYNC_LAB_NATIVE_TOKEN` (32+ characters) in an external env file. The current preview no longer mounts the retired audit database.

```sh
docker compose --env-file /home/neo-calculator-lab.env -p neo-sync-lab -f compose.sync-lab.yml up -d --build
```

The sidecar listens only on the private Compose network. Traefik provides HTTPS and `noindex` for the app. To roll back, redeploy the previous app image and disable the native sidecar; production calculator data is separate.


## Main application deployment and saved configurations

The main application uses its own native sidecar, token and data volume. Set a random 32+ character `HUAWEI_NATIVE_TOKEN` in `/home/neo-calculator-native.env` (mode 0600). `compose.native.yml` documents the production overlay; the VPS parent Compose also references its sidecar service so normal app restarts preserve connectivity. No sidecar port is published. The app explicitly sets `traefik.docker.network=home_web`; otherwise Traefik can choose its private sidecar network after a recreate and lose public connectivity.

Native selections persist initial controls, an ordered action history and expected final controls. Reopening replays them against current collected sources, checking control identities and selected labels throughout. Saving refreshes the exact session revision on the server; stale revisions, incomplete quotes, changed defaults and unavailable choices reject the operation. The server strips session IDs before persistence. Sessions remain anonymous and contain no account/cart database access.

The main workspace preserves the original declarative calculators and saved products alongside the native integration. The separate QuickJS synchronization runtime has been removed; old synchronized estimates use the recovery editor described in [retirement notes](synced-calculator-retirement.md). New services are discoverable in the Huawei live service selector without adding local definitions. Unknown Huawei widgets continue to fail closed.

The integration rerun recorded **81 independent comparisons** across ECS, ELB, DCS and NAT in Hong Kong, São Paulo and Singapore; see `huawei-native-integration-validation.json`. That historical run used C7n for São Paulo ECS because the adapter incorrectly treated aC8's disabled empty image selectors as incomplete. The adapter now accepts Huawei's deliberately unavailable controls and still requires a complete official quote. The unavailable-image regression audit covers aC8, switching to C7n and back, and saved-selection replay.

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

Huawei’s current Hong Kong ECS RI data offers No Upfront for the checked flavors. Partial/All Upfront schedules are validated with unit fixtures and are exposed if the official service/region/flavor offers them. The historical RI tests in `huawei-native-billing-validation.json` selected C7n; a subsequent fix supports aC8 without image selection, matching Huawei. Coverage does not establish exhaustive correctness for every service or future widget.

The unavailable-image regression passed **31 independent price comparisons**, seven saved-selection replays and three regional rejection guards across ECS pay-per-use, yearly/monthly and RI scopes in Hong Kong and São Paulo. It also passed 347 unit tests, five DOM fixtures and twenty main-app browser scenarios, including saving and editing aC8 RI with unavailable images. [The recorded evidence](huawei-native-unavailable-images-validation.json) includes official form probes and source hashes. The DOM fixtures verify that enabled empty selectors and disabled populated selectors without a selection still fail.

The billing run passed **24 independent official comparisons and 10 saved-selection replay checks**, plus three live regional/mode rejection checks, in 230.6 seconds. It covers ECS RI in Hong Kong and São Paulo, ECS/ELB/NAT yearly-monthly in Hong Kong, DCS yearly-monthly in Singapore, CCM/DEW one-time purchases in Hong Kong, and NAT pay-per-use. All four modes passed main-cart save/edit tests; regional choices and switching an open mode were also tested. The resulting suite has 347 passing unit tests, four DOM fixtures and 20 distinct isolated app scenarios.

The additional pay-per-use regression passed **27 independent comparisons in 101.0 seconds** across ECS, ELB, DCS and NAT in Hong Kong. It verifies complete inquiries, exact totals and charged components; the full renderer also retains zero-price catalog image components that the rating API omits.

Production verification passed four live-mode browser scenarios and nine legacy/catalog checks. HTTPS returns 200 with a valid calculator.hwctools.site certificate, HTTP redirects with 308, and the native sidecar is healthy. The VPS parent Compose file already references `compose.native.yml`; deploy through the parent file with `docker compose -f /home/docker-compose.yml up -d --build calculator-native calculator`.

## Memory budget and runtime decision

The browserless experiment was retired at the user's request. Its code, nested
dependencies, temporary artifacts and public preview were removed; the production
Chromium runtime remains unchanged. The experiment's PR was closed.

The native service shares one Chromium browser across a maximum of six sessions;
each session has its own browser context and page. Closing a session closes its
context. Idle sessions expire after ten minutes, and sessions have a thirty-minute
maximum age. These limits are applied when the service sweeps its sessions.

An isolated container using the exact production image measured the following
total backend working memory, including the anonymous controller and Chromium:

| Open sessions | Sample | Working memory |
| --- | --- | ---: |
| 1 | NAT, Hong Kong | 414 MiB |
| 2 | NAT + ECS, Hong Kong | 751 MiB |
| 3 | NAT + ECS + ELB, Hong Kong | 1,025 MiB |
| 6 | Above plus Redis Singapore, ECS RI São Paulo and NAT São Paulo | 1,421 MiB |
| 0, after closing all six | Shared browser retained | 374 MiB |

The sampled peak was 1,502 MiB. A seventh session was rejected, all six produced
complete quotes without diagnostics, and context/browser cleanup passed. The
production service currently has a 3 GiB container memory limit. The tested mixed
workload fits that limit; this is not proof that every six-session configuration
or simultaneous opening burst fits it.

At the time of measurement the existing idle production native container used
about 98 MiB, while the separate Next.js application used about 139 MiB. Warmed
memory can remain higher after closing tabs because the browser and controller
retain caches and garbage collection is not immediate.

These figures use cgroup-v1 memory usage minus inactive file cache, following
Docker's working-memory accounting. They avoid summing subprocess RSS, which can
count shared pages multiple times. The six-session sample also had about 20 MiB
in swap. It was one run with sequential openings, not a worst-case load test.
Source data, selections, caching, swap and garbage collection affect the results.
See [the raw measurements](huawei-native-memory-validation.json) for timestamps,
the exact production image, per-phase values and verification details.

The conservative memory cleanup shares identical page, menu and instrumented
framework strings by content hash across active sessions. Only three current
common assets are retained; existing sessions keep their captured versions.
Source collection, regional product snapshots, RI freshness and pricing requests
continue to use their existing rules. Unsupported framework changes still fail
explicitly instead of reusing an older instrumented version.

The common asset cache is released when a sweep finds no active or opening
sessions, and at shutdown. Expired save requests now close their unused context
promptly. Expiry checks never close a context while an edit or save is running;
normal sweeping releases it once the operation finishes. Session timeouts,
capacity and browser flags remain unchanged. A later loading improvement adds
script preload hints and a separate cache for versioned public CDN scripts/styles,
bounded to 16 MiB, 64 entries and fifteen minutes. It leaves source freshness,
pricing inquiries and the settled-quote checks intact; see
[the consolidated workspace](calculator-consolidation.md).

Automatic Chromium shutdown after five empty-pool minutes was tested and
rejected: several same-process reopen audits stalled, including one in an
isolated production runtime. That optimization is not enabled. Chromium stays
warm, so these savings are modest. The workload measurements do not establish
a lower overall peak; browser pages, GC, swap and workload variation dominate.

Run the real-browser cleanup and busy-expiry audit with:

```sh
HWC_SOCKS5_PROXY=socks5h://172.17.0.1:40001 bun scripts/audit-native-lifecycle.ts
```

The audit ages controller session timestamps while keeping Playwright, HTTP,
price-cache clocks and timers at real time. It verifies context release,
warm-browser reuse, saved replay after clearing shared assets, protection of an
in-flight edit at expiry, rejected opens and final shutdown. The unit fixtures
cover immutable asset ownership, version replacement and unsupported framework
updates. See [the cleanup validation](huawei-native-memory-cleanup-validation.json)
for price comparisons and deployment evidence.

The 2026-10-05 merge-readiness run passed a clean 350-test unit suite, production
build and type checking, 20 isolated main-application browser scenarios, five
DOM fixtures, eight real-browser lifecycle checks and four production browser
scenarios. The two stale NAT/EIP catalog fixtures now assert their existing
constraints. Fresh official comparisons covered 46 prices across all four
billing modes, 11 saved replays/fresh saves, three legacy replays and three
regional/mode rejection guards. Live API samples took 7–11 seconds to open,
about 1.7–1.8 seconds to edit, and 0.4–1.3 seconds to refresh a saved quote.
These are measured samples, not response-time guarantees; Huawei availability
and the six-session pool limit still apply. See
[the merge-readiness evidence](merge-readiness-validation.json).
