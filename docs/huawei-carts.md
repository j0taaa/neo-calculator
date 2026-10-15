# Huawei Carts

`/huawei-carts` is an optional account connection and copy-transfer workspace. It does not participate in calculator discovery, pricing synchronization, or interactive price calculations. Normal Neo calculation still uses the independent engine and published daily catalog.

## User workflow

The navbar exposes **Huawei Carts** to signed-in and anonymous users. Connect a Huawei account, search or sort its saved carts, and select individual carts or a page of carts for import. The default destination is **Local Carts**, without a Neo account or project. Signed-in users can choose a project they can edit. A single successful import opens its Neo copy; a bulk import shows a result and open link for each cart, including retryable failures. Browser history records previous imports per Huawei identity so the page can offer **Open Neo copy** or explicitly **Import another copy**.

Every local and project cart offers **Export to Huawei Cloud**. The export dialog defaults to a new Huawei cart, lets the user set a separate Huawei name (maximum 50 characters), and requires review before writing. Replacing a destination uses a searchable list, preserves its name by default, and explicitly warns that its resources will be replaced. Import and export never establish continuous synchronization or mutate a Neo cart's old Huawei link fields.

Editable imported resources are restored only when all saved controls, billing period and commercial product dimensions can be reproduced by the independent engine. They use published catalog prices. Unknown, historical or ambiguous configurations become clearly marked, read-only saved Huawei resources with their complete original payload and saved estimate. They survive JSON export/import, local persistence and copying back to Huawei. Server signatures prevent silently changing their contents or money. Unreadable resources fail the import instead of disappearing.

Retired Neo resource formats without a valid independent configuration must be reconfigured before a current-price export, as with existing calculator/JSON validation. Preserved estimates are not represented as fresh independent quotes.

## Login and session lifecycle

Huawei ID account authentication has been verified by using the account ID as both `user.domain.name` and `user.name`. IAM login can supply a separate username; virtual MFA accepts the user ID and authenticator code when required. Additional website challenges that cannot be completed through these APIs produce an explicit error rather than a browser fallback.

The HTTP-only chain is:

1. `POST https://iam.myhuaweicloud.com/v3/auth/tokens?nocatalog=true` (domain-scoped password authentication).
2. `POST /v3.0/OS-CREDENTIAL/securitytokens` using the IAM token.
3. `POST /v3.0/OS-AUTH/securitytoken/logintokens` using the temporary credentials.
4. Follow the Huawei federation login to the portal `/index/islogin` endpoint, including its ticket callback. Portal requests need the Huawei calculator Origin/Referer headers.
5. Retain only the applicable `HWS_INTL_ID` and `portal_csrf` cookies. Cart requests send the latter as the `csrf` header.

The password, IAM token, temporary access keys and SSO cookies are not retained. Credential-bearing curl configuration travels through stdin; temporary files are private and removed in `finally`. The shared curl transport also uses stdin so large cart payloads do not hit OS argument limits and cookies do not appear in process arguments. Authenticated requests do not forward cookies through redirects.

The remaining portal cookie is encrypted with AES-256-GCM in the application database. Only a random, HttpOnly, SameSite=Lax cookie reaches the browser; production uses the Secure, host-only `__Host-neo_huawei_connection` cookie. The connection lasts at most eight hours and can expire sooner at Huawei. Disconnect deletes only that browser's server connection. Huawei and Neo sign-ins remain independent. Connection status refreshes on relevant connection events and when returning to the Huawei workspace; ordinary calculator pages do not check Huawei sessions.

Same-origin checks protect mutations; failed credential attempts are limited. Huawei secrets never appear in browser localStorage, connection JSON responses or export documents. The old localStorage cookie and its settings/linking UI have been retired. Existing cookie-based APIs remain for compatibility.

Session encryption and preserved-resource/transfer signatures use keys derived from `HUAWEI_CARTS_SECRET`, falling back to `BETTER_AUTH_SECRET`. Configure a strong, stable `HUAWEI_CARTS_SECRET` in production and retain it when restoring the app and its data. This lets the Huawei connection have its own key without rotating Neo logins. Changing this key invalidates connections and signatures; original preserved data remains in the saved document.

## API and export safety

- `GET/POST/DELETE /api/huawei/connection`: inspect, establish or disconnect the browser's connection.
- `GET /api/huawei/transfers`: read the connected account's cart list.
- `GET /api/huawei/transfers?key=...`: verify ownership and prepare a Neo copy.
- `POST /api/huawei/transfers`, `action: import`: copy a Huawei cart into an authorized Neo project. Local imports commit to the browser store instead.
- `POST /api/huawei/transfers`, `action: preview`: validate/reprice the source locally and return a reviewed export confirmation.
- `POST /api/huawei/transfers`, `action: export`: verify that confirmation and write the copy.

Mutating transfer requests include the displayed `connectionAccount` and `connectionUsername`. An export source is either a permitted Neo `listId` or an importable cart `document`; `exportName` names the Huawei copy and optional `key` chooses replacement. The confirmation binds the connection, complete generated payload, destination revision, expiry and nonce. Account/source/destination changes require a new review. Local source changes in another tab are checked before review and confirmation. Repeated or concurrent confirmations cannot create duplicates. Ambiguous writes remain pending instead of being automatically retried.

A new Huawei cart is created with its full contents in one request. Replacement rechecks membership and complete destination content immediately before writing. Huawei's API provides no atomic compare-and-swap, so a remote edit in the final gap between that check and Huawei accepting the update remains a provider limitation; the UI never overwrites a detected conflict. There is no automatic deletion of Huawei carts.

## Validation

Run the normal unit suite, the isolated route suite, and browser regression suite separately:

```sh
bun test ./lib ./tests/calculator-pricing
bun test tests/huawei-carts-routes.test.ts
node node_modules/playwright/cli.js test --config tests/standalone-calculator.config.ts
HUAWEI_SNAPSHOT_DIR=/path/to/published-snapshots bun scripts/audit-huawei-cart-transfers.ts
```

The isolated route suite mocks Huawei, uses its own temporary database/catalog, and exercises connection encryption, permissions, CSRF, reviewed writes, idempotency, name limits and conflicts. Browser tests use a network-isolated application plus intercepted Huawei connection/transfer responses; regular calculator operations keep external access blocked. The cart-transfer audit evaluates every published default service/region/mode, including component totals and installment schedules, without external requests. Results and the separate live HTTP verification are recorded in `huawei-carts-validation.json`.

The live verification created one uniquely named test cart with seven resources (ECS pay-per-use/subscription/RI, Flexus L subscription, ELB, OBS and CCM one-time), read back identical JSON contents, verified the round-trip prices, replaced only that test cart, and deleted it. Existing Huawei carts were not changed. Live credentials and private responses are not test fixtures.
