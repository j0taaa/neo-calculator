export const runtime = "nodejs";

const services = [
  { code: "apig", name: "API Gateway", category: "Networking" },
  { code: "cce", name: "Cloud Container Engine", category: "Compute" },
  { code: "ccm", name: "Cloud Camera", category: "Video" },
  { code: "cbr", name: "Cloud Backup and Recovery", category: "Storage" },
  { code: "cbh", name: "Cloud Bastion Host", category: "Security" },
  { code: "dcs", name: "Distributed Cache Service", category: "Database" },
  { code: "dc", name: "Direct Connect", category: "Networking" },
  { code: "eip", name: "Elastic IP", category: "Networking" },
  { code: "elb", name: "Elastic Load Balance", category: "Networking" },
  { code: "er", name: "Cloud Connect", category: "Networking" },
  { code: "evs", name: "Elastic Volume Service", category: "Storage" },
  { code: "flexus-rds", name: "Flexus RDS", category: "Database" },
  { code: "functiongraph", name: "FunctionGraph", category: "Compute" },
  { code: "ga", name: "Global Accelerator", category: "Networking" },
  { code: "lts", name: "Log Tank Service", category: "Management" },
  { code: "modelarts", name: "ModelArts", category: "AI" },
  { code: "nat", name: "NAT Gateway", category: "Networking" },
  { code: "obs", name: "Object Storage Service", category: "Storage" },
  { code: "rds", name: "Relational Database Service", category: "Database" },
  { code: "sfs", name: "Scalable File Service", category: "Storage" },
  { code: "sfsturbo", name: "SFS Turbo", category: "Storage" },
  { code: "vpcep", name: "VPC Endpoint", category: "Networking" },
  { code: "vpn", name: "Virtual Private Network", category: "Networking" },
  { code: "workspace", name: "Workspace", category: "Desktop" },
];

export async function GET() {
  return Response.json({
    services: services.map((s) => ({
      code: s.code,
      name: s.name,
      category: s.category,
      pricingUrl: `/api/v1/public/catalog/${s.code}/pricing`,
    })),
    total: services.length,
  });
}