> This is the earlier QuickJS audit. The preview now runs a browser-backed adapter for complex forms; see [the current implementation and validation](huawei-native-calculator.md). The captured results below are preserved as historical evidence.

# Complex-service and regional sync audit

Captured 2026-09-29 (Asia/Shanghai). This audit tests the new automatic adapter, not the existing handwritten ECS/ELB/DCS calculators.

## Conclusion

The current adapter does **not** provide complete ECS or ELB parity. Region-specific data is fetched independently, but that does not establish complete regional form behavior. NAT passes the sampled exhaustive selector checks; DCS passes default-form checks but exceeds the current exhaustive scenario budget. The publication gate correctly keeps incomplete scopes unavailable for quoting.

| Service | Hong Kong | São Paulo | Singapore |
|---|---|---|---|
| NAT | 16 comparisons passed | 16 comparisons passed | 16 comparisons passed |
| ECS | Held: repeatable disk component unsupported | Same blocker | Same blocker |
| ELB | Held: callback environment lacks console | Same blocker | Same blocker |
| DCS | Default passed 2 checks; full scope held | Same result | Same result |

NAT checks cover public/private gateways × four sizes × two durations. DCS default checks compare fields/options, full inquiry payloads, component amounts and total prices at two durations. These six DCS checks do not justify promoting all configurations.

ECS's default official form has 13 visible field rows, excluding informational tips, while the generated form has five. Field rows are not a count of all possible fields or combinations. `CommonAddible` is unsupported; the captured official form also includes image and EIP choices absent from the generated form.

ELB evaluation currently fails on an upstream `console` call. Removing that immediate blocker would not establish parity: its official form also uses checkbox groups, derived LCUs, unit choices and dependent traffic controls. Observed transitions between shared, dedicated elastic and fixed specifications change the visible component set. These transitions were captured through actual UI clicks, with outgoing inquiries recorded; they are observations, not passing Neo comparisons.

DCS's generated default matches the official default, but enumeration exceeds 128 reachable states. Added a wall-clock/evaluation budget so a large search fails explicitly instead of consuming unbounded work. Supporting large catalogs requires branch-directed coverage and separating flavor inventory from structural control-flow combinations, rather than just raising the cap.

## Measured regional differences

| Service | Metric | Hong Kong | São Paulo | Singapore |
|---|---|---:|---:|---:|
| ECS | Catalog product records | 2,636 | 2,313 | 3,192 |
| ECS | Distinct specification codes | 1,530 | 1,007 | 1,905 |
| ELB | Catalog product records | 84 | 71 | 85 |
| ELB | Distinct specification codes | 13 | 12 | 14 |
| DCS | Catalog product records | 1,726 | 1,690 | 1,699 |
| NAT | Catalog product records | 8 | 8 | 8 |

These catalogs contain multiple resource types and billing variants. Product/specification counts must not be described as the number of selectable ECS instance flavors.

In the sampled default ECS state, Huawei exposes nine instance-type choices in Hong Kong and eight in São Paulo; image choices differ 19 versus 10. In ELB's dedicated state, Hong Kong exposes General AZ and Edge AZ under Sub-AZ, while São Paulo exposes General AZ only. ECS switches to Kunpeng and ELB shared/dedicated/fixed transitions were captured in each region.

The production worker discovers 24 HWC calculator-enabled regions from the directory. This audit tests only `ap-southeast-1`, `sa-brazil-1` and `ap-southeast-3`, pay-per-use, quantity one. It does not verify every region, availability zone, flavor, billing mode or numeric boundary.

## Reproduction and preview

```bash
HWC_SOCKS5_PROXY=socks5h://172.17.0.1:40001 \
HUAWEI_SYNC_DB=/tmp/neo-sync-complex-audit/sync.sqlite \
HUAWEI_SYNC_SERVICES=ecs,elb,redis,nat \
HUAWEI_SYNC_REGIONS=ap-southeast-1,sa-brazil-1,ap-southeast-3 \
HUAWEI_SYNC_MAX_SCOPES=12 bun run sync:calculator:once

HWC_SOCKS5_PROXY=socks5h://172.17.0.1:40001 bun run scripts/audit-huawei-sync.ts
HWC_SOCKS5_PROXY=socks5h://172.17.0.1:40001 bun run scripts/audit-huawei-sync-defaults.ts
```

The audit script stores source hashes, catalog inventories, generated fields, official field observations, observed UI transitions, inquiry requests/responses, screenshots and HTML under `HUAWEI_AUDIT_DIR` (default `/tmp/neo-sync-complex-audit`). Chromium receives the captured configuration/product/menu bodies, so comparisons use coherent captured inputs. This is a limited audit, not an exhaustive regression suite.

The isolated preview is **https://calculator-lab.hwctools.site/sync-lab**. It contains generated controls beside recorded official fields, regional catalog counts, explicit publication status and screenshots. NAT can request current Huawei prices. Incomplete scopes cannot quote, including direct API attempts. The reference column remains a recorded state, not a live mirror of the left-hand selection.

`compose.sync-lab.yml` deploys a separate app with its own app-data volume and a copy of the audit database. It uses Traefik HTTPS, exposes no public host port, and marks pages noindex. `HUAWEI_SYNC_LAB_DIR` gates the audit API; without it the API returns 404. The preview has no production account/cart data and does not write estimates.

Set `SYNC_LAB_AUTH_SECRET` to a separate random secret and `SYNC_LAB_DATA_DIR` to the captured dataset directory, using an environment file outside the repository. On this VPS that file is `/home/neo-calculator-lab.env`; the dataset is `/home/neo-calculator-lab-data`.

```bash
docker compose --env-file /home/neo-calculator-lab.env -p neo-sync-lab -f compose.sync-lab.yml up -d --build
NEO_TEST_URL=https://calculator-lab.hwctools.site bunx playwright test --config tests/sync-lab.config.ts
```

The preview is a frozen audit, without a background synchronization worker. Captured forms and evidence remain viewable, but current-price eligibility expires after the existing 24-hour verification window. A new capture/verification refreshes that window. This prevents an old demonstration from presenting itself as continuously verified.
