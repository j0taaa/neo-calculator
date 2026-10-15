# Design proposals

The `/designs` gallery links three isolated, interactive visual proposals:

- `/designs/studio`: light personal workspace, vertical service library, configuration and estimate columns.
- `/designs/console`: dark, compact workbench, service rail, overview and full-width resource table.
- `/designs/atelier`: warm serif typography and horizontal service cards.

These are design prototypes, not production pricing calculators. All three deliberately use the same illustrative four-service dataset. Prices are marked as samples. Selections, quantities, durations and cart changes run in component memory; refreshing resets the preview. No saved carts, authentication, published pricing or Huawei integration is modified. The shared cart-creation dialog retains the current on-demand creation interaction.

The existing calculator remains at `/`. Only the production navbar's visibility changes on `/designs` routes. Styles and locally served OFL-licensed fonts live under `components/design-proposals` and `public/fonts/design-proposals`; portal styles apply only while a proposal is mounted. Proposal pages request no search indexing.

Run the preview checks against a running production build:

```sh
NEO_TEST_URL=http://127.0.0.1:3307 node node_modules/playwright/cli.js test --config tests/design-proposals.config.ts
```

The checks cover each direction at 280, 375, 768, 1440 and 1920 pixels; desktop/mobile form and cart interactions with requests blocked; modal cancellation, creation and focus; preview reset without persistence; gallery navigation, unknown routes and return to the existing application.

Visible copy is limited to navigation, control labels, resource details, totals and one sample-price label. Marketing headings, descriptions, breadcrumbs, numbered sections and repeated preview notes are omitted; action announcements remain available to assistive technology.
