"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EipCalculatorPanelProps = {
  type: string;
  typeOptions: readonly string[];
  onTypeChange: (value: string) => void;
  chargeMode: string;
  chargeModeOptions: readonly string[];
  onChargeModeChange: (value: string) => void;
  bandwidthMbit: string;
  onBandwidthMbitChange: (value: string) => void;
  showBandwidth: boolean;
  bandwidthLabel: string;
  bandwidthMinimumMbit?: number | null;
  bandwidthMinimumLabel?: string | null;
  enhanced95DurationMonths: string;
  onEnhanced95DurationMonthsChange: (value: string) => void;
  showEnhanced95DurationMonths: boolean;
  sharedBandwidthQuantity: string;
  onSharedBandwidthQuantityChange: (value: string) => void;
  showSharedBandwidthQuantity: boolean;
  trafficAmount: string;
  trafficUnit: string;
  trafficUnitOptions: readonly string[];
  onTrafficAmountChange: (value: string) => void;
  onTrafficUnitChange: (value: string) => void;
  showTraffic: boolean;
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
};

export function EipCalculatorPanel({
  type,
  typeOptions,
  onTypeChange,
  chargeMode,
  chargeModeOptions,
  onChargeModeChange,
  bandwidthMbit,
  onBandwidthMbitChange,
  showBandwidth,
  bandwidthLabel,
  bandwidthMinimumMbit,
  bandwidthMinimumLabel,
  enhanced95DurationMonths,
  onEnhanced95DurationMonthsChange,
  showEnhanced95DurationMonths,
  sharedBandwidthQuantity,
  onSharedBandwidthQuantityChange,
  showSharedBandwidthQuantity,
  trafficAmount,
  trafficUnit,
  trafficUnitOptions,
  onTrafficAmountChange,
  onTrafficUnitChange,
  showTraffic,
  pricingError,
  pricingLoadingMessage,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: EipCalculatorPanelProps) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Type</p>
          <Select value={type} onValueChange={(value) => value && onTypeChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{type}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Charge mode</p>
          <Select value={chargeMode} onValueChange={(value) => value && onChargeModeChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{chargeMode}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {chargeModeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">EIP type</p>
          <div className="rounded-lg border bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Dynamic BGP</div>
        </div>

        {showBandwidth ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{bandwidthLabel}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={bandwidthMinimumMbit ?? undefined}
                step="any"
                value={bandwidthMbit}
                onChange={(event) => onBandwidthMbitChange(event.target.value)}
                inputMode="decimal"
                className="bg-white"
              />
              <span className="min-w-12 text-sm text-zinc-500">Mbit/s</span>
            </div>
            {bandwidthMinimumLabel ? <p className="text-xs text-zinc-500">{bandwidthMinimumLabel}</p> : null}
          </div>
        ) : null}

        {showSharedBandwidthQuantity ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Bandwidth quantity</p>
            <Input
              type="number"
              min={1}
              step={1}
              value={sharedBandwidthQuantity}
              onChange={(event) => onSharedBandwidthQuantityChange(event.target.value)}
              inputMode="numeric"
              className="bg-white"
            />
          </div>
        ) : null}

        {showEnhanced95DurationMonths ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Required duration</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={enhanced95DurationMonths}
                onChange={(event) => onEnhanced95DurationMonthsChange(event.target.value)}
                inputMode="numeric"
                className="bg-white"
              />
              <span className="min-w-12 text-sm text-zinc-500">months</span>
            </div>
          </div>
        ) : null}

        {showTraffic ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Traffic</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                value={trafficAmount}
                onChange={(event) => onTrafficAmountChange(event.target.value)}
                inputMode="decimal"
                className="bg-white"
              />
              <Select value={trafficUnit} onValueChange={(value) => value && onTrafficUnitChange(value)}>
                <SelectTrigger className="w-28 bg-white">
                  <SelectValue>{trafficUnit}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {trafficUnitOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </section>

      {pricingError ? <p className="text-sm text-red-600">{pricingError}</p> : null}
      {pricingLoadingMessage ? <p className="text-sm text-zinc-500">{pricingLoadingMessage}</p> : null}

      <div className="rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-600">
        {selectionSummary}
        {selectionNotes.map((note) => (
          <p key={note} className="mt-2 text-xs text-zinc-500">
            {note}
          </p>
        ))}
      </div>

      <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
        {referenceNote}
      </div>
    </>
  );
}
