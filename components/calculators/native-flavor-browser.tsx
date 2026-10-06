"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogFlavor } from "@/lib/calculator-types";
import type { NativeBillingMode } from "@/lib/huawei-native/native-billing";

export function NativeFlavorBrowser({ region, billingMode, disabled, onSelect }: {
  region: string; billingMode: NativeBillingMode; disabled: boolean; onSelect: (flavor: CatalogFlavor) => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<{ region: string; flavors: CatalogFlavor[] } | null>(null);
  const [failure, setFailure] = useState({ region: "", message: "" });
  const error = failure.region === region ? failure.message : "";
  const [query, setQuery] = useState("");
  const [minCpu, setMinCpu] = useState("");
  const [minRam, setMinRam] = useState("");
  const [sort, setSort] = useState("price");
  const [pagination, setPagination] = useState({ key: "", page: 1 });
  const [pageSize, setPageSize] = useState(6);
  const [expanded, setExpanded] = useState(false);
  const catalogRegion = catalog?.region;
  useEffect(() => {
    if (!expanded || catalogRegion === region) return;
    const abort = new AbortController();
    fetch(`/api/catalog/ecs-flavors?region=${encodeURIComponent(region)}`, { signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load flavor catalog");
      if (!Array.isArray(data.flavors)) throw new Error("Incomplete flavor catalog");
      if (!abort.signal.aborted) { setCatalog({ region, flavors: data.flavors }); setFailure({ region, message: "" }); }
    }).catch(error => { if (!abort.signal.aborted) setFailure({ region, message: error.message }); });
    return () => abort.abort();
  }, [region, expanded, catalogRegion]);
  const filterKey = [query, minCpu, minRam, sort, pageSize, region, billingMode].join("|");
  const page = pagination.key === filterKey ? pagination.page : 1;
  const setPage = (page: number) => setPagination({ key: filterKey, page });
  const priceMode = billingMode === "PERIOD" ? "MONTHLY" : billingMode;
  const flavors = useMemo(() => (catalog?.region === region ? catalog.flavors : []).filter(flavor =>
    flavor.cpu >= Number(minCpu || 0) && flavor.ramGiB >= Number(minRam || 0) &&
    `${flavor.resourceSpecCode} ${flavor.family} ${flavor.description} ${flavor.architecture}`.toLowerCase().includes(query.toLowerCase().trim()),
  ).sort((a, b) => sort === "cpu" ? a.cpu - b.cpu || a.ramGiB - b.ramGiB : sort === "memory" ? a.ramGiB - b.ramGiB || a.cpu - b.cpu :
    sort === "name" ? a.resourceSpecCode.localeCompare(b.resourceSpecCode) : (a.prices[priceMode] ?? Infinity) - (b.prices[priceMode] ?? Infinity)),
  [catalog, region, query, minCpu, minRam, sort, priceMode]);
  const pages = Math.max(1, Math.ceil(flavors.length / pageSize));
  const currentPage = Math.min(page, pages);
  return <details className="m-4 rounded-lg border" aria-label="ECS flavor browser" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer p-3 text-sm font-medium">Search and compare ECS flavors</summary>
    <div className="space-y-3 px-3 pb-3">
      <p className="text-xs text-zinc-500">Catalog prices below cover compute only and are reference prices. Selecting a flavor verifies its exact SKU through Huawei and updates the complete estimate.</p>
      <div className="grid gap-3 @min-[480px]/native:grid-cols-2">
        <Input aria-label="Search flavors" placeholder="Search flavors" value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Sort flavors" className="h-10 rounded-md border bg-white px-2 text-sm" value={sort} onChange={event => setSort(event.target.value)}>
          <option value="price">Price: low to high</option><option value="cpu">vCPUs: low to high</option>
          <option value="memory">Memory: low to high</option><option value="name">Name</option>
        </select>
        <Input aria-label="Minimum vCPUs" placeholder="Minimum vCPUs" type="number" min={0} value={minCpu} onChange={event => setMinCpu(event.target.value)} />
        <Input aria-label="Minimum RAM" placeholder="Minimum RAM (GiB)" type="number" min={0} value={minRam} onChange={event => setMinRam(event.target.value)} />
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error} You can still use the official controls below.</p> : catalog?.region !== region ?
        <p role="status" className="text-sm">Loading ECS flavors…</p> : <>
          <p className="text-xs text-zinc-500">{flavors.length} matching flavors</p>
          <ul className="space-y-2">{flavors.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(flavor => <li key={flavor.resourceSpecCode} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0"><p className="break-all text-sm font-medium">{flavor.resourceSpecCode}</p>
              <p className="text-xs text-zinc-500">{flavor.cpu} vCPUs · {flavor.ramGiB} GiB · {flavor.architecture}</p>
              <p className="text-xs">{flavor.prices[priceMode] !== undefined ? `${flavor.currency} ${flavor.prices[priceMode]} / ${priceMode === "ONDEMAND" ? "hour" : priceMode === "MONTHLY" ? "month" : "term"}` : "No catalog reference price for this mode"}</p></div>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => void onSelect(flavor)} aria-label={`Select ${flavor.resourceSpecCode}`}>Select</Button>
          </li>)}</ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <span className="text-xs">Page {currentPage} of {pages}</span>
            <Button size="sm" variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button>
            <select aria-label="Flavors per page" className="h-9 rounded-md border bg-white px-2 text-sm" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>
              {[3, 6, 12, 24].map(size => <option key={size} value={size}>{size} per page</option>)}
            </select>
          </div>
        </>}
    </div>
  </details>;
}
