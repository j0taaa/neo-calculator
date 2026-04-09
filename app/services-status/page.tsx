"use client";

import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const HUAWEI_CLOUD_SERVICES = [
  { name: "Elastic Cloud Server", code: "ECS", category: "Compute" },
  { name: "Flexus L Instance", code: "Flexus L", category: "Compute" },
  { name: "Flexus X Instance", code: "Flexus X", category: "Compute" },
  { name: "Bare Metal Server", code: "BMS", category: "Compute" },
  { name: "Auto Scaling", code: "AS", category: "Compute" },
  { name: "Dedicated Host", code: "DeH", category: "Compute" },
  { name: "Image Management Service", code: "IMS", category: "Compute" },
  { name: "Cloud Phone Host", code: "CPH", category: "Compute" },
  { name: "FunctionGraph", code: "FunctionGraph", category: "Compute" },
  { name: "Cloud Container Engine", code: "CCE", category: "Containers" },
  { name: "Cloud Container Instance", code: "CCI", category: "Containers" },
  { name: "Cloud Container Instance 2.0", code: "CCI 2.0", category: "Containers" },
  { name: "Flexus CCI", code: "Flexus CCI", category: "Containers" },
  { name: "SoftWare Repository for Container", code: "SWR", category: "Containers" },
  { name: "Elastic Volume Service", code: "EVS", category: "Storage" },
  { name: "Object Storage Service", code: "OBS", category: "Storage" },
  { name: "Dedicated OBS", code: "DOS", category: "Storage" },
  { name: "Scalable File Service", code: "SFS", category: "Storage" },
  { name: "Scalable File Service Turbo", code: "SFS Turbo", category: "Storage" },
  { name: "Cloud Backup and Recovery", code: "CBR", category: "Storage" },
  { name: "Cloud Server Backup Service", code: "CSBS", category: "Storage" },
  { name: "Storage Disaster Recovery Service", code: "SDRS", category: "Storage" },
  { name: "Dedicated Distributed Storage Service", code: "DSS", category: "Storage" },
  { name: "Elastic IP", code: "EIP", category: "Network" },
  { name: "Elastic Load Balance", code: "ELB", category: "Network" },
  { name: "Virtual Private Cloud", code: "VPC", category: "Network" },
  { name: "NAT Gateway", code: "NAT", category: "Network" },
  { name: "Virtual Private Network", code: "VPN", category: "Network" },
  { name: "Direct Connect", code: "DC", category: "Network" },
  { name: "Enterprise Router", code: "ER", category: "Network" },
  { name: "Global Accelerator", code: "GA", category: "Network" },
  { name: "VPC Endpoint", code: "VPCEP", category: "Network" },
  { name: "Content Delivery Network", code: "CDN", category: "Network" },
  { name: "Domain Name Service", code: "DNS", category: "Network" },
  { name: "Relational Database Service", code: "RDS", category: "Database" },
  { name: "Flexus RDS", code: "Flexus RDS", category: "Database" },
  { name: "Document Database Service", code: "DDS", category: "Database" },
  { name: "GaussDB", code: "GaussDB", category: "Database" },
  { name: "TaurusDB", code: "TaurusDB", category: "Database" },
  { name: "GeminiDB", code: "GeminiDB", category: "Database" },
  { name: "Distributed Cache Service (for Redis)", code: "DCS", category: "Database" },
  { name: "Distributed Database Middleware", code: "DDM", category: "Database" },
  { name: "Data Replication Service", code: "DRS", category: "Database" },
  { name: "UGO", code: "UGO", category: "Database" },
  { name: "Distributed Message Service", code: "DMS", category: "Middleware" },
  { name: "Distributed Message Service (for Kafka)", code: "DMS Kafka", category: "Middleware" },
  { name: "Distributed Message Service (for RabbitMQ)", code: "DMS RabbitMQ", category: "Middleware" },
  { name: "Distributed Message Service (for RocketMQ)", code: "DMS RocketMQ", category: "Middleware" },
  { name: "API Gateway", code: "APIG", category: "Middleware" },
  { name: "Cloud Service Engine", code: "CSE", category: "Middleware" },
  { name: "ServiceStage", code: "ServiceStage", category: "Middleware" },
  { name: "ModelArts", code: "ModelArts", category: "AI" },
  { name: "ModelArts Studio", code: "ModelArts Studio", category: "AI" },
  { name: "Graph Engine Service", code: "GES", category: "AI" },
  { name: "MapReduce Service", code: "MRS", category: "Big Data" },
  { name: "Data Ingestion Service", code: "DIS", category: "Big Data" },
  { name: "Data Lake Insight", code: "DLI", category: "Big Data" },
  { name: "Data Warehouse Service", code: "DWS", category: "Big Data" },
  { name: "Cloud Search Service", code: "CSS", category: "Big Data" },
  { name: "DataArts Insight", code: "DataArts Insight", category: "Big Data" },
  { name: "DataArts Studio (DGC)", code: "DGC", category: "Big Data" },
  { name: "DataArts Lake Formation", code: "Lake Formation", category: "Big Data" },
  { name: "DataArts Fabric", code: "DataArts Fabric", category: "Big Data" },
  { name: "Cloud Data Migration", code: "CDM", category: "Big Data" },
  { name: "Host Security Service", code: "HSS", category: "Security" },
  { name: "Web Application Firewall", code: "WAF", category: "Security" },
  { name: "DDoS Mitigation", code: "DDoS", category: "Security" },
  { name: "Cloud Firewall", code: "CFW", category: "Security" },
  { name: "Container Guard Service", code: "CGS", category: "Security" },
  { name: "Data Encryption Workshop", code: "DEW", category: "Security" },
  { name: "Data Security Center", code: "DSC", category: "Security" },
  { name: "Database Security Service", code: "DBSS", category: "Security" },
  { name: "Cloud Certificate Manager", code: "CCM", category: "Security" },
  { name: "Cloud Bastion Host", code: "CBH", category: "Security" },
  { name: "SecMaster", code: "SecMaster", category: "Security" },
  { name: "Identity and Access Management", code: "IAM", category: "Security" },
  { name: "IAM Identity Center", code: "IAM Identity Center", category: "Security" },
  { name: "Simple Message Notification", code: "SMN", category: "Application Services" },
  { name: "EventGrid", code: "EventGrid", category: "Application Services" },
  { name: "Log Tank Service", code: "LTS", category: "Management" },
  { name: "Application Operations Management", code: "AOM", category: "Management" },
  { name: "Application Performance Management", code: "APM", category: "Management" },
  { name: "Cloud Eye", code: "CES", category: "Management" },
  { name: "Cloud Trace Service", code: "CTS", category: "Management" },
  { name: "CodeArts", code: "CodeArts", category: "Developer Services" },
  { name: "CodeArts Repo", code: "CodeArts Repo", category: "Developer Services" },
  { name: "CodeArts Build", code: "CodeArts Build", category: "Developer Services" },
  { name: "CodeArts Check", code: "CodeArts Check", category: "Developer Services" },
  { name: "CodeArts Pipeline", code: "CodeArts Pipeline", category: "Developer Services" },
  { name: "CodeArts Deploy", code: "CodeArts Deploy", category: "Developer Services" },
  { name: "CodeArts TestPlan", code: "CodeArts TestPlan", category: "Developer Services" },
  { name: "CodeArts PerfTest", code: "CodeArts PerfTest", category: "Developer Services" },
  { name: "CodeArts Req", code: "CodeArts Req", category: "Developer Services" },
  { name: "CodeArts Artifact", code: "CodeArts Artifact", category: "Developer Services" },
  { name: "CodeArts Governance", code: "CodeArts Governance", category: "Developer Services" },
  { name: "Workspace", code: "Workspace", category: "Desktop" },
  { name: "IoT Device Management", code: "IoTDM", category: "IoT" },
  { name: "IoTDA", code: "IoTDA", category: "IoT" },
  { name: "Object Storage Migration Service", code: "OMS", category: "Migration" },
  { name: "Server Migration Service", code: "SMS", category: "Migration" },
  { name: "Migration Center", code: "MGC", category: "Migration" },
  { name: "KooGallery", code: "KooGallery", category: "Marketplace" },
];

