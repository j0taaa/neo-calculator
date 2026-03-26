"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ElbProtocolFormSection = {
  protocol: string;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  newConnections: string;
  onNewConnectionsChange: (value: string) => void;
  maxConcurrentConnections: string;
  onMaxConcurrentConnectionsChange: (value: string) => void;
  metricMode: string;
  onMetricModeChange: (value: string) => void;
  processedTrafficGbPerHour: string;
  onProcessedTrafficGbPerHourChange: (value: string) => void;
  averageBandwidthMbit: string;
  onAverageBandwidthMbitChange: (value: string) => void;
  queriesPerSecond?: string;
  onQueriesPerSecondChange?: (value: string) => void;
  forwardingRules?: string;
  onForwardingRulesChange?: (value: string) => void;
  estimatedLcu: number;
  details: string[];
};

type ElbFixedTypeSection = {
  type: string;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  spec: string;
  specOptions: readonly string[];
  onSpecChange: (value: string) => void;
};

type ElbCalculatorPanelProps = {
  type: string;
  typeOptions: readonly string[];
  onTypeChange: (value: string) => void;
  networkType: string;
  networkTypeOptions: readonly string[];
  onNetworkTypeChange: (value: string) => void;
  sharedChargeMode: string;
  sharedChargeModeOptions: readonly string[];
  onSharedChargeModeChange: (value: string) => void;
  showSharedChargeMode: boolean;
  sharedBandwidthMbit: string;
  onSharedBandwidthMbitChange: (value: string) => void;
  showSharedBandwidth: boolean;
  sharedTrafficAmount: string;
  sharedTrafficUnit: string;
  sharedTrafficUnitOptions: readonly string[];
  onSharedTrafficAmountChange: (value: string) => void;
  onSharedTrafficUnitChange: (value: string) => void;
  showSharedTraffic: boolean;
  requiredDurationHours: string;
  onRequiredDurationHoursChange: (value: string) => void;
  showRequiredDuration: boolean;
  specificationType: string;
  specificationTypeOptions: readonly string[];
  onSpecificationTypeChange: (value: string) => void;
  fixedAvailabilityAzCount: string;
  fixedAvailabilityAzCountOptions: readonly string[];
  onFixedAvailabilityAzCountChange: (value: string) => void;
  fixedTypeSections: ElbFixedTypeSection[];
  protocolSections: ElbProtocolFormSection[];
  metricModeOptions: readonly string[];
  estimatedNetworkLcus: number;
  estimatedApplicationLcus: number;
  estimatedTotalLcus: number;
  selectedNetworkSpecLcus: number;
  selectedApplicationSpecLcus: number;
  pricingError?: string;
  pricingLoadingMessage?: string | null;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
};

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <Select value={value} onValueChange={(nextValue) => nextValue && onChange(nextValue)}>
        <SelectTrigger className="bg-white">
          <SelectValue>{value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="bg-white" />
        <span className="text-sm text-zinc-500">{suffix}</span>
      </div>
    </div>
  );
}

