"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";


type FlavorListItem = {
  name: string;
  family: string;
  priceModeLabel: string;
  price: string;
  riPrice: string | null;
  vcpu: string;
  ram: string;
};

export type EcsFlavorPickerProps = {
  minVcpuValue: string;
  onMinVcpuChange: (value: string) => void;
  minRamValue: string;
  onMinRamChange: (value: string) => void;
  flavorQuery: string;
  onFlavorQueryChange: (value: string) => void;
  flavorSort: string;
  flavorSortOptions: Array<{ value: string; label: string }>;
  onFlavorSortChange: (value: string) => void;
  flavorPageSize: number;
  flavorPageSizeOptions: readonly number[];
  onFlavorPageSizeChange: (value: number) => void;
  catalogFlavorsError: string;
  catalogFlavorsLastCompletedAt: string | null;
  catalogFlavorsLoading: boolean;
  visibleFlavors: FlavorListItem[];
  selectedFlavor: string;
  onSelectFlavor: (name: string, vcpu: string, ram: string) => void;
  currentFlavorPage: number;
  totalFlavorPages: number;
  onPreviousFlavorPage: () => void;
  onNextFlavorPage: () => void;
  showFlexusLToggleVisible: boolean;
  showFlexusLChecked: boolean;
  onShowFlexusLChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function EcsFlavorPicker({
  minVcpuValue,
  onMinVcpuChange,
  minRamValue,
  onMinRamChange,
  flavorQuery,
  onFlavorQueryChange,
  flavorSort,
  flavorSortOptions,
  onFlavorSortChange,
  flavorPageSize,
  flavorPageSizeOptions,
  onFlavorPageSizeChange,
  catalogFlavorsError,
  catalogFlavorsLastCompletedAt,
  catalogFlavorsLoading,
  visibleFlavors,
  selectedFlavor,
  onSelectFlavor,
  currentFlavorPage,
  totalFlavorPages,
  onPreviousFlavorPage,
  onNextFlavorPage,
  showFlexusLToggleVisible,
  showFlexusLChecked,
  onShowFlexusLChange,
  disabled = false,
}: EcsFlavorPickerProps) {
  return (
    <>
      <section className="space-y-3">
        <div className="grid gap-4 @min-[480px]/workspace:grid-cols-2">
          <div className="space-y-2" data-calculator-focus-group>
            <p className="text-sm font-medium">Minimum vCPUs</p>
            <Input
              aria-label="Minimum vCPUs"
              value={minVcpuValue}
              data-calculator-focus-target
              onChange={(event) => onMinVcpuChange(event.target.value)}
              inputMode="numeric"
              placeholder="Show flavors with at least this many vCPUs"
            />
          </div>
          <div className="space-y-2" data-calculator-focus-group>
            <p className="text-sm font-medium">Minimum Memory (GiB)</p>
            <Input
              aria-label="Minimum RAM"
              value={minRamValue}
              data-calculator-focus-target
              onChange={(event) => onMinRamChange(event.target.value)}
              inputMode="numeric"
              placeholder="Show flavors with at least this much RAM"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Flavor</p>
          </div>
          <div className="grid grid-cols-1 gap-2 @min-[480px]/workspace:grid-cols-2 @min-[780px]/workspace:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
            {showFlexusLToggleVisible ? (
              <label data-calculator-focus-group className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <Checkbox
                  data-calculator-focus-target
                  checked={showFlexusLChecked}
                  onCheckedChange={(checked) => onShowFlexusLChange(Boolean(checked))}
                  aria-label="Show Flexus L"
                />
                <span>Show Flexus L</span>
              </label>
            ) : null}
            <div className="min-w-0" data-calculator-focus-group>
              <Input
                aria-label="Search flavors"
                value={flavorQuery}
                data-calculator-focus-target
                onChange={(event) => onFlavorQueryChange(event.target.value)}
                placeholder="Search flavors"
              />
            </div>
            <div data-calculator-focus-group>
            <Select
              value={flavorSort}
              onValueChange={(value) => {
                if (value) {
                  onFlavorSortChange(value);
                }
              }}
            >
              <SelectTrigger aria-label="Sort flavors" data-calculator-focus-target className="w-full min-w-0 bg-white">
                <SelectValue>{flavorSortOptions.find((option) => option.value === flavorSort)?.label ?? flavorSort}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {flavorSortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} onClick={() => onFlavorSortChange(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <div data-calculator-focus-group>
            <Select
              value={String(flavorPageSize)}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }
                const nextPageSize = Number(value);
                if (Number.isFinite(nextPageSize)) {
                  onFlavorPageSizeChange(nextPageSize);
                }
              }}
            >
              <SelectTrigger aria-label="Flavors per page" data-calculator-focus-target className="w-full min-w-0 bg-white">
                <SelectValue>{`${flavorPageSize} per page`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {flavorPageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)} onClick={() => onFlavorPageSizeChange(option)}>
                    {option} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-zinc-50 p-3" data-calculator-focus-group>
          {catalogFlavorsError ? <p className="mb-3 text-sm text-red-600">{catalogFlavorsError}</p> : null}
          {catalogFlavorsLastCompletedAt ? (
            <p className="mb-3 text-xs text-zinc-500">Last synced: {formatDateTime(catalogFlavorsLastCompletedAt)}</p>
          ) : null}
          <div className="space-y-2">
            {catalogFlavorsLoading ? (
              <div className="rounded-lg border border-dashed bg-white px-3 py-6 text-center text-sm text-zinc-500">
                Loading ECS flavors...
              </div>
            ) : null}

            {visibleFlavors.map((flavor) => {
              const isSelected = selectedFlavor === flavor.name;

              return (
                <button
                  key={flavor.name}
                  type="button"
                  aria-label={`Select ${flavor.name}`}
                  disabled={disabled}
                  data-calculator-focus-target={isSelected ? "" : undefined}
                  aria-pressed={isSelected}
                  className={`flex w-full flex-col items-start justify-between gap-2 @min-[480px]/workspace:flex-row @min-[480px]/workspace:items-center rounded-lg border px-3 py-3 text-left disabled:cursor-wait disabled:opacity-60 ${
                    isSelected ? "border-zinc-950 bg-white" : "border-zinc-200 bg-white/80"
                  }`}
                  onClick={() => onSelectFlavor(flavor.name, flavor.vcpu, flavor.ram)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-medium text-zinc-950">{flavor.name}</p>
                    <p className="text-sm text-zinc-500">{flavor.family}</p>
                    <p className="text-xs text-zinc-400">{flavor.priceModeLabel}</p>
                  </div>
                  <div className="shrink-0 text-sm @min-[480px]/workspace:text-right">
                    <p className="font-medium text-zinc-950">{flavor.price}</p>
                    <p className="text-zinc-500">
                      {flavor.vcpu} vCPUs · {flavor.ram} GiB RAM
                    </p>
                  </div>
                </button>
              );
            })}

            {!catalogFlavorsLoading && visibleFlavors.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-white px-3 py-6 text-center text-sm text-zinc-500">
                No flavors matched your search.
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
            <span>
              Page {currentFlavorPage} of {totalFlavorPages}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onPreviousFlavorPage} disabled={currentFlavorPage === 1}>
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onNextFlavorPage}
                disabled={currentFlavorPage === totalFlavorPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
