# Neo Calculator

An independent Huawei Cloud pricing calculator with a React dashboard. A daily synchronization worker discovers the official calculator's services, regions, conditional options and rates. Neo then calculates from its published JSON catalog using its own controls and pricing engine.

## Features

- Local calculations without Huawei requests, Chromium sessions or calculator iframes
- Pay-per-use, yearly/monthly, reserved-instance and one-time modes where Huawei offers them
- Regional and availability-zone options, ECS flavor search, conditional controls and payment terms
- Projects, saved configurations, batch quotations and API-key pricing
- Region/mode cloning, sharing, JSON import/export and Excel exports
- Atomic daily updates: failed validation retains the previous complete catalog

Prices reflect the last successful synchronization. Chromium belongs exclusively to the daily extraction/validation worker.

## Development

```bash
bun install
bun dev
```

The application needs a published independent snapshot at `HUAWEI_SNAPSHOT_DIR` (default `data/huawei-snapshot`). It never substitutes a live calculator when a snapshot is missing. Set `HUAWEI_SOURCE_ACCESS=offline` in the app and provide the usual authentication configuration.

```bash
bun run sync:calculator
```

Synchronization fetches official data and compares Neo's independently generated controls, resource dimensions and prices before publication. It needs network access and Playwright Chromium. `Dockerfile.sync` includes those dependencies and schedules synchronization every 24 hours, with retries after failures. `Dockerfile` builds the application without Chromium or the upstream calculator bridge. Mount the snapshot volume read-only in the application; see `compose.snapshot-preview.yml` for the two-process deployment.

## Structure

| Directory | Purpose |
|---|---|
| `app/` | Pages, accounts, project APIs and immutable calculator model API |
| `components/` | React controls, ECS flavor cards and quotation workspace |
| `lib/calculator-rules/` | Worker compiler, bounded JSON interpreter, Neo controls and state machine |
| `lib/huawei-snapshot/` | Daily extraction, price calibration, validation, publication and local rating |
| `lib/huawei-native/` | Shared upstream discovery and worker-only browser reader |
| `config/services/` | Existing declarative bundles and compatibility adapters |
| `tests/` | Browser, API and regional regression tests |

New official services enter discovery automatically. The generic compiler and controls handle supported rule patterns; an unknown widget, rule or pricing behavior blocks publication instead of producing an unverified calculator. Existing manual bundle additions should follow DCS, using `productSpecSysDesc` and `resourceSpecCode` rather than the empty `specDesc` field.

See [the architecture](docs/calculator-architecture.md) and [the synchronization and independence contract](docs/standalone-calculator.md). Older live-renderer documentation describes a retired implementation.

## Verification

```bash
mapfile -t neo_test_files < <(rg --files lib tests | rg '\.test\.ts$')
bun test "${neo_test_files[@]}"
bunx tsc --noEmit
bun run lint
bun run build
NEO_TEST_URL=http://127.0.0.1:3307 bunx playwright test --config tests/standalone-calculator.config.ts
```

Use an isolated application database for browser tests: they create accounts and quotations. The standalone suite covers all services, modes, regional conditions, cart save/edit, API consistency, tampering and retired replay endpoints. Independence checks block all browser HTTP after opening a model and run the app on an internal Docker network without internet access. Daily validation also compares official responses with the local engine, including unselected catalog SKUs and pricing boundaries.

The Calculator and Batch add tabs share one service selection. Old `/synchronized` and `tab=huawei-live` bookmarks redirect into this workspace. Saved legacy selections are reconstructed through the independent engine; unavailable choices require review rather than upstream replay.
