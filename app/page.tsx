"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { EcsCalculatorPanel } from "@/components/calculators/ecs-calculator-panel";
import { EvsCalculatorPanel } from "@/components/calculators/evs-calculator-panel";
import { FlexusLCalculatorPanel } from "@/components/calculators/flexus-l-calculator-panel";
import { ServiceBatchAddPanel } from "@/components/calculators/service-batch-add-panel";
import { UnsupportedServicePanel } from "@/components/calculators/unsupported-service-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { findBestFlexusLPlan, findFlexusLPlan, flexusLPlans, flexusLPricingReference } from "@/lib/flexus-l-catalog";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronDown, ChevronRight, Copy, Link2, MoreHorizontal, Pencil, RefreshCw, Search, Share2, Trash2, UserCircle2, X } from "lucide-react";

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
  { name: "Flexus L Instance", code: "Flexus L", icon: "https://res-static.hc-cdn.cn/aem/program/prod/common/china/zh-cn/service-icon/hcss.svg" },
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

const supportedCalculatorServiceCodes = ["ECS", "Flexus L", "EVS"] as const;
const supportedBatchAddServiceCodes = ["ECS", "Flexus L", "EVS"] as const;
const evsBillingOptions: BillingOption[] = ["Pay-per-use", "Yearly/Monthly"];
const flavorPageSizeOptions = [1, 3, 5, 10, 20] as const;
const flavorPageSizeStorageKey = "neoCalculator.flavorPageSize";
const ecsDiskSizeBounds = { min: 40, max: 1024 } as const;
const evsDiskSizeBounds = { min: 1, max: 1_000_000 } as const;
const evsSingleDiskMaxGiB = 32_768;
const gpSsd2IopsBounds = { min: 3_000, max: 128_000 } as const;
const gpSsd2ThroughputBounds = { min: 125, max: 1_000 } as const;

type FlavorBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY" | "RI";
type FlavorPriceSource = "catalog_plan" | "rate_inquiry";

type CatalogFlavor = {
  resourceSpecCode: string;
  family: string | null;
  architecture: string | null;
  series: string | null;
  description: string | null;
  cpu: number;
  ramGiB: number;
  prices: Partial<Record<FlavorBillingMode, number>>;
  priceSources?: Partial<Record<FlavorBillingMode, FlavorPriceSource>>;
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
  priceCurrency: string;
  priceSuffix: string;
  priceModeLabel: string;
  flavorPrice: string | null;
  description: string | null;
  productType: "ecs" | "flexus-l";
  serviceCode: string;
  serviceName: string;
  referencePlanId?: string;
  includedSystemDiskGiB?: number;
  peakBandwidthMbit?: number;
  dataPackageTiB?: number;
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
    if (mode === "ONDEMAND" && flavor.priceSources?.ONDEMAND && flavor.priceSources.ONDEMAND !== "catalog_plan") {
      continue;
    }

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
    priceCurrency: flavor.currency,
    priceSuffix: preferredPrice?.suffix ?? "",
    priceModeLabel: preferredPrice?.label ?? "Unavailable",
    flavorPrice: preferredPrice ? formatFlavorAmount(flavor.currency, preferredPrice.amount, preferredPrice.suffix) : null,
    description: flavor.description,
    productType: "ecs",
    serviceCode: "ECS",
    serviceName: "Elastic Cloud Server",
  };
}

function toFlexusLFlavorCard(plan: (typeof flexusLPlans)[number], billingOption: BillingOption, usageHours: number): FlavorCard {
  const priceSuffix = billingOption === "Pay-per-use" ? getUsageSuffix(usageHours) : "/mo";
  const priceModeLabel =
    billingOption === "RI" ? "RI reference" : billingOption === "Pay-per-use" ? "Pay-per-use reference" : "Monthly";

  return {
    name: `Flexus L ${plan.title}`,
    vcpu: String(plan.vcpu),
    ram: String(plan.ramGiB),
    family: `Flexus L · ${plan.systemDiskGiB} GiB included · ${plan.dataPackageTiB} TB/month`,
    price: formatFlavorAmount("USD", plan.monthlyPriceUsd, priceSuffix),
    priceValue: plan.monthlyPriceUsd,
    priceCurrency: "USD",
    priceSuffix,
    priceModeLabel,
    flavorPrice: formatFlavorAmount("USD", plan.monthlyPriceUsd, priceSuffix),
    description: `Flexus L bundled plan with ${plan.systemDiskGiB} GiB system disk, ${plan.peakBandwidthMbit} Mbit/s peak bandwidth, and ${plan.dataPackageTiB} TB/month.`,
    productType: "flexus-l",
    serviceCode: "Flexus L",
    serviceName: "Flexus L Instance",
    referencePlanId: plan.id,
    includedSystemDiskGiB: plan.systemDiskGiB,
    peakBandwidthMbit: plan.peakBandwidthMbit,
    dataPackageTiB: plan.dataPackageTiB,
  };
}

type AppList = {
  id: string;
  name: string;
  ownerUserId: string;
  accessLevel: "owner" | "project_collaborator" | "list_collaborator";
  canShare: boolean;
  huaweiCartKey: string | null;
  huaweiCartName: string | null;
  huaweiLastSyncedAt: string | null;
  huaweiLastError: string | null;
  huaweiLastRemoteUpdatedAt: number | null;
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
  ownerUserId: string;
  accessLevel: "owner" | "project_collaborator" | "list_collaborator";
  canShare: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  lists: AppList[];
};

type HuaweiCartSummary = {
  key: string;
  name: string;
  updateTime: number;
  billingMode: string | null;
  totalAmount: number | null;
  originalAmount: number | null;
  associatedListId: string | null;
};

type ActionMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

type BatchEcsSelection = {
  flavor: CatalogFlavor;
  flavorCard: FlavorCard;
  diskPrice: NonNullable<ReturnType<typeof getDiskPriceForBillingOption>>;
};

type BatchFlexusLSelection = {
  plan: (typeof flexusLPlans)[number];
  flavorCard: FlavorCard;
};

type ProductMutationBody = {
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
};

type ActiveModal =
  | { kind: "project-huawei"; projectId: string }
  | { kind: "project-clone"; projectId: string }
  | { kind: "project-share"; projectId: string }
  | { kind: "list-link"; listId: string }
  | { kind: "list-clone"; listId: string }
  | { kind: "list-share"; listId: string }
  | null;

function getFirstListId(projects: AppProject[]) {
  return projects[0]?.lists[0]?.id ?? "";
}

function getProjectCloneDefaultName(
  projectName: string,
  targetRegion: HuaweiRegionKey | "",
  targetBillingMode: BillingOption | "",
) {
  const base = projectName.trim() || "NeoCalculator project";
  const suffixParts: string[] = [];
  if (targetRegion) {
    suffixParts.push(huaweiRegions[targetRegion].short);
  }
  if (targetBillingMode) {
    suffixParts.push(targetBillingMode);
  }

  return suffixParts.length ? `${base} ${suffixParts.join(" ")}` : `${base} (Copy)`;
}

function getCartCloneDefaultName(
  listName: string,
  targetRegion: HuaweiRegionKey | "",
  targetBillingMode: BillingOption | "",
) {
  const base = listName.trim() || "NeoCalculator cart";
  const suffixParts: string[] = [];
  if (targetRegion) {
    suffixParts.push(huaweiRegions[targetRegion].short);
  }
  if (targetBillingMode) {
    suffixParts.push(targetBillingMode);
  }

  return suffixParts.length ? `${base} (${suffixParts.join(" · ")})` : `${base} (Copy)`;
}

async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function ActionMenu({
  open,
  onOpenChange,
  label,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  items: ActionMenuItem[];
}) {
  return (
    <div data-action-menu-root className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                onOpenChange(false);
                item.onSelect();
              }}
            >
              <span className="text-zinc-500">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActionModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_100px_-40px_rgba(15,23,42,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Close ${title}`} onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-4 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function HomeNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
      }`}
    >
      {children}
    </Link>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
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

function scalePriceDisplay(summary: string, multiplier: number) {
  const normalizedMultiplier = Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1;
  if (normalizedMultiplier === 1) {
    return summary;
  }

  const match = summary.match(/^([A-Z]{3})\s+([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) {
    return summary;
  }

  const [, currency, rawAmount, suffix] = match;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount)) {
    return summary;
  }

  return formatFlavorAmount(currency, amount * normalizedMultiplier, suffix);
}

function buildFlavorAutoSelectKey({
  minVcpuValue,
  minRamValue,
  flavorQuery,
  flavorSort,
  regionValue,
  billingMode,
  usageHoursValue,
  systemDiskType,
  systemDiskSizeValue,
  includeFlexusL,
}: {
  minVcpuValue: string;
  minRamValue: string;
  flavorQuery: string;
  flavorSort: string;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHoursValue: number;
  systemDiskType: SystemDiskOption;
  systemDiskSizeValue: number;
  includeFlexusL: boolean;
}) {
  return [
    minVcpuValue,
    minRamValue,
    flavorQuery.trim().toLowerCase(),
    flavorSort,
    regionValue,
    billingMode,
    String(usageHoursValue),
    systemDiskType,
    String(systemDiskSizeValue),
    includeFlexusL ? "with-flexus-l" : "ecs-only",
  ].join("|");
}

