"use client";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type ServiceBatchAddPanelProps = {
  mode: "ecs" | "flexus-l" | "evs" | "obs";
  regionValue: string;
  regionOptions: Array<{ value: string; label: string }>;
  onRegionChange: (value: string) => void;
  batchInput: string;
  onBatchInputChange: (value: string) => void;
  batchAddMessage: string;
  systemDiskType: string;
  systemDiskSizeValue: number;
  evsSingleDiskMaxGiB: number;
  obsProductType?: string;
  obsStorageClass?: string;
  obsRedundancy?: string;
  obsStorageSizeValue?: number;
  obsStorageUnit?: string;
  obsDurationMonthsValue?: number;
  showFlexusLToggleVisible?: boolean;
  showFlexusLChecked?: boolean;
  onShowFlexusLChange?: (checked: boolean) => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  submitLabel: string;
};

export function ServiceBatchAddPanel({
  mode,
  regionValue,
  regionOptions,
  onRegionChange,
  batchInput,
  onBatchInputChange,
  batchAddMessage,
  systemDiskType,
  systemDiskSizeValue,
  evsSingleDiskMaxGiB,
  obsProductType = "Object storage",
  obsStorageClass = "Standard",
  obsRedundancy = "Single-AZ storage",
  obsStorageSizeValue = 100,
  obsStorageUnit = "GB",
  obsDurationMonthsValue = 1,
  showFlexusLToggleVisible = false,
  showFlexusLChecked = false,
  onShowFlexusLChange,
  onSubmit,
  submitDisabled,
  submitLabel,
}: ServiceBatchAddPanelProps) {
  const isEcs = mode === "ecs";
  const isFlexusL = mode === "flexus-l";
  const isObs = mode === "obs";

  return (
    <>
      <CardContent className="space-y-6 py-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">Region</p>
          <Select
            value={regionValue}
            onValueChange={(value) => {
              if (value) {
                onRegionChange(value);
              }
            }}
          >
            <SelectTrigger className="max-w-sm bg-white">
              <SelectValue>{regionOptions.find((option) => option.value === regionValue)?.label ?? regionValue}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {regionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Batch input</p>
            {isEcs && showFlexusLToggleVisible && onShowFlexusLChange ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <Checkbox
                  checked={showFlexusLChecked}
                  onCheckedChange={(checked) => onShowFlexusLChange(Boolean(checked))}
                  aria-label="Show Flexus L"
                />
                <span>Show Flexus L</span>
              </label>
            ) : null}
          </div>
          <textarea
            value={batchInput}
            onChange={(event) => onBatchInputChange(event.target.value)}
            className="min-h-48 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-3 focus:ring-zinc-200"
            placeholder={
              isEcs
                ? `[
  {
    "vcpu": 2,
    "ram": 8
  },
  {
    "vcpu": 4,
    "ram": 16,
    "quantity": 2,
    "description": "Production API",
    "evs": {
      "type": "Ultra-high I/O",
      "size": 100
    }
  }
]`
                : isFlexusL
                ? `[
  {
    "vcpu": 2,
    "ram": 2
  },
  {
    "vcpu": 4,
    "ram": 8,
    "quantity": 2,
    "description": "ERP"
  }
]`
                : isObs
                ? `[
  {
    "size": 500
  },
  {
    "productType": "Object storage",
    "storageClass": "Archive",
    "redundancy": "Single-AZ storage",
    "size": 2,
    "sizeUnit": "TB",
    "durationMonths": 3,
    "outboundTraffic": 120,
    "readRequests": 50,
    "writeRequests": 8,
    "deleteRequests": 1,
    "pullTraffic": 50,
    "replicationTraffic": 20,
    "quantity": 2,
    "description": "Media archive"
  }
]`
                : `[
  {
    "size": 40
  },
  {
    "type": "Ultra-high I/O",
    "size": 50000,
    "durationMonths": 6,
    "quantity": 2,
    "description": "Database disks"
  },
  {
    "type": "General Purpose SSD V2",
    "size": 800,
    "iops": 6000,
    "throughput": 250
  }
]`
            }
          />
          <p className="text-sm text-zinc-500">
            {isEcs ? (
              <>
                Paste a JSON array of instances. Required fields: <code>vcpu</code> and <code>ram</code>. Optional fields:
                <code>quantity</code>, <code>description</code>, and <code>evs</code>.
                {showFlexusLToggleVisible && showFlexusLChecked ? " With Show Flexus L enabled, matching Flexus L plans are considered too." : ""}
              </>
            ) : isFlexusL ? (
              <>
                Paste a JSON array of Flexus L instances. Required fields: <code>vcpu</code> and <code>ram</code>. Optional
                fields: <code>quantity</code> and <code>description</code>.
              </>
            ) : isObs ? (
              <>
                Paste a JSON array of OBS items. Required field: <code>size</code>. Optional fields:
                <code>productType</code>, <code>storageClass</code>, <code>redundancy</code>, <code>sizeUnit</code>,
                <code>durationMonths</code>, <code>outboundTraffic</code>, <code>readRequests</code>,
                <code>writeRequests</code>, <code>deleteRequests</code>, <code>pullTraffic</code>,
                <code>replicationTraffic</code>, <code>quantity</code>, and <code>description</code>. Request fields use
                units of <code>10,000</code>, so <code>2</code> means <code>20,000</code> requests.
              </>
            ) : (
              <>
                Paste a JSON array of EVS volumes. Optional fields: <code>type</code>, <code>size</code>,
                <code>durationMonths</code>, <code>quantity</code>, <code>description</code>, <code>iops</code>, and
                <code>throughput</code>.
              </>
            )}
          </p>
          {batchAddMessage ? <p className="text-sm text-zinc-500">{batchAddMessage}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-900">Defaults</p>
            <p className="mt-1 text-sm text-zinc-500">
              {isEcs ? (
                <>
                  If omitted, <code>description</code> defaults to <code>Elastic Cloud Server</code> and
                  <code>evs</code> defaults to <code>{`{ "type": "High I/O", "size": 40 }`}</code>.
                </>
              ) : isFlexusL ? (
                <>
                  If omitted, <code>description</code> defaults to <code>Flexus L Instance</code>. The calculator chooses the
                  smallest public Flexus L plan that satisfies the requested <code>vcpu</code> and <code>ram</code>.
                </>
              ) : isObs ? (
                <>
                  If omitted, <code>productType</code> defaults to <code>{obsProductType}</code>,
                  <code>storageClass</code> defaults to <code>{obsStorageClass}</code>,
                  <code>redundancy</code> defaults to <code>{obsRedundancy}</code>,
                  <code>size</code> defaults to <code>{obsStorageSizeValue}</code>,
                  <code>sizeUnit</code> defaults to <code>{obsStorageUnit}</code>, and
                  <code>durationMonths</code> defaults to <code>{obsDurationMonthsValue}</code>.
                </>
              ) : (
                <>
                  If omitted, <code>type</code> defaults to <code>{systemDiskType}</code> and
                  <code>size</code> defaults to <code>{systemDiskSizeValue}</code> GiB. When using yearly/monthly EVS,
                  <code>durationMonths</code> falls back to the active calculator value. Sizes above
                  <code>{` ${evsSingleDiskMaxGiB}`}</code> are split into multiple disks when saved. For General Purpose SSD V2,
                  omitted <code>iops</code> and <code>throughput</code> use the minimum valid values.
                </>
              )}
            </p>
          </div>
          <div className="rounded-lg border bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-900">Validation</p>
            <p className="mt-1 text-sm text-zinc-500">
              {isEcs ? (
                <>
                  Each JSON item should include numeric <code>vcpu</code> and <code>ram</code>. When present,
                  <code>evs.size</code> should be in GiB and <code>evs.type</code> should match an available disk type.
                </>
              ) : isFlexusL ? (
                <>
                  Each JSON item should include numeric <code>vcpu</code> and <code>ram</code>. If no published Flexus L plan
                  satisfies the request, that item fails.
                </>
              ) : isObs ? (
                <>
                  Each JSON item should include a positive storage size. When present, <code>productType</code>,
                  <code>storageClass</code>, <code>redundancy</code>, and all unit fields should match the available OBS options
                  for the selected region. Unsupported combinations fail item-by-item.
                </>
              ) : (
                <>
                  Each JSON item should resolve to a valid EVS disk type. When <code>size</code> is above
                  <code>{` ${evsSingleDiskMaxGiB}`}</code> GiB, it is saved as multiple disks:
                  <code>{` ${evsSingleDiskMaxGiB}`}</code> GiB chunks plus one final remainder disk. General Purpose SSD V2
                  accepts configurable <code>iops</code> and <code>throughput</code> values.
                </>
              )}
            </p>
          </div>
        </div>
      </CardContent>
      <Separator />
      <div className="flex justify-end p-4">
        <Button onClick={onSubmit} disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </>
  );
}
