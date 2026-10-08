"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EcsFlavorPicker } from "./ecs-flavor-picker";
import type { CatalogFlavor } from "@/lib/calculator-types";
import type { NativeBillingMode } from "@/lib/huawei-native/native-billing";

const sorts = [{ value: "price", label: "Price: Lowest first" }, { value: "price-desc", label: "Price: Highest first" },
  { value: "name", label: "Name: A to Z" }, { value: "cpu", label: "vCPU: Lowest first" }];
export function NativeFlavorBrowser({ region, billingMode, disabled, selectedFlavor = "", enabled = true, releaseId, locationCode, onSelect }: {
  region: string; billingMode: NativeBillingMode; disabled: boolean; selectedFlavor?: string; enabled?: boolean;
  onSelect: (flavor: CatalogFlavor) => Promise<void>;
  releaseId?: string; locationCode?: string;
}) {
  const scopeKey = [region, releaseId ?? "", locationCode ?? ""].join("/");
  const [catalog, setCatalog] = useState<{ key: string; flavors: CatalogFlavor[]; lastCompletedAt: string | null } | null>(null);
  const [failure, setFailure] = useState({ key: "", message: "" });
  const error = failure.key === scopeKey ? failure.message : "";
  const [query, setQuery] = useState("");
  const [minCpu, setMinCpu] = useState("2");
  const [minRam, setMinRam] = useState("4");
  const [sort, setSort] = useState("price");
  const [pagination, setPagination] = useState({ key: "", page: 1 });
  const [pageSize, setPageSize] = useState(3);
  const [attempt, setAttempt] = useState(0);
  const catalogKey = catalog?.key;
  useEffect(() => {
    if (!enabled || catalogKey === scopeKey) return;
    const abort = new AbortController();
    const params = new URLSearchParams({ region, computeOnly: "1" });
    if (releaseId) params.set("release", releaseId);
    if (locationCode) params.set("locationCode", locationCode);
    fetch(`/api/catalog/ecs-flavors?${params}`, { signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error ?? "Unable to load flavor catalog");
      if (!Array.isArray(data.flavors)) throw new Error("Incomplete flavor catalog");
      if (!abort.signal.aborted) { setCatalog({ key: scopeKey, flavors: data.flavors, lastCompletedAt: data.lastCompletedAt ?? null }); setFailure({ key: scopeKey, message: "" }); }
    }).catch(error => { if (!abort.signal.aborted) setFailure({ key: scopeKey, message: error.message }); });
    return () => abort.abort();
  }, [region, releaseId, locationCode, scopeKey, catalogKey, attempt, enabled]);
  const filterKey = [query, minCpu, minRam, sort, pageSize, scopeKey, billingMode].join("|");
  const page = pagination.key === filterKey ? pagination.page : 1;
  const setPage = (page: number) => setPagination({ key: filterKey, page });
  const priceMode = billingMode === "PERIOD" ? "MONTHLY" : billingMode;
  const flavors = useMemo(() => (catalog?.key === scopeKey ? catalog.flavors : []).filter(flavor =>
    flavor.cpu >= Number(minCpu || 0) && flavor.ramGiB >= Number(minRam || 0) &&
    `${flavor.resourceSpecCode} ${flavor.family} ${flavor.description} ${flavor.architecture}`.toLowerCase().includes(query.toLowerCase().trim()),
  ).sort((a, b) => {
    if (sort === "cpu") return a.cpu - b.cpu || a.ramGiB - b.ramGiB;
    if (sort === "name") return a.resourceSpecCode.localeCompare(b.resourceSpecCode);
    const price = (flavor: CatalogFlavor) => flavor.prices[priceMode] ?? (sort === "price-desc" ? -Infinity : Infinity);
    return sort === "price-desc" ? price(b) - price(a) : price(a) - price(b);
  }), [catalog, scopeKey, query, minCpu, minRam, sort, priceMode]);
  const pages = Math.max(1, Math.ceil(flavors.length / pageSize));
  const currentPage = Math.min(page, pages);
  return <section aria-label="ECS flavor browser" className="space-y-3">
    <EcsFlavorPicker minVcpuValue={minCpu} onMinVcpuChange={setMinCpu} minRamValue={minRam} onMinRamChange={setMinRam}
      flavorQuery={query} onFlavorQueryChange={setQuery} flavorSort={sort} flavorSortOptions={sorts} onFlavorSortChange={setSort}
      flavorPageSize={pageSize} flavorPageSizeOptions={[1, 3, 5, 10, 20]} onFlavorPageSizeChange={setPageSize}
      catalogFlavorsError={error} catalogFlavorsLastCompletedAt={catalog?.key === scopeKey ? catalog.lastCompletedAt : null}
      catalogFlavorsLoading={catalog?.key !== scopeKey && !error} selectedFlavor={selectedFlavor} disabled={disabled}
      visibleFlavors={flavors.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(flavor => ({
        name: flavor.resourceSpecCode, family: flavor.family ?? flavor.series ?? flavor.architecture ?? "ECS",
        vcpu: String(flavor.cpu), ram: String(flavor.ramGiB), riPrice: null,
        priceModeLabel: "Compute reference price", price: flavor.prices[priceMode] !== undefined ?
          `${flavor.currency} ${flavor.prices[priceMode]} / ${priceMode === "ONDEMAND" ? "hour" : priceMode === "MONTHLY" ? "month" : "term"}` : "Huawei price checked on selection",
      }))}
      onSelectFlavor={name => { const flavor = flavors.find(flavor => flavor.resourceSpecCode === name); if (flavor) void onSelect(flavor); }}
      currentFlavorPage={currentPage} totalFlavorPages={pages} onPreviousFlavorPage={() => setPage(currentPage - 1)} onNextFlavorPage={() => setPage(currentPage + 1)}
      showFlexusLToggleVisible={false} showFlexusLChecked={false} onShowFlexusLChange={() => {}} />
    {selectedFlavor && <p className="text-sm">Selected flavor: <strong>{selectedFlavor}</strong></p>}
    <p className="text-xs text-zinc-500"><span>{flavors.length} matching flavors</span>. Reference prices cover compute only; your complete estimate uses synchronized Huawei rates.</p>
    {error && <Button variant="outline" size="sm" onClick={() => { setFailure({ key: scopeKey, message: "" }); setAttempt(value => value + 1); }}>Retry flavors</Button>}
  </section>;
}