function getProductConfigSummary(product: AppProduct): string {
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

  if (product.productType === "huawei-raw") {
    const parts = [
      typeof product.config.region === "string" ? product.config.region : null,
      typeof product.config.resourceCode === "string" ? product.config.resourceCode : null,
      typeof product.config.pricingMode === "string" ? product.config.pricingMode : null,
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

function getCalculatorBillingOptions(serviceCode: string): BillingOption[] {
  if (serviceCode === "EVS") {
    return evsBillingOptions;
  }

  if (serviceCode === "Flexus L") {
    return ["Yearly/Monthly"];
  }

  return [...options.billing];
}

function parsePositiveNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parseBatchQuantity(value: unknown) {
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}

function getNestedRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

function getBatchDiskType(
  value: unknown,
  fallback: SystemDiskOption,
) {
  const evs = getNestedRecord(value, "evs");
  const candidates = [
    isRecord(value) ? value.type : undefined,
    isRecord(value) ? value.diskType : undefined,
    isRecord(value) ? value.systemDiskType : undefined,
    evs?.type,
    evs?.diskType,
  ];

  for (const candidate of candidates) {
    if (isSystemDiskOption(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function getBatchDiskSize(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
) {
  const evs = getNestedRecord(value, "evs");
  const candidates = [
    isRecord(value) ? value.size : undefined,
    isRecord(value) ? value.sizeGiB : undefined,
    isRecord(value) ? value.diskSizeGiB : undefined,
    isRecord(value) ? value.systemDiskSizeGiB : undefined,
    evs?.size,
    evs?.sizeGiB,
    evs?.diskSizeGiB,
  ];

  for (const candidate of candidates) {
    const parsed = parsePositiveNumber(candidate);
    if (parsed != null) {
      return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
    }
  }

  return fallback;
}

function getBatchDescription(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.description === "string" && value.description.trim()) {
    return value.description.trim();
  }

  return fallback;
}

function hasExplicitBatchDiskConfig(value: unknown) {
  const evs = getNestedRecord(value, "evs");
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type !== undefined
    || value.diskType !== undefined
    || value.systemDiskType !== undefined
    || value.size !== undefined
    || value.sizeGiB !== undefined
    || value.diskSizeGiB !== undefined
    || value.systemDiskSizeGiB !== undefined
    || evs != null
  );
}

function getGpSsd2IopsBounds(sizeGiB: number) {
  const max = Math.max(1, Math.min(gpSsd2IopsBounds.max, Math.floor(sizeGiB * 500)));
  return {
    min: Math.min(gpSsd2IopsBounds.min, max),
    max,
  };
}

function normalizeGpSsd2Iops(value: unknown, sizeGiB: number) {
  const bounds = getGpSsd2IopsBounds(sizeGiB);
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return bounds.min;
  }

  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
}

function getGpSsd2ThroughputBounds(iops: number) {
  const max = Math.max(1, Math.min(gpSsd2ThroughputBounds.max, Math.floor(iops / 4)));
  return {
    min: Math.min(gpSsd2ThroughputBounds.min, max),
    max,
  };
}

function normalizeGpSsd2Throughput(value: unknown, iops: number) {
  const bounds = getGpSsd2ThroughputBounds(iops);
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return bounds.min;
  }

  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
}

function getGpSsd2RequestedIops(value: unknown, fallbackSizeGiB: number) {
  const evs = getNestedRecord(value, "evs");
  const systemDisk = getNestedRecord(value, "systemDisk");
  const candidates = [
    isRecord(value) ? value.iops : undefined,
    isRecord(value) ? value.diskIops : undefined,
    evs?.iops,
    evs?.diskIops,
    systemDisk?.iops,
    systemDisk?.diskIops,
  ];

  for (const candidate of candidates) {
    if (parsePositiveNumber(candidate) != null) {
      return normalizeGpSsd2Iops(candidate, fallbackSizeGiB);
    }
  }

  return normalizeGpSsd2Iops(undefined, fallbackSizeGiB);
}

function getGpSsd2RequestedThroughput(value: unknown, fallbackIops: number) {
  const evs = getNestedRecord(value, "evs");
  const systemDisk = getNestedRecord(value, "systemDisk");
  const candidates = [
    isRecord(value) ? value.throughput : undefined,
    isRecord(value) ? value.diskThroughput : undefined,
    evs?.throughput,
    evs?.diskThroughput,
    systemDisk?.throughput,
    systemDisk?.diskThroughput,
  ];

  for (const candidate of candidates) {
    if (parsePositiveNumber(candidate) != null) {
      return normalizeGpSsd2Throughput(candidate, fallbackIops);
    }
  }

  return normalizeGpSsd2Throughput(undefined, fallbackIops);
}

function splitEvsDiskSizes(totalGiB: number) {
  const normalizedTotal = Math.max(1, Math.floor(totalGiB));
  const chunks: number[] = [];
  let remaining = normalizedTotal;

  while (remaining > evsSingleDiskMaxGiB) {
    chunks.push(evsSingleDiskMaxGiB);
    remaining -= evsSingleDiskMaxGiB;
  }

  chunks.push(remaining);
  return chunks;
}

function buildEvsSplitNotice(totalGiB: number) {
  if (totalGiB <= evsSingleDiskMaxGiB) {
    return null;
  }

  const chunks = splitEvsDiskSizes(totalGiB);
  return `Totals above ${evsSingleDiskMaxGiB} GiB are saved as multiple disks: ${chunks.join(" GiB + ")} GiB.`;
}

function findBestBatchEcsSelection(
  flavors: CatalogFlavor[],
  diskPricing: DiskPricing | null,
  billingOption: BillingOption,
  usageHours: number,
  vcpu: number,
  ramGiB: number,
  diskType: SystemDiskOption,
  diskSizeGiB: number,
  fallbackDescription: string,
): BatchEcsSelection | null {
  const candidates = flavors
    .filter((flavor) => flavor.cpu >= vcpu && flavor.ramGiB >= ramGiB)
    .map((flavor) => {
      const diskPrice = getDiskPriceForBillingOption(
        diskPricing,
        diskType,
        diskSizeGiB,
        billingOption,
        usageHours,
      );
      const flavorCard = toFlavorCard(
        {
          ...flavor,
          description: flavor.description ?? fallbackDescription,
        },
        billingOption,
        usageHours,
        diskPrice,
      );

      return diskPrice
        ? {
            flavor,
            flavorCard,
            diskPrice,
          }
        : null;
    })
    .filter((candidate): candidate is BatchEcsSelection => candidate != null)
    .sort((left, right) => {
      if (left.flavorCard.priceValue !== right.flavorCard.priceValue) {
        return left.flavorCard.priceValue - right.flavorCard.priceValue;
      }

      if (left.flavor.cpu !== right.flavor.cpu) {
        return left.flavor.cpu - right.flavor.cpu;
      }

      if (left.flavor.ramGiB !== right.flavor.ramGiB) {
        return left.flavor.ramGiB - right.flavor.ramGiB;
      }

      return left.flavor.resourceSpecCode.localeCompare(right.flavor.resourceSpecCode);
    });

  return candidates[0] ?? null;
}

function findBestBatchFlexusLSelection(
  billingOption: BillingOption,
  usageHours: number,
  vcpu: number,
  ramGiB: number,
): BatchFlexusLSelection | null {
  const plan = findBestFlexusLPlan(vcpu, ramGiB);
  if (!plan) {
    return null;
  }

  return {
    plan,
    flavorCard: toFlexusLFlavorCard(plan, billingOption, usageHours),
  };
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
  const [cookieValue, setCookieValue] = useState("");
  const [cookieDraft, setCookieDraft] = useState("");
  const [regionValue, setRegionValue] = useState<HuaweiRegionKey>("la-sao-paulo1");
  const [billingMode, setBillingMode] = useState<BillingOption>("Pay-per-use");
  const [usageHours, setUsageHours] = useState("744");
  const [vcpuValue, setVcpuValue] = useState("2");
  const [ramValue, setRamValue] = useState("8");
  const [minVcpuValue, setMinVcpuValue] = useState("2");
  const [minRamValue, setMinRamValue] = useState("8");
  const [instanceCount, setInstanceCount] = useState("1");
  const [systemDiskType, setSystemDiskType] = useState<SystemDiskOption>("High I/O");
  const [systemDiskSize, setSystemDiskSize] = useState("40");
  const [gpSsd2Iops, setGpSsd2Iops] = useState("3000");
  const [gpSsd2Throughput, setGpSsd2Throughput] = useState("125");
  const [flavorQuery, setFlavorQuery] = useState("");
  const [flavorPage, setFlavorPage] = useState(1);
  const [flavorSort, setFlavorSort] = useState("price-asc");
  const [flavorPageSize, setFlavorPageSize] = useState<(typeof flavorPageSizeOptions)[number]>(3);
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
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectNameDrafts, setProjectNameDrafts] = useState<Record<string, string>>({});
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [listBaseDrafts, setListBaseDrafts] = useState<Record<string, string>>({});
  const [listPendingProjectId, setListPendingProjectId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedHuaweiCartKey, setSelectedHuaweiCartKey] = useState("");
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductListId, setEditingProductListId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("calculator");
  const [showFlexusLInEcs, setShowFlexusLInEcs] = useState(false);
  const [addToListPending, setAddToListPending] = useState(false);
  const [addToListMessage, setAddToListMessage] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [batchAddPending, setBatchAddPending] = useState(false);
  const [batchAddMessage, setBatchAddMessage] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [huaweiCarts, setHuaweiCarts] = useState<HuaweiCartSummary[]>([]);
  const [huaweiCartsLoading, setHuaweiCartsLoading] = useState(false);
  const [huaweiCartsError, setHuaweiCartsError] = useState("");
  const [huaweiCartsSyncedAt, setHuaweiCartsSyncedAt] = useState<string | null>(null);
  const [linkingHuaweiListId, setLinkingHuaweiListId] = useState<string | null>(null);
  const [syncingHuaweiListId, setSyncingHuaweiListId] = useState<string | null>(null);
  const [huaweiActionMessage, setHuaweiActionMessage] = useState("");
  const [cloneNameDraft, setCloneNameDraft] = useState("");
  const [cloneTargetRegion, setCloneTargetRegion] = useState<HuaweiRegionKey | "">("");
  const [cloneTargetBillingMode, setCloneTargetBillingMode] = useState<BillingOption | "">("");
  const [cloningListId, setCloningListId] = useState<string | null>(null);
  const [cloneActionMessage, setCloneActionMessage] = useState("");
  const [cloneActionIsError, setCloneActionIsError] = useState(false);
  const [projectCloneNameDrafts, setProjectCloneNameDrafts] = useState<Record<string, string>>({});
  const [projectCloneTargetRegions, setProjectCloneTargetRegions] = useState<Record<string, HuaweiRegionKey | "">>({});
  const [projectCloneTargetBillingModes, setProjectCloneTargetBillingModes] = useState<Record<string, BillingOption | "">>({});
  const [cloningProjectId, setCloningProjectId] = useState<string | null>(null);
  const [projectCloneMessages, setProjectCloneMessages] = useState<Record<string, string>>({});
  const [projectCloneMessageErrors, setProjectCloneMessageErrors] = useState<Record<string, boolean>>({});
  const [syncingHuaweiProjectId, setSyncingHuaweiProjectId] = useState<string | null>(null);
  const [projectHuaweiMessages, setProjectHuaweiMessages] = useState<Record<string, string>>({});
  const [projectHuaweiMessageErrors, setProjectHuaweiMessageErrors] = useState<Record<string, boolean>>({});
  const [sharingProjectKey, setSharingProjectKey] = useState<string | null>(null);
  const [sharingListKey, setSharingListKey] = useState<string | null>(null);
  const [projectShareMessages, setProjectShareMessages] = useState<Record<string, string>>({});
  const [listShareMessages, setListShareMessages] = useState<Record<string, string>>({});
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [isCartMenuOpen, setIsCartMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileAreaRef = useRef<HTMLDivElement>(null);
  const listboxId = `${useId()}-services`;
  const lastFlavorAutoSelectKeyRef = useRef("");

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = normalizedQuery
    ? services
        .filter((service) =>
          service.name.toLowerCase().includes(normalizedQuery) || service.code.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 8)
    : [];
  const selectedServiceMeta = services.find((service) => service.name === selectedService) ?? services[0];
  const selectedServiceCode = selectedServiceMeta.code;
  const isEcsCalculator = selectedServiceCode === "ECS";
  const isFlexusLCalculator = selectedServiceCode === "Flexus L";
  const isEvsCalculator = selectedServiceCode === "EVS";
  const calculatorBillingOptions = useMemo(() => getCalculatorBillingOptions(selectedServiceCode), [selectedServiceCode]);
  const isSelectedServiceImplemented = supportedCalculatorServiceCodes.includes(
    selectedServiceCode as (typeof supportedCalculatorServiceCodes)[number],
  );
  const isSelectedServiceBatchAddImplemented = supportedBatchAddServiceCodes.includes(
    selectedServiceCode as (typeof supportedBatchAddServiceCodes)[number],
  );
  const selectedPrices = priceListEntries.filter((entry) => entry.service === selectedService);
  const hasSuggestions = isSearchOpen && suggestions.length > 0;
  const activeDescendant = hasSuggestions ? `${listboxId}-${activeSuggestionIndex}` : undefined;
  const totalProjectLists = projects.reduce((sum, project) => sum + project.lists.length, 0);
  const totalProjectProducts = projects.reduce(
    (sum, project) => sum + project.lists.reduce((listSum, list) => listSum + list.productCount, 0),
    0,
  );
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project] as const)), [projects]);
  const listsById = useMemo(
    () => new Map(projects.flatMap((project) => project.lists.map((list) => [list.id, { list, project }] as const))),
    [projects],
  );
  const selectedProject = projects.find((project) => project.lists.some((list) => list.id === selectedListId)) ?? null;
  const selectedList = selectedProject?.lists.find((list) => list.id === selectedListId) ?? null;
  const selectedCartProducts = selectedList?.products ?? [];
  const activeProject =
    activeModal == null
      ? null
      : "projectId" in activeModal
        ? projectsById.get(activeModal.projectId) ?? null
        : listsById.get(activeModal.listId)?.project ?? null;
  const activeList = activeModal != null && "listId" in activeModal ? listsById.get(activeModal.listId)?.list ?? null : null;
  const cloneableRegions = (Object.entries(huaweiRegions) as Array<[HuaweiRegionKey, (typeof huaweiRegions)[HuaweiRegionKey]]>)
    .filter(([, labels]) => Boolean(labels.catalogRegionId));
  const usageHoursValue = Number.isFinite(Number(usageHours)) ? Math.max(1, Number(usageHours)) : 744;
  const canShowFlexusLInEcs = isEcsCalculator
    && (billingMode === "RI" || billingMode === "Yearly/Monthly" || (billingMode === "Pay-per-use" && (usageHoursValue === 730 || usageHoursValue === 744)));
  const minVcpuFilter = Number.isFinite(Number(minVcpuValue)) ? Math.max(0, Number(minVcpuValue)) : 0;
  const minRamFilter = Number.isFinite(Number(minRamValue)) ? Math.max(0, Number(minRamValue)) : 0;
  const activeDiskSizeBounds = isEvsCalculator ? evsDiskSizeBounds : ecsDiskSizeBounds;
  const systemDiskSizeValue = Number.isFinite(Number(systemDiskSize))
    ? Math.max(activeDiskSizeBounds.min, Number(systemDiskSize))
    : activeDiskSizeBounds.min;
  const isGpSsd2Selected = systemDiskType === "General Purpose SSD V2";
  const gpSsd2IopsValue = isGpSsd2Selected ? normalizeGpSsd2Iops(gpSsd2Iops, systemDiskSizeValue) : null;
  const gpSsd2IopsRange = isGpSsd2Selected ? getGpSsd2IopsBounds(systemDiskSizeValue) : null;
  const gpSsd2ThroughputValue =
    isGpSsd2Selected && gpSsd2IopsValue != null ? normalizeGpSsd2Throughput(gpSsd2Throughput, gpSsd2IopsValue) : null;
  const gpSsd2ThroughputRange =
    isGpSsd2Selected && gpSsd2IopsValue != null ? getGpSsd2ThroughputBounds(gpSsd2IopsValue) : null;
  const instanceCountValue = Number.isFinite(Number(instanceCount)) ? Math.max(1, Number(instanceCount)) : 1;
  const selectedDiskPrice = getDiskPriceForBillingOption(diskPricing, systemDiskType, systemDiskSizeValue, billingMode, usageHoursValue);
  const ecsFlavorCards = catalogFlavors
    .filter((flavor) => getFlavorPriceForBillingOption(flavor, billingMode, usageHoursValue))
    .map((flavor) => toFlavorCard(flavor, billingMode, usageHoursValue, selectedDiskPrice));
  const flexusLFlavorCards =
    isEcsCalculator && canShowFlexusLInEcs && showFlexusLInEcs
      ? flexusLPlans.map((plan) => toFlexusLFlavorCard(plan, billingMode, usageHoursValue))
      : [];
  const billableFlavors = [...ecsFlavorCards, ...flexusLFlavorCards];
  const selectedFlavorCard = billableFlavors.find((flavor) => flavor.name === selectedFlavor) ?? null;
  const selectedFlexusLPlan = isFlexusLCalculator ? findFlexusLPlan(selectedFlavor) ?? flexusLPlans[0] ?? null : null;
  const selectedEstimateBase =
    (isFlexusLCalculator && selectedFlexusLPlan
      ? formatFlavorAmount("USD", selectedFlexusLPlan.monthlyPriceUsd, "/mo")
      : isEvsCalculator && selectedDiskPrice
      ? formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)
      : selectedFlavorCard?.price)
    ?? selectedPrices.find((entry) => entry.unit === "per month")?.price
    ?? selectedPrices[0]?.price
    ?? "USD 0.00";
  const selectedEstimate = isEvsCalculator && selectedDiskPrice
    ? formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount * instanceCountValue, selectedDiskPrice.suffix)
    : isFlexusLCalculator && selectedFlexusLPlan
    ? formatFlavorAmount("USD", selectedFlexusLPlan.monthlyPriceUsd * instanceCountValue, "/mo")
    : selectedFlavorCard
    ? formatFlavorAmount(
        selectedFlavorCard.priceCurrency,
        selectedFlavorCard.priceValue * instanceCountValue,
        selectedFlavorCard.priceSuffix,
      )
    : scalePriceDisplay(selectedEstimateBase, instanceCountValue);
  const selectedEstimateParts = splitPriceDisplay(selectedEstimate);
  const quantityLabel = isEvsCalculator ? "Volume" : "Instance";
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
  const totalFlavorPages = Math.max(1, Math.ceil(sortedFlavors.length / flavorPageSize));
  const currentFlavorPage = Math.min(flavorPage, totalFlavorPages);
  const visibleFlavors = sortedFlavors.slice((currentFlavorPage - 1) * flavorPageSize, currentFlavorPage * flavorPageSize);
  const flavorAutoSelectKey = buildFlavorAutoSelectKey({
    minVcpuValue,
    minRamValue,
    flavorQuery,
    flavorSort,
    regionValue,
    billingMode,
    usageHoursValue,
    systemDiskType,
    systemDiskSizeValue,
    includeFlexusL: isEcsCalculator && canShowFlexusLInEcs && showFlexusLInEcs,
  });

  const [evsPricingLoading, setEvsPricingLoading] = useState(false);
  const [evsPricingError, setEvsPricingError] = useState("");

  useEffect(() => {
    if (!calculatorBillingOptions.includes(billingMode)) {
      setBillingMode(calculatorBillingOptions[0]);
    }
  }, [billingMode, calculatorBillingOptions]);

  useEffect(() => {
    if (!canShowFlexusLInEcs && showFlexusLInEcs) {
      setShowFlexusLInEcs(false);
    }
  }, [canShowFlexusLInEcs, showFlexusLInEcs]);

  useEffect(() => {
    if (!isGpSsd2Selected || gpSsd2IopsValue == null || gpSsd2ThroughputValue == null) {
      return;
    }

    const normalizedIops = String(gpSsd2IopsValue);
    if (gpSsd2Iops !== normalizedIops) {
      setGpSsd2Iops(normalizedIops);
    }

    const normalizedThroughput = String(gpSsd2ThroughputValue);
    if (gpSsd2Throughput !== normalizedThroughput) {
      setGpSsd2Throughput(normalizedThroughput);
    }
  }, [gpSsd2Iops, gpSsd2IopsValue, gpSsd2Throughput, gpSsd2ThroughputValue, isGpSsd2Selected]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalculatorData() {
      if (isEcsCalculator) {
        setCatalogFlavorsLoading(true);
        setCatalogFlavorsError("");
        setEvsPricingLoading(false);
        setEvsPricingError("");

        try {
          const response = await fetch(`/api/catalog/ecs-flavors?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            flavors?: CatalogFlavor[];
            diskPricing?: DiskPricing;
            error?: string;
            lastCompletedAt?: string | null;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Failed to load ECS flavors");
          }

          if (cancelled) return;

          setCatalogFlavors(payload.flavors ?? []);
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
        return;
      }

      setCatalogFlavors([]);
      setCatalogFlavorsLastCompletedAt(null);
      setCatalogFlavorsLoading(false);
      setCatalogFlavorsError("");

      if (!isEvsCalculator) {
        setDiskPricing(null);
        setEvsPricingLoading(false);
        setEvsPricingError("");
        return;
      }

      setEvsPricingLoading(true);
      setEvsPricingError("");

      try {
        const response = await fetch(`/api/catalog/evs-pricing?region=${encodeURIComponent(regionValue)}`, {
          cache: "no-store",
        });
        const rawBody = await response.text();
        const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
          diskPricing?: DiskPricing | null;
          error?: string;
        };

        if (!response.ok || !payload.diskPricing) {
          throw new Error(payload.error ?? "Failed to load EVS pricing");
        }

        if (cancelled) return;

        setDiskPricing(payload.diskPricing);
      } catch (error) {
        if (cancelled) return;
        setDiskPricing(null);
        setEvsPricingError(error instanceof Error ? error.message : "Failed to load EVS pricing");
      } finally {
        if (!cancelled) {
          setEvsPricingLoading(false);
        }
      }
    }

    void loadCalculatorData();

    return () => {
      cancelled = true;
    };
  }, [isEcsCalculator, isEvsCalculator, regionValue]);

  useEffect(() => {
    if (!isEcsCalculator) {
      return;
    }

    if (!sortedFlavors.length) {
      if (selectedFlavor !== "") {
        setSelectedFlavor("");
      }
      return;
    }

    const hasSelectedFlavor = sortedFlavors.some((flavor) => flavor.name === selectedFlavor);
    if (lastFlavorAutoSelectKeyRef.current === flavorAutoSelectKey && hasSelectedFlavor) {
      return;
    }

    const nextFlavor = sortedFlavors[0];
    setSelectedFlavor(nextFlavor.name);
    setVcpuValue(nextFlavor.vcpu);
    setRamValue(nextFlavor.ram);
    lastFlavorAutoSelectKeyRef.current = flavorAutoSelectKey;
  }, [flavorAutoSelectKey, isEcsCalculator, selectedFlavor, sortedFlavors]);

  useEffect(() => {
    if (!isFlexusLCalculator || !flexusLPlans.length) {
      return;
    }

    const nextPlan = findFlexusLPlan(selectedFlavor) ?? flexusLPlans[0];
    if (selectedFlavor !== nextPlan.id) {
      setSelectedFlavor(nextPlan.id);
    }
    if (vcpuValue !== String(nextPlan.vcpu)) {
      setVcpuValue(String(nextPlan.vcpu));
    }
    if (ramValue !== String(nextPlan.ramGiB)) {
      setRamValue(String(nextPlan.ramGiB));
    }
  }, [isFlexusLCalculator, ramValue, selectedFlavor, vcpuValue]);

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
    if (!openProjectMenuId && !isCartMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-action-menu-root]")) {
        return;
      }

      setOpenProjectMenuId(null);
      setIsCartMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isCartMenuOpen, openProjectMenuId]);

  useEffect(() => {
    if (!activeModal) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveModal(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeModal]);

  useEffect(() => {
    if (!activeModal) {
      return;
    }

    if ("projectId" in activeModal && !projectsById.has(activeModal.projectId)) {
      setActiveModal(null);
      return;
    }

    if ("listId" in activeModal && !listsById.has(activeModal.listId)) {
      setActiveModal(null);
    }
  }, [activeModal, listsById, projectsById]);

  useEffect(() => {
    if (!session?.user.id) {
      setProjects([]);
      setProjectsError("");
      setProjectsLoading(false);
      setSelectedListId("");
      return;
    }

    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(getResponseError(payload, "Failed to load projects"));
        }

        const payload = (await response.json()) as AppProject[];
        setProjects(payload);
        setSelectedListId((current) => {
          if (current && payload.some((project) => project.lists.some((list) => list.id === current))) {
            return current;
          }

          return getFirstListId(payload);
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

  useEffect(() => {
    const storedCookie = window.localStorage.getItem("neoCalculator.huaweiCookie") ?? "";
    setCookieValue(storedCookie);
    setCookieDraft(storedCookie);
  }, []);

  useEffect(() => {
    const storedPageSize = Number(window.localStorage.getItem(flavorPageSizeStorageKey));
    if (flavorPageSizeOptions.some((option) => option === storedPageSize)) {
      setFlavorPageSize(storedPageSize as (typeof flavorPageSizeOptions)[number]);
    }
  }, []);

  const loadHuaweiCarts = useCallback(async () => {
    if (!cookieValue.trim()) {
      setHuaweiCarts([]);
      setHuaweiCartsError("");
      setHuaweiCartsSyncedAt(null);
      return;
    }

    setHuaweiCartsLoading(true);
    setHuaweiCartsError("");

    try {
      const response = await fetch("/api/huawei/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { carts?: HuaweiCartSummary[]; syncedAt?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(getResponseError(payload, "Unable to load Huawei carts"));
      }

      setHuaweiCarts(payload?.carts ?? []);
      setHuaweiCartsSyncedAt(payload?.syncedAt ?? new Date().toISOString());
    } catch (error) {
      setHuaweiCarts([]);
      setHuaweiCartsSyncedAt(null);
      setHuaweiCartsError(error instanceof Error ? error.message : "Unable to load Huawei carts");
    } finally {
      setHuaweiCartsLoading(false);
    }
  }, [cookieValue]);

  useEffect(() => {
    void loadHuaweiCarts();
  }, [loadHuaweiCarts, session?.user.id]);

  useEffect(() => {
    setSelectedHuaweiCartKey(selectedList?.huaweiCartKey ?? "");
  }, [selectedList?.huaweiCartKey, selectedList?.id]);

  useEffect(() => {
    setCloneNameDraft("");
    setCloneTargetRegion("");
    setCloneTargetBillingMode("");
  }, [selectedList?.id]);

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
    setHuaweiActionMessage("");
  };

  const handleCreateProject = async () => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

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
        throw new Error(getResponseError(payload, "Unable to create project"));
      }

      const project = (await response.json()) as Omit<AppProject, "lists">;
      setProjects((current) => [{ ...project, lists: [] }, ...current]);
      setExpandedProjects((current) => ({ ...current, [project.id]: true }));
      setProjectNameDrafts((current) => ({ ...current, [project.id]: project.name }));
      setNewProjectName("");
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create project");
    } finally {
      setNewProjectPending(false);
    }
  };

  const handleCreateShare = async (resourceType: "project" | "list", resourceId: string, mode: "copy" | "collaborate") => {
    const setPending = resourceType === "project" ? setSharingProjectKey : setSharingListKey;
    const setMessages = resourceType === "project" ? setProjectShareMessages : setListShareMessages;

    setPending(`${resourceType}:${resourceId}:${mode}`);
    setMessages((current) => ({ ...current, [resourceId]: "" }));

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, mode }),
      });
      const payload = (await response.json().catch(() => null)) as { shareUrl?: string; error?: string } | null;

      if (!response.ok || !payload?.shareUrl) {
        throw new Error(getResponseError(payload, "Unable to create share link"));
      }

      const shareUrl = new URL(payload.shareUrl, window.location.origin).toString();
      const copied = await copyText(shareUrl);
      setMessages((current) => ({
        ...current,
        [resourceId]: copied
          ? mode === "copy"
            ? "Copy link copied."
            : "Collaborative link copied."
          : `${mode === "copy" ? "Copy" : "Collaborative"} link: ${shareUrl}`,
      }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [resourceId]: error instanceof Error ? error.message : "Unable to create share link",
      }));
    } finally {
      setPending(null);
    }
  };

  const handleCreateList = async (projectId: string) => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    const name = listDrafts[projectId]?.trim();
    const baseCartKey = listBaseDrafts[projectId] ?? "";
    const usingHuaweiBase = Boolean(baseCartKey);
    if (!name && !usingHuaweiBase) return;
    if (usingHuaweiBase && !cookieValue.trim()) {
      setProjectsError("Save a Huawei Cloud cookie before importing a Huawei cart.");
      return;
    }

    setListPendingProjectId(projectId);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          huaweiCartKey: baseCartKey || null,
          cookie: baseCartKey ? cookieValue : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(getResponseError(payload, "Unable to create list"));
      }

      const list = (await response.json()) as AppList & { projectId: string };
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: list.updatedAt,
                lists: [...project.lists, list],
              }
            : project,
        ),
      );
      setSelectedListId((current) => current || list.id);
      setListDrafts((current) => ({ ...current, [projectId]: "" }));
      setListBaseDrafts((current) => ({ ...current, [projectId]: "" }));
      setExpandedProjects((current) => ({ ...current, [projectId]: true }));
      setHuaweiActionMessage(baseCartKey ? `Imported ${list.name} from Huawei Cloud Calculator.` : "");
      if (baseCartKey) {
        await loadHuaweiCarts();
      }
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create list");
    } finally {
      setListPendingProjectId(null);
    }
  };

  const handleLinkSelectedList = async () => {
    if (!selectedListId || !selectedHuaweiCartKey) {
      return;
    }

    const targetCart = huaweiCarts.find((cart) => cart.key === selectedHuaweiCartKey);
    if (!targetCart) {
      setHuaweiActionMessage("Choose a Huawei cart first.");
      return;
    }

    setLinkingHuaweiListId(selectedListId);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          huaweiCartKey: targetCart.key,
          huaweiCartName: targetCart.name,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            id: string;
            projectId: string;
            huaweiCartKey: string | null;
            huaweiCartName: string | null;
            huaweiLastError: string | null;
            updatedAt: string;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to link Huawei cart"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.id
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setHuaweiActionMessage(`Linked ${targetCart.name} to this Neo cart.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to link Huawei cart");
    } finally {
      setLinkingHuaweiListId(null);
    }
  };

  const handleSyncSelectedList = async () => {
    if (!selectedListId) {
      return;
    }

    if (!cookieValue.trim()) {
      setHuaweiActionMessage("Save a Huawei Cloud cookie before syncing.");
      return;
    }

    setSyncingHuaweiListId(selectedListId);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}/huawei-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            listId: string;
            projectId: string;
            huaweiCartKey: string;
            huaweiCartName: string;
            huaweiLastSyncedAt: string;
            huaweiLastError: string | null;
            updatedAt: string;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to sync with Huawei Cloud Calculator"));
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
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastSyncedAt: payload.huaweiLastSyncedAt,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setSelectedHuaweiCartKey(payload.huaweiCartKey);
      setHuaweiActionMessage(`Synced ${selectedList?.name ?? "cart"} to Huawei Cloud Calculator.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to sync with Huawei Cloud Calculator");
    } finally {
      setSyncingHuaweiListId(null);
    }
  };

  const handleCloneSelectedList = async () => {
    if (!selectedListId || !selectedProject || !selectedList) {
      return;
    }

    setCloningListId(selectedListId);
    setCloneActionMessage("");
    setCloneActionIsError(false);

    try {
      const response = await fetch(`/api/lists/${selectedListId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cloneNameDraft.trim() || undefined,
          targetRegion: cloneTargetRegion || undefined,
          targetBillingMode: cloneTargetBillingMode || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AppList & {
            projectId: string;
            cloneSummary?: {
              totalProducts: number;
              convertedEcsCount: number;
              copiedUnchangedCount: number;
              copiedUnsupportedCount: number;
            };
            error?: never;
          })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to clone cart"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: [...project.lists, payload],
              }
            : project,
        ),
      );
      setSelectedListId(payload.id);
      setCloneNameDraft("");
      setCloneTargetRegion("");
      setCloneTargetBillingMode("");
      setCloneActionMessage(
        `Cloned ${selectedList.name} into ${payload.name}. Converted ${payload.cloneSummary?.convertedEcsCount ?? 0} ECS item(s).`,
      );
    } catch (error) {
      setCloneActionIsError(true);
      setCloneActionMessage(error instanceof Error ? error.message : "Unable to clone cart");
    } finally {
      setCloningListId(null);
    }
  };

  const handleCloneProject = async (project: AppProject) => {
    setCloningProjectId(project.id);
    setProjectCloneMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: false }));

    try {
      const response = await fetch(`/api/projects/${project.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectCloneNameDrafts[project.id]?.trim() || undefined,
          targetRegion: projectCloneTargetRegions[project.id] || undefined,
          targetBillingMode: projectCloneTargetBillingModes[project.id] || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AppProject & {
            cloneSummary?: {
              totalLists: number;
              totalProducts: number;
              convertedEcsCount: number;
              copiedUnchangedCount: number;
              copiedUnsupportedCount: number;
            };
            error?: never;
          })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("lists" in payload)) {
        throw new Error(getResponseError(payload, "Unable to clone project"));
      }

      setProjects((current) => [payload, ...current]);
      setExpandedProjects((current) => ({ ...current, [payload.id]: true }));
      setSelectedListId(payload.lists[0]?.id ?? "");
      setProjectCloneNameDrafts((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneTargetRegions((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneTargetBillingModes((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneMessages((current) => ({
        ...current,
        [project.id]: `Cloned ${project.name} into ${payload.name}. Converted ${payload.cloneSummary?.convertedEcsCount ?? 0} ECS item(s).`,
      }));
      setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: false }));
    } catch (error) {
      setProjectCloneMessages((current) => ({
        ...current,
        [project.id]: error instanceof Error ? error.message : "Unable to clone project",
      }));
      setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: true }));
    } finally {
      setCloningProjectId(null);
    }
  };

  const handleSyncProjectHuawei = async (project: AppProject) => {
    if (!cookieValue.trim()) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: "Save a Huawei Cloud cookie before creating Huawei carts.",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
      return;
    }

    if (project.lists.length === 0) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: "This project does not have carts to sync.",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
      return;
    }

    setSyncingHuaweiProjectId(project.id);
    setProjectHuaweiMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: false }));

    try {
      const response = await fetch(`/api/projects/${project.id}/huawei-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            projectId: string;
            updatedAt: string;
            syncedCount: number;
            failedCount: number;
            lists: Array<{
              id: string;
              huaweiCartKey: string | null;
              huaweiCartName: string | null;
              huaweiLastSyncedAt: string | null;
              huaweiLastError: string | null;
              updatedAt: string;
            }>;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to create Huawei carts for this project"));
      }

      const listUpdates = new Map(payload.lists.map((list) => [list.id, list]));

      setProjects((current) =>
        current.map((item) =>
          item.id === project.id
            ? {
                ...item,
                updatedAt: payload.updatedAt,
                lists: item.lists.map((list) => {
                  const update = listUpdates.get(list.id);
                  if (!update) {
                    return list;
                  }

                  return {
                    ...list,
                    updatedAt: update.updatedAt,
                    huaweiCartKey: update.huaweiCartKey,
                    huaweiCartName: update.huaweiCartName,
                    huaweiLastSyncedAt: update.huaweiLastSyncedAt,
                    huaweiLastError: update.huaweiLastError,
                  };
                }),
              }
            : item,
        ),
      );
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]:
          payload.failedCount > 0
            ? `Created or updated ${payload.syncedCount} Huawei cart(s). ${payload.failedCount} cart(s) failed.`
            : `Created or updated ${payload.syncedCount} Huawei cart(s) for this project.`,
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: payload.failedCount > 0 }));
      await loadHuaweiCarts();
    } catch (error) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: error instanceof Error ? error.message : "Unable to create Huawei carts for this project",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
    } finally {
      setSyncingHuaweiProjectId(null);
    }
  };

  const openActionModal = (modal: Exclude<ActiveModal, null>) => {
    setOpenProjectMenuId(null);
    setIsCartMenuOpen(false);
    setActiveModal(modal);
  };

  const toggleProject = (projectName: string) => {
    setExpandedProjects((current) => ({
      ...current,
      [projectName]: !current[projectName],
    }));
  };

  const handleStartProjectRename = (project: AppProject) => {
    setEditingProjectId(project.id);
    setProjectNameDrafts((current) => ({
      ...current,
      [project.id]: current[project.id] ?? project.name,
    }));
    setProjectsError("");
  };

  const handleCancelProjectRename = (project: AppProject) => {
    setEditingProjectId((current) => (current === project.id ? null : current));
    setProjectNameDrafts((current) => ({
      ...current,
      [project.id]: project.name,
    }));
  };

  const handleRenameProject = async (project: AppProject) => {
    const name = (projectNameDrafts[project.id] ?? project.name).trim();
    if (!name) {
      setProjectsError("Project name is required.");
      return;
    }

    if (name === project.name) {
      setEditingProjectId(null);
      return;
    }

    setRenamingProjectId(project.id);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; name: string; description: string | null; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("updatedAt" in payload)) {
        throw new Error(getResponseError(payload, "Unable to rename project"));
      }

      setProjects((current) =>
        current.map((item) =>
          item.id === payload.id
            ? {
                ...item,
                name: payload.name,
                description: payload.description,
                updatedAt: payload.updatedAt,
              }
            : item,
        ),
      );
      setProjectNameDrafts((current) => ({ ...current, [project.id]: payload.name }));
      setEditingProjectId(null);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to rename project");
    } finally {
      setRenamingProjectId(null);
    }
  };

  const handleDeleteProject = async (project: AppProject) => {
    const confirmed = window.confirm(`Delete "${project.name}" and all of its lists and products?`);
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; deleted: true }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("deleted" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete project"));
      }

      setProjects((current) => {
        const nextProjects = current.filter((item) => item.id !== payload.id);
        setSelectedListId((currentListId) => {
          if (!project.lists.some((list) => list.id === currentListId)) {
            return currentListId;
          }

          return getFirstListId(nextProjects);
        });
        return nextProjects;
      });
      setExpandedProjects((current) => {
        const nextState = { ...current };
        delete nextState[project.id];
        return nextState;
      });
      setProjectNameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneNameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneTargetRegions((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneTargetBillingModes((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneMessages((current) => {
        const nextMessages = { ...current };
        delete nextMessages[project.id];
        return nextMessages;
      });
      setProjectCloneMessageErrors((current) => {
        const nextFlags = { ...current };
        delete nextFlags[project.id];
        return nextFlags;
      });
      setEditingProjectId((current) => (current === project.id ? null : current));
      await loadHuaweiCarts();
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to delete project");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleDeleteList = async (list: AppList, projectId: string) => {
    const confirmed = window.confirm(`Delete "${list.name}" and all of its products?`);
    if (!confirmed) {
      return;
    }

    setDeletingListId(list.id);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; projectId: string; deleted: true; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("deleted" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete cart"));
      }

      setProjects((current) => {
        const nextProjects = current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.filter((item) => item.id !== payload.id),
              }
            : project,
        );
        setSelectedListId((currentListId) => {
          if (currentListId !== payload.id) {
            return currentListId;
          }

          return getFirstListId(nextProjects);
        });
        return nextProjects;
      });
      if (editingProductListId === payload.id) {
        handleCancelEdit();
      }
      setHuaweiActionMessage(`Deleted ${list.name}.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to delete cart");
    } finally {
      setDeletingListId(null);
    }
  };

  const updateSystemDiskSize = (nextValue: string) => {
    if (nextValue === "") {
      setSystemDiskSize("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(activeDiskSizeBounds.max, Math.max(activeDiskSizeBounds.min, parsed));
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
    if (product.productType !== "ecs" && product.productType !== "evs" && product.productType !== "flexus-l") {
      setAddToListMessage("This product cannot be edited from the calculator.");
      return;
    }

    if (!isRecord(product.config)) {
      setAddToListMessage("This product cannot be edited from the calculator.");
      return;
    }

    const nextRegion = typeof product.config.region === "string" && product.config.region in huaweiRegions
      ? (product.config.region as HuaweiRegionKey)
      : regionValue;
    const rawBillingMode = isBillingOption(product.config.billingMode) ? product.config.billingMode : "Pay-per-use";
    const nextBillingMode = product.productType === "evs" && rawBillingMode === "RI"
      ? "Pay-per-use"
      : product.productType === "flexus-l"
        ? "Yearly/Monthly"
        : rawBillingMode;
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
    const nextMinVcpuValue = typeof product.config.vcpu === "number" ? String(product.config.vcpu) : minVcpuValue;
    const nextMinRamValue = typeof product.config.ramGiB === "number" ? String(product.config.ramGiB) : minRamValue;
    const nextSystemDiskType = isSystemDiskOption(product.config.diskType)
      ? product.config.diskType
      : isSystemDiskOption(nextSystemDisk?.type)
        ? nextSystemDisk.type
        : "High I/O";
    const nextSystemDiskSize =
      typeof product.config.diskSizeGiB === "number" && Number.isFinite(product.config.diskSizeGiB)
        ? String(Math.max(evsDiskSizeBounds.min, Math.floor(product.config.diskSizeGiB)))
        : typeof nextSystemDisk?.sizeGiB === "number" && Number.isFinite(nextSystemDisk.sizeGiB)
          ? String(Math.max(ecsDiskSizeBounds.min, Math.floor(nextSystemDisk.sizeGiB)))
          : product.productType === "evs"
            ? String(evsDiskSizeBounds.min)
            : String(ecsDiskSizeBounds.min);
    if (product.productType === "ecs") {
      lastFlavorAutoSelectKeyRef.current = buildFlavorAutoSelectKey({
        minVcpuValue: nextMinVcpuValue,
        minRamValue: nextMinRamValue,
        flavorQuery,
        flavorSort,
        regionValue: nextRegion,
        billingMode: nextBillingMode,
        usageHoursValue:
          typeof product.config.usageHours === "number" && Number.isFinite(product.config.usageHours)
            ? Math.max(1, Math.floor(product.config.usageHours))
            : 744,
        systemDiskType: nextSystemDiskType,
        systemDiskSizeValue: Number(nextSystemDiskSize),
        includeFlexusL: false,
      });
      setSelectedFlavor(typeof product.config.flavor === "string" ? product.config.flavor : "");
      setVcpuValue(typeof product.config.vcpu === "number" ? String(product.config.vcpu) : vcpuValue);
      setRamValue(typeof product.config.ramGiB === "number" ? String(product.config.ramGiB) : ramValue);
      setMinVcpuValue(nextMinVcpuValue);
      setMinRamValue(nextMinRamValue);
    } else if (product.productType === "flexus-l") {
      const nextPlanId = typeof product.config.planId === "string"
        ? product.config.planId
        : typeof product.config.flavor === "string"
          ? product.config.flavor
          : flexusLPlans[0]?.id ?? "";
      const nextPlan = findFlexusLPlan(nextPlanId) ?? flexusLPlans[0] ?? null;
      setSelectedFlavor(nextPlan?.id ?? "");
      setVcpuValue(
        typeof product.config.vcpu === "number"
          ? String(product.config.vcpu)
          : nextPlan
            ? String(nextPlan.vcpu)
            : "",
      );
      setRamValue(
        typeof product.config.ramGiB === "number"
          ? String(product.config.ramGiB)
          : nextPlan
            ? String(nextPlan.ramGiB)
            : "",
      );
    } else {
      setSelectedFlavor("");
      setVcpuValue("");
      setRamValue("");
    }
    const nextGpSsd2Iops = getGpSsd2RequestedIops(product.config, Number(nextSystemDiskSize));
    const nextGpSsd2Throughput = getGpSsd2RequestedThroughput(product.config, nextGpSsd2Iops);
    setGpSsd2Iops(String(nextGpSsd2Iops));
    setGpSsd2Throughput(String(nextGpSsd2Throughput));
    setSystemDiskType(nextSystemDiskType);
    setSystemDiskSize(nextSystemDiskSize);
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

  const updateGpSsd2Iops = (nextValue: string) => {
    if (nextValue === "") {
      setGpSsd2Iops("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    setGpSsd2Iops(String(normalizeGpSsd2Iops(parsed, systemDiskSizeValue)));
  };

  const updateGpSsd2Throughput = (nextValue: string) => {
    if (nextValue === "") {
      setGpSsd2Throughput("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    setGpSsd2Throughput(String(normalizeGpSsd2Throughput(parsed, gpSsd2IopsValue ?? gpSsd2IopsBounds.min)));
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

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete product"));
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

  const appendProductToState = useCallback((payload: AppProduct & { listId: string; projectId: string }) => {
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
                      productCount: list.productCount + 1,
                      products: [payload, ...list.products],
                    }
                  : list,
              ),
            }
          : project,
      ),
    );
  }, []);

  const mutateListProduct = useCallback(
    async (
      requestUrl: string,
      requestMethod: "POST" | "PATCH",
      requestBody: ProductMutationBody,
      fallbackError: string,
    ) => {
      const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json().catch(() => null)) as
        | (AppProduct & { listId: string; projectId: string; error?: never })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, fallbackError));
      }

      return payload;
    },
    [],
  );

  const handleBatchAdd = async () => {
    if (!session) {
      setBatchAddMessage("Sign in to save carts and projects.");
      return;
    }

    if (!isSelectedServiceBatchAddImplemented) {
      setBatchAddMessage(`${selectedService} does not support batch add yet.`);
      return;
    }

    if (!selectedListId) {
      setBatchAddMessage("Create a list first.");
      return;
    }

    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(batchInput);
    } catch {
      setBatchAddMessage("Batch input must be valid JSON.");
      return;
    }

    if (!Array.isArray(parsedInput) || parsedInput.length === 0) {
      setBatchAddMessage("Batch input must be a non-empty JSON array.");
      return;
    }

    if (isEcsCalculator && !catalogFlavors.length) {
      setBatchAddMessage("ECS flavors are not loaded yet.");
      return;
    }

    if (isEvsCalculator && !diskPricing) {
      setBatchAddMessage("EVS pricing is not loaded yet.");
      return;
    }

    setBatchAddPending(true);
    setBatchAddMessage("");

    let createdCount = 0;
    let splitDiskCount = 0;

    try {
      for (let index = 0; index < parsedInput.length; index += 1) {
        const item = parsedInput[index];

        if (!isRecord(item)) {
          throw new Error(`Item ${index + 1} must be an object.`);
        }

        const quantity = parseBatchQuantity(item.quantity);
        const description = getBatchDescription(item, selectedService);
        const requestBodies = isEcsCalculator
          ? (() => {
              const requestedVcpu = parsePositiveNumber(item.vcpu);
              const requestedRamGiB = parsePositiveNumber(item.ram);
              if (requestedVcpu == null || requestedRamGiB == null) {
                throw new Error(`Item ${index + 1} must include numeric vcpu and ram values.`);
              }

              const diskType = getBatchDiskType(item, "High I/O");
              const diskSizeGiB = getBatchDiskSize(item, ecsDiskSizeBounds.min, ecsDiskSizeBounds);
              const diskIops = diskType === "General Purpose SSD V2"
                ? getGpSsd2RequestedIops(item, diskSizeGiB)
                : null;
              const diskThroughput = diskType === "General Purpose SSD V2" && diskIops != null
                ? getGpSsd2RequestedThroughput(item, diskIops)
                : null;
              const selection = findBestBatchEcsSelection(
                catalogFlavors,
                diskPricing,
                billingMode,
                usageHoursValue,
                requestedVcpu,
                requestedRamGiB,
                diskType,
                diskSizeGiB,
                description,
              );
              const flexusSelection =
                canShowFlexusLInEcs && showFlexusLInEcs && !hasExplicitBatchDiskConfig(item)
                  ? findBestBatchFlexusLSelection(billingMode, usageHoursValue, requestedVcpu, requestedRamGiB)
                  : null;
              const useFlexusSelection = flexusSelection != null
                && (selection == null || flexusSelection.flavorCard.priceValue < selection.flavorCard.priceValue);

              if (!selection && !flexusSelection) {
                throw new Error(
                  `Item ${index + 1} could not find an ECS or Flexus L flavor with at least ${requestedVcpu} vCPUs and ${requestedRamGiB} GiB RAM.`,
                );
              }

              if (useFlexusSelection && flexusSelection) {
                return [{
                  serviceCode: flexusSelection.flavorCard.serviceCode,
                  serviceName: flexusSelection.flavorCard.serviceName,
                  productType: "flexus-l",
                  title: `${flexusSelection.flavorCard.serviceName} ${flexusSelection.plan.title}`,
                  quantity,
                  config: {
                    region: regionValue,
                    billingMode,
                    description,
                    planId: flexusSelection.plan.id,
                    planTitle: flexusSelection.plan.title,
                    vcpu: flexusSelection.plan.vcpu,
                    ramGiB: flexusSelection.plan.ramGiB,
                    systemDiskGiB: flexusSelection.plan.systemDiskGiB,
                    peakBandwidthMbit: flexusSelection.plan.peakBandwidthMbit,
                    dataPackageTiB: flexusSelection.plan.dataPackageTiB,
                    referenceRegion: flexusLPricingReference.region,
                  },
                  pricing: {
                    total: formatFlavorAmount(
                      flexusSelection.flavorCard.priceCurrency,
                      flexusSelection.flavorCard.priceValue * quantity,
                      flexusSelection.flavorCard.priceSuffix,
                    ),
                    flavor: flexusSelection.flavorCard.flavorPrice,
                  },
                }];
              }

              if (!selection) {
                throw new Error(`Item ${index + 1} could not find an ECS flavor.`);
              }

              return [{
                serviceCode: selection.flavorCard.serviceCode,
                serviceName: selection.flavorCard.serviceName,
                productType: "ecs",
                title: `${selectedService} ${selection.flavor.resourceSpecCode}`,
                quantity,
                config: {
                  region: regionValue,
                  billingMode,
                  usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
                  description,
                  flavor: selection.flavor.resourceSpecCode,
                  vcpu: selection.flavor.cpu,
                  ramGiB: selection.flavor.ramGiB,
                  systemDisk: {
                    type: diskType,
                    sizeGiB: diskSizeGiB,
                    ...(diskIops != null ? { iops: diskIops } : {}),
                    ...(diskThroughput != null ? { throughput: diskThroughput } : {}),
                  },
                },
                pricing: {
                  total: formatFlavorAmount(
                    selection.flavorCard.priceCurrency,
                    selection.flavorCard.priceValue * quantity,
                    selection.flavorCard.priceSuffix,
                  ),
                  flavor: selection.flavorCard.flavorPrice,
                  disk: formatFlavorAmount(
                    selection.diskPrice.currency,
                    selection.diskPrice.amount,
                    selection.diskPrice.suffix,
                  ),
                },
              }];
            })()
          : isFlexusLCalculator
          ? (() => {
              const requestedVcpu = parsePositiveNumber(item.vcpu);
              const requestedRamGiB = parsePositiveNumber(item.ram);
              if (requestedVcpu == null || requestedRamGiB == null) {
                throw new Error(`Item ${index + 1} must include numeric vcpu and ram values.`);
              }

              const plan = findBestFlexusLPlan(requestedVcpu, requestedRamGiB);
              if (!plan) {
                throw new Error(
                  `Item ${index + 1} could not find a Flexus L plan with at least ${requestedVcpu} vCPUs and ${requestedRamGiB} GiB RAM.`,
                );
              }

              return [{
                serviceCode: selectedServiceMeta.code,
                serviceName: selectedService,
                productType: "flexus-l",
                title: `${selectedService} ${plan.title}`,
                quantity,
                config: {
                  region: regionValue,
                  billingMode: "Yearly/Monthly",
                  description,
                  planId: plan.id,
                  planTitle: plan.title,
                  vcpu: plan.vcpu,
                  ramGiB: plan.ramGiB,
                  systemDiskGiB: plan.systemDiskGiB,
                  peakBandwidthMbit: plan.peakBandwidthMbit,
                  dataPackageTiB: plan.dataPackageTiB,
                  referenceRegion: flexusLPricingReference.region,
                },
                pricing: {
                  total: formatFlavorAmount("USD", plan.monthlyPriceUsd * quantity, "/mo"),
                  flavor: formatFlavorAmount("USD", plan.monthlyPriceUsd, "/mo"),
                },
              }];
            })()
          : (() => {
              const diskType = getBatchDiskType(item, systemDiskType);
              const diskSizeGiB = getBatchDiskSize(item, systemDiskSizeValue, evsDiskSizeBounds);
              const requestedIops = diskType === "General Purpose SSD V2"
                ? getGpSsd2RequestedIops(item, diskSizeGiB)
                : null;
              const requestedThroughput = diskType === "General Purpose SSD V2" && requestedIops != null
                ? getGpSsd2RequestedThroughput(item, requestedIops)
                : null;
              const chunkSizes = splitEvsDiskSizes(diskSizeGiB);
              splitDiskCount += Math.max(0, chunkSizes.length - 1);

              return chunkSizes.map((chunkSizeGiB) => {
                const price = getDiskPriceForBillingOption(diskPricing, diskType, chunkSizeGiB, billingMode, usageHoursValue);
                const chunkIops = diskType === "General Purpose SSD V2" && requestedIops != null
                  ? normalizeGpSsd2Iops(requestedIops, chunkSizeGiB)
                  : null;
                const chunkThroughput = diskType === "General Purpose SSD V2" && requestedThroughput != null && chunkIops != null
                  ? normalizeGpSsd2Throughput(requestedThroughput, chunkIops)
                  : null;

                if (!price) {
                  throw new Error(`Item ${index + 1} could not be priced with the selected EVS billing mode.`);
                }

                return {
                  serviceCode: selectedServiceMeta.code,
                  serviceName: selectedService,
                  productType: "evs",
                  title: `${selectedService} ${diskType} ${chunkSizeGiB} GiB`,
                  quantity,
                  config: {
                    region: regionValue,
                    billingMode,
                    usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
                    description,
                    diskType,
                    diskSizeGiB: chunkSizeGiB,
                    ...(chunkIops != null ? { iops: chunkIops } : {}),
                    ...(chunkThroughput != null ? { throughput: chunkThroughput } : {}),
                    requestedDiskSizeGiB: diskSizeGiB,
                    splitDiskCount: chunkSizes.length,
                  },
                  pricing: {
                    total: formatFlavorAmount(price.currency, price.amount * quantity, price.suffix),
                    disk: formatFlavorAmount(price.currency, price.amount, price.suffix),
                  },
                } satisfies ProductMutationBody;
              });
            })();

        for (const [chunkIndex, requestBody] of requestBodies.entries()) {
          const payload = await mutateListProduct(
            `/api/lists/${selectedListId}/products`,
            "POST",
            requestBody,
            `Unable to add item ${index + 1}${requestBodies.length > 1 ? ` chunk ${chunkIndex + 1}` : ""} to the list`,
          );

          appendProductToState(payload);
          createdCount += 1;
        }
      }

      setBatchAddMessage(
        splitDiskCount > 0
          ? `Added ${createdCount} products to the list. ${splitDiskCount} extra EVS split disk${splitDiskCount === 1 ? "" : "s"} were created for sizes above ${evsSingleDiskMaxGiB} GiB.`
          : createdCount === 1
            ? "Added 1 product to the list."
            : `Added ${createdCount} products to the list.`,
      );
    } catch (error) {
      setBatchAddMessage(
        createdCount > 0
          ? `${error instanceof Error ? error.message : "Batch add failed."} ${createdCount} item${createdCount === 1 ? "" : "s"} were added before the error.`
          : error instanceof Error
            ? error.message
            : "Batch add failed.",
      );
    } finally {
      setBatchAddPending(false);
    }
  };

  const handleAddToList = async () => {
    if (!session) {
      setAddToListMessage("Sign in to save carts and projects.");
      return;
    }

    if (!isSelectedServiceImplemented) {
      setAddToListMessage(`${selectedService} is not implemented in the calculator yet.`);
      return;
    }

    if (!selectedListId) {
      setAddToListMessage("Create a list first.");
      return;
    }

    if (isEcsCalculator && !selectedFlavorCard) {
      setAddToListMessage("Select a flavor first.");
      return;
    }

    if (isFlexusLCalculator && !selectedFlexusLPlan) {
      setAddToListMessage("Select a Flexus L plan first.");
      return;
    }

    if (isEvsCalculator && !selectedDiskPrice) {
      setAddToListMessage("Select a volume type first.");
      return;
    }

    setAddToListPending(true);
    setAddToListMessage("");

    try {
      const quantity = Math.max(1, Number(instanceCount || "1"));
      const requestBodies = isEcsCalculator
        ? selectedFlavorCard?.productType === "flexus-l" && selectedFlavorCard.referencePlanId
          ? (() => {
              const selectedPlan = findFlexusLPlan(selectedFlavorCard.referencePlanId);
              if (!selectedPlan) {
                throw new Error("Select a Flexus L plan first.");
              }

              return {
                serviceCode: selectedFlavorCard.serviceCode,
                serviceName: selectedFlavorCard.serviceName,
                productType: "flexus-l",
                title: `${selectedFlavorCard.serviceName} ${selectedPlan.title}`,
                quantity,
                config: {
                  region: regionValue,
                  billingMode,
                  description: selectedFlavorCard.description ?? selectedService,
                  planId: selectedPlan.id,
                  planTitle: selectedPlan.title,
                  vcpu: selectedPlan.vcpu,
                  ramGiB: selectedPlan.ramGiB,
                  systemDiskGiB: selectedPlan.systemDiskGiB,
                  peakBandwidthMbit: selectedPlan.peakBandwidthMbit,
                  dataPackageTiB: selectedPlan.dataPackageTiB,
                  referenceRegion: flexusLPricingReference.region,
                },
                pricing: {
                  total: selectedEstimate,
                  flavor: selectedFlavorCard.flavorPrice ?? null,
                },
              } satisfies ProductMutationBody;
            })()
          : {
              serviceCode: selectedServiceMeta.code,
              serviceName: selectedService,
              productType: "ecs",
              title: `${selectedService} ${selectedFlavor}`,
              quantity,
              config: {
                region: regionValue,
                billingMode,
                usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
                description: selectedFlavorCard?.description ?? selectedService,
                flavor: selectedFlavor,
                vcpu: Number(vcpuValue || "0"),
                ramGiB: Number(ramValue || "0"),
                systemDisk: {
                  type: systemDiskType,
                  sizeGiB: systemDiskSizeValue,
                  ...(isGpSsd2Selected && gpSsd2IopsValue != null ? { iops: gpSsd2IopsValue } : {}),
                  ...(isGpSsd2Selected && gpSsd2ThroughputValue != null ? { throughput: gpSsd2ThroughputValue } : {}),
                },
              },
              pricing: {
                total: selectedEstimate,
                flavor: selectedFlavorCard?.flavorPrice ?? null,
                disk: selectedDiskPrice ? formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix) : null,
              },
            }
        : isFlexusLCalculator && selectedFlexusLPlan
        ? {
            serviceCode: selectedServiceMeta.code,
            serviceName: selectedService,
            productType: "flexus-l",
            title: `${selectedService} ${selectedFlexusLPlan.title}`,
            quantity,
            config: {
              region: regionValue,
              billingMode: "Yearly/Monthly",
              description: selectedService,
              planId: selectedFlexusLPlan.id,
              planTitle: selectedFlexusLPlan.title,
              vcpu: selectedFlexusLPlan.vcpu,
              ramGiB: selectedFlexusLPlan.ramGiB,
              systemDiskGiB: selectedFlexusLPlan.systemDiskGiB,
              peakBandwidthMbit: selectedFlexusLPlan.peakBandwidthMbit,
              dataPackageTiB: selectedFlexusLPlan.dataPackageTiB,
              referenceRegion: flexusLPricingReference.region,
            },
            pricing: {
              total: selectedEstimate,
              flavor: formatFlavorAmount("USD", selectedFlexusLPlan.monthlyPriceUsd, "/mo"),
            },
          }
        : splitEvsDiskSizes(systemDiskSizeValue).map((chunkSizeGiB) => {
            const chunkPrice = getDiskPriceForBillingOption(diskPricing, systemDiskType, chunkSizeGiB, billingMode, usageHoursValue);
            const chunkIops = isGpSsd2Selected && gpSsd2IopsValue != null
              ? normalizeGpSsd2Iops(gpSsd2IopsValue, chunkSizeGiB)
              : null;
            const chunkThroughput = isGpSsd2Selected && gpSsd2ThroughputValue != null && chunkIops != null
              ? normalizeGpSsd2Throughput(gpSsd2ThroughputValue, chunkIops)
              : null;
            if (!chunkPrice) {
              throw new Error("Unable to price one of the EVS split disks.");
            }

            return {
              serviceCode: selectedServiceMeta.code,
              serviceName: selectedService,
              productType: "evs",
              title: `${selectedService} ${systemDiskType} ${chunkSizeGiB} GiB`,
              quantity,
              config: {
                region: regionValue,
                billingMode,
                usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
                description: selectedService,
                diskType: systemDiskType,
                diskSizeGiB: chunkSizeGiB,
                ...(chunkIops != null ? { iops: chunkIops } : {}),
                ...(chunkThroughput != null ? { throughput: chunkThroughput } : {}),
                requestedDiskSizeGiB: systemDiskSizeValue,
                splitDiskCount: splitEvsDiskSizes(systemDiskSizeValue).length,
              },
              pricing: {
                total: formatFlavorAmount(chunkPrice.currency, chunkPrice.amount * quantity, chunkPrice.suffix),
                disk: formatFlavorAmount(chunkPrice.currency, chunkPrice.amount, chunkPrice.suffix),
              },
            } satisfies ProductMutationBody;
          });

      if (editingProductId && editingProductListId) {
        if (Array.isArray(requestBodies)) {
          const [firstBody, ...extraBodies] = requestBodies;
          const updatedPayload = await mutateListProduct(
            `/api/lists/${editingProductListId}/products/${editingProductId}`,
            "PATCH",
            firstBody,
            "Unable to update product",
          );

          setProjects((current) =>
            current.map((project) =>
              project.id === updatedPayload.projectId
                ? {
                    ...project,
                    updatedAt: updatedPayload.updatedAt,
                    lists: project.lists.map((list) =>
                      list.id === updatedPayload.listId
                        ? {
                            ...list,
                            updatedAt: updatedPayload.updatedAt,
                            products: list.products.map((item) => (item.id === updatedPayload.id ? { ...item, ...updatedPayload } : item)),
                          }
                        : list,
                    ),
                  }
                : project,
            ),
          );

          for (const extraBody of extraBodies) {
            const createdPayload = await mutateListProduct(
              `/api/lists/${selectedListId}/products`,
              "POST",
              extraBody,
              "Unable to create one of the EVS split disks",
            );
            appendProductToState(createdPayload);
          }

          setAddToListMessage(
            extraBodies.length > 0
              ? `Product updated and split into ${requestBodies.length} EVS disks because totals above ${evsSingleDiskMaxGiB} GiB are saved in chunks.`
              : "Product updated.",
          );
        } else {
          const updatedPayload = await mutateListProduct(
            `/api/lists/${editingProductListId}/products/${editingProductId}`,
            "PATCH",
            requestBodies,
            "Unable to update product",
          );

          setProjects((current) =>
            current.map((project) =>
              project.id === updatedPayload.projectId
                ? {
                    ...project,
                    updatedAt: updatedPayload.updatedAt,
                    lists: project.lists.map((list) =>
                      list.id === updatedPayload.listId
                        ? {
                            ...list,
                            updatedAt: updatedPayload.updatedAt,
                            products: list.products.map((item) => (item.id === updatedPayload.id ? { ...item, ...updatedPayload } : item)),
                          }
                        : list,
                    ),
                  }
                : project,
            ),
          );

          setAddToListMessage("Product updated.");
        }
      } else if (Array.isArray(requestBodies)) {
        for (const requestBody of requestBodies) {
          const createdPayload = await mutateListProduct(
            `/api/lists/${selectedListId}/products`,
            "POST",
            requestBody,
            "Unable to add product to list",
          );
          appendProductToState(createdPayload);
        }

        setAddToListMessage(
          requestBodies.length > 1
            ? `Added ${requestBodies.length} EVS disks to the list because totals above ${evsSingleDiskMaxGiB} GiB are split into ${evsSingleDiskMaxGiB} GiB chunks plus a final remainder disk.`
            : "Product added to list.",
        );
      } else {
        const createdPayload = await mutateListProduct(
          `/api/lists/${selectedListId}/products`,
          "POST",
          requestBodies,
          "Unable to add product to list",
        );

        appendProductToState(createdPayload);
        setAddToListMessage("Product added to list.");
      }

      setEditingProductId(null);
      setEditingProductListId(null);
    } catch (error) {
      setAddToListMessage(error instanceof Error ? error.message : "Unable to add product to list");
    } finally {
      setAddToListPending(false);
    }
  };

  const activeProjectCloneTargetRegion = activeProject ? projectCloneTargetRegions[activeProject.id] ?? "" : "";
  const activeProjectCloneTargetBillingMode = activeProject ? projectCloneTargetBillingModes[activeProject.id] ?? "" : "";
  const activeProjectCloneMessage = activeProject ? projectCloneMessages[activeProject.id] ?? "" : "";
  const activeProjectCloneMessageIsError = activeProject ? projectCloneMessageErrors[activeProject.id] ?? false : false;
  const activeProjectHuaweiMessage = activeProject ? projectHuaweiMessages[activeProject.id] ?? "" : "";
  const activeProjectHuaweiMessageIsError = activeProject ? projectHuaweiMessageErrors[activeProject.id] ?? false : false;
  const activeProjectShareMessage = activeProject ? projectShareMessages[activeProject.id] ?? "" : "";
  const activeSelectedHuaweiCartKey = activeList ? selectedHuaweiCartKey || activeList.huaweiCartKey || "" : "";
  const activeSelectedHuaweiCart = huaweiCarts.find((cart) => cart.key === activeSelectedHuaweiCartKey) ?? null;
  const activeListCloneMessage = activeList ? cloneActionMessage : "";
  const activeListCloneMessageIsError = activeList ? cloneActionIsError : false;
  const activeListHuaweiMessage = activeList ? huaweiActionMessage : "";
  const activeListShareMessage = activeList ? listShareMessages[activeList.id] ?? "" : "";
  const isActiveProjectCloning = activeProject ? cloningProjectId === activeProject.id : false;
  const isActiveProjectSyncing = activeProject ? syncingHuaweiProjectId === activeProject.id : false;
  const isActiveListLinking = activeList ? linkingHuaweiListId === activeList.id : false;
  const isActiveListCloning = activeList ? cloningListId === activeList.id : false;
  const calculatorRegionOptions = Object.entries(huaweiRegions).map(([value, labels]) => ({
    value,
    label: labels.full,
  }));
  const flavorSortOptions = Object.entries(flavorSortLabels).map(([value, label]) => ({
    value,
    label,
  }));
  const evsSplitNotice = isEvsCalculator ? buildEvsSplitNotice(systemDiskSizeValue) : null;
  const calculatorSelectionSummary = isEcsCalculator
    ? selectedFlavorCard?.productType === "flexus-l"
      ? `Selected specifications: ${selectedFlavorCard.name} | ${selectedFlavorCard.includedSystemDiskGiB ?? "-"} GiB system disk | ${selectedFlavorCard.peakBandwidthMbit ?? "-"} Mbit/s | ${selectedFlavorCard.dataPackageTiB ?? "-"} TB/month | ${selectedFlavorCard.price}`
      : `Selected specifications: ${selectedFlavor} | ${vcpuValue || "-"} vCPUs | ${ramValue || "-"} GiB | ${systemDiskType} ${systemDiskSize || String(activeDiskSizeBounds.min)} GiB${isGpSsd2Selected && gpSsd2IopsValue != null && gpSsd2ThroughputValue != null ? ` | ${gpSsd2IopsValue} IOPS | ${gpSsd2ThroughputValue} MB/s` : ""}${selectedDiskPrice ? ` | Disk ${formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}` : ""}`
    : isFlexusLCalculator && selectedFlexusLPlan
    ? `Selected specifications: ${selectedFlexusLPlan.title} | ${selectedFlexusLPlan.systemDiskGiB} GiB system disk | ${selectedFlexusLPlan.peakBandwidthMbit} Mbit/s | ${selectedFlexusLPlan.dataPackageTiB} TB/month | ${formatFlavorAmount("USD", selectedFlexusLPlan.monthlyPriceUsd, "/mo")}`
    : `Selected specifications: ${systemDiskType} | ${systemDiskSize || String(activeDiskSizeBounds.min)} GiB${isGpSsd2Selected && gpSsd2IopsValue != null && gpSsd2ThroughputValue != null ? ` | ${gpSsd2IopsValue} IOPS | ${gpSsd2ThroughputValue} MB/s` : ""}${selectedDiskPrice ? ` | Disk ${formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}` : ""}`;
  const calculatorSelectionNotes = [
    ...(isEcsCalculator && selectedFlavorCard?.productType === "flexus-l"
      ? ["Flexus L plans include bundled system disk, bandwidth, and traffic. The ECS disk settings below are ignored for this selection."]
      : []),
    ...(isEcsCalculator && selectedFlavorCard?.productType === "ecs" && selectedFlavorCard?.flavorPrice && selectedDiskPrice
      ? [`Flavor ${selectedFlavorCard.flavorPrice} + Disk ${formatFlavorAmount(selectedDiskPrice.currency, selectedDiskPrice.amount, selectedDiskPrice.suffix)}`]
      : []),
    ...(isEvsCalculator && evsSplitNotice ? [evsSplitNotice] : []),
  ];
  const calculatorDiskNotes = [
    ...(isGpSsd2Selected
      ? ["Current estimate reflects capacity pricing only. Additional GPSSD2 IOPS and throughput charges are not modeled yet."]
      : []),
    ...(isEvsCalculator
      ? [
          `A single EVS disk can be up to ${evsSingleDiskMaxGiB} GiB. Entering a larger total will save multiple disks: ${evsSingleDiskMaxGiB} GiB chunks plus one final remainder disk.`,
          ...(evsSplitNotice ? [evsSplitNotice] : []),
        ]
      : [`Minimum ${activeDiskSizeBounds.min} GiB, maximum ${activeDiskSizeBounds.max} GiB.`]),
  ];
  const calculatorDiskConfigProps = {
    mode: isEvsCalculator ? ("evs" as const) : ("ecs" as const),
    systemDiskType,
    systemDiskOptions,
    onSystemDiskTypeChange: (value: string) => {
      if (!value) {
        return;
      }
      setSystemDiskType(value as (typeof systemDiskOptions)[number]);
    },
    systemDiskSize,
    onSystemDiskSizeChange: (value: string) => {
      if (value === "") {
        setSystemDiskSize("");
        return;
      }
      updateSystemDiskSize(value);
    },
    onSystemDiskSizeBlur: () => updateSystemDiskSize(systemDiskSize || String(activeDiskSizeBounds.min)),
    onSystemDiskSizeStep: (delta: number) => updateSystemDiskSize(String(Number(systemDiskSize || String(activeDiskSizeBounds.min)) + delta)),
    showGpSsd2Controls: isGpSsd2Selected,
    gpSsd2Iops,
    gpSsd2IopsRange,
    onGpSsd2IopsChange: (value: string) => {
      if (value === "") {
        setGpSsd2Iops("");
        return;
      }
      updateGpSsd2Iops(value);
    },
    onGpSsd2IopsBlur: () => updateGpSsd2Iops(gpSsd2Iops || String(gpSsd2IopsRange?.min ?? gpSsd2IopsBounds.min)),
    gpSsd2Throughput,
    gpSsd2ThroughputRange,
    onGpSsd2ThroughputChange: (value: string) => {
      if (value === "") {
        setGpSsd2Throughput("");
        return;
      }
      updateGpSsd2Throughput(value);
    },
    onGpSsd2ThroughputBlur: () =>
      updateGpSsd2Throughput(gpSsd2Throughput || String(gpSsd2ThroughputRange?.min ?? gpSsd2ThroughputBounds.min)),
    pricingError: evsPricingError,
    pricingLoadingMessage: evsPricingLoading ? "Loading EVS pricing..." : null,
    notes: calculatorDiskNotes,
    selectionSummary: calculatorSelectionSummary,
    selectionNotes: calculatorSelectionNotes,
  };
  const selectedCartMenuItems: ActionMenuItem[] =
    selectedList && selectedProject
      ? [
          {
            label: selectedList.huaweiCartKey ? "Sync Huawei Cart" : "Create Huawei Cart",
            icon: <RefreshCw className="size-4" />,
            onSelect: () => {
              void handleSyncSelectedList();
            },
            disabled: syncingHuaweiListId === selectedList.id,
          },
          {
            label: "Link Huawei Cart",
            icon: <Link2 className="size-4" />,
            onSelect: () => openActionModal({ kind: "list-link", listId: selectedList.id }),
          },
          {
            label: "Clone Cart",
            icon: <Copy className="size-4" />,
            onSelect: () => openActionModal({ kind: "list-clone", listId: selectedList.id }),
          },
          ...(selectedList.canShare
            ? [
                {
                  label: "Share Cart",
                  icon: <Share2 className="size-4" />,
                  onSelect: () => openActionModal({ kind: "list-share", listId: selectedList.id }),
                },
              ]
            : []),
          {
            label: "Delete Cart",
            icon: <Trash2 className="size-4" />,
            onSelect: () => {
              void handleDeleteList(selectedList, selectedProject.id);
            },
            disabled: deletingListId === selectedList.id,
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900 lg:p-6">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
        <header className="sticky top-0 z-50 rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div className="justify-self-start">
              <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">NeoCalculator</p>
              <p className="text-sm text-zinc-600">Calculator, carts, and projects.</p>
            </div>
            <nav className="hidden items-center gap-2 lg:flex lg:justify-self-center">
              <HomeNavLink href="/projects" active={false}>
                Projects
              </HomeNavLink>
              <HomeNavLink href="/" active>
                Dashboard
              </HomeNavLink>
            </nav>
            <div className="flex items-center justify-self-end gap-3">
              {session ? (
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-zinc-900">{session.user.name || session.user.email}</p>
                  <p className="text-xs text-zinc-500">{session.user.email}</p>
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10"
                aria-label="Reload Huawei carts"
                onClick={() => void loadHuaweiCarts()}
                disabled={huaweiCartsLoading || !cookieValue.trim()}
              >
                <RefreshCw className={`size-4 ${huaweiCartsLoading ? "animate-spin" : ""}`} />
              </Button>
              <div ref={profileAreaRef} className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-full border border-zinc-200"
                  aria-label="Open Huawei cookie settings"
                  aria-expanded={isProfileOpen}
                  onClick={() => setIsProfileOpen((current) => !current)}
                >
                  <UserCircle2 className="size-5" />
                </Button>

                {isProfileOpen ? (
                  <div className="absolute top-full right-0 z-50 mt-3 w-[min(92vw,380px)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-950">Huawei Cloud Cookie</p>
                      <p className="text-sm text-zinc-500">
                        Paste your website cookie string. It will be saved locally in this browser and works even before you sign in.
                      </p>
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
              {session ? (
                <Button type="button" variant="outline" onClick={() => authClient.signOut()}>
                  Sign Out
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setAuthMode("sign-in")}>
                    Sign In
                  </Button>
                  <Button type="button" onClick={() => setAuthMode("sign-up")}>
                    Create Account
                  </Button>
                </>
              )}
            </div>
          </div>
          <nav className="mt-3 flex items-center gap-2 lg:hidden">
            <HomeNavLink href="/projects" active={false}>
              Projects
            </HomeNavLink>
            <HomeNavLink href="/" active>
              Dashboard
            </HomeNavLink>
          </nav>
        </header>

        {isSessionPending ? (
          <Card>
            <CardContent className="py-16 text-center text-zinc-500">Checking session...</CardContent>
          </Card>
        ) : (
          <>
        {!session ? (
          <Card className="mx-auto w-full max-w-md">
            <CardHeader className="space-y-2">
              <CardTitle>{authMode === "sign-in" ? "Sign In" : "Create Account"}</CardTitle>
              <p className="text-sm text-zinc-500">
                Use the calculator without an account. Sign in only when you want to save carts, projects, or collaborate on shared work.
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
        ) : null}
        <div className="relative z-30 px-1 py-1 sm:px-2">
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
        </div>

        <main className="relative z-0 grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
          <Card className="overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Projects</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    {session ? "Projects and lists are scoped to your account." : "Browse anonymously. Sign in when you want to save carts and projects."}
                  </p>
                  {huaweiCartsSyncedAt ? (
                    <p className="mt-1 text-xs text-zinc-400">Huawei carts synced {new Date(huaweiCartsSyncedAt).toLocaleString()}</p>
                  ) : null}
                  {huaweiCartsError ? <p className="mt-1 text-xs text-red-600">{huaweiCartsError}</p> : null}
                </div>
                <Badge variant="secondary">{projects.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="New project name"
                    disabled={!session}
                  />
                  <Button variant="outline" size="sm" onClick={handleCreateProject} disabled={newProjectPending || !session}>
                    {newProjectPending ? "Adding..." : "New Project"}
                  </Button>
                </div>
                {projectsError ? <p className="text-sm text-red-600">{projectsError}</p> : null}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[620px] px-4 xl:h-[calc(100vh-15rem)]">
                <div className="space-y-3 py-3">
                  {!session ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      Sign in to save carts and projects. The calculator and Huawei cookie tools still work without an account.
                    </div>
                  ) : null}
                  {projectsLoading ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">Loading projects...</div>
                  ) : null}
                  {projects.map((project) => {
                    const isExpanded = expandedProjects[project.id] ?? false;
                    const isEditingProject = editingProjectId === project.id;
                    const isRenamingProject = renamingProjectId === project.id;
                    const isDeletingProject = deletingProjectId === project.id;
                    const projectCloneMessage = projectCloneMessages[project.id] ?? "";
                    const projectCloneIsError = projectCloneMessageErrors[project.id] ?? false;
                    const projectHuaweiMessage = projectHuaweiMessages[project.id] ?? "";
                    const projectHuaweiMessageIsError = projectHuaweiMessageErrors[project.id] ?? false;
                    const projectShareMessage = projectShareMessages[project.id] ?? "";
                    const projectMenuItems: ActionMenuItem[] = [
                      {
                        label: "Rename Project",
                        icon: <Pencil className="size-4" />,
                        onSelect: () => handleStartProjectRename(project),
                        disabled: isDeletingProject,
                      },
                      {
                        label: "Create Huawei Carts",
                        icon: <RefreshCw className="size-4" />,
                        onSelect: () => openActionModal({ kind: "project-huawei", projectId: project.id }),
                      },
                      {
                        label: "Clone Project",
                        icon: <Copy className="size-4" />,
                        onSelect: () => openActionModal({ kind: "project-clone", projectId: project.id }),
                      },
                      ...(project.canShare
                        ? [
                            {
                              label: "Share Project",
                              icon: <Share2 className="size-4" />,
                              onSelect: () => openActionModal({ kind: "project-share", projectId: project.id }),
                            },
                          ]
                        : []),
                    ];

                    return (
                      <div key={project.id} className="rounded-lg border bg-white">
                        <div className="flex items-start gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            {isEditingProject ? (
                              <div className="space-y-2 pr-2">
                                <Input
                                  value={projectNameDrafts[project.id] ?? project.name}
                                  onChange={(event) =>
                                    setProjectNameDrafts((current) => ({
                                      ...current,
                                      [project.id]: event.target.value,
                                    }))}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleRenameProject(project);
                                    }

                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      handleCancelProjectRename(project);
                                    }
                                  }}
                                  autoFocus
                                  placeholder="Project name"
                                />
                                <p className="text-xs text-zinc-500">Press Enter to save or Escape to cancel.</p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="min-w-0 text-left"
                                onClick={() => toggleProject(project.id)}
                                aria-expanded={isExpanded}
                              >
                                <p className="font-medium">{project.name}</p>
                                <p className="text-sm text-zinc-500">
                                  {project.lists.length} lists · {project.lists.reduce((sum, list) => sum + list.productCount, 0)} products ·{" "}
                                  {new Date(project.updatedAt).toLocaleDateString()}
                                </p>
                              </button>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isEditingProject ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleRenameProject(project)}
                                  disabled={isRenamingProject}
                                  aria-label="Save project name"
                                >
                                  <Check className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelProjectRename(project)}
                                  disabled={isRenamingProject}
                                  aria-label="Cancel project rename"
                                >
                                  <X className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                {project.canShare ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openActionModal({ kind: "project-share", projectId: project.id })}
                                    aria-label={`Share ${project.name}`}
                                  >
                                    <Share2 className="size-4" />
                                  </Button>
                                ) : null}
                                <ActionMenu
                                  open={openProjectMenuId === project.id}
                                  onOpenChange={(open) => setOpenProjectMenuId(open ? project.id : null)}
                                  label={`Open actions for ${project.name}`}
                                  items={projectMenuItems}
                                />
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleProject(project.id)}
                              aria-label={isExpanded ? "Collapse project" : "Expand project"}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleDeleteProject(project)}
                              disabled={isDeletingProject || isRenamingProject}
                              aria-label="Delete project"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

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
                              <Select
                                value={listBaseDrafts[project.id] || "__blank"}
                                onValueChange={(value) => {
                                  const nextValue = value && value !== "__blank" ? value : "";
                                  setListBaseDrafts((current) => ({
                                    ...current,
                                    [project.id]: nextValue,
                                  }));
                                }}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue>
                                    {listBaseDrafts[project.id]
                                      ? `Base: ${huaweiCarts.find((cart) => cart.key === listBaseDrafts[project.id])?.name ?? "Huawei cart"}`
                                      : "Base: Blank Neo cart"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__blank">Blank Neo cart</SelectItem>
                                  {huaweiCarts.map((cart) => {
                                    return (
                                      <SelectItem key={cart.key} value={cart.key} disabled={Boolean(cart.associatedListId)}>
                                        {cart.name}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              {projectHuaweiMessage || projectCloneMessage || projectShareMessage ? (
                                <div className="rounded-lg border bg-zinc-50 p-3">
                                  <div className="space-y-1 text-xs">
                                    {projectHuaweiMessage ? (
                                      <p className={projectHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectHuaweiMessage}</p>
                                    ) : null}
                                    {projectCloneMessage ? (
                                      <p className={projectCloneIsError ? "text-red-600" : "text-zinc-600"}>{projectCloneMessage}</p>
                                    ) : null}
                                    {projectShareMessage ? <p className="text-zinc-600">{projectShareMessage}</p> : null}
                                  </div>
                                </div>
                              ) : null}
                              {project.lists.map((item) => (
                                <div
                                  key={item.id}
                                  className={`flex items-start gap-2 rounded-lg border p-3 ${
                                    selectedListId === item.id ? "border-zinc-950 bg-white" : "border-zinc-200 bg-zinc-50"
                                  }`}
                                >
                                  <button type="button" onClick={() => setSelectedListId(item.id)} className="min-w-0 flex-1 text-left">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-medium">{item.name}</p>
                                          {item.huaweiCartKey ? <Badge variant="secondary">Huawei linked</Badge> : null}
                                        </div>
                                        <p className="text-sm text-zinc-500">
                                          {item.productCount} products · Created {new Date(item.createdAt).toLocaleDateString()}
                                        </p>
                                        {item.huaweiCartName ? <p className="text-xs text-zinc-400">{item.huaweiCartName}</p> : null}
                                      </div>
                                      <Badge variant="outline">{item.productCount}</Badge>
                                    </div>
                                  </button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void handleDeleteList(item, project.id)}
                                    disabled={deletingListId === item.id}
                                    aria-label={`Delete ${item.name}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
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

          <Card className="overflow-visible">
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
                {isSelectedServiceImplemented ? (
                  <>
                    <div className="fixed right-4 bottom-4 left-4 z-40 grid gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)] backdrop-blur xl:left-1/2 xl:w-[min(920px,calc(100vw-48rem))] xl:-translate-x-1/2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                      <div className="min-w-0">
                        <p className="text-[2.125rem] leading-none font-semibold tracking-tight text-zinc-950">{selectedEstimateParts.amount}</p>
                        <p className="mt-0.5 leading-tight text-sm text-zinc-500">
                          {selectedEstimateParts.timeframe ? `${selectedEstimateParts.timeframe} · ` : ""}
                          {instanceCountValue} {quantityLabel}
                          {instanceCountValue === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-col justify-center gap-2 xl:items-end">
                        {addToListMessage ? <p className="text-sm text-zinc-500">{addToListMessage}</p> : null}
                        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-600">{quantityLabel}s</span>
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
                          <Button onClick={handleAddToList} disabled={addToListPending || !selectedListId || !session}>
                            {addToListPending ? (editingProductId ? "Saving..." : "Adding...") : editingProductId ? "Save Changes" : "Add to List"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <CardContent className="space-y-6 py-5 pb-44">
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
                            items={calculatorBillingOptions}
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
                      {isEcsCalculator ? (
                        <EcsCalculatorPanel
                          minVcpuValue={minVcpuValue}
                          onMinVcpuChange={setMinVcpuValue}
                          minRamValue={minRamValue}
                          onMinRamChange={setMinRamValue}
                          flavorQuery={flavorQuery}
                          onFlavorQueryChange={(value) => {
                            setFlavorQuery(value);
                            setFlavorPage(1);
                          }}
                          flavorSort={flavorSort}
                          flavorSortOptions={flavorSortOptions}
                          onFlavorSortChange={(value) => {
                            if (!value) {
                              return;
                            }
                            setFlavorSort(value);
                            setFlavorPage(1);
                          }}
                          flavorPageSize={flavorPageSize}
                          flavorPageSizeOptions={flavorPageSizeOptions}
                          onFlavorPageSizeChange={(value) => {
                            if (!flavorPageSizeOptions.some((option) => option === value)) {
                              return;
                            }
                            setFlavorPageSize(value as (typeof flavorPageSizeOptions)[number]);
                            setFlavorPage(1);
                            window.localStorage.setItem(flavorPageSizeStorageKey, String(value));
                          }}
                          catalogFlavorsError={catalogFlavorsError}
                          catalogFlavorsLastCompletedAt={catalogFlavorsLastCompletedAt}
                          catalogFlavorsLoading={catalogFlavorsLoading}
                          visibleFlavors={visibleFlavors}
                          selectedFlavor={selectedFlavor}
                          onSelectFlavor={(name, vcpu, ram) => {
                            setSelectedFlavor(name);
                            setVcpuValue(vcpu);
                            setRamValue(ram);
                          }}
                          currentFlavorPage={currentFlavorPage}
                          totalFlavorPages={totalFlavorPages}
                          onPreviousFlavorPage={() => setFlavorPage((page) => Math.max(1, page - 1))}
                          onNextFlavorPage={() => setFlavorPage((page) => Math.min(totalFlavorPages, page + 1))}
                          showFlexusLToggleVisible={canShowFlexusLInEcs}
                          showFlexusLChecked={showFlexusLInEcs}
                          onShowFlexusLChange={setShowFlexusLInEcs}
                          diskConfigProps={calculatorDiskConfigProps}
                        />
                      ) : isFlexusLCalculator ? (
                        <FlexusLCalculatorPanel
                          plans={flexusLPlans.map((plan) => ({
                            id: plan.id,
                            title: plan.title,
                            vcpu: plan.vcpu,
                            ramGiB: plan.ramGiB,
                            systemDiskGiB: plan.systemDiskGiB,
                            peakBandwidthMbit: plan.peakBandwidthMbit,
                            dataPackageTiB: plan.dataPackageTiB,
                            monthlyPrice: formatFlavorAmount("USD", plan.monthlyPriceUsd, "/mo"),
                          }))}
                          selectedPlanId={selectedFlexusLPlan?.id ?? ""}
                          onSelectPlan={(planId) => {
                            const plan = findFlexusLPlan(planId);
                            if (!plan) {
                              return;
                            }
                            setSelectedFlavor(plan.id);
                            setVcpuValue(String(plan.vcpu));
                            setRamValue(String(plan.ramGiB));
                          }}
                          selectionSummary={calculatorSelectionSummary}
                          selectionNotes={calculatorSelectionNotes}
                          referenceNote={`Reference pricing uses Huawei Cloud's public Flexus L monthly catalog for ${flexusLPricingReference.region}.`}
                        />
                      ) : (
                        <EvsCalculatorPanel diskConfigProps={calculatorDiskConfigProps} />
                      )}
                    </CardContent>
                  </>
                ) : (
                  <UnsupportedServicePanel
                    title={`Calculator not implemented yet for ${selectedService}`}
                    description={`This dashboard calculator currently supports ${supportedCalculatorServiceCodes.join(", ")} only. Select Elastic Cloud Server, Flexus L Instance, or Elastic Volume Service to use the pricing form and save items.`}
                  />
                )}
              </TabsContent>

              <TabsContent value="batch-add">
                {isSelectedServiceBatchAddImplemented ? (
                  <ServiceBatchAddPanel
                    mode={isEcsCalculator ? "ecs" : isFlexusLCalculator ? "flexus-l" : "evs"}
                    regionValue={regionValue}
                    regionOptions={calculatorRegionOptions}
                    onRegionChange={(value) => setRegionValue(value as HuaweiRegionKey)}
                    batchInput={batchInput}
                    onBatchInputChange={setBatchInput}
                    batchAddMessage={batchAddMessage}
                    systemDiskType={systemDiskType}
                    systemDiskSizeValue={systemDiskSizeValue}
                    evsSingleDiskMaxGiB={evsSingleDiskMaxGiB}
                    showFlexusLToggleVisible={canShowFlexusLInEcs}
                    showFlexusLChecked={showFlexusLInEcs}
                    onShowFlexusLChange={setShowFlexusLInEcs}
                    onSubmit={handleBatchAdd}
                    submitDisabled={batchAddPending || !selectedListId || !session}
                    submitLabel={batchAddPending ? "Adding Batch..." : "Add Batch"}
                  />
                ) : (
                  <UnsupportedServicePanel
                    title={`Batch add not implemented yet for ${selectedService}`}
                    description={`Batch input currently supports ${supportedBatchAddServiceCodes.join(", ")} only. Select Elastic Cloud Server, Flexus L Instance, or Elastic Volume Service to use it.`}
                  />
                )}
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
            <CardHeader className="pb-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <CardTitle>Cart Contents</CardTitle>
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {selectedList && selectedProject ? `${selectedProject.name} / ${selectedList.name}` : "Select a list to see its saved products."}
                  </p>
                  {selectedList?.huaweiCartKey ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      Linked to Huawei cart {selectedList.huaweiCartName || selectedList.huaweiCartKey}
                    </p>
                  ) : null}
                  {selectedList?.huaweiLastSyncedAt ? (
                    <p className="mt-1 text-xs text-zinc-400">Last Huawei sync: {new Date(selectedList.huaweiLastSyncedAt).toLocaleString()}</p>
                  ) : null}
                  {selectedList?.huaweiLastError ? <p className="mt-1 text-xs text-red-600">{selectedList.huaweiLastError}</p> : null}
                  {selectedList && (huaweiActionMessage || cloneActionMessage || listShareMessages[selectedList.id]) ? (
                    <div className="mt-2 space-y-1 text-xs">
                      {huaweiActionMessage ? <p className="text-zinc-500">{huaweiActionMessage}</p> : null}
                      {cloneActionMessage ? (
                        <p className={cloneActionIsError ? "text-red-600" : "text-zinc-500"}>{cloneActionMessage}</p>
                      ) : null}
                      {listShareMessages[selectedList.id] ? <p className="text-zinc-500">{listShareMessages[selectedList.id]}</p> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Badge variant="outline">{selectedCartProducts.length} items</Badge>
                  {selectedList?.huaweiCartKey ? <Badge variant="secondary">Huawei linked</Badge> : null}
                  {selectedList?.canShare ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openActionModal({ kind: "list-share", listId: selectedList.id })}
                      aria-label={`Share ${selectedList.name}`}
                    >
                      <Share2 className="size-4" />
                    </Button>
                  ) : null}
                  {selectedList ? (
                    <ActionMenu
                      open={isCartMenuOpen}
                      onOpenChange={setIsCartMenuOpen}
                      label={`Open actions for ${selectedList.name}`}
                      items={selectedCartMenuItems}
                    />
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[620px] px-4 xl:h-[calc(100vh-15rem)]">
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
                                    disabled={addToListPending || !selectedListId || !session || deletingProductId === product.id}
                                  >
                                    {addToListPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEditProduct(product)}
                                  disabled={deletingProductId === product.id}
                                  aria-label={`Edit ${product.title}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteProduct(product)}
                                disabled={deletingProductId === product.id}
                                aria-label={deletingProductId === product.id ? `Deleting ${product.title}` : `Delete ${product.title}`}
                              >
                                <Trash2 className="size-4" />
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
        {activeModal && activeProject ? (
          <ActionModal
            title={
              activeModal.kind === "project-huawei"
                ? "Create Huawei Carts"
                : activeModal.kind === "project-clone"
                  ? "Clone Project"
                  : activeModal.kind === "project-share"
                    ? "Share Project"
                    : activeModal.kind === "list-link"
                      ? "Link Huawei Cart"
                      : activeModal.kind === "list-clone"
                        ? "Clone Cart"
                        : "Share Cart"
            }
            description={
              activeModal.kind === "project-huawei"
                ? "Create or update one Huawei cart for every NeoCalculator cart in this project."
                : activeModal.kind === "project-clone"
                  ? "Clone every cart in this project into a new project, with optional region and billing conversion."
                  : activeModal.kind === "project-share"
                    ? "Choose whether recipients should import a detached copy or join a collaborative project."
                    : activeModal.kind === "list-link"
                      ? "Link this cart to an existing Huawei calculator cart using the saved Huawei Cloud cookie."
                      : activeModal.kind === "list-clone"
                        ? "Clone this cart with optional region and billing conversion."
                        : "Create a detached copy link or a collaborative cart link for this cart only."
            }
            onClose={() => setActiveModal(null)}
          >
            {activeModal.kind === "project-huawei" ? (
              <>
                {activeProjectHuaweiMessage ? (
                  <p className={`text-sm ${activeProjectHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeProjectHuaweiMessage}
                  </p>
                ) : !cookieValue.trim() ? (
                  <p className="text-sm text-zinc-500">Save a Huawei Cloud cookie on the dashboard to enable project sync.</p>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Existing Huawei-linked carts are updated; unlinked carts will create new Huawei carts.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => void handleSyncProjectHuawei(activeProject)}
                    disabled={isActiveProjectSyncing || activeProject.lists.length === 0 || !cookieValue.trim()}
                  >
                    {isActiveProjectSyncing ? "Creating Huawei Carts..." : "Create Huawei Carts"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeModal.kind === "project-clone" ? (
              <>
                <Input
                  value={projectCloneNameDrafts[activeProject.id] ?? ""}
                  onChange={(event) =>
                    setProjectCloneNameDrafts((current) => ({
                      ...current,
                      [activeProject.id]: event.target.value,
                    }))}
                  placeholder={getProjectCloneDefaultName(
                    activeProject.name,
                    activeProjectCloneTargetRegion,
                    activeProjectCloneTargetBillingMode,
                  )}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={activeProjectCloneTargetRegion || "__keep"}
                    onValueChange={(value) =>
                      setProjectCloneTargetRegions((current) => ({
                        ...current,
                        [activeProject.id]: value && value !== "__keep" ? (value as HuaweiRegionKey) : "",
                      }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {activeProjectCloneTargetRegion
                          ? `Region: ${huaweiRegions[activeProjectCloneTargetRegion].short}`
                          : "Keep current region"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current region</SelectItem>
                      {cloneableRegions.map(([value, labels]) => (
                        <SelectItem key={value} value={value}>
                          {labels.short}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={activeProjectCloneTargetBillingMode || "__keep"}
                    onValueChange={(value) =>
                      setProjectCloneTargetBillingModes((current) => ({
                        ...current,
                        [activeProject.id]: value && value !== "__keep" ? (value as BillingOption) : "",
                      }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {activeProjectCloneTargetBillingMode
                          ? `Billing: ${activeProjectCloneTargetBillingMode}`
                          : "Keep current billing"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current billing</SelectItem>
                      {options.billing.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeProjectCloneMessage ? (
                  <p className={`text-sm ${activeProjectCloneMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeProjectCloneMessage}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">Huawei links are not copied to the cloned project.</p>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => void handleCloneProject(activeProject)} disabled={isActiveProjectCloning}>
                    {isActiveProjectCloning ? "Cloning Project..." : "Clone Project"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeModal.kind === "project-share" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("project", activeProject.id, "copy")}
                    disabled={sharingProjectKey === `project:${activeProject.id}:copy`}
                  >
                    {sharingProjectKey === `project:${activeProject.id}:copy` ? "Sharing..." : "Copy Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("project", activeProject.id, "collaborate")}
                    disabled={sharingProjectKey === `project:${activeProject.id}:collaborate`}
                  >
                    {sharingProjectKey === `project:${activeProject.id}:collaborate` ? "Sharing..." : "Collaborative Link"}
                  </Button>
                </div>
                {activeProjectShareMessage ? <p className="text-sm text-zinc-600">{activeProjectShareMessage}</p> : null}
              </>
            ) : null}

            {activeList && activeModal.kind === "list-link" ? (
              <>
                {activeList.huaweiCartKey ? (
                  <p className="text-sm text-zinc-600">Linked to {activeList.huaweiCartName || activeList.huaweiCartKey}</p>
                ) : null}
                {activeList.huaweiLastSyncedAt ? (
                  <p className="text-sm text-zinc-500">Last Huawei sync: {new Date(activeList.huaweiLastSyncedAt).toLocaleString()}</p>
                ) : null}
                {activeList.huaweiLastError ? <p className="text-sm text-red-600">{activeList.huaweiLastError}</p> : null}
                {activeListHuaweiMessage ? (
                  <p className="text-sm text-zinc-600">{activeListHuaweiMessage}</p>
                ) : !cookieValue.trim() ? (
                  <p className="text-sm text-zinc-500">Save a Huawei Cloud cookie on the dashboard to load linkable carts here.</p>
                ) : null}
                <Select
                  value={activeSelectedHuaweiCartKey || "__unlinked"}
                  onValueChange={(value) => setSelectedHuaweiCartKey(value && value !== "__unlinked" ? value : "")}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {activeSelectedHuaweiCartKey
                        ? `Huawei: ${activeSelectedHuaweiCart?.name ?? activeList.huaweiCartName ?? activeSelectedHuaweiCartKey}`
                        : "Choose Huawei cart to link"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unlinked">No Huawei link selected</SelectItem>
                    {activeList.huaweiCartKey && !huaweiCarts.some((cart) => cart.key === activeList.huaweiCartKey) ? (
                      <SelectItem value={activeList.huaweiCartKey}>
                        {activeList.huaweiCartName ?? activeList.huaweiCartKey}
                      </SelectItem>
                    ) : null}
                    {huaweiCarts.map((cart) => {
                      const linkedElsewhere = Boolean(cart.associatedListId && cart.associatedListId !== activeList.id);
                      return (
                        <SelectItem key={cart.key} value={cart.key} disabled={linkedElsewhere}>
                          {cart.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={handleLinkSelectedList}
                    disabled={!activeSelectedHuaweiCartKey || isActiveListLinking}
                  >
                    {isActiveListLinking ? "Linking..." : "Link Huawei Cart"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeList && activeModal.kind === "list-clone" ? (
              <>
                <Input
                  value={cloneNameDraft}
                  onChange={(event) => setCloneNameDraft(event.target.value)}
                  placeholder={getCartCloneDefaultName(activeList.name, cloneTargetRegion, cloneTargetBillingMode)}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={cloneTargetRegion || "__keep"}
                    onValueChange={(value) => setCloneTargetRegion(value && value !== "__keep" ? (value as HuaweiRegionKey) : "")}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {cloneTargetRegion ? `Region: ${huaweiRegions[cloneTargetRegion].short}` : "Keep current region"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current region</SelectItem>
                      {cloneableRegions.map(([value, labels]) => (
                        <SelectItem key={value} value={value}>
                          {labels.short}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={cloneTargetBillingMode || "__keep"}
                    onValueChange={(value) => setCloneTargetBillingMode(value && value !== "__keep" ? (value as BillingOption) : "")}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {cloneTargetBillingMode ? `Billing: ${cloneTargetBillingMode}` : "Keep current billing"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current billing</SelectItem>
                      {options.billing.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeListCloneMessage ? (
                  <p className={`text-sm ${activeListCloneMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeListCloneMessage}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">ECS items are reselected by the cheapest flavor that meets or exceeds the current vCPU and RAM.</p>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleCloneSelectedList} disabled={isActiveListCloning}>
                    {isActiveListCloning ? "Cloning..." : "Clone Cart"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeList && activeModal.kind === "list-share" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("list", activeList.id, "copy")}
                    disabled={sharingListKey === `list:${activeList.id}:copy`}
                  >
                    {sharingListKey === `list:${activeList.id}:copy` ? "Sharing..." : "Copy Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("list", activeList.id, "collaborate")}
                    disabled={sharingListKey === `list:${activeList.id}:collaborate`}
                  >
                    {sharingListKey === `list:${activeList.id}:collaborate` ? "Sharing..." : "Collaborative Link"}
                  </Button>
                </div>
                {activeListShareMessage ? <p className="text-sm text-zinc-600">{activeListShareMessage}</p> : null}
              </>
            ) : null}
          </ActionModal>
        ) : null}
          </>
        )}
      </div>
    </div>
  );
}
