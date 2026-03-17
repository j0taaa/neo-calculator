"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ObsStorageClassCard = {
  title: string;
  description: string;
  monthlyPrice: string;
  retrievalSummary: string;
  minimumStorageDays: number;
};

type ObsCalculatorPanelProps = {
  storageClasses: ObsStorageClassCard[];
  selectedStorageClass: string;
  onStorageClassChange: (value: string) => void;
  storageSize: string;
  onStorageSizeChange: (value: string) => void;
  onStorageSizeBlur: () => void;
  onStorageSizeStep: (delta: number) => void;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
};

export function ObsCalculatorPanel({
  storageClasses,
  selectedStorageClass,
  onStorageClassChange,
  storageSize,
  onStorageSizeChange,
  onStorageSizeBlur,
  onStorageSizeStep,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: ObsCalculatorPanelProps) {
  const activeStorageClass = storageClasses.find((entry) => entry.title === selectedStorageClass) ?? storageClasses[0];

  return (
    <>
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <p className="text-sm font-medium">Storage class</p>
          <Select
            value={selectedStorageClass}
            onValueChange={(value) => {
              if (value) {
                onStorageClassChange(value);
              }
            }}
          >
            <SelectTrigger className="bg-white">
              <SelectValue>{activeStorageClass?.title ?? selectedStorageClass}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {storageClasses.map((storageClass) => (
                <SelectItem key={storageClass.title} value={storageClass.title}>
                  {storageClass.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeStorageClass ? (
            <p className="text-sm text-zinc-500">
              {activeStorageClass.description} {activeStorageClass.monthlyPrice}. Retrieval: {activeStorageClass.retrievalSummary}
              {activeStorageClass.minimumStorageDays > 0 ? ` · ${activeStorageClass.minimumStorageDays}-day minimum storage duration` : ""}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Storage size (GiB)</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => onStorageSizeStep(-10)} aria-label="Decrease OBS storage size">
              -
            </Button>
            <Input
              value={storageSize}
              onChange={(event) => onStorageSizeChange(event.target.value)}
              onBlur={onStorageSizeBlur}
              inputMode="numeric"
              placeholder="Storage in GiB"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => onStorageSizeStep(10)} aria-label="Increase OBS storage size">
              +
            </Button>
          </div>
        </div>
      </section>

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
