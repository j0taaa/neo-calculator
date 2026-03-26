"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NatCalculatorPanelProps = {
  natType: string;
  natTypeOptions: readonly string[];
  onNatTypeChange: (value: string) => void;
  natSize: string;
  natSizeOptions: readonly string[];
  onNatSizeChange: (value: string) => void;
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
};

export function NatCalculatorPanel({
  natType,
  natTypeOptions,
  onNatTypeChange,
  natSize,
  natSizeOptions,
  onNatSizeChange,
  pricingError,
  pricingLoadingMessage,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: NatCalculatorPanelProps) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Gateway type</p>
          <Select value={natType} onValueChange={(value) => value && onNatTypeChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{natType}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {natTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Specifications</p>
          <Select value={natSize} onValueChange={(value) => value && onNatSizeChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{natSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {natSizeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
