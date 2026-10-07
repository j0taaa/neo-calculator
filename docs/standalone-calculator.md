# Daily synchronization and standalone calculation

Neo's normal calculator uses a published local snapshot. Opening a form, changing duration/options, restoring a selection, queuing products and saving quotes do not call Huawei or a server browser. The existing UI and ECS flavor cards remain in place.

The official conditional component rules execute in an opaque, hidden iframe in the user's browser. Its scripts, styles, menu, configuration and products are served by Neo from one immutable release. XHR/fetch are replaced with snapshot reads and a pure local rating engine; CSP blocks remote connections. The iframe has no cookies, account storage or same-origin access. Messages require the correct frame and an unpredictable session token. Unknown dependencies, controls and price rules block pricing rather than falling back to live requests or a zero estimate.

This retains Huawei's dependent defaults, regional choices, disk actions and ELB derived quantities without reconstructing every conditional rule by enumerating numeric inputs. The downloaded framework is version-checked and adapted only at its storage, API-origin and pricing-observation boundaries. Executable asset imports are discovered during synchronization; the application does not need the TypeScript compiler or Chromium to serve these assets.

## Synchronization

`bun run sync:calculator` performs an immediate synchronization. `Dockerfile.sync` runs `scripts/run-calculator-sync.ts`, which starts a job every 24 hours after success and retries failures after one hour. The worker owns Chromium and writable snapshot storage; the app mounts snapshots read-only. A process lease prevents concurrent jobs and recovers after a killed worker. Chromium closes when a changed-source audit finishes. Unchanged snapshots receive fresh API price checks using recorded inquiry shapes without launching Chromium.

The job discovers services, HWC regions and billing modes from the official menu. It also applies service-level rules that narrow that menu, such as SFS hiding PERIOD billing in São Paulo. A mode that produces only an empty global duration control has no usable offer and is excluded; arbitrary form failures are not treated as unavailable modes.

Changed scopes exercise actual local forms in every offered billing mode and compare inquiry components against Huawei's fresh rating API. Catalog contracts additionally check unselected SKUs in batches using proven request shapes, including separate RI terms/payment SKUs. Fixed packages and required-capacity SKUs need different request shapes. Raw catalog entries without a proven family template are not evidence of complete coverage.

Pricing supports duration/capacity/quantity conversions, progressive and whole-quantity tiers, monthly/yearly terms, one-time charges, installments and mixed RI components. Currency arithmetic uses exact decimal ratios. Bounded size/unit-scale corrections must pass independent quantity, capacity, duration and holdout probes. RI hourly recurring corrections require three independent quantities, unchanged upfront charges and recognized hourly units before updating monthly installments. Corrections and official responses are retained with the scope; nonlinear or contradictory results are rejected.

A complete candidate is published by atomically replacing the active release pointer. Previously published scopes cannot disappear after a failed audit. An unfiltered initial bootstrap cannot publish an incomplete catalog. Explicit service/region filters are for isolated validation/previews; they must not be used to silently narrow production coverage. New validated scopes can enter a later release automatically; unfamiliar widgets or unvalidated pricing remain pending.

Large products, configurations and proof bodies use separate content-addressed blobs. Daily timestamps do not duplicate the entire catalog. Historical blobs are retained because saved quotes and open forms can reference older releases; there is no destructive automatic garbage collection.

## Saved quotes

A new form pins its release for consistent calculation during a daily update. Save endpoints recompute all monetary values from that published release and ignore client totals. They preserve durable selections and quantity. Old native records without local proof require opening their configuration once; existing estimates remain readable.

Explicit server repricing uses the active snapshot when conditional rules are unchanged, including refreshed RI metadata. If the conditional framework/configuration changed, the user must reopen the configuration to check its options. Reopening replays the saved steps against the current form and verifies initial controls, every step and the final selection.

Explicit Huawei cart import/export/synchronization still uses Huawei's authenticated cart APIs. It is a separate user-triggered feature; local calculator interaction does not depend on it.

## Deployment and checks

`compose.snapshot.yml` describes the production app/read-only volume and daily worker. Build the app and worker from the same revision so their generated bridge hashes match. Do not stop the existing production sidecar until a full bootstrap and the application regression checks pass. `compose.snapshot-preview.yml` is a separate preview with its own accounts and snapshot volume.

```sh
bun run test
bunx tsc --noEmit
bun run lint
NEO_TEST_URL=http://127.0.0.1:3307 bunx playwright test --config tests/standalone-calculator.config.ts
HUAWEI_SNAPSHOT_DIR=/path/to/snapshots bun scripts/check-snapshot-evidence.ts
```

The browser suite must run against an isolated local application/database with a seeded validated snapshot. The strongest check uses an internal Docker network with no internet access, then verifies actual quote editing, all four billing families, saved-cart replay, regional availability, frame cleanup and mobile layout. Historical browser tests that mock native POST sessions exercise the retired transport and are not evidence for this implementation.

## Rollout status

The implementation is available for an isolated standalone preview. Production cutover remains gated on full service/region validation. The current official menu discovers 97 available services and 24 eligible regions; the broader audit exercised 80 service/region scopes in Hong Kong and São Paulo, validating 76 scopes across 40 services. Services and regions outside that audit remain unverified. Strict micro-dollar comparisons have exposed unsupported behavior in some OBS/SFS Turbo cases and missing synthetic request metadata in DLI contracts. These failures remain visible; the implementation does not infer a nonlinear rule or lower accuracy tolerances to make the audit pass. See `standalone-calculator-validation.json` for actual counts and remaining scopes.

The isolated preview is at https://calculator-offline.hwctools.site and has separate accounts/carts. Its initial release contains 40 services across 76 validated scopes in the two audited regions; its worker runs discovery and validation every day. This partial preview is not the production catalog. The production application has not been switched over.

The runtime skips loading audit bodies and the iframe payload excludes proof records. For the audited Hong Kong ECS scope, that avoids sending approximately 2.2 MB of verification evidence with each form. The local browser regression measured a 390 ms duration change; the public HTTPS smoke measured 224 ms and no external requests. These are measured runs, not a latency guarantee. Initial loading still includes the self-hosted official framework and product data; the public smoke reached its first ECS price in 2.8 seconds. A cold public smoke immediately after container recreation timed out once; the subsequent public smoke and debug run succeeded. Further startup/performance testing is part of the production rollout gate.
