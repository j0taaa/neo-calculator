# Retired synchronized calculator

> Historical documentation: the live browser renderer described below has been retired. Use [the independent daily calculator architecture](standalone-calculator.md) for current behavior and deployment.

The Huawei live tab is the sole synchronized calculator. The original declarative calculators remain available. The QuickJS interpreter, verification/publication worker, standalone form, old form/quote APIs, captured audit API, and QuickJS dependency have been removed.

## Saved estimates and imports

The production database inventory on 2026-10-06 contained zero `HWC:` / `huawei-synchronized` estimates. No production record migration was necessary. Old exports may still exist, so imports, cloning, sharing and exports continue to preserve their original data.

Old field values are product/model identifiers, whereas native selections contain control identities, option labels and ordered interactions. Guessing a replay from these identifiers risks selecting different resources. The recovery adapter therefore opens the correct service and region in Huawei live, shows the original configuration, and requires the user to reselect and review it. It does not automatically overwrite saved data or carry an old price forward as a current quote.

Saving the replacement uses the existing server verification and updates the same product ID to `HUAWEI:` / `huawei-native`. The user can cancel without changing the old estimate. Old `HWC:` creation, direct updates and API repricing reject with an actionable recovery message; imports and historical reads remain supported. Current native estimates retain normal automatic replay and fresh server pricing.

`/synchronized?service=...&edit=...` redirects to `/?tab=huawei-live&editProduct=...`. When no cart is specified, the dashboard resolves the item only among carts accessible to the signed-in user. `/sync-lab/audit` redirects to Huawei live; `/sync-lab` remains an isolated preview of the same native implementation.

## Shared code and deployment

`lib/huawei-native` owns the live runtime, source collector/cache, pricing gateway and compatibility adapter. `SourceStore` creates only immutable snapshots and latest-fetch references; it no longer schedules releases, maintains publication leases or enumerates configurations. Existing native source databases are readable without a destructive schema migration. The sidecar uses `HUAWEI_SOURCE_DB` (default `/app/data/native.sqlite` in its image).

Remove the `calculator-sync` service and the app's `HUAWEI_SYNC_DB` setting and synchronization-volume mount from the parent Compose file. Keep the old volume and a database/Compose backup for rollback. Rebuild only `calculator-native` and `calculator`. No additional ports or tokens are required. The native sidecar stays on its private network with the existing six-session limit and Chromium lifecycle protections.

## Validation

Run the unit suite, type checking, targeted lint and production build. Run `tests/retired-calculator.config.ts` against an isolated app with a native sidecar to cover redirects, removed APIs, historical imports, cancellation, cloning/sharing, rejected legacy pricing, reviewed conversion and native replay. Run the existing main calculator, native DOM and responsive suites, plus an independent official billing audit to compare resources and prices across billing modes and regions.

Historical synchronization docs and audit evidence are retained as historical records, not deployment instructions.

## Deployment result

On 2026-10-06, production and the isolated preview were updated to the validated images. The parent Compose no longer defines `calculator-sync` or mounts its database in the app; the stopped worker container was removed. Its volume, SQLite backups, previous Compose file and rollback images remain available. Both native containers passed health checks with zero restarts and no out-of-memory events. Existing deployed metadata and workbook changes were preserved separately from this PR.

Public browser checks confirmed the redirect, removed APIs, all four billing modes and mobile layout. Detailed validation is in [the validation report](synced-calculator-retirement-validation.json). The repeatable public checks are anonymous and do not create accounts or mutate carts:

```sh
NEO_TEST_URL=https://calculator.hwctools.site bunx playwright test --config tests/retirement-production.config.ts
```
