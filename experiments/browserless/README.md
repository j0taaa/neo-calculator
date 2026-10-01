# Calculator without Chromium: an isolated experiment

[Open the demo](https://calculator-lab.hwctools.site/browserless-demo/).

**Decision: keep this experimental; do not replace the production runtime.**
The same generic adapter can discover all advertised services and run several of
their calculators without Chromium. It does not satisfy the requirement to keep
every service working automatically. Source loading is not proof of calculator
support, and the sampled openings were slower than the existing Chromium runtime.

## How it works

1. `sources.ts` fetches Huawei's live directory, original service definitions,
   products, stylesheet and framework modules using HTTP. Regions and billing
   modes come from the directory. There are no hardcoded service formulas.
2. `worker.mjs` runs the original Vue calculator framework in Node using
   [Happy DOM](https://github.com/capricorn86/happy-dom) and ephemeral IndexedDB.
   This is JavaScript execution with a DOM emulator, rather than a JSON-only
   interpretation of the HTTP responses.
3. `runtime.ts` uses NeoCalculator's existing form mapper and complete-quote
   validator. The original framework calculates dependencies and builds pricing
   requests. A trusted controller sends these requests to Huawei's read-only
   inquiry API; the worker has no network connection.
4. `server.ts` exposes a small standalone demo. It offers one worker at a time,
   expires idle sessions after two minutes and limits openings to 12/hour. Its
   generic UI does not connect to NeoCalculator's accounts or carts.

The emulator needed classic-script global binding restoration, a tag-selector
compatibility shim and semantic visibility checks because it has no layout
engine. Neutral `offsetParent` behavior avoids Huawei scrolling recursion. These
are compatibility assumptions, not a complete implementation of browser layout.
Any unfamiliar widget definition, unmapped visible control, incomplete quote,
unexpected request or input that fails to apply withholds a price. Configuration
and pricing are reread before publishing a quote to catch changes during pricing.
There is no Chromium fallback.

## Findings

The recorded run discovered 97 services and loaded sources for 96 eligible
common HWC scopes. MaaS had no eligible common HWC region/mode. Inventory checked
one region/mode per service; it did not run all service/region combinations.

There were 26 matching states across seven scopes: NAT pay-per-use and prepaid,
ECS pay-per-use and reserved instances, ELB, Redis and one-time certificates.
Tests covered Hong Kong, Singapore and São Paulo, ECS C7n/aC8/Kunpeng changes,
unavailable image controls, three-year reservations, ELB shared/dedicated/fixed
choices, a Redis selection and quantity/duration changes.

The comparison checks source hashes, complete visible controls and option values,
semantic pricing inquiry payloads, exact amounts and payment schedules against
the **existing Chromium NativeCalculator**, using the same Huawei sources and
live inquiry API. This is not an independent comparison with the unmodified
official website, nor proof of parity for untested combinations.

Fourteen definitions contain inputs this adapter cannot map, including
FunctionGraph, Flexus L, MRS, VOD and several database/media services. FunctionGraph
was blocked by an unmapped input; VOD failed to initialize. MRS initially produced
a default quote, but that did not establish coverage of its custom node inputs;
strict metadata preflight now rejects it. See [evidence.json](./evidence.json)
for the complete list and recorded states.

These are form-adapter coverage gaps, some shared with the existing Chromium
implementation. Unknown metadata types are rejected conservatively even if some
of their children might be ordinary controls. They do not establish that HTTP
pricing itself is impossible for those services. The separate Node compatibility
shims and sampled performance still need to justify a browser replacement.

| Warm-source opening | Node + DOM emulator | Existing Chromium |
| --- | ---: | ---: |
| NAT, Hong Kong, pay-per-use | 9.2 s / 551 MiB worker RSS | 5.4 s |
| ECS, Hong Kong, reserved instances | 23.0 s / 883 MiB worker RSS | 8.7 s |
| ELB, Hong Kong, pay-per-use | 22.0 s / 1,050 MiB worker RSS | 5.9 s |

These are one sample per scope, not a load test or statistical benchmark. Node
worker RSS is not directly comparable to shared browser-process memory. Initial
ECS/ELB runs exceeded a 768 MiB container limit. Workers now have a 1,536 MiB cap.

Implementing the missing widgets and more web-platform behavior might improve
coverage, but adds ongoing compatibility work. Removing Chromium alone is not a
sufficient reason to adopt this approach. Production NeoCalculator is unchanged.

## Run and verify

Requires Docker, Bun, root project dependencies and access to Huawei's public
endpoints. The nested package has its own pinned dependencies and lockfile.

```sh
bun install --cwd experiments/browserless --frozen-lockfile --ignore-scripts
docker build -t neo-browserless-runtime:demo experiments/browserless
bun experiments/browserless/server.ts
```

The local demo listens on `127.0.0.1:3318`. Set `HWC_SOCKS5_PROXY` if an upstream
SOCKS proxy is required. Do not copy application credentials into this process.
`BROWSERLESS_DB`, `BROWSERLESS_HOST`, `BROWSERLESS_PORT` and `BROWSERLESS_IMAGE`
can select an isolated source store, binding and worker image. Framework/menu
sources refresh after six hours; product-source cache follows the existing
collector (reserved-instance products are fetched fresh). Quote requests remain
live. Opening a session pins its sources until it closes.

```sh
bun run test
bunx tsc --noEmit
bunx tsc --project experiments/browserless/tsconfig.json --noEmit
bunx eslint experiments/browserless/*.ts experiments/browserless/worker.mjs
bun experiments/browserless/inventory.ts
bun experiments/browserless/probe.ts nat:ap-southeast-1:ONDEMAND
bun experiments/browserless/compare.ts
bun experiments/browserless/demo.playwright.ts
```

`compare.ts` launches Chromium only as a comparison oracle. The Playwright script
tests the preview UI only; it also checks the actual worker container's process
list and confinement. `BROWSERLESS_URL` selects another preview URL.
`BROWSERLESS_OUTPUT` selects the audit directory (default `/tmp/neo-browserless-audit`).
Comparison exits nonzero on a mismatch. `probe.ts` records exploratory successes
and failures, exiting nonzero if any calculator fails or withholds its quote.
The experiment has its own TypeScript configuration; production type checking
excludes it so a production install does not require the nested demo dependencies.

The public preview uses `compose.yml` for an HTTPS Traefik/Nginx route at
`/browserless-demo` on the existing lab domain. A separate private host controller
binds to Docker's gateway at port 3318 and launches jailed workers. Each worker
runs as a non-root user with no outbound network, no credentials or host mounts,
a read-only root, dropped capabilities, a PID limit and a memory limit. Docker's
socket stays in the trusted host controller; it is never mounted into workers.
The Node VM itself is not the isolation boundary.

Compose also creates a `runtime-image` container that immediately exits with
code 0. Its retained image reference prevents this host's six-hourly unused-image
cleanup from deleting the worker image while the demo is idle. Recreate it with
`docker compose -p neo-browserless-preview -f experiments/browserless/compose.yml up -d`
after rebuilding the worker image.

The active preview controller is the transient `neo-browserless-demo` systemd
unit. Stop it and the `neo-browserless-preview` Compose project when retiring the
demo. The existing `/sync-lab` route and production containers are unaffected.
