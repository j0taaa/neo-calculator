"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type CciCalculatorPanelProps = {
  cpu: string;
  onCpuChange: (value: string) => void;
  onCpuBlur: () => void;
  onCpuStep: (delta: number) => void;
  memory: string;
  onMemoryChange: (value: string) => void;
  onMemoryBlur: () => void;
  onMemoryStep: (delta: number) => void;
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
};

export function CciCalculatorPanel({
  cpu,
  onCpuChange,
  onCpuBlur,
  onCpuStep,
  memory,
  onMemoryChange,
  onMemoryBlur,
  onMemoryStep,
  pricingError,
  pricingLoadingMessage,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: CciCalculatorPanelProps) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">CPU</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => onCpuStep(-1)} aria-label="Decrease CPU">
              -
            </Button>
            <Input
              value={cpu}
              onChange={(event) => onCpuChange(event.target.value)}
              onBlur={onCpuBlur}
              inputMode="numeric"
              className="w-24 bg-white text-center"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => onCpuStep(1)} aria-label="Increase CPU">
              +
            </Button>
            <span className="text-sm text-zinc-500">vCPU</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Memory</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => onMemoryStep(-1)} aria-label="Decrease memory">
              -
            </Button>
            <Input
              value={memory}
              onChange={(event) => onMemoryChange(event.target.value)}
              onBlur={onMemoryBlur}
              inputMode="numeric"
              className="w-24 bg-white text-center"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => onMemoryStep(1)} aria-label="Increase memory">
              +
            </Button>
            <span className="text-sm text-zinc-500">GiB</span>
          </div>
        </div>
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
