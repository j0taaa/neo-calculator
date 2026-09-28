# Huawei calculator response audit

Observed 2026-09-29, Asia/Shanghai. This is an investigation, not an implemented sync system.

## Conclusion

The sampled responses support a deterministic compatibility layer. The presence of JavaScript does not imply that AI is needed to understand every update. Most investigated behavior is supplied as explicit configuration or callable transformation functions, and the shared calculator framework exposes their invocation contract.

Translating every function into our existing small expression language would be substantial work. Preserving supported callback behavior in an isolated execution engine is another deterministic option, and deserves a prototype before introducing autonomous AI repair. Reproducing dependency order, component state, normalization, global billing controls, and quote assembly remains substantial work. These samples do not establish universal support.

## Requests and responses

Requests used the repository's Huawei HTTP transport and configured proxy. All six configuration requests, both product requests, the calculator HTML, shared framework, and menu request returned HTTP 200.

Base configuration URL:

`https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/config?urlPath=redis&tag=general.online.portal&tab=calc&sign=common`

The response is JavaScript served as `text/plain; charset=utf-8`. All six samples parsed without syntax errors using TypeScript's JavaScript parser.

| Service path | Response bytes | Function-valued `function`/`func` properties |
| --- | ---: | ---: |
| redis | 36,603 | 21 |
| vpn | 101,141 | 26 |
| ecs | 67,234 | 25 |
| obs | 276,619 | 45 |
| rds | 63,421 | 36 |
| nat | 18,796 | 11 |

The function counts exclude compiler helper declarations and anonymous array callbacks. They include configuration sections outside the interactive calculator, such as details and purchase links; they are not a count of difficult rules or a coverage percentage.

Other sources fetched:

