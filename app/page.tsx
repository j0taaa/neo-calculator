"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Search, UserCircle2 } from "lucide-react";

const services = [
  { name: "Bare Metal Server", code: "BMS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/BMS.png" },
  { name: "Auto Scaling", code: "AS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/AS.png" },
  { name: "SoftWare Repository for Container", code: "SWR", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/SWR.png" },
  { name: "Cloud Container Instance", code: "CCI", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png" },
  { name: "Cloud Container Instance 2.0", code: "CCI 2.0", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png" },
  { name: "Flexus CCI", code: "Flexus CCI", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png" },
  { name: "Dedicated Host", code: "DeH", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/DeH.png" },
  { name: "Cloud Container Engine", code: "CCE", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCE.png" },
  { name: "Elastic Cloud Server", code: "ECS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/ECS.png" },
  { name: "Flexus L Instance", code: "Flexus L", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/FECSL.png" },
  { name: "Flexus X Instance", code: "Flexus X", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/FECSX.png" },
  { name: "MapReduce Service", code: "MRS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DWS.png" },
  { name: "DataArts Insight", code: "DataArts Insight", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DataArts.png" },
  { name: "Data Ingestion Service", code: "DIS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DIS.png" },
  { name: "DataArts Studio(DGC)", code: "DGC", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DataArts.png" },
  { name: "Data Lake Insight", code: "DLI", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DLI.png" },
  { name: "DataArts Lake Formation", code: "Lake Formation", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DataArts.png" },
  { name: "Data Warehouse Service", code: "DWS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DWS.png" },
  { name: "Cloud Search Service", code: "CSS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/CSS.png" },
  { name: "Distributed Cache Service (for Redis)", code: "DCS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/Memcached.png" },
  { name: "Distributed Database Middleware", code: "DDM", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/DDM.png" },
  { name: "Data Replication Service", code: "DRS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/DRS.png" },
  { name: "UGO", code: "UGO", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/UGO.png" },
  { name: "Graph Engine Service", code: "GES", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ges.png" },
  { name: "Document Database Service", code: "DDS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/DDS.png" },
  { name: "GeminiDB", code: "GeminiDB", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/GaussDBfornosql.png" },
  { name: "Relational Database Service", code: "RDS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/RDSforMySQL.png" },
  { name: "GaussDB", code: "GaussDB", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/GaussDB.png" },
  { name: "TaurusDB", code: "TaurusDB", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/GaussDBforMySQL.png" },
  { name: "Flexus RDS", code: "Flexus RDS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/FRDS.png" },
  { name: "IoT Device Management", code: "IoTDM", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/InternetofThings/IoTDM.png" },
  { name: "IoTDA", code: "IoTDA", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/InternetofThings/IoTDA.png" },
  { name: "ModelArts", code: "ModelArts", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ModelArts.png" },
  { name: "ModelArts Studio", code: "ModelArts Studio", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ModelArts.png" },
  { name: "API Gateway", code: "APIG", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/APIG.png" },
  { name: "ServiceStage", code: "ServiceStage", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/ServiceStage.png" },
  { name: "CodeArts Artifact", code: "CodeArts Artifact", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsArtifact.png" },
  { name: "CodeArts Build", code: "CodeArts Build", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsBuild.png" },
  { name: "CodeArts Pipeline", code: "CodeArts Pipeline", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsPipeline.png" },
  { name: "CodeArts Check", code: "CodeArts Check", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsCheck.png" },
  { name: "CodeArts", code: "CodeArts", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArts.png" },
  { name: "EventGrid", code: "EventGrid", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/BusinessApplications/ROMAConnect.png" },
  { name: "Elastic Load Balance", code: "ELB", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/ELB.png" },
  { name: "CodeArts TestPlan", code: "CodeArts TestPlan", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsTestPlan.png" },
  { name: "Image Management Service", code: "IMS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/IMS.png" },
  { name: "Log Tank Service", code: "LTS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/LTS.png" },
  { name: "Simple Message Notification", code: "SMN", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/SMN.png" },
  { name: "Application Operations Management", code: "AOM", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/AOM.png" },
  { name: "Application Performance Management", code: "APM", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/APM.png" },
  { name: "Cloud Eye", code: "CES", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/CES.png" },
  { name: "Content Delivery Network", code: "CDN", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ContentDeliveryEdgeComputing/CDN.png" },
  { name: "Direct Connect", code: "DC", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/DC.png" },
  { name: "Domain Name Service", code: "DNS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/BusinessApplications/DNS.png" },
  { name: "NAT Gateway", code: "NAT", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/NAT.png" },
  { name: "Enterprise Router", code: "ER", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/ER.png" },
  { name: "VPC Endpoint", code: "VPCEP", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPCEP.png" },
  { name: "Elastic IP", code: "EIP", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/EIP.png" },
  { name: "Virtual Private Cloud", code: "VPC", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPC.png" },
  { name: "Virtual Private Network", code: "VPN", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPN.png" },
  { name: "Host Security Service", code: "HSS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png" },
  { name: "Cloud Trace Service", code: "CTS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/CTS.png" },
  { name: "Cloud Certificate & Manager", code: "CCM", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/SSL.png" },
  { name: "Container Guard Service", code: "CGS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png" },
  { name: "Data Security Center", code: "DSC", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/DSC.png" },
  { name: "Database Security Service", code: "DBSS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/DBSS.png" },
  { name: "IAM Identity Center", code: "IAM Identity Center", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/IAM.png" },
  { name: "Identity and Access Management", code: "IAM", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/IAM.png" },
  { name: "Data Encryption Workshop", code: "DEW", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/DEW.png" },
  { name: "Cloud Firewall", code: "CFW", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png" },
  { name: "DDoS Mitigation", code: "DDoS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/AAD.png" },
  { name: "Cloud Bastion Host", code: "CBH", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CBH.png" },
  { name: "SecMaster", code: "SecMaster", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png" },
  { name: "Cloud Backup and Recovery", code: "CBR", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/CBR.png" },
  { name: "Cloud Server Backup Service", code: "CSBS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/CSBS.png" },
  { name: "Elastic Volume Service", code: "EVS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/EVS.png" },
  { name: "Storage Disaster Recovery Service", code: "SDRS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/SDRS.png" },
  { name: "Scalable File Service", code: "SFS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/SFS.png" },
  { name: "Object Storage Service", code: "OBS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/OBS.png" },
  { name: "Dedicated OBS", code: "DOS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/OBS.png" },
  { name: "Object Storage Migration Service", code: "OMS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/OMS.png" },
  { name: "Dedicated Distributed Storage Service", code: "DSS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/DSS.png" },
  { name: "Cloud Data Migration", code: "CDM", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/CDM.png" },
  { name: "Migration Center", code: "MGC", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/MGC.png" },
  { name: "Server Migration Service", code: "SMS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/SMS.png" },
  { name: "KooGallery", code: "KooGallery", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/aPaaS/KooMessage.png" },
  { name: "Workspace", code: "Workspace", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/BusinessApplications/Workspace.png" },
  { name: "CodeArts Deploy", code: "CodeArts Deploy", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsDeploy.png" },
  { name: "DataArts Fabric", code: "DataArts Fabric", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DataArtsFabric.png" },
  { name: "CodeArts Governance", code: "CodeArts Governance", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/DevSecurity.png" },
  { name: "Distributed Message Service", code: "DMS", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/DMS.png" },
  { name: "Distributed Message Service (for Kafka)", code: "DMS Kafka", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/Kafka.png" },
  { name: "Distributed Message Service (for RabbitMQ)", code: "DMS RabbitMQ", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/RabbitMQ.png" },
  { name: "Distributed Message Service (for RocketMQ)", code: "DMS RocketMQ", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/ROCKETMQ.png" },
  { name: "CodeArts PerfTest", code: "CodeArts PerfTest", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsPerfTest.png" },
  { name: "CodeArts Req", code: "CodeArts Req", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsReq.png" },
  { name: "FunctionGraph", code: "FunctionGraph", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/FunctionGraph.png" },
  { name: "CodeArts Repo", code: "CodeArts Repo", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsRepo.png" },
  { name: "Cloud Phone Host", code: "CPH", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/CPH.png" },
  { name: "Web Application Firewall", code: "WAF", icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/WAF.png" },
] as const;

const options = {
  billing: ["Pay-per-use", "RI", "Yearly/Monthly"],
} as const;

type BillingOption = (typeof options.billing)[number];

const systemDiskOptions = [
  "High I/O",
  "Ultra-high I/O",
  "Extreme SSD",
  "General Purpose SSD",
  "General Purpose SSD V2",
] as const;

type SystemDiskOption = (typeof systemDiskOptions)[number];

const priceListEntries = [
  { service: "Elastic Cloud Server", sku: "c7.large.2", billing: "Pay-per-use", unit: "per hour", price: "USD 0.122" },
  { service: "Elastic Cloud Server", sku: "c7.xlarge.4", billing: "Yearly/Monthly", unit: "per month", price: "USD 89.11" },
  { service: "Elastic Cloud Server", sku: "c7.2xlarge.8", billing: "RI", unit: "per month", price: "USD 154.63" },
  { service: "Flexus X Instance", sku: "fx1.medium", billing: "Pay-per-use", unit: "per hour", price: "USD 0.094" },
  { service: "Flexus X Instance", sku: "fx1.large", billing: "Yearly/Monthly", unit: "per month", price: "USD 64.20" },
  { service: "Object Storage Service", sku: "Standard Storage", billing: "Pay-per-use", unit: "per GB", price: "USD 0.023" },
  { service: "Object Storage Service", sku: "Infrequent Access", billing: "Pay-per-use", unit: "per GB", price: "USD 0.012" },
  { service: "Elastic Load Balance", sku: "Shared ELB", billing: "Pay-per-use", unit: "per hour", price: "USD 0.031" },
  { service: "Elastic Load Balance", sku: "Dedicated ELB", billing: "Yearly/Monthly", unit: "per month", price: "USD 47.80" },
  { service: "Cloud Container Engine", sku: "Cluster Management", billing: "Pay-per-use", unit: "per hour", price: "USD 0.145" },
  { service: "Cloud Container Engine", sku: "Node Pool", billing: "Yearly/Monthly", unit: "per month", price: "USD 112.40" },
  { service: "DataArts Studio", sku: "Basic Workspace", billing: "Yearly/Monthly", unit: "per month", price: "USD 39.00" },
  { service: "Workspace", sku: "Desktop Standard", billing: "Pay-per-use", unit: "per hour", price: "USD 0.082" },
  { service: "Databases", sku: "Primary DB Instance", billing: "Yearly/Monthly", unit: "per month", price: "USD 129.70" },
  { service: "Networking", sku: "NAT Gateway", billing: "Pay-per-use", unit: "per hour", price: "USD 0.056" },
  { service: "Analytics", sku: "Data Lake Query", billing: "Pay-per-use", unit: "per query", price: "USD 0.009" },
];

const flavorSortLabels = {
  "price-asc": "Price: Lowest first",
  "price-desc": "Price: Highest first",
  "name-asc": "Name: A to Z",
  "vcpu-asc": "vCPU: Lowest first",
} as const;

type FlavorBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY" | "RI";

type CatalogFlavor = {
  resourceSpecCode: string;
  family: string | null;
  architecture: string | null;
  series: string | null;
  description: string | null;
  cpu: number;
  ramGiB: number;
  prices: Partial<Record<FlavorBillingMode, number>>;
  currency: string;
  updatedAt: string;
};

type FlavorCard = {
  name: string;
  vcpu: string;
  ram: string;
  family: string;
  price: string;
  priceValue: number;
  priceModeLabel: string;
  flavorPrice: string | null;
  description: string | null;
};

type DiskPricing = {
  currency: string;
  prices: Record<SystemDiskOption, Partial<Record<FlavorBillingMode, number>>>;
};

const flavorPricePriority: Array<{ mode: FlavorBillingMode; label: string; suffix: string }> = [
  { mode: "ONDEMAND", label: "Pay-per-use", suffix: "/h" },
  { mode: "MONTHLY", label: "Monthly", suffix: "/mo" },
  { mode: "YEARLY", label: "Yearly", suffix: "/yr" },
  { mode: "RI", label: "RI", suffix: "" },
];

const billingOptionConfig: Record<
  BillingOption,
  {
    modes: FlavorBillingMode[];
    label: string;
    suffix: string;
  }
> = {
  "Yearly/Monthly": {
    modes: ["MONTHLY", "YEARLY"],
    label: "Monthly",
    suffix: "/mo",
  },
  "Pay-per-use": {
    modes: ["ONDEMAND"],
    label: "Pay-per-use",
    suffix: "/h",
  },
  RI: {
    modes: ["RI"],
    label: "RI",
    suffix: "",
  },
};

function formatFlavorAmount(currency: string, amount: number, suffix: string) {
  return `${currency} ${amount.toFixed(amount < 1 ? 4 : 2)}${suffix}`;
}

function getUsageSuffix(hours: number) {
  return `/${hours}h`;
}

function getDiskPriceForBillingOption(
  diskPricing: DiskPricing | null,
  systemDiskType: SystemDiskOption,
  systemDiskSizeGiB: number,
  billingOption: BillingOption,
  usageHours: number,
) {
  if (!diskPricing || systemDiskSizeGiB <= 0) {
    return null;
  }

  const rates = diskPricing.prices[systemDiskType];
  if (!rates) {
    return null;
  }

  if (billingOption === "Pay-per-use") {
    const rate = rates.ONDEMAND;
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      return null;
    }

    return {
      currency: diskPricing.currency,
      amount: rate * systemDiskSizeGiB * usageHours,
      label: "Disk",
      suffix: getUsageSuffix(usageHours),
    };
  }

  if (billingOption === "Yearly/Monthly") {
    const monthlyRate = rates.MONTHLY;
    if (typeof monthlyRate === "number" && Number.isFinite(monthlyRate)) {
      return {
        currency: diskPricing.currency,
        amount: monthlyRate * systemDiskSizeGiB,
        label: "Disk",
        suffix: "/mo",
      };
    }

    const yearlyRate = rates.YEARLY;
    if (typeof yearlyRate === "number" && Number.isFinite(yearlyRate)) {
      return {
        currency: diskPricing.currency,
        amount: yearlyRate * systemDiskSizeGiB,
        label: "Disk",
        suffix: "/yr",
      };
    }

    return null;
  }

  const onDemandRate = rates.ONDEMAND;
  if (typeof onDemandRate !== "number" || !Number.isFinite(onDemandRate)) {
    return null;
  }

  return {
    currency: diskPricing.currency,
    amount: onDemandRate * systemDiskSizeGiB * 24 * 365,
    label: "Disk (annualized)",
    suffix: "",
  };
}

function getFlavorPriceForBillingOption(flavor: CatalogFlavor, billingOption: BillingOption, usageHours: number) {
  const config = billingOptionConfig[billingOption];

  for (const mode of config.modes) {
    const amount = flavor.prices[mode];
    if (typeof amount === "number" && Number.isFinite(amount)) {
      const modeDetails = flavorPricePriority.find((entry) => entry.mode === mode);
      return {
        amount: billingOption === "Pay-per-use" ? amount * usageHours : amount,
        label: modeDetails?.label ?? config.label,
        suffix: billingOption === "Pay-per-use" ? getUsageSuffix(usageHours) : modeDetails?.suffix ?? config.suffix,
      };
    }
  }

  return null;
}

function toFlavorCard(
  flavor: CatalogFlavor,
  billingOption: BillingOption,
  usageHours: number,
  diskPrice: ReturnType<typeof getDiskPriceForBillingOption>,
): FlavorCard {
  const preferredPrice = getFlavorPriceForBillingOption(flavor, billingOption, usageHours);

  const familyParts = [flavor.family, flavor.architecture].filter(Boolean);
  const totalAmount = preferredPrice ? preferredPrice.amount + (diskPrice?.amount ?? 0) : Number.POSITIVE_INFINITY;

  return {
    name: flavor.resourceSpecCode,
    vcpu: String(flavor.cpu),
    ram: String(Number.isInteger(flavor.ramGiB) ? flavor.ramGiB : Number(flavor.ramGiB.toFixed(1))),
    family: familyParts.join(" · ") || flavor.series || "ECS",
    price: preferredPrice ? formatFlavorAmount(flavor.currency, totalAmount, preferredPrice.suffix) : "Price unavailable",
    priceValue: totalAmount,
    priceModeLabel: preferredPrice?.label ?? "Unavailable",
    flavorPrice: preferredPrice ? formatFlavorAmount(flavor.currency, preferredPrice.amount, preferredPrice.suffix) : null,
    description: flavor.description,
  };
}

type AppList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  products: AppProduct[];
};

type AppProduct = {
  id: string;
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
  createdAt?: string;
  updatedAt: string;
};

type AppProject = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  lists: AppList[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProductPriceSummary(product: AppProduct): string {
  if (isRecord(product.pricing) && typeof product.pricing.total === "string" && product.pricing.total.trim()) {
    return product.pricing.total.trim();
  }

  return "Price unavailable";
}

function splitProductPriceSummary(product: AppProduct) {
  const summary = getProductPriceSummary(product);
  const slashIndex = summary.indexOf("/");

  if (slashIndex === -1) {
    return {
      amount: summary,
      timeframe: null,
    };
  }

  return {
    amount: summary.slice(0, slashIndex),
    timeframe: summary.slice(slashIndex + 1),
  };
}

function splitPriceDisplay(summary: string) {
  const slashIndex = summary.indexOf("/");

  if (slashIndex === -1) {
    return {
      amount: summary,
      timeframe: null,
    };
  }

  return {
    amount: summary.slice(0, slashIndex),
    timeframe: summary.slice(slashIndex + 1),
  };
}

function getProductConfigSummary(product: AppProduct): string {
  if (!isRecord(product.config)) {
    return product.serviceName;
  }

  if (product.productType === "ecs") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.flavor === "string" ? product.config.flavor : null,
      typeof product.config.billingMode === "string" ? product.config.billingMode : null,
      typeof product.config.usageHours === "number" && product.config.billingMode === "Pay-per-use"
        ? `${product.config.usageHours}h`
        : null,
    ].filter(Boolean);

    return parts.join(" · ") || product.serviceName;
  }

  return product.serviceName;
}

function getServiceMeta(serviceCode: string, serviceName: string) {
  return (
    services.find((service) => service.code === serviceCode)
    ?? services.find((service) => service.name === serviceName)
    ?? null
  );
}

function isBillingOption(value: unknown): value is BillingOption {
  return typeof value === "string" && (options.billing as readonly string[]).includes(value);
}

function isSystemDiskOption(value: unknown): value is SystemDiskOption {
  return typeof value === "string" && (systemDiskOptions as readonly string[]).includes(value);
}

function OptionGrid({
  items,
  value,
  onChange,
}: {
  items: BillingOption[];
  value: BillingOption;
  onChange: (value: BillingOption) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <Button
          key={item}
          type="button"
          variant={item === value ? "default" : "secondary"}
          className="justify-start rounded-md"
          aria-pressed={item === value}
          onClick={() => onChange(item)}
        >
          {item}
        </Button>
      ))}
    </div>
  );
}

export default function Home() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const initialCookieValue =
    typeof window === "undefined" ? "" : window.localStorage.getItem("neoCalculator.huaweiCookie") ?? "";

  const [query, setQuery] = useState("");
  const [selectedService, setSelectedService] = useState("Elastic Cloud Server");
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [cookieValue, setCookieValue] = useState(initialCookieValue);
  const [cookieDraft, setCookieDraft] = useState(initialCookieValue);
  const [regionValue, setRegionValue] = useState<HuaweiRegionKey>("la-sao-paulo1");
  const [billingMode, setBillingMode] = useState<BillingOption>("Pay-per-use");
  const [usageHours, setUsageHours] = useState("744");
  const [vcpuValue, setVcpuValue] = useState("2");
  const [ramValue, setRamValue] = useState("8");
  const [instanceCount, setInstanceCount] = useState("1");
  const [systemDiskType, setSystemDiskType] = useState<SystemDiskOption>("High I/O");
  const [systemDiskSize, setSystemDiskSize] = useState("40");
  const [flavorQuery, setFlavorQuery] = useState("");
  const [flavorPage, setFlavorPage] = useState(1);
  const [flavorSort, setFlavorSort] = useState("price-asc");
  const [selectedFlavor, setSelectedFlavor] = useState("");
  const [catalogFlavors, setCatalogFlavors] = useState<CatalogFlavor[]>([]);
  const [diskPricing, setDiskPricing] = useState<DiskPricing | null>(null);
  const [catalogFlavorsLoading, setCatalogFlavorsLoading] = useState(false);
  const [catalogFlavorsError, setCatalogFlavorsError] = useState("");
  const [catalogFlavorsLastCompletedAt, setCatalogFlavorsLastCompletedAt] = useState<string | null>(null);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPending, setNewProjectPending] = useState(false);
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [listPendingProjectId, setListPendingProjectId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductListId, setEditingProductListId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("calculator");
  const [addToListPending, setAddToListPending] = useState(false);
  const [addToListMessage, setAddToListMessage] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileAreaRef = useRef<HTMLDivElement>(null);
  const listboxId = `${useId()}-services`;

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = normalizedQuery
    ? services
        .filter((service) =>
          service.name.toLowerCase().includes(normalizedQuery) || service.code.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 8)
    : [];
  const selectedServiceMeta = services.find((service) => service.name === selectedService) ?? services[0];
  const selectedPrices = priceListEntries.filter((entry) => entry.service === selectedService);
  const hasSuggestions = isSearchOpen && suggestions.length > 0;
  const activeDescendant = hasSuggestions ? `${listboxId}-${activeSuggestionIndex}` : undefined;
  const totalProjectLists = projects.reduce((sum, project) => sum + project.lists.length, 0);
  const totalProjectProducts = projects.reduce(
    (sum, project) => sum + project.lists.reduce((listSum, list) => listSum + list.productCount, 0),
    0,
  );
  const selectedProject = projects.find((project) => project.lists.some((list) => list.id === selectedListId)) ?? null;
  const selectedList = selectedProject?.lists.find((list) => list.id === selectedListId) ?? null;
  const selectedCartProducts = selectedList?.products ?? [];
  const usageHoursValue = Number.isFinite(Number(usageHours)) ? Math.max(1, Number(usageHours)) : 744;
  const minVcpuFilter = Number.isFinite(Number(vcpuValue)) ? Math.max(0, Number(vcpuValue)) : 0;
  const minRamFilter = Number.isFinite(Number(ramValue)) ? Math.max(0, Number(ramValue)) : 0;
  const systemDiskSizeValue = Number.isFinite(Number(systemDiskSize)) ? Math.max(0, Number(systemDiskSize)) : 0;
  const selectedDiskPrice = getDiskPriceForBillingOption(diskPricing, systemDiskType, systemDiskSizeValue, billingMode, usageHoursValue);
  const billableFlavors = catalogFlavors
    .filter((flavor) => getFlavorPriceForBillingOption(flavor, billingMode, usageHoursValue))
    .map((flavor) => toFlavorCard(flavor, billingMode, usageHoursValue, selectedDiskPrice));
  const selectedFlavorCard = billableFlavors.find((flavor) => flavor.name === selectedFlavor) ?? null;
  const selectedEstimate =
    selectedFlavorCard?.price
    ?? selectedPrices.find((entry) => entry.unit === "per month")?.price
    ?? selectedPrices[0]?.price
    ?? "USD 0.00";
  const selectedEstimateParts = splitPriceDisplay(selectedEstimate);
  const filteredFlavors = billableFlavors.filter((flavor) => {
    if (Number(flavor.vcpu) < minVcpuFilter || Number(flavor.ram) < minRamFilter) {
      return false;
    }

    const q = flavorQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      flavor.name.toLowerCase().includes(q) ||
      flavor.family.toLowerCase().includes(q) ||
      `${flavor.vcpu} ${flavor.ram}`.includes(q)
    );
  });
  const sortedFlavors = [...filteredFlavors].sort((a, b) => {
    if (flavorSort === "price-desc") return b.priceValue - a.priceValue;
    if (flavorSort === "name-asc") return a.name.localeCompare(b.name);
    if (flavorSort === "vcpu-asc") return Number(a.vcpu) - Number(b.vcpu);
    return a.priceValue - b.priceValue;
  });
  const totalFlavorPages = Math.max(1, Math.ceil(sortedFlavors.length / 5));
  const currentFlavorPage = Math.min(flavorPage, totalFlavorPages);
  const visibleFlavors = sortedFlavors.slice((currentFlavorPage - 1) * 5, currentFlavorPage * 5);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogFlavors() {
      setCatalogFlavorsLoading(true);
      setCatalogFlavorsError("");

      try {
        const response = await fetch(`/api/catalog/ecs-flavors?region=${encodeURIComponent(regionValue)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          flavors?: CatalogFlavor[];
          diskPricing?: DiskPricing;
          error?: string;
          lastCompletedAt?: string | null;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load ECS flavors");
        }

        if (cancelled) return;

        const nextFlavors = payload.flavors ?? [];
        setCatalogFlavors(nextFlavors);
        setDiskPricing(payload.diskPricing ?? null);
        setCatalogFlavorsLastCompletedAt(payload.lastCompletedAt ?? null);
        setFlavorPage(1);
        setCatalogFlavorsError(payload.error ?? "");
      } catch (error) {
        if (cancelled) return;
        setCatalogFlavors([]);
        setDiskPricing(null);
        setCatalogFlavorsError(error instanceof Error ? error.message : "Failed to load ECS flavors");
      } finally {
        if (!cancelled) {
          setCatalogFlavorsLoading(false);
        }
      }
    }

    void loadCatalogFlavors();

    return () => {
      cancelled = true;
    };
  }, [regionValue]);

  useEffect(() => {
    if (!sortedFlavors.length) {
      setSelectedFlavor("");
      return;
    }

    const activeFlavor = sortedFlavors.find((flavor) => flavor.name === selectedFlavor);
    if (activeFlavor) {
      return;
    }

    const nextFlavor = sortedFlavors[0];
    setSelectedFlavor(nextFlavor.name);
    setVcpuValue(nextFlavor.vcpu);
    setRamValue(nextFlavor.ram);
  }, [selectedFlavor, sortedFlavors]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (searchAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsSearchOpen(false);

      if (profileAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsProfileOpen(false);
    };

    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleShortcut);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setProjects([]);
      setProjectsError("");
      return;
    }

    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to load projects");
        }

        const payload = (await response.json()) as AppProject[];
        setProjects(payload);
        setSelectedListId((current) => {
          if (current && payload.some((project) => project.lists.some((list) => list.id === current))) {
            return current;
          }

          return payload[0]?.lists[0]?.id ?? "";
        });
        setExpandedProjects((current) => {
          const nextState: Record<string, boolean> = {};
          payload.forEach((project, index) => {
            nextState[project.id] = current[project.id] ?? index === 0;
          });
          return nextState;
        });
      } catch (error) {
        setProjectsError(error instanceof Error ? error.message : "Failed to load projects");
      } finally {
        setProjectsLoading(false);
      }
    };

    void loadProjects();
  }, [session?.user.id]);

  const handleSelectService = (service: string) => {
    setSelectedService(service);
    setQuery(service);
    setIsSearchOpen(false);
    setActiveSuggestionIndex(0);
  };

  const handleAuthSubmit = async () => {
    setAuthPending(true);
    setAuthError("");

    try {
      if (authMode === "sign-up") {
        const result = await authClient.signUp.email({
          name: authName.trim() || authEmail.split("@")[0] || "Neo User",
          email: authEmail,
          password: authPassword,
        });

        if (result.error) {
          setAuthError(result.error.message ?? "Unable to create account");
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email: authEmail,
          password: authPassword,
        });

        if (result.error) {
          setAuthError(result.error.message ?? "Unable to sign in");
          return;
        }
      }

      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
    } finally {
      setAuthPending(false);
    }
  };

  const handleSaveCookie = () => {
    window.localStorage.setItem("neoCalculator.huaweiCookie", cookieDraft);
    setCookieValue(cookieDraft);
    setIsProfileOpen(false);
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;

    setNewProjectPending(true);
    setProjectsError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to create project");
      }

      const project = (await response.json()) as Omit<AppProject, "lists">;
      setProjects((current) => [{ ...project, lists: [] }, ...current]);
      setExpandedProjects((current) => ({ ...current, [project.id]: true }));
      setNewProjectName("");
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create project");
    } finally {
      setNewProjectPending(false);
    }
  };

  const handleCreateList = async (projectId: string) => {
    const name = listDrafts[projectId]?.trim();
    if (!name) return;

    setListPendingProjectId(projectId);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to create list");
      }

      const list = (await response.json()) as { id: string; projectId: string; name: string; createdAt: string; updatedAt: string };
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: list.updatedAt,
                lists: [
                  ...project.lists,
                  { id: list.id, name: list.name, createdAt: list.createdAt, updatedAt: list.updatedAt, productCount: 0, products: [] },
                ],
              }
            : project,
        ),
      );
      setSelectedListId((current) => current || list.id);
      setListDrafts((current) => ({ ...current, [projectId]: "" }));
      setExpandedProjects((current) => ({ ...current, [projectId]: true }));
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create list");
    } finally {
      setListPendingProjectId(null);
    }
  };

  const toggleProject = (projectName: string) => {
    setExpandedProjects((current) => ({
      ...current,
      [projectName]: !current[projectName],
    }));
  };

  const updateSystemDiskSize = (nextValue: string) => {
    if (nextValue === "") {
      setSystemDiskSize("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(1024, Math.max(40, parsed));
    setSystemDiskSize(String(bounded));
  };

  const updateInstanceCount = (nextValue: string) => {
    if (nextValue === "") {
      setInstanceCount("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(999, Math.max(1, parsed));
    setInstanceCount(String(bounded));
  };

  const updateUsageHours = (nextValue: string) => {
    if (nextValue === "") {
      setUsageHours("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(87600, Math.max(1, parsed));
    setUsageHours(String(bounded));
  };

  const handleEditProduct = (product: AppProduct) => {
    if (!isRecord(product.config)) {
      setAddToListMessage("This product cannot be edited from the calculator.");
      return;
    }

    const nextRegion = typeof product.config.region === "string" && product.config.region in huaweiRegions
      ? (product.config.region as HuaweiRegionKey)
      : regionValue;
    const nextBillingMode = isBillingOption(product.config.billingMode) ? product.config.billingMode : "Pay-per-use";
    const nextSystemDisk = isRecord(product.config.systemDisk) ? product.config.systemDisk : null;

    setSelectedService(product.serviceName);
    setQuery(product.serviceName);
    setRegionValue(nextRegion);
    setBillingMode(nextBillingMode);
    setUsageHours(
      typeof product.config.usageHours === "number" && Number.isFinite(product.config.usageHours)
        ? String(Math.max(1, Math.floor(product.config.usageHours)))
        : "744",
    );
    setSelectedFlavor(typeof product.config.flavor === "string" ? product.config.flavor : "");
    setVcpuValue(typeof product.config.vcpu === "number" ? String(product.config.vcpu) : vcpuValue);
    setRamValue(typeof product.config.ramGiB === "number" ? String(product.config.ramGiB) : ramValue);
    setSystemDiskType(isSystemDiskOption(nextSystemDisk?.type) ? nextSystemDisk.type : "High I/O");
    setSystemDiskSize(
      typeof nextSystemDisk?.sizeGiB === "number" && Number.isFinite(nextSystemDisk.sizeGiB)
        ? String(Math.max(40, Math.floor(nextSystemDisk.sizeGiB)))
        : "40",
    );
    setInstanceCount(String(Math.max(1, product.quantity)));
    setEditingProductId(product.id);
    setEditingProductListId(selectedListId);
    setActiveTab("calculator");
    setAddToListMessage("Editing item. Save changes when ready.");
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setEditingProductListId(null);
    setAddToListMessage("");
  };

  const handleDeleteProduct = async (product: AppProduct) => {
    if (!selectedListId) {
      return;
    }

    setDeletingProductId(product.id);
    setAddToListMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}/products/${product.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; listId: string; projectId: string; deleted: true; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || "error" in payload) {
        throw new Error(payload?.error ?? "Unable to delete product");
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.listId
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        productCount: Math.max(0, list.productCount - 1),
                        products: list.products.filter((item) => item.id !== payload.id),
                      }
                    : list,
                ),
              }
            : project,
        ),
      );

      if (editingProductId === payload.id) {
        handleCancelEdit();
      }

      setAddToListMessage("Product deleted.");
    } catch (error) {
      setAddToListMessage(error instanceof Error ? error.message : "Unable to delete product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleAddToList = async () => {
    if (!selectedListId) {
      setAddToListMessage("Create a list first.");
      return;
    }

    if (!selectedFlavorCard) {
      setAddToListMessage("Select a flavor first.");
      return;
    }

    setAddToListPending(true);
    setAddToListMessage("");

    try {
      const quantity = Math.max(1, Number(instanceCount || "1"));
      const requestMethod = editingProductId ? "PATCH" : "POST";
      const requestUrl =
        editingProductId && editingProductListId
          ? `/api/lists/${editingProductListId}/products/${editingProductId}`
          : `/api/lists/${selectedListId}/products`;
      const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceCode: selectedServiceMeta.code,
          serviceName: selectedService,
          productType: "ecs",
          title: `${selectedService} ${selectedFlavor}`,
          quantity,
          config: {
            region: regionValue,
            billingMode,
            usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
            flavor: selectedFlavor,
            vcpu: Number(vcpuValue || "0"),
            ramGiB: Number(ramValue || "0"),
            systemDisk: {
              type: systemDiskType,
              sizeGiB: systemDiskSizeValue,
            },
          },
          pricing: {
            total: selectedEstimate,
            flavor: selectedFlavorCard.flavorPrice,
            disk: selectedDiskPrice ? formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix) : null,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (AppProduct & { listId: string; projectId: string; error?: never })
        | { error?: string }
        | null;

      if (!response.ok || !payload || "error" in payload) {
        throw new Error(payload?.error ?? "Unable to add product to list");
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.listId
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        productCount: editingProductId ? list.productCount : list.productCount + 1,
                        products: editingProductId
                          ? list.products.map((item) => (item.id === payload.id ? { ...item, ...payload } : item))
                          : [payload, ...list.products],
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setEditingProductId(null);
      setEditingProductListId(null);
      setAddToListMessage(editingProductId ? "Product updated." : "Product added to list.");
    } catch (error) {
      setAddToListMessage(error instanceof Error ? error.message : "Unable to add product to list");
    } finally {
      setAddToListPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900 lg:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className="relative z-40 rounded-xl border bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-2xl font-semibold tracking-tight text-zinc-950">NeoCalculator</div>
            {session ? (
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-zinc-900">{session.user.name || session.user.email}</p>
                  <p className="text-xs text-zinc-500">{session.user.email}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => authClient.signOut()}>
                  Sign Out
                </Button>
                <div ref={profileAreaRef} className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-full border border-zinc-200"
                    aria-label="Open profile settings"
                    aria-expanded={isProfileOpen}
                    onClick={() => setIsProfileOpen((current) => !current)}
                  >
                    <UserCircle2 className="size-5" />
                  </Button>

                  {isProfileOpen ? (
                    <div className="absolute top-full right-0 z-50 mt-3 w-[min(92vw,380px)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-950">Huawei Cloud Cookie</p>
                        <p className="text-sm text-zinc-500">Paste your website cookie string. It will be saved locally in this browser.</p>
                      </div>
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={cookieDraft}
                          onChange={(event) => setCookieDraft(event.target.value)}
                          className="min-h-32 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-3 focus:ring-zinc-200"
                          placeholder="cookie_name=value; other_cookie=value;"
                        />
                        <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                          <span>{cookieValue ? "Cookie saved locally" : "No cookie saved yet"}</span>
                          <span>{cookieDraft.length} chars</span>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCookieDraft(cookieValue);
                              setIsProfileOpen(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="button" onClick={handleSaveCookie}>
                            Save Cookie
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {isSessionPending ? (
          <Card>
            <CardContent className="py-16 text-center text-zinc-500">Checking session...</CardContent>
          </Card>
        ) : !session ? (
          <Card className="mx-auto w-full max-w-md">
            <CardHeader className="space-y-2">
              <CardTitle>{authMode === "sign-in" ? "Sign In" : "Create Account"}</CardTitle>
              <p className="text-sm text-zinc-500">
                Use email and password authentication. Projects and lists are stored per user in Bun SQLite.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {authMode === "sign-up" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Name</p>
                  <Input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Your name" />
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-sm font-medium">Email</p>
                <Input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Password</p>
                <Input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
              {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
              <div className="flex gap-2">
                <Button type="button" onClick={handleAuthSubmit} disabled={authPending}>
                  {authPending ? "Please wait..." : authMode === "sign-in" ? "Sign In" : "Register"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAuthMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
                    setAuthError("");
                  }}
                >
                  {authMode === "sign-in" ? "Create account" : "Have an account?"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
        <Card className="relative z-30 overflow-visible">
          <CardHeader className="py-6">
            <div className="flex justify-center">
              <div ref={searchAreaRef} className="relative z-40 w-full max-w-3xl">
                <label htmlFor="service-search" className="sr-only">
                  Search services
                </label>
                <Search className="pointer-events-none absolute top-1/2 left-5 z-10 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="service-search"
                  ref={searchInputRef}
                  value={query}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setIsSearchOpen(true);
                    setActiveSuggestionIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      if (suggestions.length === 0) {
                        return;
                      }

                      event.preventDefault();
                      setIsSearchOpen(true);
                      setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
                    }

                    if (event.key === "ArrowUp") {
                      if (suggestions.length === 0) {
                        return;
                      }

                      event.preventDefault();
                      setIsSearchOpen(true);
                      setActiveSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
                    }

                    if (event.key === "Enter" && suggestions[activeSuggestionIndex]) {
                      event.preventDefault();
                      handleSelectService(suggestions[activeSuggestionIndex].name);
                    }

                    if (event.key === "Escape") {
                      setIsSearchOpen(false);
                    }
                  }}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-expanded={hasSuggestions}
                  aria-activedescendant={activeDescendant}
                  className="h-16 rounded-full border-zinc-200 bg-white pr-26 pl-14 text-base shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]"
                  placeholder="Search service name"
                />
                <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
                  Ctrl K
                </div>

                {isSearchOpen && normalizedQuery ? (
                  suggestions.length > 0 ? (
                    <div
                      id={listboxId}
                      role="listbox"
                      className="absolute top-full right-0 left-0 z-50 mt-3 overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]"
                    >
                      <div className="border-b border-zinc-100 px-5 py-3 text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">
                        Suggested services
                      </div>
                      <div className="p-2">
                        {suggestions.map((service, index) => (
                          <button
                            key={service.name}
                            id={`${listboxId}-${index}`}
                            type="button"
                            role="option"
                            aria-selected={index === activeSuggestionIndex}
                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                              index === activeSuggestionIndex ? "bg-zinc-950 text-white" : "text-zinc-900 hover:bg-zinc-100"
                            }`}
                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                            onClick={() => handleSelectService(service.name)}
                          >
                            <div className="flex items-center gap-3">
                              <Image src={service.icon} alt="" width={36} height={36} className="size-9 rounded-md object-contain" />
                              <div>
                                <p className="font-medium">{service.name}</p>
                                <p
                                  className={`text-sm ${
                                    index === activeSuggestionIndex ? "text-zinc-300" : "text-zinc-500"
                                  }`}
                                >
                                  {service.code}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p
                                className={`rounded-full px-2 py-1 text-xs font-medium ${
                                  index === activeSuggestionIndex ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-500"
                                }`}
                              >
                                {service.code}
                              </p>
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-medium ${
                                  index === activeSuggestionIndex ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-500"
                                }`}
                              >
                                Enter
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="absolute top-full right-0 left-0 z-50 mt-3 rounded-[28px] border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-500 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                      No services matched your search.
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </CardHeader>
        </Card>

        <main className="relative z-0 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Projects</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">Projects and lists are scoped to your account.</p>
                </div>
                <Badge variant="secondary">{projects.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="New project name"
                  />
                  <Button variant="outline" size="sm" onClick={handleCreateProject} disabled={newProjectPending}>
                    {newProjectPending ? "Adding..." : "New Project"}
                  </Button>
                </div>
                {projectsError ? <p className="text-sm text-red-600">{projectsError}</p> : null}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[620px] px-4">
                <div className="space-y-3 py-3">
                  {projectsLoading ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">Loading projects...</div>
                  ) : null}
                  {projects.map((project) => {
                    const isExpanded = expandedProjects[project.id] ?? false;

                    return (
                      <div key={project.id} className="rounded-lg border bg-white">
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 p-4 text-left"
                          onClick={() => toggleProject(project.id)}
                          aria-expanded={isExpanded}
                        >
                          <div className="min-w-0">
                            <p className="font-medium">{project.name}</p>
                            <p className="text-sm text-zinc-500">
                              {project.lists.length} lists · {project.lists.reduce((sum, list) => sum + list.productCount, 0)} products ·{" "}
                              {new Date(project.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{project.lists.length}</Badge>
                            {isExpanded ? <ChevronDown className="size-4 text-zinc-500" /> : <ChevronRight className="size-4 text-zinc-500" />}
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-zinc-100 px-3 py-3">
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  value={listDrafts[project.id] ?? ""}
                                  onChange={(event) => setListDrafts((current) => ({ ...current, [project.id]: event.target.value }))}
                                  placeholder="New list name"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCreateList(project.id)}
                                  disabled={listPendingProjectId === project.id}
                                >
                                  {listPendingProjectId === project.id ? "Adding..." : "Add List"}
                                </Button>
                              </div>
                              {project.lists.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setSelectedListId(item.id)}
                                  className={`block w-full rounded-lg border p-3 text-left ${
                                    selectedListId === item.id ? "border-zinc-950 bg-white" : "border-zinc-200 bg-zinc-50"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium">{item.name}</p>
                                      <p className="text-sm text-zinc-500">
                                        {item.productCount} products · Created {new Date(item.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <Badge variant="outline">{item.productCount}</Badge>
                                  </div>
                                </button>
                              ))}
                              {project.lists.length === 0 ? (
                                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                                  This project does not have lists yet.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                    {projects.length} projects containing {totalProjectLists} lists and {totalProjectProducts} products.
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Image src={selectedServiceMeta.icon} alt="" width={40} height={40} className="size-10 rounded-lg object-contain" />
                    <div>
                      <CardTitle className="text-2xl">{selectedService}</CardTitle>
                      <p className="text-sm text-zinc-500">{selectedServiceMeta.code}</p>
                    </div>
                  </div>
                  <TabsList>
                    <TabsTrigger value="calculator">Price Calculator</TabsTrigger>
                    <TabsTrigger value="batch-add">Batch add</TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <Separator />

              <TabsContent value="calculator">
                <CardContent className="space-y-6 py-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm text-zinc-600">Description (Optional)</p>
                      <Input value={selectedService} readOnly className="max-w-sm lg:max-w-none" />
                    </div>

                    <section className="space-y-3">
                      <p className="text-sm font-medium">Region</p>
                      <Select value={regionValue} onValueChange={(value) => setRegionValue(value as HuaweiRegionKey)}>
                        <SelectTrigger className="max-w-sm bg-white lg:max-w-none">
                          <SelectValue>{huaweiRegions[regionValue].full}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(huaweiRegions).map(([value, labels]) => (
                            <SelectItem key={value} value={value}>
                              {labels.short}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </section>
                  </div>

                  <section className={`grid gap-4 ${billingMode === "Pay-per-use" ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Billing Mode</p>
                      <OptionGrid
                        items={[...options.billing]}
                        value={billingMode}
                        onChange={(value) => {
                          setBillingMode(value);
                          setFlavorPage(1);
                        }}
                      />
                    </div>
                    {billingMode === "Pay-per-use" ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Usage Hours</p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11 rounded-none px-3"
                              onClick={() => updateUsageHours(String(Number(usageHours || "744") - 24))}
                            >
                              -
                            </Button>
                            <Input
                              value={usageHours}
                              onChange={(event) => {
                                const digitsOnly = event.target.value.replace(/\D/g, "");
                                if (digitsOnly === "") {
                                  setUsageHours("");
                                  return;
                                }
                                updateUsageHours(digitsOnly);
                              }}
                              onBlur={() => updateUsageHours(usageHours || "744")}
                              inputMode="numeric"
                              className="h-11 w-24 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11 rounded-none px-3"
                              onClick={() => updateUsageHours(String(Number(usageHours || "744") + 24))}
                            >
                              +
                            </Button>
                          </div>
                          <span className="text-sm font-medium text-zinc-500">hours</span>
                        </div>
                      </div>
                    ) : null}
                  </section>
                  <section className="space-y-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Minimum vCPUs</p>
                        <Input
                          value={vcpuValue}
                          onChange={(event) => setVcpuValue(event.target.value)}
                          inputMode="numeric"
                          placeholder="Show flavors with at least this many vCPUs"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Minimum Memory (GiB)</p>
                        <Input
                          value={ramValue}
                          onChange={(event) => setRamValue(event.target.value)}
                          inputMode="numeric"
                          placeholder="Show flavors with at least this much RAM"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Flavor</p>
                        <p className="text-sm text-zinc-500">Only flavors meeting the minimum vCPU and RAM filters appear here.</p>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <div className="w-full sm:w-44">
                          <Input
                            value={flavorQuery}
                            onChange={(event) => {
                              setFlavorQuery(event.target.value);
                              setFlavorPage(1);
                            }}
                            placeholder="Search flavors"
                          />
                        </div>
                        <Select
                          value={flavorSort}
                          onValueChange={(value) => {
                            if (!value) return;
                            setFlavorSort(value);
                            setFlavorPage(1);
                          }}
                        >
                          <SelectTrigger className="w-full bg-white sm:w-52">
                            <SelectValue>{flavorSortLabels[flavorSort as keyof typeof flavorSortLabels]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="price-asc">{flavorSortLabels["price-asc"]}</SelectItem>
                            <SelectItem value="price-desc">{flavorSortLabels["price-desc"]}</SelectItem>
                            <SelectItem value="name-asc">{flavorSortLabels["name-asc"]}</SelectItem>
                            <SelectItem value="vcpu-asc">{flavorSortLabels["vcpu-asc"]}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-zinc-50 p-3">
                      {catalogFlavorsError ? <p className="mb-3 text-sm text-red-600">{catalogFlavorsError}</p> : null}
                      {catalogFlavorsLastCompletedAt ? (
                        <p className="mb-3 text-xs text-zinc-500">Last synced: {new Date(catalogFlavorsLastCompletedAt).toLocaleString()}</p>
                      ) : null}
                      <div className="space-y-2">
                        {catalogFlavorsLoading ? (
                          <div className="rounded-lg border border-dashed bg-white px-3 py-6 text-center text-sm text-zinc-500">
                            Loading ECS flavors...
                          </div>
                        ) : null}

                        {visibleFlavors.map((flavor) => {
                          const isSelected = selectedFlavor === flavor.name;

                          return (
                            <button
                              key={flavor.name}
                              type="button"
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left ${
                                isSelected ? "border-zinc-950 bg-white" : "border-zinc-200 bg-white/80"
                              }`}
                              onClick={() => {
                                setSelectedFlavor(flavor.name);
                                setVcpuValue(flavor.vcpu);
                                setRamValue(flavor.ram);
                              }}
                            >
                              <div>
                                <p className="font-medium text-zinc-950">{flavor.name}</p>
                                <p className="text-sm text-zinc-500">{flavor.family}</p>
                                <p className="text-xs text-zinc-400">{flavor.priceModeLabel}</p>
                              </div>
                              <div className="text-right text-sm">
                                <p className="font-medium text-zinc-950">{flavor.price}</p>
                                <p className="text-zinc-500">
                                  {flavor.vcpu} vCPUs · {flavor.ram} GiB RAM
                                </p>
                              </div>
                            </button>
                          );
                        })}

                        {!catalogFlavorsLoading && visibleFlavors.length === 0 ? (
                          <div className="rounded-lg border border-dashed bg-white px-3 py-6 text-center text-sm text-zinc-500">
                            No flavors matched your search.
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
                        <span>
                          Page {currentFlavorPage} of {totalFlavorPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFlavorPage((page) => Math.max(1, page - 1))}
                            disabled={currentFlavorPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFlavorPage((page) => Math.min(totalFlavorPages, page + 1))}
                            disabled={currentFlavorPage === totalFlavorPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-sm font-medium">System Disk</p>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <Select
                        value={systemDiskType}
                        onValueChange={(value) => {
                          if (!value) return;
                          setSystemDiskType(value as (typeof systemDiskOptions)[number]);
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
                            onClick={() => updateSystemDiskSize(String(Number(systemDiskSize || "40") - 10))}
                          >
                            -
                          </Button>
                          <Input
                            value={systemDiskSize}
                            onChange={(event) => {
                              const digitsOnly = event.target.value.replace(/\D/g, "");
                              if (digitsOnly === "") {
                                setSystemDiskSize("");
                                return;
                              }
                              updateSystemDiskSize(digitsOnly);
                            }}
                            onBlur={() => updateSystemDiskSize(systemDiskSize || "40")}
                            inputMode="numeric"
                            className="h-11 w-20 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-11 rounded-none px-3"
                            onClick={() => updateSystemDiskSize(String(Number(systemDiskSize || "40") + 10))}
                          >
                            +
                          </Button>
                        </div>
                        <span className="text-sm font-medium text-zinc-500">GiB</span>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500">Minimum 40 GiB, maximum 1024 GiB.</p>
                  </section>

                  <div className="rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-600">
                    Selected specifications: {selectedFlavor} | {vcpuValue || "-"} vCPUs | {ramValue || "-"} GiB | {systemDiskType} {systemDiskSize || "40"} GiB
                    {selectedDiskPrice ? ` | Disk ${formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}` : ""}
                    {selectedFlavorCard?.flavorPrice && selectedDiskPrice ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Flavor {selectedFlavorCard.flavorPrice} + Disk {formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
                <Separator />
                <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-600">Estimated Price</p>
                    <p className="mt-1 text-4xl font-semibold tracking-tight text-zinc-950">{selectedEstimateParts.amount}</p>
                    {selectedEstimateParts.timeframe ? (
                      <p className="mt-1 text-sm font-medium text-zinc-500">{selectedEstimateParts.timeframe}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 xl:items-end">
                    {addToListMessage ? <p className="text-sm text-zinc-500">{addToListMessage}</p> : null}
                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-600">Instances</span>
                        <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-10 rounded-none px-3"
                            onClick={() => updateInstanceCount(String(Number(instanceCount || "1") - 1))}
                          >
                            -
                          </Button>
                          <Input
                            value={instanceCount}
                            onChange={(event) => {
                              const digitsOnly = event.target.value.replace(/\D/g, "");
                              if (digitsOnly === "") {
                                setInstanceCount("");
                                return;
                              }
                              updateInstanceCount(digitsOnly);
                            }}
                            onBlur={() => updateInstanceCount(instanceCount || "1")}
                            inputMode="numeric"
                            className="h-10 w-16 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-10 rounded-none px-3"
                            onClick={() => updateInstanceCount(String(Number(instanceCount || "1") + 1))}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                        {editingProductId ? (
                          <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={addToListPending}>
                            Cancel
                          </Button>
                        ) : null}
                        <Button onClick={handleAddToList} disabled={addToListPending || !selectedListId}>
                          {addToListPending ? (editingProductId ? "Saving..." : "Adding...") : editingProductId ? "Save Changes" : "Add to List"}
                        </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="batch-add">
                <CardContent className="space-y-6 py-5">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Region</p>
                    <Select value={regionValue} onValueChange={(value) => setRegionValue(value as HuaweiRegionKey)}>
                      <SelectTrigger className="max-w-sm bg-white">
                        <SelectValue>{huaweiRegions[regionValue].full}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(huaweiRegions).map(([value, labels]) => (
                          <SelectItem key={value} value={value}>
                            {labels.short}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Batch input</p>
                    <textarea
                      className="min-h-48 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-3 focus:ring-zinc-200"
                      placeholder={`[
  {
    "vcpu": 2,
    "ram": 8
  },
  {
    "vcpu": 4,
    "ram": 16,
    "description": "Production API",
    "evs": {
      "type": "Ultra-high I/O",
      "size": 100
    }
  }
]`}
                    />
                    <p className="text-sm text-zinc-500">
                      Paste a JSON array of instances. Required fields: <code>vcpu</code> and <code>ram</code>. Optional fields:
                      <code>description</code> and <code>evs</code>.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border bg-zinc-50 p-4">
                      <p className="text-sm font-medium text-zinc-900">Defaults</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        If omitted, <code>description</code> defaults to <code>Elastic Cloud Server</code> and
                        <code>evs</code> defaults to <code>{`{ "type": "High I/O", "size": 40 }`}</code>.
                      </p>
                    </div>
                    <div className="rounded-lg border bg-zinc-50 p-4">
                      <p className="text-sm font-medium text-zinc-900">Validation</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Each JSON item should include numeric <code>vcpu</code> and <code>ram</code>. When present, <code>evs.size</code>
                        should be in GiB and <code>evs.type</code> should match an available disk type.
                      </p>
                    </div>
                  </div>
                </CardContent>
                <Separator />
                <div className="flex justify-end p-4">
                  <Button>Add Batch</Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Cart Contents</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    {selectedList && selectedProject ? `${selectedProject.name} / ${selectedList.name}` : "Select a list to see its saved products."}
                  </p>
                </div>
                <Badge variant="outline">{selectedCartProducts.length} items</Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[620px] px-4">
                <div className="space-y-3 py-3">
                  {!selectedList ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      Create a list and select it to use it as the active cart.
                    </div>
                  ) : null}

                  {selectedList && selectedCartProducts.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      This cart is empty.
                    </div>
                  ) : null}

                  {selectedCartProducts.map((product) => {
                    const serviceMeta = getServiceMeta(product.serviceCode, product.serviceName);
                    const priceSummary = splitProductPriceSummary(product);
                    const isEditingProduct = editingProductId === product.id;

                    return (
                      <div
                        key={product.id}
                        className={`rounded-lg border p-4 ${
                          isEditingProduct ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              {serviceMeta ? (
                                <Image
                                  src={serviceMeta.icon}
                                  alt=""
                                  width={28}
                                  height={28}
                                  className="mt-0.5 size-7 rounded-md object-contain"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-medium">{product.title}</p>
                                  {isEditingProduct ? <Badge>Editing</Badge> : null}
                                </div>
                                <p className="mt-1 text-sm text-zinc-500">{getProductConfigSummary(product)}</p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {product.serviceCode} · {product.productType.toUpperCase()} · Qty {product.quantity}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-lg font-semibold text-zinc-950">{priceSummary.amount}</p>
                            <p className="text-sm text-zinc-500">{priceSummary.timeframe ?? "Saved item"}</p>
                            <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
                              {isEditingProduct ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    disabled={addToListPending || deletingProductId === product.id}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAddToList}
                                    disabled={addToListPending || !selectedListId || deletingProductId === product.id}
                                  >
                                    {addToListPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditProduct(product)}
                                  disabled={deletingProductId === product.id}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteProduct(product)}
                                disabled={deletingProductId === product.id}
                              >
                                {deletingProductId === product.id ? "Deleting..." : "Delete"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </main>
          </>
        )}
      </div>
    </div>
  );
}
