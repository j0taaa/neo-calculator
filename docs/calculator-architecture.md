# Calculator architecture and Huawei integration seam

This refactor prepares the existing calculator for another runtime. It does not route the main calculator through the native Huawei preview, change stored product schemas, or migrate saved carts.

## Responsibilities

```mermaid
flowchart TD
  page[Dashboard: account, selected cart, common controls] --> controller[Calculator controller]
  controller --> declarative[Declarative runtime]
  controller --> custom[ECS and Flexus L]
  declarative --> source[CalculatorProductSource]
  custom --> source
  source --> cart[Shared cart workflow]
  cart --> transport[Existing authenticated product endpoints]
  cart --> state[Shared immutable cart update]
  controller --> panel[Typed active panel]
```

- `lib/calculator-types.ts` owns shared calculator and saved-product contracts without importing React, UI formatting, storage or a pricing engine. Existing JSON fields and API response shapes remain unchanged.
- The declarative runtime owns its fields, visibility, catalogs, estimates, product construction and hydration. ECS and Flexus L retain their custom implementations.
- `lib/calculator-presentation.ts` only formats the custom ECS/Flexus L calculations. Declarative services no longer have a second, unused presentation implementation. The hardcoded sample ECS price fallback has been removed.
- `CalculatorPanelRouter` accepts one discriminated, fully typed active panel. Adding another panel requires a checked union case rather than casting through `unknown`/`never`.
- `lib/calculator-cart.ts` owns save/edit/split/batch sequencing and acknowledged cart updates. Both runtime implementations use its `CalculatorProductSource` interface. Clipboard insertion uses the same state update while preserving its existing append order.
- The controller selects the runtime, coordinates common controls and edit hydration, and supplies the cart writer. The dashboard retains account/project/list UI. Server repricing continues to use its existing ECS, Flexus L, declarative and synchronized-service paths.

## Product source contract

A source builds one saved product, several split products, or `null` if no configuration can be built. Builders may be synchronous or asynchronous. A source can optionally build batch items and customize success messages. It has no knowledge of cart identifiers, HTTP requests or React state.

The writer is injected. Saves update the original item first when editing; split extras are added to the selected destination list. Batch items are converted and saved in order. Each acknowledged write updates local state immediately, so a later failure preserves earlier successful saves. Batch errors report how many products were saved. These operations retain the existing sequential, nontransactional behavior; retrying an entire partially saved batch is not an idempotent operation.

Pricing is opaque to the cart workflow. It never recomputes, rounds or multiplies a source's price. Quantity and configuration are passed through unchanged. Validation and authentication at the existing endpoints remain in effect.

## Next integration, deliberately deferred

The native implementation remains under `lib/huawei-sync` and `/sync-lab`. To integrate it:

1. Adapt native form/session state to a typed active panel, including loading, expiry, unavailable configurations and invalidation of stale quotes after edits.
2. Implement `CalculatorProductSource` for a verified native selection. Its asynchronous builder must obtain a fresh quote for the current revision before producing a saved product. The shared cart workflow already awaits it.
3. Persist a versioned, durable selection that can reopen and replay the configuration after a session expires. A transient native session ID is not sufficient for saved-cart editing.
4. Validate and reprice those saved native products on the server before accepting them. The current legacy client pricing payload must not be treated as proof of a verified Huawei quote.
5. Add native edit hydration and service discovery/region availability to the main selector. Keep explicit unsupported states and existing legacy products editable during migration.
6. Test save/edit/reopen/batch behavior, expired sessions, concurrent option changes, regional availability and independent Huawei price parity before switching any service over.

No placeholder native adapter, new provider registry or second cart schema is introduced here. There are two concrete product-source implementations today; the future native adapter will reuse that same cart workflow.

## Verification

- `bun run test`: existing pricing/runtime fixtures plus cart workflow failure/ordering tests and ECS/Flexus L presentation checks.
- `bunx tsc --noEmit` and `bun run lint`.
- `bunx playwright test --config tests/playwright.config.ts`: eight declarative forms, public routes, saved-cart edit/batch/clone/share/export/import, and ECS/Flexus L save/edit/batch scenarios. Run write scenarios only against an isolated local app database.
- Production build and read-only browser checks against the deployed app.

These checks establish regression coverage for the refactor, not universal parity of every legacy calculator with Huawei. Native parity evidence remains documented separately in `huawei-native-calculator.md`.