const IMPLEMENTED_SERVICES = new Set([
  "ECS",
  "Flexus L",
  "EVS",
  "OBS",
  "ELB",
  "EIP",
  "NAT",
  "VPN",
  "CCE",
  "CCI",
  "ModelArts",
  "Workspace",
  "DCS",
  "DC",
  "CBR",
  "SFS",
  "SFS Turbo",
  "CCM",
  "CBH",
  "VPCEP",
  "FunctionGraph",
  "RDS",
  "Flexus RDS",
  "ER",
  "APIG",
  "LTS",
  "GA",
  "GES",
  "CSE",
  "DIS",
  "HSS",
  "DEW",
  "SMN",
  "DWS",
  "DLI",
  "CDM",
  "DDS",
  "WAF",
  "CFW",
]);

export default function ServicesStatusPage() {
  const categories = [...new Set(HUAWEI_CLOUD_SERVICES.map((s) => s.category))].sort();

  const stats = {
    total: HUAWEI_CLOUD_SERVICES.length,
    implemented: IMPLEMENTED_SERVICES.size,
    notImplemented: HUAWEI_CLOUD_SERVICES.filter((s) => !IMPLEMENTED_SERVICES.has(s.code)).length,
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Huawei Cloud Services - Implementation Status</h1>
          <p className="text-muted-foreground">
            Overview of Huawei Cloud services and their implementation status in NeoCalculator.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Implemented</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.implemented}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">Not Implemented</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.notImplemented}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Services by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {categories.map((category) => {
                const services = HUAWEI_CLOUD_SERVICES.filter((s) => s.category === category);
                const implementedCount = services.filter((s) => IMPLEMENTED_SERVICES.has(s.code)).length;

                return (
                  <div key={category} className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{category}</h3>
                      <Badge variant="secondary">
                        {implementedCount}/{services.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {services.map((service) => {
                        const isImplemented = IMPLEMENTED_SERVICES.has(service.code);

                        return (
                          <div
                            key={service.code}
                            className={`flex items-center gap-2 p-2 rounded-md ${
                              isImplemented
                                ? "bg-green-50 dark:bg-green-950"
                                : "bg-red-50 dark:bg-red-950"
                            }`}
                          >
                            {isImplemented ? (
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm ${isImplemented ? "font-medium" : ""} truncate`}>{service.name}</div>
                              <div className="text-xs text-muted-foreground">{service.code}</div>
                            </div>
                            {isImplemented && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                Done
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p suppressHydrationWarning>This is a hidden status page. Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}