- [Calculator HTML](https://www.huaweicloud.com/intl/en-us/pricing/calculator.html), which identifies the shared framework asset.
- [Framework version 11.4.201](https://portal.hc-cdn.com/CBC-PortalCalculator/11.4.201/framework.js), approximately 2.76 million characters of readable JavaScript.
- [Service directory](https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/menuInfo?sign=common&language=en-us): 20 categories and 105 distinct raw service paths. 97 entries declare `hasCalculator` and do not declare `hideCalculator`; these counts precede the framework's site/region filtering and are not a claim that all 97 are available in every scope.
- `productInfo?urlPath=redis&tag=general.online.portal&region=ap-southeast-1&tab=calc&sign=common`: valid JSON, 1,726 recursively located records with `resourceSpecCode`.
- The equivalent VPN product request: valid JSON, 21 such records.
- A live VPN V300 one-hour pricing inquiry using the existing repository verifier: remote amount 0.33000, local amount 0.33000, difference 0.00000. This verifies one configuration only.

The menu response includes `menuInfos`, `languagePack`, `regionRules`, `measureID`, `global`, `regionsOfSite`, and `regionGeoCategory`. It directly supports automatic discovery; HTML label scraping is unnecessary for this directory.

The product records are richer than raw SKU names. A Redis record already includes derived fields such as `edition`, `versionKey`, `instanceType`, `cpu`, and `repl_spec`, together with a `planList` for multiple billing modes. Prefer these observed fields where available rather than recreating every extraction rule from `resourceSpecCode`.

## Concrete behavior found

**Declarative controls:** NAT specifies `CommonRadioGroup` and `CommonSelect`, option keys, ordering, labels, and a `showConfigs` entry hiding `global_QUANTITY`. DCS explicitly lists component bounds and billing-mode visibility. These structures are straightforward to parse.

**DCS dependent bandwidth:** `dataConfig.dataSources[].cascadedSource` names the bandwidth switch and bandwidth product collection in its `inputs`. Its function returns matching `dcs.additional.bandwidth` products when a selected switch resource has `resourceSize == 1`; otherwise it returns an empty list. The rule is explicit, not inferred from prose.

**NAT duration:** a `cascadedViewConfig` function clones `this.defaultViewConfig` and assigns duration `measureId` 4 for `hws.resource.type.privatenat`, otherwise 0. Calling it without the correct bound context would fail even though its logic is simple.

**RDS disks:** a callback filters allowed storage products using selected database type, instance type, AZ mode, and regexes over the instance specification. It includes explicit excluded volume codes. A generic field/visibility JSON importer alone would omit this behavior; executing or faithfully translating the supplied callback can preserve it.

**OBS billing transformations:** a selected-product callback applies different quantity conversions, a factor of 720 in one branch, and measurement-ID substitutions for specific regions and usage factors. A universal `hourly rate × quantity × hours` formula would miss these rules. Their complexity does not make them nondeterministic.

**VPN semantic trap:** a callback contains an expression beginning `source2.region === 'cn-north-4' || 'cn-southwest-2' || ...`. In JavaScript, the nonempty string makes the condition truthy for nonmatching regions too. Reinterpreting this as an intended list-membership test changes the supplied behavior. The isolated callback test confirms this expression's result; it does not establish that the full official UI exposes an invalid region, because other filters may apply.

## Shared runtime evidence

The downloaded framework contains these inspectable functions:

- `formShowFunction`: translates switch, checkbox, inverse, and data-source visibility dependencies.
- `formDataFunction`: registers `cascadedSource.inputs` and the supplied callback.
- `formConfigFunction`: clones default configuration and binds `cascadedViewConfig.function` to `{ defaultViewConfig }`.
- `formFunctionList`: combines visibility, data, and configuration callbacks.
- `parseSelected`: filters billing plans, applies global quantity/duration rules, runs service-specific product transformations, and assembles the final product list.
- `URIMAP`: identifies configuration, products, menu, language, inquiry, and a separate quoting endpoint. Endpoint presence alone does not establish which pricing path every service uses.

Huawei itself loads the service configuration as JavaScript. That confirms these function properties are intended to run. It does not justify executing fetched scripts in Neo's application process or exposing application credentials to them.

## Executed checks

Extracted three inspected callbacks with the JavaScript AST parser, then executed only those callbacks in a fresh headless Chromium context with requests blocked and service workers disabled. Supplied explicit data and context. Seven cases, repeated ten times each, passed exact-output assertions:

1. Redis bandwidth enabled returns the matching bandwidth SKU only.
2. Redis bandwidth disabled returns no bandwidth products.
3. Private NAT sets duration measure ID 4.
4. Public NAT sets duration measure ID 0.
5. Private VPN selects `calSpecNoBasic`.
6. Public pay-per-use VPN selects `calGatewaySpec`.
7. Periodic VPN with a synthetic unknown region also selects `calNonFixedIP`, preserving the actual truthy expression.

These are callback execution checks with controlled fixtures, not full official-browser parity tests or a proof of safe production sandboxing. No complete translator or service renderer was built. No all-service or all-region price claim follows from them.

## Recommended change to the design

Build a deterministic Huawei compatibility adapter first: menu discovery, product ingestion, declarative component mapping, dependency scheduling, callback context, product normalization, and final quote assembly. Prototype an isolated, resource-limited JavaScript engine for pinned callbacks with JSON inputs/outputs and no network or application access. Preserve shared semantics and supported language behavior rather than guessing intent. Keep our declarative renderer; the adapter supplies its evaluated field state and quote inputs.

Compare that approach with compiling callbacks to the existing expression system on the same pilot services. Measure parity coverage, latency, state compatibility, unsupported dependencies, and isolation. Use browser observations as an independent oracle. New components or unavailable runtime capabilities can still require engineering changes, but AI should be optional repair tooling rather than a prerequisite for routine synchronization.

Raw responses, hashes, extraction scripts, callback fixtures, and results are retained locally in `/tmp/neo-huawei-audit-20260929/`. The configuration request manifest is `manifest.json`; static analysis is `analysis.json`; execution results are `callback-checks.json`. Temporary files are reproducibility aids, not the future durable snapshot store.
