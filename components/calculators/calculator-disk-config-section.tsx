"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CalculatorDiskConfigSectionProps = {
  mode: "ecs" | "evs";
  systemDiskType: string;
  systemDiskOptions: readonly string[];
  onSystemDiskTypeChange: (value: string) => void;
  systemDiskSize: string;
  onSystemDiskSizeChange: (value: string) => void;
  onSystemDiskSizeBlur: () => void;
  onSystemDiskSizeStep: (delta: number) => void;
  showGpSsd2Controls: boolean;
  gpSsd2Iops: string;
  gpSsd2IopsRange: { min: number; max: number } | null;
  onGpSsd2IopsChange: (value: string) => void;
  onGpSsd2IopsBlur: () => void;
  gpSsd2Throughput: string;
  gpSsd2ThroughputRange: { min: number; max: number } | null;
  onGpSsd2ThroughputChange: (value: string) => void;
  onGpSsd2ThroughputBlur: () => void;
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  notes: string[];
  selectionSummary: string;
  selectionNotes: string[];
};

export function CalculatorDiskConfigSection({
  mode,
  systemDiskType,
  systemDiskOptions,
  onSystemDiskTypeChange,
  systemDiskSize,
  onSystemDiskSizeChange,
  onSystemDiskSizeBlur,
  onSystemDiskSizeStep,
  showGpSsd2Controls,
  gpSsd2Iops,
  gpSsd2IopsRange,
  onGpSsd2IopsChange,
  onGpSsd2IopsBlur,
  gpSsd2Throughput,
  gpSsd2ThroughputRange,
  onGpSsd2ThroughputChange,
  onGpSsd2ThroughputBlur,
  pricingError,
  pricingLoadingMessage,
  notes,
  selectionSummary,
  selectionNotes,
}: CalculatorDiskConfigSectionProps) {
  return (
    <>
      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium">{mode === "evs" ? "Volume Type" : "System Disk"}</p>
          {mode === "evs" ? <p className="mt-1 text-sm text-zinc-500">Choose the EVS disk type and capacity you want to price.</p> : null}
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Select
            value={systemDiskType}
            onValueChange={(value) => {
              if (value) {
                onSystemDiskTypeChange(value);
              }
            }}
          >
            <SelectTrigger className="w-full bg-white lg:w-72">
              <SelectValue>{systemDiskType}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {systemDiskOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-none px-3"
                onClick={() => onSystemDiskSizeStep(-10)}
              >
                -
              </Button>
              <Input
                value={systemDiskSize}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, "");
                  onSystemDiskSizeChange(digitsOnly);
                }}
                onBlur={onSystemDiskSizeBlur}
                inputMode="numeric"
                className="h-11 w-20 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-none px-3"
                onClick={() => onSystemDiskSizeStep(10)}
              >
                +
              </Button>
            </div>
            <span className="text-sm font-medium text-zinc-500">GiB</span>
          </div>
        </div>

        {showGpSsd2Controls && gpSsd2IopsRange && gpSsd2ThroughputRange ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">IOPS</p>
              <Input
                value={gpSsd2Iops}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, "");
                  onGpSsd2IopsChange(digitsOnly);
                }}
                onBlur={onGpSsd2IopsBlur}
                inputMode="numeric"
                placeholder={`${gpSsd2IopsRange.min}-${gpSsd2IopsRange.max}`}
              />
              <p className="text-xs text-zinc-500">
                {gpSsd2IopsRange.min}-{gpSsd2IopsRange.max} IOPS, capped at 500 IOPS per GiB.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Throughput (MB/s)</p>
              <Input
                value={gpSsd2Throughput}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, "");
                  onGpSsd2ThroughputChange(digitsOnly);
                }}
                onBlur={onGpSsd2ThroughputBlur}
                inputMode="numeric"
                placeholder={`${gpSsd2ThroughputRange.min}-${gpSsd2ThroughputRange.max}`}
              />
              <p className="text-xs text-zinc-500">
                {gpSsd2ThroughputRange.min}-{gpSsd2ThroughputRange.max} MB/s, capped at one quarter of the selected IOPS.
              </p>
            </div>
          </div>
        ) : null}

        {pricingError ? <p className="text-sm text-red-600">{pricingError}</p> : null}
        {pricingLoadingMessage ? <p className="text-sm text-zinc-500">{pricingLoadingMessage}</p> : null}
        {notes.map((note) => (
          <p key={note} className="text-sm text-zinc-500">
            {note}
          </p>
        ))}
      </section>

      <div className="rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-600">
        {selectionSummary}
        {selectionNotes.map((note) => (
          <p key={note} className="mt-2 text-xs text-zinc-500">
            {note}
          </p>
        ))}
      </div>
    </>
  );
}