export function ElbCalculatorPanel({
  type,
  typeOptions,
  onTypeChange,
  networkType,
  networkTypeOptions,
  onNetworkTypeChange,
  sharedChargeMode,
  sharedChargeModeOptions,
  onSharedChargeModeChange,
  showSharedChargeMode,
  sharedBandwidthMbit,
  onSharedBandwidthMbitChange,
  showSharedBandwidth,
  sharedTrafficAmount,
  sharedTrafficUnit,
  sharedTrafficUnitOptions,
  onSharedTrafficAmountChange,
  onSharedTrafficUnitChange,
  showSharedTraffic,
  requiredDurationHours,
  onRequiredDurationHoursChange,
  showRequiredDuration,
  specificationType,
  specificationTypeOptions,
  onSpecificationTypeChange,
  fixedAvailabilityAzCount,
  fixedAvailabilityAzCountOptions,
  onFixedAvailabilityAzCountChange,
  fixedTypeSections,
  protocolSections,
  metricModeOptions,
  estimatedNetworkLcus,
  estimatedApplicationLcus,
  estimatedTotalLcus,
  selectedNetworkSpecLcus,
  selectedApplicationSpecLcus,
  pricingError,
  pricingLoadingMessage,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: ElbCalculatorPanelProps) {
  const dedicatedSections = protocolSections.filter((section) => section.selected);
  const dedicatedFixedSections = fixedTypeSections.filter((section) => section.selected);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <SelectField label="Type" value={type} options={typeOptions} onChange={onTypeChange} />
        {type === "Shared load balancer" ? (
          <SelectField label="Network type" value={networkType} options={networkTypeOptions} onChange={onNetworkTypeChange} />
        ) : null}
        {showSharedChargeMode ? (
          <SelectField
            label="Billing by"
            value={sharedChargeMode}
            options={sharedChargeModeOptions}
            onChange={onSharedChargeModeChange}
          />
        ) : null}
        {type === "Shared load balancer" && showRequiredDuration ? (
          <NumberField
            label="Required duration"
            value={requiredDurationHours}
            onChange={onRequiredDurationHoursChange}
            suffix="hour"
          />
        ) : null}
        {showSharedBandwidth ? (
          <NumberField
            label="Bandwidth"
            value={sharedBandwidthMbit}
            onChange={onSharedBandwidthMbitChange}
            suffix="Mbit/s"
          />
        ) : null}
        {showSharedTraffic ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Traffic</p>
            <div className="flex items-center gap-2">
              <Input value={sharedTrafficAmount} onChange={(event) => onSharedTrafficAmountChange(event.target.value)} inputMode="decimal" className="bg-white" />
              <Select value={sharedTrafficUnit} onValueChange={(nextValue) => nextValue && onSharedTrafficUnitChange(nextValue)}>
                <SelectTrigger className="w-28 bg-white">
                  <SelectValue>{sharedTrafficUnit}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sharedTrafficUnitOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
        {type === "Dedicated load balancer" ? (
          <SelectField
            label="Specifications"
            value={specificationType}
            options={specificationTypeOptions}
            onChange={onSpecificationTypeChange}
          />
        ) : null}
        {type === "Dedicated load balancer" && specificationType === "Fixed" ? (
          <SelectField
            label="Availability AZs"
            value={fixedAvailabilityAzCount}
            options={fixedAvailabilityAzCountOptions}
            onChange={onFixedAvailabilityAzCountChange}
          />
        ) : null}
      </section>

      {type === "Dedicated load balancer" ? (
        <>
          {specificationType === "Fixed" ? (
            <section className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium">Load balancing type</p>
              <div className="grid gap-4 md:grid-cols-2">
                {fixedTypeSections.map((section) => (
                  <div key={section.type} className="space-y-3 rounded-lg border bg-white px-3 py-3 text-sm text-zinc-700">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={section.selected}
                        onChange={(event) => section.onSelectedChange(event.target.checked)}
                        className="mt-1"
                      />
                      <span>{section.type}</span>
                    </label>
                    {section.selected ? (
                      <SelectField label="Specs" value={section.spec} options={section.specOptions} onChange={section.onSpecChange} />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium">Estimated LCUs</p>
              <div className="grid gap-3 md:grid-cols-2">
                {protocolSections.map((section) => (
                  <label key={section.protocol} className="flex items-start gap-3 rounded-lg border bg-white px-3 py-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={section.selected}
                      onChange={(event) => section.onSelectedChange(event.target.checked)}
                      className="mt-1"
                    />
                    <span>{section.protocol}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {specificationType === "Elastic" ? dedicatedSections.map((section) => {
            const shortName = section.protocol.includes("HTTP/HTTPS")
              ? "HTTP/HTTPS"
              : section.protocol.includes("(TCP)")
                ? "TCP"
                : section.protocol.includes("(UDP)")
                  ? "UDP"
                  : "TLS";

            return (
              <section key={section.protocol} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-medium">{shortName} Traffic</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <NumberField label="New Connections" value={section.newConnections} onChange={section.onNewConnectionsChange} suffix="per second" />
                  <NumberField
                    label="Maximum concurrent connections"
                    value={section.maxConcurrentConnections}
                    onChange={section.onMaxConcurrentConnectionsChange}
                    suffix="connections"
                  />
                  <SelectField label="Metric" value={section.metricMode} options={metricModeOptions} onChange={section.onMetricModeChange} />
                  {section.metricMode === "By traffic" ? (
                    <NumberField
                      label="Processed Bytes"
                      value={section.processedTrafficGbPerHour}
                      onChange={section.onProcessedTrafficGbPerHourChange}
                      suffix="GB/hour"
                    />
                  ) : (
                    <NumberField
                      label="Average Bandwidth"
                      value={section.averageBandwidthMbit}
                      onChange={section.onAverageBandwidthMbitChange}
                      suffix="Mbit/s"
                    />
                  )}
                  {section.queriesPerSecond != null && section.onQueriesPerSecondChange ? (
                    <NumberField
                      label="Queries per second (QPS)"
                      value={section.queriesPerSecond}
                      onChange={section.onQueriesPerSecondChange}
                      suffix="QPS"
                    />
                  ) : null}
                  {section.forwardingRules != null && section.onForwardingRulesChange ? (
                    <NumberField
                      label="Forwarding rules"
                      value={section.forwardingRules}
                      onChange={section.onForwardingRulesChange}
                      suffix="rules"
                    />
                  ) : null}
                </div>
                <div className="rounded-lg border bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  Estimated LCUs: <span className="font-medium text-zinc-800">{section.estimatedLcu}</span>
                  {section.details.map((detail) => (
                    <p key={detail} className="mt-1 text-xs text-zinc-500">{detail}</p>
                  ))}
                </div>
              </section>
            );
          }) : null}

          {specificationType === "Fixed" ? (
            <section className="grid gap-4 md:grid-cols-2">
              {dedicatedFixedSections.map((section) => (
                <div key={section.type} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  <p className="font-medium text-zinc-800">{section.type}</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">{section.spec}</p>
                  <p className="mt-2 text-xs text-zinc-500">{fixedAvailabilityAzCount} AZs</p>
                </div>
              ))}
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
              <p className="font-medium text-zinc-800">Estimated LCUs for network load balancing</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">{estimatedNetworkLcus}</p>
              {selectedNetworkSpecLcus > 0 ? <p className="mt-2 text-xs text-zinc-500">Fixed-spec selection: {selectedNetworkSpecLcus} LCU</p> : null}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
              <p className="font-medium text-zinc-800">Estimated LCUs for application load balancing</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">{estimatedApplicationLcus}</p>
              {selectedApplicationSpecLcus > 0 ? <p className="mt-2 text-xs text-zinc-500">Fixed-spec selection: {selectedApplicationSpecLcus} LCU</p> : null}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
              <p className="font-medium text-zinc-800">Estimated LCUs total</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">{estimatedTotalLcus}</p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <SelectField label="Network type" value={networkType} options={networkTypeOptions} onChange={onNetworkTypeChange} />
          </section>
        </>
      ) : null}

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
