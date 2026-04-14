# Performance Optimization Plan — neo-calculator

## Item 1: Remove dead `xlsx` dependency (~7.3 MB)

**Files:**
- `package.json` — remove `"xlsx": "^0.18.5"` from dependencies (line 31)

**Verification:** Grep confirms zero imports of the `xlsx` package. All `.xlsx` references are file extension strings or `exceljs` API calls.

**Steps:**
1. Remove `"xlsx": "^0.18.5"` from `package.json`
2. Run `bun install`
3. Run `bun run lint` to verify no breakage
4. Run `bun run build` to verify no breakage

---

## Item 2: Add in-memory cache to declarative pricing engine

**File:** `lib/declarative-pricing-engine.ts`

**Problem:** `fetchProductInfoBody()` (line 576) makes a raw HTTP call to Huawei API on every request. No caching, no deduplication.

**Solution:** Add a TTL-based in-memory cache with request deduplication at the `fetchProductInfoBody` level. Model it on the existing `catalogBodyCache` in `lib/huawei-calculator.ts:37`.

```typescript
// Add near the top of declarative-pricing-engine.ts
const productInfoCache = new Map<string, { expiresAt: number; data: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

Wrap `fetchProductInfoBody` to check cache first, and deduplicate concurrent identical requests.

**Steps:**
1. Read `lib/declarative-pricing-engine.ts` fully
2. Read the existing `catalogBodyCache` pattern in `lib/huawei-calculator.ts`
3. Add cache with TTL and request dedup to `fetchProductInfoBody`
4. Run `bun run lint`
5. Run `bun run build`

---

## Item 3: Memoize uncached computations in page.tsx

**File:** `app/page.tsx`

**Changes (lines ~391-402):**

```typescript
// Before:
const totalProjectLists = projects.reduce(...)
const totalProjectProducts = projects.reduce(...)
const selectedServiceMeta = services.find(...)
const selectedProject = projects.find(...)
const selectedList = selectedProject?.lists.find(...)

// After:
const totalProjectLists = useMemo(() => projects.reduce(...), [projects]);
const totalProjectProducts = useMemo(() => projects.reduce(...), [projects]);
const selectedServiceMeta = useMemo(() => services.find(...), [services, selectedService]);
const selectedProject = useMemo(() => projects.find(...), [projects, selectedListId]);
const selectedList = useMemo(() => selectedProject?.lists.find(...), [selectedProject, selectedListId]);
```

**Steps:**
1. Read the relevant lines of `app/page.tsx`
2. Wrap each computation in `useMemo`
3. Run `bun run lint`
4. Run `bun run build`

---

## Item 4: Fix duplicate JSON parsing in loadProjects

**File:** `app/page.tsx` (~lines 696-703)

**Problem:** Response body is parsed twice — once for error check, once for data.

**Solution:** Parse once:

```typescript
const payload = await response.json();
if (!response.ok) {
  throw new Error(getResponseError(payload, "Failed to load projects"));
}
const projectData = payload as AppProject[];
setProjects(projectData);
```

**Steps:**
1. Read the relevant lines
2. Consolidate to single parse
3. Run `bun run lint`
4. Run `bun run build`

---

## Item 5: Add revalidate to catalog API routes

**Files:** All 39 `app/api/catalog/*/route.ts` files

**Solution:** Add `export const revalidate = 300;` (5 minutes) to each route.

Since these will be deduplicated with a factory function (item 6), do these together.

---

## Item 6: Deduplicate 39 catalog route files with factory function

**Files:** All 39 `app/api/catalog/*/route.ts` files

**Solution:** Create a factory helper:

```typescript
// lib/create-catalog-route.ts
export function createCatalogRoute(
  fetchFn: (regionId: string) => Promise<unknown>,
  serviceName: string,
) {
  return async function handler(request: Request) {
    // ... unified handler
  };
}
```

Then each route becomes:
```typescript
// app/api/catalog/dcs-pricing/route.ts
import { createCatalogRoute } from "@/lib/create-catalog-route";
import { fetchDcsPricingCatalog } from "@/lib/dcs-pricing";

export const revalidate = 300;
export const runtime = "nodejs";

