"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ObsCalculatorPanelProps = {
  productType: string;
  productTypeOptions: string[];
  onProductTypeChange: (value: string) => void;
  storageClass: string;
  storageClassOptions: string[];
  onStorageClassChange: (value: string) => void;
  redundancy: string;
  redundancyOptions: string[];
  onRedundancyChange: (value: string) => void;
  storageAmount: string;
  storageUnit: string;
  storageUnitOptions: readonly string[];
  onStorageAmountChange: (value: string) => void;
  onStorageAmountBlur: () => void;
  onStorageAmountStep: (delta: number) => void;
  onStorageUnitChange: (value: string) => void;
  durationMonths: string;
  onDurationMonthsChange: (value: string) => void;
  onDurationMonthsBlur: () => void;
  outboundTrafficAmount: string;
  outboundTrafficUnit: string;
  onOutboundTrafficAmountChange: (value: string) => void;
  onOutboundTrafficUnitChange: (value: string) => void;
  readRequests: string;
  onReadRequestsChange: (value: string) => void;
  writeRequests: string;
  onWriteRequestsChange: (value: string) => void;
  deleteRequests: string;
  onDeleteRequestsChange: (value: string) => void;
  pullTrafficAmount: string;
  pullTrafficUnit: string;
  onPullTrafficAmountChange: (value: string) => void;
  onPullTrafficUnitChange: (value: string) => void;
  replicationTrafficAmount: string;
  replicationTrafficUnit: string;
  onReplicationTrafficAmountChange: (value: string) => void;
  onReplicationTrafficUnitChange: (value: string) => void;
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
};

function NumericField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          className="bg-white"
        />
        {suffix ? <span className="min-w-10 text-sm text-zinc-500">{suffix}</span> : null}
      </div>
    </div>
  );
}

export function ObsCalculatorPanel({
  productType,
  productTypeOptions,
  onProductTypeChange,
  storageClass,
  storageClassOptions,
  onStorageClassChange,
  redundancy,
  redundancyOptions,
  onRedundancyChange,
  storageAmount,
  storageUnit,
  storageUnitOptions,
  onStorageAmountChange,
  onStorageAmountBlur,
  onStorageAmountStep,
  onStorageUnitChange,
  durationMonths,
  onDurationMonthsChange,
  onDurationMonthsBlur,
  outboundTrafficAmount,
  outboundTrafficUnit,
  onOutboundTrafficAmountChange,
  onOutboundTrafficUnitChange,
  readRequests,
  onReadRequestsChange,
  writeRequests,
  onWriteRequestsChange,
  deleteRequests,
  onDeleteRequestsChange,
  pullTrafficAmount,
  pullTrafficUnit,
  onPullTrafficAmountChange,
  onPullTrafficUnitChange,
  replicationTrafficAmount,
  replicationTrafficUnit,
  onReplicationTrafficAmountChange,
  onReplicationTrafficUnitChange,
  pricingError,
  pricingLoadingMessage,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: ObsCalculatorPanelProps) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">Product type</p>
          <Select value={productType} onValueChange={(value) => value && onProductTypeChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{productType}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {productTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Storage class</p>
          <Select value={storageClass} onValueChange={(value) => value && onStorageClassChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{storageClass}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {storageClassOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Data redundancy policy</p>
          <Select value={redundancy} onValueChange={(value) => value && onRedundancyChange(value)}>
            <SelectTrigger className="bg-white">
              <SelectValue>{redundancy}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {redundancyOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <div className="space-y-2">
          <p className="text-sm font-medium">Storage space</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => onStorageAmountStep(-10)} aria-label="Decrease storage space">
              -
            </Button>
            <Input
              value={storageAmount}
              onChange={(event) => onStorageAmountChange(event.target.value)}
              onBlur={onStorageAmountBlur}
              inputMode="decimal"
              className="bg-white"
            />
            <Select value={storageUnit} onValueChange={(value) => value && onStorageUnitChange(value)}>
              <SelectTrigger className="w-24 bg-white">
                <SelectValue>{storageUnit}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {storageUnitOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Storage duration</p>
          <div className="flex items-center gap-2">
            <Input
              value={durationMonths}
              onChange={(event) => onDurationMonthsChange(event.target.value)}
              onBlur={onDurationMonthsBlur}
              inputMode="numeric"
              className="bg-white"
            />
            <span className="text-sm text-zinc-500">months</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Internet outbound traffic</p>
          <div className="flex items-center gap-2">
            <Input value={outboundTrafficAmount} onChange={(event) => onOutboundTrafficAmountChange(event.target.value)} inputMode="decimal" className="bg-white" />
            <Select value={outboundTrafficUnit} onValueChange={(value) => value && onOutboundTrafficUnitChange(value)}>
              <SelectTrigger className="w-24 bg-white">
                <SelectValue>{outboundTrafficUnit}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {storageUnitOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Pull traffic</p>
          <div className="flex items-center gap-2">
            <Input value={pullTrafficAmount} onChange={(event) => onPullTrafficAmountChange(event.target.value)} inputMode="decimal" className="bg-white" />
            <Select value={pullTrafficUnit} onValueChange={(value) => value && onPullTrafficUnitChange(value)}>
              <SelectTrigger className="w-24 bg-white">
                <SelectValue>{pullTrafficUnit}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {storageUnitOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Cross-region replication traffic</p>
          <div className="flex items-center gap-2">
            <Input value={replicationTrafficAmount} onChange={(event) => onReplicationTrafficAmountChange(event.target.value)} inputMode="decimal" className="bg-white" />
            <Select value={replicationTrafficUnit} onValueChange={(value) => value && onReplicationTrafficUnitChange(value)}>
              <SelectTrigger className="w-24 bg-white">
                <SelectValue>{replicationTrafficUnit}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {storageUnitOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Huawei charges requests in different blocks by storage class. Enter raw request counts below and the calculator normalizes them to the billed request units.
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <NumericField label="Read requests" value={readRequests} onChange={onReadRequestsChange} />
        <NumericField label="Write requests" value={writeRequests} onChange={onWriteRequestsChange} />
        <NumericField label="Delete requests" value={deleteRequests} onChange={onDeleteRequestsChange} />
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
