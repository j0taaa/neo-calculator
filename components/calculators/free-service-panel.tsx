"use client";

import { CardContent } from "@/components/ui/card";

type FreeServicePanelProps = {
  serviceName: string;
  serviceCode: string;
};

export function FreeServicePanel({ serviceName, serviceCode }: FreeServicePanelProps) {
  const descriptions: Record<string, string> = {
    AS: "Auto Scaling is free of charge. You only pay for the underlying cloud resources (such as ECS instances) that are automatically scaled.",
    VPC: "Virtual Private Cloud is free of charge. You only pay for the resources you create within your VPC (such as ECS, ELB, etc.).",
    DNS: "Domain Name Service is free of charge. Basic DNS resolution is provided at no cost.",
    IAM: "Identity and Access Management is free of charge. Access management and identity features are included at no cost.",
    CES: "Cloud Eye is free of charge. Basic monitoring and alarm features are provided at no cost.",
    CTS: "Cloud Trace Service basic features are free of charge. Advanced features may incur costs for associated services (OBS, SMN, DEW).",
    SWR: "SoftWare Repository for Container is free of charge. Container image hosting and management are provided at no cost.",
    SMS: "Server Migration Service is free of charge. You only pay for temporary resources such as EVS disks used during migration.",
  };

  const description = descriptions[serviceCode]
    ?? `${serviceName} is free of charge. No additional costs are incurred for using this service.`;

  return (
    <CardContent className="py-8">
      <div className="rounded-2xl border border-dashed bg-green-50 dark:bg-green-950/30 p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800 dark:bg-green-900 dark:text-green-100">
            Free
          </span>
          <span className="text-lg font-semibold text-zinc-950">{serviceName}</span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          There is no calculator needed for this service as it is always free of charge.
        </p>
      </div>
    </CardContent>
  );
}
