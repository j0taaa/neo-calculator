"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CceCalculatorPanelProps = {
  clusterScale: string;
  clusterScaleOptions: readonly string[];
  onClusterScaleChange: (value: string) => void;
  masterNodes: string;
  masterNodesOptions: readonly string[];
  onMasterNodesChange: (value: string) => void;
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
};

export function CceCalculatorPanel({
  clusterScale,
  clusterScaleOptions,
  onClusterScaleChange,
  masterNodes,
  masterNodesOptions,
  onMasterNodesChange,
  pricingError,
  pricingLoadingMessage,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: CceCalculatorPanelProps) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Cluster Scale</p>
          <Select value={clusterScale} onValueChange={(value) => value && onClusterScaleChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{clusterScale}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clusterScaleOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Master Nodes</p>
          <Select value={masterNodes} onValueChange={(value) => value && onMasterNodesChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{masterNodes}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {masterNodesOptions.map((option) => (
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
