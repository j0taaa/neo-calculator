"use client";

import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";

import { CalculatorDiskConfigSection, type CalculatorDiskConfigSectionProps } from "./calculator-disk-config-section";

type FlavorListItem = {
  name: string;
  family: string;
  priceModeLabel: string;
  price: string;
  vcpu: string;
  ram: string;
};

type EcsCalculatorPanelProps = {
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
  diskConfigProps: CalculatorDiskConfigSectionProps;
  children?: ReactNode;
};

export function EcsCalculatorPanel({
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
  diskConfigProps,
  children,
}: EcsCalculatorPanelProps) {
  return (
    <>
      <section className="space-y-3">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Minimum vCPUs</p>
            <Input
              value={minVcpuValue}
              onChange={(event) => onMinVcpuChange(event.target.value)}
              inputMode="numeric"
              placeholder="Show flavors with at least this many vCPUs"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Minimum Memory (GiB)</p>
            <Input
              value={minRamValue}
              onChange={(event) => onMinRamChange(event.target.value)}
              inputMode="numeric"
              placeholder="Show flavors with at least this much RAM"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Flavor</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {showFlexusLToggleVisible ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <Checkbox
                  checked={showFlexusLChecked}
                  onCheckedChange={(checked) => onShowFlexusLChange(Boolean(checked))}
                  aria-label="Show Flexus L"
                />
                <span>Show Flexus L</span>
              </label>
            ) : null}
            <div className="w-full sm:w-44">
              <Input
                value={flavorQuery}
                onChange={(event) => onFlavorQueryChange(event.target.value)}
                placeholder="Search flavors"
              />
            </div>
            <Select
              value={flavorSort}
              onValueChange={(value) => {
                if (value) {
                  onFlavorSortChange(value);
                }
              }}
            >
              <SelectTrigger className="w-full bg-white sm:w-52">
                <SelectValue>{flavorSortOptions.find((option) => option.value === flavorSort)?.label ?? flavorSort}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {flavorSortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <SelectTrigger className="w-full bg-white sm:w-36">
                <SelectValue>{`${flavorPageSize} per page`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {flavorPageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border bg-zinc-50 p-3">
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
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left ${
                    isSelected ? "border-zinc-950 bg-white" : "border-zinc-200 bg-white/80"
                  }`}
                  onClick={() => onSelectFlavor(flavor.name, flavor.vcpu, flavor.ram)}
                >
                  <div>
                    <p className="font-medium text-zinc-950">{flavor.name}</p>
                    <p className="text-sm text-zinc-500">{flavor.family}</p>
                    <p className="text-xs text-zinc-400">{flavor.priceModeLabel}</p>
                  </div>
                  <div className="text-right text-sm">
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

          <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
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

      <CalculatorDiskConfigSection {...diskConfigProps} />
      {children}
    </>
  );
}
