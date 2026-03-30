import type { ServiceRegistryDocument } from "@/lib/service-config-types";

export const serviceRegistryDocument = {
  "version": 1,
  "supportedCalculatorServiceCodes": [
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
    "FunctionGraph"
  ],
  "supportedBatchAddServiceCodes": [
    "ECS",
    "Flexus L",
    "EVS",
    "OBS",
    "CCE",
    "CCI"
  ],
  "definitions": [
    {
      "serviceCode": "OBS",
      "definitionId": "obs",
      "serviceDefinitionPath": "./obs/bundle.ts",
      "pricingDefinitionPath": "./obs/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "EVS",
      "definitionId": "evs",
      "serviceDefinitionPath": "./evs/bundle.ts",
      "pricingDefinitionPath": "./evs/bundle.ts",
      "status": "pilot"
    },
    {
      "serviceCode": "EIP",
      "definitionId": "eip",
      "serviceDefinitionPath": "./eip/bundle.ts",
      "pricingDefinitionPath": "./eip/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "ELB",
      "definitionId": "elb",
      "serviceDefinitionPath": "./elb/bundle.ts",
      "pricingDefinitionPath": "./elb/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "NAT",
      "definitionId": "nat",
      "serviceDefinitionPath": "./nat/bundle.ts",
      "pricingDefinitionPath": "./nat/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "VPN",
      "definitionId": "vpn",
      "serviceDefinitionPath": "./vpn/bundle.ts",
      "pricingDefinitionPath": "./vpn/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "CCE",
      "definitionId": "cce",
      "serviceDefinitionPath": "./cce/bundle.ts",
      "pricingDefinitionPath": "./cce/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "CCI",
      "definitionId": "cci",
      "serviceDefinitionPath": "./cci/bundle.ts",
      "pricingDefinitionPath": "./cci/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "ModelArts",
      "definitionId": "modelarts",
      "serviceDefinitionPath": "./modelarts/bundle.ts",
      "pricingDefinitionPath": "./modelarts/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "Workspace",
      "definitionId": "workspace",
      "serviceDefinitionPath": "./workspace/bundle.ts",
      "pricingDefinitionPath": "./workspace/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "DCS",
      "definitionId": "dcs",
      "serviceDefinitionPath": "./dcs/bundle.ts",
      "pricingDefinitionPath": "./dcs/bundle.ts",
      "status": "active"
    },
    {
      "serviceCode": "FunctionGraph",
      "definitionId": "functiongraph",
      "serviceDefinitionPath": "./functiongraph/bundle.ts",
      "pricingDefinitionPath": "./functiongraph/bundle.ts",
      "status": "active"
    }
  ],
  "services": [
    {
      "name": "Bare Metal Server",
      "code": "BMS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/BMS.png"
    },
    {
      "name": "Auto Scaling",
      "code": "AS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/AS.png"
    },
    {
      "name": "SoftWare Repository for Container",
      "code": "SWR",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/SWR.png"
    },
    {
      "name": "Cloud Container Instance",
      "code": "CCI",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png"
    },
    {
      "name": "Cloud Container Instance 2.0",
      "code": "CCI 2.0",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png"
    },
    {
      "name": "Flexus CCI",
      "code": "Flexus CCI",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png"
    },
    {
      "name": "Dedicated Host",
      "code": "DeH",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/DeH.png"
    },
    {
      "name": "Cloud Container Engine",
      "code": "CCE",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCE.png"
    },
    {
      "name": "Elastic Cloud Server",
      "code": "ECS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/ECS.png"
    },
    {
      "name": "Flexus L Instance",
      "code": "Flexus L",
      "icon": "https://res-static.hc-cdn.cn/aem/program/prod/common/china/zh-cn/service-icon/hcss.svg"
    },
    {
      "name": "Flexus X Instance",
      "code": "Flexus X",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/FECSX.png"
    },
    {
      "name": "MapReduce Service",
      "code": "MRS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DWS.png"
    },
    {
      "name": "DataArts Insight",
      "code": "DataArts Insight",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DataArts.png"
    },
    {
      "name": "Data Ingestion Service",
      "code": "DIS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DIS.png"
    },
    {
      "name": "DataArts Studio(DGC)",
      "code": "DGC",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DataArts.png"
    },
    {
      "name": "Data Lake Insight",
      "code": "DLI",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DLI.png"
    },
    {
      "name": "DataArts Lake Formation",
      "code": "Lake Formation",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DataArts.png"
    },
    {
      "name": "Data Warehouse Service",
      "code": "DWS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DWS.png"
    },
    {
      "name": "Cloud Search Service",
      "code": "CSS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/CSS.png"
    },
    {
      "name": "Distributed Cache Service (for Redis)",
      "code": "DCS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/Memcached.png"
    },
    {
      "name": "Distributed Database Middleware",
      "code": "DDM",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/DDM.png"
    },
    {
      "name": "Data Replication Service",
      "code": "DRS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/DRS.png"
    },
    {
      "name": "UGO",
      "code": "UGO",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/UGO.png"
    },
    {
      "name": "Graph Engine Service",
      "code": "GES",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ges.png"
    },
    {
      "name": "Document Database Service",
      "code": "DDS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/DDS.png"
    },
    {
      "name": "GeminiDB",
      "code": "GeminiDB",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/GaussDBfornosql.png"
    },
    {
      "name": "Relational Database Service",
      "code": "RDS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/RDSforMySQL.png"
    },
    {
      "name": "GaussDB",
      "code": "GaussDB",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/GaussDB.png"
    },
    {
      "name": "TaurusDB",
      "code": "TaurusDB",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/GaussDBforMySQL.png"
    },
    {
      "name": "Flexus RDS",
      "code": "Flexus RDS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/FRDS.png"
    },
    {
      "name": "IoT Device Management",
      "code": "IoTDM",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/InternetofThings/IoTDM.png"
    },
    {
      "name": "IoTDA",
      "code": "IoTDA",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/InternetofThings/IoTDA.png"
    },
    {
      "name": "ModelArts",
      "code": "ModelArts",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ModelArts.png"
    },
    {
      "name": "ModelArts Studio",
      "code": "ModelArts Studio",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ModelArts.png"
    },
    {
      "name": "API Gateway",
      "code": "APIG",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/APIG.png"
    },
    {
      "name": "ServiceStage",
      "code": "ServiceStage",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/ServiceStage.png"
    },
    {
      "name": "CodeArts Artifact",
      "code": "CodeArts Artifact",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsArtifact.png"
    },
    {
      "name": "CodeArts Build",
      "code": "CodeArts Build",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsBuild.png"
    },
    {
      "name": "CodeArts Pipeline",
      "code": "CodeArts Pipeline",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsPipeline.png"
    },
    {
      "name": "CodeArts Check",
      "code": "CodeArts Check",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsCheck.png"
    },
    {
      "name": "CodeArts",
      "code": "CodeArts",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArts.png"
    },
    {
      "name": "EventGrid",
      "code": "EventGrid",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/BusinessApplications/ROMAConnect.png"
    },
    {
      "name": "Elastic Load Balance",
      "code": "ELB",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/ELB.png"
    },
    {
      "name": "CodeArts TestPlan",
      "code": "CodeArts TestPlan",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsTestPlan.png"
    },
    {
      "name": "Image Management Service",
      "code": "IMS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/IMS.png"
    },
    {
      "name": "Log Tank Service",
      "code": "LTS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/LTS.png"
    },
    {
      "name": "Simple Message Notification",
      "code": "SMN",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/SMN.png"
    },
    {
      "name": "Application Operations Management",
      "code": "AOM",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/AOM.png"
    },
    {
      "name": "Application Performance Management",
      "code": "APM",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/APM.png"
    },
    {
      "name": "Cloud Eye",
      "code": "CES",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/CES.png"
    },
    {
      "name": "Content Delivery Network",
      "code": "CDN",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ContentDeliveryEdgeComputing/CDN.png"
    },
    {
      "name": "Direct Connect",
      "code": "DC",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/DC.png"
    },
    {
      "name": "Domain Name Service",
      "code": "DNS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/BusinessApplications/DNS.png"
    },
    {
      "name": "NAT Gateway",
      "code": "NAT",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/NAT.png"
    },
    {
      "name": "Enterprise Router",
      "code": "ER",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/ER.png"
    },
    {
      "name": "VPC Endpoint",
      "code": "VPCEP",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPCEP.png"
    },
    {
      "name": "Elastic IP",
      "code": "EIP",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/EIP.png"
    },
    {
      "name": "Virtual Private Cloud",
      "code": "VPC",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPC.png"
    },
    {
      "name": "Virtual Private Network",
      "code": "VPN",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPN.png"
    },
    {
      "name": "Host Security Service",
      "code": "HSS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png"
    },
    {
      "name": "Cloud Trace Service",
      "code": "CTS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/CTS.png"
    },
    {
      "name": "Cloud Certificate & Manager",
      "code": "CCM",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/SSL.png"
    },
    {
      "name": "Container Guard Service",
      "code": "CGS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png"
    },
    {
      "name": "Data Security Center",
      "code": "DSC",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/DSC.png"
    },
    {
      "name": "Database Security Service",
      "code": "DBSS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/DBSS.png"
    },
    {
      "name": "IAM Identity Center",
      "code": "IAM Identity Center",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/IAM.png"
    },
    {
      "name": "Identity and Access Management",
      "code": "IAM",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/IAM.png"
    },
    {
      "name": "Data Encryption Workshop",
      "code": "DEW",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/DEW.png"
    },
    {
      "name": "Cloud Firewall",
      "code": "CFW",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png"
    },
    {
      "name": "DDoS Mitigation",
      "code": "DDoS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/AAD.png"
    },
    {
      "name": "Cloud Bastion Host",
      "code": "CBH",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CBH.png"
    },
    {
      "name": "SecMaster",
      "code": "SecMaster",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png"
    },
    {
      "name": "Cloud Backup and Recovery",
      "code": "CBR",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/CBR.png"
    },
    {
      "name": "Cloud Server Backup Service",
      "code": "CSBS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/CSBS.png"
    },
    {
      "name": "Elastic Volume Service",
      "code": "EVS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/EVS.png"
    },
    {
      "name": "Storage Disaster Recovery Service",
      "code": "SDRS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/SDRS.png"
    },
    {
      "name": "Scalable File Service",
      "code": "SFS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/SFS.png"
    },
    {
      "name": "Object Storage Service",
      "code": "OBS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/OBS.png"
    },
    {
      "name": "Dedicated OBS",
      "code": "DOS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/OBS.png"
    },
    {
      "name": "Object Storage Migration Service",
      "code": "OMS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/OMS.png"
    },
    {
      "name": "Dedicated Distributed Storage Service",
      "code": "DSS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/DSS.png"
    },
    {
      "name": "Cloud Data Migration",
      "code": "CDM",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/CDM.png"
    },
    {
      "name": "Migration Center",
      "code": "MGC",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/MGC.png"
    },
    {
      "name": "Server Migration Service",
      "code": "SMS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/SMS.png"
    },
    {
      "name": "KooGallery",
      "code": "KooGallery",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/aPaaS/KooMessage.png"
    },
    {
      "name": "Workspace",
      "code": "Workspace",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/BusinessApplications/Workspace.png"
    },
    {
      "name": "CodeArts Deploy",
      "code": "CodeArts Deploy",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsDeploy.png"
    },
    {
      "name": "DataArts Fabric",
      "code": "DataArts Fabric",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DataArtsFabric.png"
    },
    {
      "name": "CodeArts Governance",
      "code": "CodeArts Governance",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/DevSecurity.png"
    },
    {
      "name": "Distributed Message Service",
      "code": "DMS",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/DMS.png"
    },
    {
      "name": "Distributed Message Service (for Kafka)",
      "code": "DMS Kafka",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/Kafka.png"
    },
    {
      "name": "Distributed Message Service (for RabbitMQ)",
      "code": "DMS RabbitMQ",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/RabbitMQ.png"
    },
    {
      "name": "Distributed Message Service (for RocketMQ)",
      "code": "DMS RocketMQ",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/ROCKETMQ.png"
    },
    {
      "name": "CodeArts PerfTest",
      "code": "CodeArts PerfTest",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsPerfTest.png"
    },
    {
      "name": "CodeArts Req",
      "code": "CodeArts Req",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsReq.png"
    },
    {
      "name": "FunctionGraph",
      "code": "FunctionGraph",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/FunctionGraph.png"
    },
    {
      "name": "CodeArts Repo",
      "code": "CodeArts Repo",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/DeveloperServices/CodeArtsRepo.png"
    },
    {
      "name": "Cloud Phone Host",
      "code": "CPH",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/CPH.png"
    },
    {
      "name": "Web Application Firewall",
      "code": "WAF",
      "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/WAF.png"
    }
  ]
} satisfies ServiceRegistryDocument;
