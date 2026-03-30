import { formatNumber } from "@/lib/utils";
import { isRecord, type AppProduct } from "@/lib/calculator-page-helpers";

function formatObsRequestSummary(value: number, label: string) {
  const normalized = value / 10_000;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  const displayValue = Number.isInteger(normalized)
    ? formatNumber(normalized)
    : formatNumber(Number(normalized.toFixed(4)));
  return `${displayValue} x 10k ${label}`;
}

export function getProductConfigSummary(product: AppProduct): string {
  if (!isRecord(product.config)) {
    return product.serviceName;
  }

  if (product.productType === "ecs") {
    const systemDisk = isRecord(product.config.systemDisk) ? product.config.systemDisk : null;
    const diskIops = systemDisk && typeof systemDisk.iops === "number" ? systemDisk.iops : null;
    const diskThroughput = systemDisk && typeof systemDisk.throughput === "number" ? systemDisk.throughput : null;
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.flavor === "string" ? product.config.flavor : null,
      systemDisk && typeof systemDisk.type === "string" ? systemDisk.type : null,
      systemDisk && typeof systemDisk.sizeGiB === "number" ? `${systemDisk.sizeGiB} GiB` : null,
      diskIops ? `${diskIops} IOPS` : null,
      diskThroughput ? `${diskThroughput} MB/s` : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
      typeof product.config.durationMonths === "number" && product.config.billingMode === "Yearly/Monthly"
        ? `${product.config.durationMonths}mo`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "evs") {
    const diskType = typeof product.config.diskType === "string"
      ? product.config.diskType
      : isRecord(product.config.systemDisk) && typeof product.config.systemDisk.type === "string"
        ? product.config.systemDisk.type
        : null;
    const diskSizeGiB = typeof product.config.diskSizeGiB === "number"
      ? product.config.diskSizeGiB
      : isRecord(product.config.systemDisk) && typeof product.config.systemDisk.sizeGiB === "number"
        ? product.config.systemDisk.sizeGiB
        : null;
    const diskIops = typeof product.config.iops === "number"
      ? product.config.iops
      : isRecord(product.config.systemDisk) && typeof product.config.systemDisk.iops === "number"
        ? product.config.systemDisk.iops
        : null;
    const diskThroughput = typeof product.config.throughput === "number"
      ? product.config.throughput
      : isRecord(product.config.systemDisk) && typeof product.config.systemDisk.throughput === "number"
        ? product.config.systemDisk.throughput
        : null;
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      diskType && diskSizeGiB ? `${diskType} ${diskSizeGiB} GiB` : diskType ?? (diskSizeGiB ? `${diskSizeGiB} GiB` : null),
      diskIops ? `${diskIops} IOPS` : null,
      diskThroughput ? `${diskThroughput} MB/s` : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "flexus-l") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.planTitle === "string"
        ? product.config.planTitle
        : typeof product.config.planId === "string"
          ? product.config.planId
          : null,
      typeof product.config.systemDiskGiB === "number" ? `${product.config.systemDiskGiB} GiB system disk` : null,
      typeof product.config.peakBandwidthMbit === "number" ? `${product.config.peakBandwidthMbit} Mbit/s` : null,
      typeof product.config.dataPackageTiB === "number" ? `${product.config.dataPackageTiB} TB/month` : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "obs") {
    const storageAmount = typeof product.config.storageAmount === "number"
      ? product.config.storageAmount
      : typeof product.config.storageGiB === "number"
        ? product.config.storageGiB
        : null;
    const storageUnit = typeof product.config.storageUnit === "string" ? product.config.storageUnit : null;
    const outboundTrafficAmount = typeof product.config.outboundTrafficAmount === "number" ? product.config.outboundTrafficAmount : null;
    const outboundTrafficUnit = typeof product.config.outboundTrafficUnit === "string" ? product.config.outboundTrafficUnit : null;
    const pullTrafficAmount = typeof product.config.pullTrafficAmount === "number" ? product.config.pullTrafficAmount : null;
    const pullTrafficUnit = typeof product.config.pullTrafficUnit === "string" ? product.config.pullTrafficUnit : null;
    const showPullTraffic = typeof product.config.productType === "string"
      ? product.config.productType === "Object storage"
      : true;
    const readTrafficAmount = typeof product.config.readTrafficAmount === "number" ? product.config.readTrafficAmount : null;
    const readTrafficUnit = typeof product.config.readTrafficUnit === "string" ? product.config.readTrafficUnit : null;
    const restorationType = typeof product.config.restorationType === "string" ? product.config.restorationType : null;
    const replicationTrafficAmount = typeof product.config.replicationTrafficAmount === "number" ? product.config.replicationTrafficAmount : null;
    const replicationTrafficUnit = typeof product.config.replicationTrafficUnit === "string" ? product.config.replicationTrafficUnit : null;
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.productType === "string" ? product.config.productType : null,
      typeof product.config.storageClass === "string" ? product.config.storageClass : null,
      typeof product.config.redundancy === "string" ? product.config.redundancy : null,
      storageAmount != null ? `${storageAmount} ${storageUnit ?? "GB"}` : null,
      typeof product.config.durationMonths === "number" ? `${product.config.durationMonths}mo` : null,
      outboundTrafficAmount != null && outboundTrafficAmount > 0 ? `Outbound ${outboundTrafficAmount} ${outboundTrafficUnit ?? "GB"}` : null,
      showPullTraffic && pullTrafficAmount != null && pullTrafficAmount > 0 ? `Pull ${pullTrafficAmount} ${pullTrafficUnit ?? "GB"}` : null,
      restorationType ? restorationType : null,
      readTrafficAmount != null && readTrafficAmount > 0 ? `Read ${readTrafficAmount} ${readTrafficUnit ?? "GB"}` : null,
      replicationTrafficAmount != null && replicationTrafficAmount > 0 ? `CRR ${replicationTrafficAmount} ${replicationTrafficUnit ?? "GB"}` : null,
      typeof product.config.readRequests === "number" ? formatObsRequestSummary(product.config.readRequests, "reads") : null,
      typeof product.config.writeRequests === "number" ? formatObsRequestSummary(product.config.writeRequests, "writes") : null,
      typeof product.config.deleteRequests === "number" ? formatObsRequestSummary(product.config.deleteRequests, "deletes") : null,
      typeof product.config.lifecycleTransitionRequests === "number"
        ? formatObsRequestSummary(product.config.lifecycleTransitionRequests, "lifecycle transitions")
        : null,
      typeof product.config.minimumStorageDays === "number" && product.config.minimumStorageDays > 0
        ? `${product.config.minimumStorageDays}-day minimum`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "huawei-raw") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.resourceCode === "string" ? product.config.resourceCode : null,
      typeof product.config.pricingMode === "string" ? product.config.pricingMode : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "cce") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.clusterScale === "string" ? product.config.clusterScale : null,
      typeof product.config.masterNodes === "string" ? product.config.masterNodes : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "elb") {
    const selectedProtocols = Array.isArray(product.config.selectedProtocols)
      ? product.config.selectedProtocols.filter((value): value is string => typeof value === "string")
      : [];
    const fixedSelectedTypes = Array.isArray(product.config.fixedSelectedTypes)
      ? product.config.fixedSelectedTypes.filter((value): value is string => typeof value === "string")
      : [];
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.type === "string" ? product.config.type : null,
      typeof product.config.specificationType === "string" && product.config.type === "Dedicated load balancer"
        ? product.config.specificationType
        : null,
      typeof product.config.fixedAvailabilityAzCount === "number" && product.config.type === "Dedicated load balancer" && product.config.specificationType === "Fixed"
        ? `${product.config.fixedAvailabilityAzCount} AZs`
        : null,
      fixedSelectedTypes.length > 0 && product.config.type === "Dedicated load balancer" && product.config.specificationType === "Fixed"
        ? fixedSelectedTypes.join(", ")
        : null,
      selectedProtocols.length > 0 && product.config.type === "Dedicated load balancer"
        && product.config.specificationType === "Elastic" ? selectedProtocols.join(", ")
        : null,
      typeof product.config.networkType === "string" ? product.config.networkType : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "eip") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.type === "string" ? product.config.type : null,
      typeof product.config.eipType === "string" ? product.config.eipType : "Dynamic BGP",
      typeof product.config.chargeMode === "string" ? product.config.chargeMode : null,
      typeof product.config.bandwidthMbit === "number" && product.config.chargeMode === "By bandwidth"
        ? `${product.config.bandwidthMbit} Mbit/s`
        : null,
      typeof product.config.bandwidthMbit === "number" && product.config.chargeMode === "Enhanced 95"
        ? `${product.config.bandwidthMbit} Mbit/s`
        : null,
      typeof product.config.durationMonths === "number" && product.config.chargeMode === "Enhanced 95"
        ? `${product.config.durationMonths}mo`
        : null,
      typeof product.config.sharedBandwidthQuantity === "number" && product.config.type === "Shared EIP" && product.config.chargeMode === "By bandwidth"
        ? `${product.config.sharedBandwidthQuantity} shared bandwidth${product.config.sharedBandwidthQuantity === 1 ? "" : "s"}`
        : null,
      typeof product.config.trafficAmount === "number" && product.config.chargeMode === "By traffic"
        ? `${product.config.trafficAmount} ${typeof product.config.trafficUnit === "string" ? product.config.trafficUnit : "GB"}`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.durationMonths === "number" && product.config.chargeMode === "Enhanced 95"
        ? null
        : typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "nat") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.type === "string" ? product.config.type : null,
      typeof product.config.size === "string" ? product.config.size : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.billableDays === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.billableDays}d`
        : typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "vpn") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.edition === "string" ? product.config.edition : null,
      typeof product.config.mode === "string" ? product.config.mode : null,
      typeof product.config.networkType === "string" ? product.config.networkType : null,
      typeof product.config.specification === "string" ? product.config.specification : null,
      typeof product.config.accessViaNonFixedIp === "string" && product.config.mode === "Site-to-Cloud" && product.config.networkType === "Public network"
        ? `Non-fixed IP ${product.config.accessViaNonFixedIp}`
        : null,
      typeof product.config.connectionGroups === "number"
        ? `${product.config.connectionGroups} groups`
        : null,
      typeof product.config.useSharedBandwidth === "boolean" && product.config.networkType === "Public network"
        ? product.config.useSharedBandwidth ? "Shared bandwidth" : "Dedicated bandwidth"
        : null,
      typeof product.config.eipBandwidthMbit1 === "number" && product.config.networkType === "Public network"
        ? `EIP1 ${product.config.eipBandwidthMbit1} Mbit/s`
        : null,
      typeof product.config.eipBandwidthMbit2 === "number" && product.config.networkType === "Public network"
        ? `EIP2 ${product.config.eipBandwidthMbit2} Mbit/s`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.durationMonths === "number" && product.config.billingMode === "Yearly/Monthly"
        ? `${product.config.durationMonths}mo`
        : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "cci") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.cpu === "number" ? `${product.config.cpu} vCPU` : null,
      typeof product.config.memoryGiB === "number" ? `${product.config.memoryGiB} GiB` : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "modelarts") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.serviceType === "string" ? product.config.serviceType : null,
      typeof product.config.resourceType === "string" ? product.config.resourceType : null,
      typeof product.config.specification === "string" ? product.config.specification : null,
      typeof product.config.resourceType === "string" && product.config.resourceType === "EVS Storage"
        && typeof product.config.storageQuotaGb === "number"
        ? `${product.config.storageQuotaGb} GB`
        : typeof product.config.quantity === "number"
        ? `${product.config.quantity} instance${product.config.quantity === 1 ? "" : "s"}`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.durationMonths === "number" && product.config.billingMode === "Yearly/Monthly"
        ? product.config.durationMonths === 12 ? "1yr" : `${product.config.durationMonths}mo`
        : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  if (product.productType === "functiongraph") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.averageRequestsAmount === "number" && typeof product.config.averageRequestsUnit === "string"
        ? `${product.config.averageRequestsAmount} x 10k/${product.config.averageRequestsUnit}`
        : null,
      typeof product.config.executionDurationMs === "number" ? `${product.config.executionDurationMs} ms` : null,
      typeof product.config.memoryAmount === "number" && typeof product.config.memoryUnit === "string"
        ? `${product.config.memoryAmount} ${product.config.memoryUnit}`
        : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  return product.serviceName;
}