export const GET = createCatalogRoute(fetchDcsPricingCatalog, "DCS");
```

**Steps:**
1. Read 3-4 representative route files to confirm the exact pattern
2. Create `lib/create-catalog-route.ts`
3. Refactor all 39 routes
4. Run `bun run lint`
5. Run `bun run build`

---

## Item 7: Fix self-referential HTTP call in v1 catalog route

**File:** `app/api/v1/public/catalog/[service]/route.ts`

**Problem:** Calls itself via `fetch(\`${baseUrl}/api/catalog/...\`)` adding unnecessary HTTP round-trip.

**Solution:** Import and call catalog fetch functions directly. Map service codes to their fetch functions.

**Steps:**
1. Read the full file
2. Import the appropriate catalog fetch functions
3. Replace self-referential fetch with direct function call
4. Run `bun run lint`
5. Run `bun run build`

---

## Item 8: Memoize unstable computations in use-calculator-controller.tsx

**File:** `lib/use-calculator-controller.tsx`

**Changes (~lines 655-656):**
- Wrap `flavorSortOptions` in `useMemo`
- Wrap `calculatorRegionOptions` in `useMemo`
- Wrap `flexusLPanelProps.plans` array in `useMemo` (~line 704)

**Steps:**
1. Read the relevant lines
2. Wrap in `useMemo`
3. Run `bun run lint`
4. Run `bun run build`

---

## Item 9: Lazy-load service bundle parsing on client

**Files:**
- `lib/service-config.ts`
- `lib/declarative-pricing-registry.ts`
- `lib/declarative-service-runtime-registry.ts`

**Solution:**
1. Keep the service catalog metadata (name, code, icon) as a static lightweight import
2. Dynamic-import individual service bundles only when selected
3. Consolidate the 3 separate import sites into a single registry

This requires careful refactoring since `getConfigurableServiceBundleByCode()` is called synchronously from `page.tsx`. The approach would be:
- Keep a minimal static registry for catalog metadata
- Make `getConfigurableServiceBundleByCode` async or pre-load bundles via a React suspense boundary

**Steps:**
1. Analyze all call sites of `getConfigurableServiceBundleByCode`
2. Design the lazy loading approach
3. Implement
4. Test thoroughly

---

## Item 10: Split resource-export.ts for client bundle

**File:** `lib/resource-export.ts` (1,159 lines)

**Solution:**
- Keep text/JSON export helpers in the current file (client-side)
- Move Excel generation code (~1,000 lines) to a new file like `lib/resource-export-excel.ts`
- Dynamic-import the Excel file only when exporting

**Steps:**
1. Read the full file
2. Identify the split point
3. Create `lib/resource-export-excel.ts` with the Excel code
4. Update `resource-export.ts` to dynamic-import the Excel module
5. Run `bun run lint`
6. Run `bun run build`

---

## Item 11: Add concurrency limiter to full-export route

**File:** `app/api/catalog/full-export/route.ts`

**Solution:** Use `Promise.allSettled` with a simple concurrency limiter (no new dependency needed — implement a small `pLimit` utility inline or add to lib).

```typescript
async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  const executing: Promise<void>[] = [];
  for (const task of tasks) {
    const p = task().then(result => { results.push({ status: 'fulfilled', value: result }); })
      .catch(reason => { results.push({ status: 'rejected', reason }); });
    executing.push(p);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(e => e === Promise.race(executing)), 1);
    }
  }
  await Promise.all(executing);
  return results;
}
```

Use `pLimit(tasks, 5)` instead of `Promise.allSettled(tasks)`.

**Steps:**
1. Read the full file
2. Add concurrency limiter
3. Run `bun run lint`
4. Run `bun run build`

---

## Item 12: Deduplicate hardcoded service list in v1/public/services

**File:** `app/api/v1/public/services/route.ts`

**Solution:** Import `serviceCatalog` from `lib/service-config.ts` instead of maintaining a hardcoded list.

**Steps:**
1. Read the file
2. Replace with import
3. Run `bun run lint`
4. Run `bun run build`

---

## Item 13: Parallelize sequential ECS price backfill

**File:** `lib/ecs-flavor-catalog.ts` (~line 626)

**Solution:** Use `Promise.allSettled` with a concurrency limiter (reuse from item 11).

**Steps:**
1. Read the relevant section
2. Add parallel execution with limit of 3-5
3. Run `bun run lint`
4. Run `bun run build`

---

## Item 14: Add next.config.ts optimizations

**File:** `next.config.ts`

**Solution:**
```typescript
const nextConfig: NextConfig = {
  output: "standalone", // Optimized for containerized deployments
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res-static.hc-cdn.cn" },
    ],
  },
};
```

**Steps:**
1. Update `next.config.ts`
2. Run `bun run build`
3. Verify Docker build works

---

## Item 15: Split monolithic page.tsx into hooks/components

**File:** `app/page.tsx` (~2,800 lines)

**Solution:** Extract into:
1. `hooks/use-projects.ts` — Project CRUD state management
2. `hooks/use-cart.ts` — Cart management, filtering, sorting, selection
3. `hooks/use-huawei-sync.ts` — Huawei cart linking/syncing state
4. `hooks/use-clone.ts` — Clone operations state
5. `hooks/use-keyboard-shortcuts.ts` — Keyboard shortcut logic
6. `hooks/use-url-state.ts` — URL state management
7. `components/dashboard/project-manager.tsx` — Project list UI
8. `components/dashboard/cart-panel.tsx` — Cart UI with filters/sort
9. `components/dashboard/calculator-section.tsx` — Calculator section

This is the largest refactor and should be done last after all other optimizations.

**Steps:**
1. Read the full `page.tsx`
2. Identify clear separation boundaries
3. Extract hooks one at a time
4. Extract components
5. Test after each extraction
6. Final lint and build
