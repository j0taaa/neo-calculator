"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DurationOption = {
  value: string;
  label: string;
};

type VpnCalculatorPanelProps = {
  edition: string;
  editionOptions: readonly string[];
  onEditionChange: (value: string) => void;
  showEnterpriseFields: boolean;
  mode: string;
  modeOptions: readonly string[];
  onModeChange: (value: string) => void;
  networkType: string;
  networkTypeOptions: readonly string[];
  onNetworkTypeChange: (value: string) => void;
  specification: string;
  specificationOptions: readonly string[];
  showEipGroup: boolean;
  useSharedBandwidth: boolean;
  onUseSharedBandwidthChange: (value: boolean) => void;
  eipBandwidthMbit1: string;
  onEipBandwidthMbit1Change: (value: string) => void;
  eipBandwidthMbit2: string;
  onEipBandwidthMbit2Change: (value: string) => void;
  durationMonths: string;
  durationMonthOptions: readonly DurationOption[];
  onDurationMonthsChange: (value: string) => void;
  showDurationMonths: boolean;
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
  descriptionNote: string;
};

export function VpnCalculatorPanel({
  edition,
  editionOptions,
  onEditionChange,
  showEnterpriseFields,
  mode,
  modeOptions,
  onModeChange,
  networkType,
  networkTypeOptions,
  onNetworkTypeChange,
  specification,
  specificationOptions,
  showEipGroup,
  useSharedBandwidth,
  onUseSharedBandwidthChange,
  eipBandwidthMbit1,
  onEipBandwidthMbit1Change,
  eipBandwidthMbit2,
  onEipBandwidthMbit2Change,
  durationMonths,
  durationMonthOptions,
  onDurationMonthsChange,
  showDurationMonths,
  pricingError,
  pricingLoadingMessage,
  selectionSummary,
  selectionNotes,
  referenceNote,
  descriptionNote,
}: VpnCalculatorPanelProps) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">VPN Edition</p>
          <Select value={edition} onValueChange={(value) => value && onEditionChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{edition}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {editionOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showEnterpriseFields ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Mode</p>
              <Select value={mode} onValueChange={(value) => value && onModeChange(value)}>
                <SelectTrigger className="bg-white">
                  <SelectValue>{mode}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {modeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Network Type</p>
              <Select value={networkType} onValueChange={(value) => value && onNetworkTypeChange(value)}>
                <SelectTrigger className="bg-white">
                  <SelectValue>{networkType}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {networkTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Specification</p>
              <Select value={specification} disabled>
                <SelectTrigger className="bg-zinc-50">
                  <SelectValue>{specification}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {specificationOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <p className="text-sm font-medium">Description</p>
              <div className="rounded-lg border bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                {descriptionNote}
              </div>
            </div>

            {showEipGroup ? (
              <div className="space-y-2 md:col-span-2">
                <p className="text-sm font-medium">EIP Group</p>
                <div className="rounded-lg border bg-zinc-50 p-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Using Shared Bandwidth</p>
                      <Select
                        value={useSharedBandwidth ? "Yes" : "No"}
                        onValueChange={(value) => onUseSharedBandwidthChange(value === "Yes")}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue>{useSharedBandwidth ? "Yes" : "No"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">EIP 1 Bandwidth</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={eipBandwidthMbit1}
                          onChange={(event) => onEipBandwidthMbit1Change(event.target.value)}
                          inputMode="decimal"
                          className="bg-white"
                        />
                        <span className="min-w-12 text-sm text-zinc-500">Mbit/s</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">EIP 2 Bandwidth</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={eipBandwidthMbit2}
                          onChange={(event) => onEipBandwidthMbit2Change(event.target.value)}
                          inputMode="decimal"
                          className="bg-white"
                        />
                        <span className="min-w-12 text-sm text-zinc-500">Mbit/s</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {showDurationMonths ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Required Duration</p>
            <Select value={durationMonths} onValueChange={(value) => value && onDurationMonthsChange(value)}>
              <SelectTrigger className="bg-white">
                <SelectValue>{durationMonthOptions.find((option) => option.value === durationMonths)?.label ?? durationMonths}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {durationMonthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
