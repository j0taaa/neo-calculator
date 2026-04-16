import { sendHttpRequest } from "@/lib/huawei-http";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

const INQUIRY_API_URL = "https://portal-intl.huaweicloud.com/api/cbc/global/rest/BSS/billing/ratingservice/v2/inquiry/resource";

const INQUIRY_HEADERS = {
  accept: "application/json, text/plain, */*",
  "content-type": "application/json; charset=UTF-8",
  origin: "https://www.huaweicloud.com",
  referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
} as const;

export function isInquiryPricingEnabled(): boolean {
  return process.env.NEO_USE_INQUIRY_API === "1" || process.env.NEO_USE_INQUIRY_API?.toLowerCase() === "true";
}

const SERVICE_TYPE_MAP: Record<string, { cloudServiceType: string; resourceType: string; defaultSpec?: string; measureId?: number }> = {
  ECS: { cloudServiceType: "hws.service.type.ec2", resourceType: "hws.resource.type.vm", defaultSpec: "vm" },
  EVS: { cloudServiceType: "hws.service.type.ebs", resourceType: "hws.resource.type.volume", defaultSpec: "SSD" },
  DCS: { cloudServiceType: "hws.service.type.dcs", resourceType: "hws.resource.type.dcs.instance" },
  EIP: { cloudServiceType: "hws.service.type.vpc", resourceType: "hws.resource.type.bandwidth", defaultSpec: "bandwidth", measureId: 15 },
  VPN: { cloudServiceType: "hws.service.type.vpn", resourceType: "hws.resource.type.vpn.ipsecvpn", defaultSpec: "V300" },
  ELB: { cloudServiceType: "hws.service.type.elb", resourceType: "hws.resource.type.loadbalancer" },
  NAT: { cloudServiceType: "hws.service.type.vpc", resourceType: "hws.resource.type.natgateway", defaultSpec: "Small" },
  OBS: { cloudServiceType: "hws.service.type.obs", resourceType: "hws.resource.type.object" },
  RDS: { cloudServiceType: "hws.service.type.rds", resourceType: "hws.resource.type.db.instance" },
  GaussDB: { cloudServiceType: "hws.service.type.gaussdb", resourceType: "hws.resource.type.db.instance" },
  CCE: { cloudServiceType: "hws.service.type.cce", resourceType: "hws.resource.type.cluster" },
  CCECluster: { cloudServiceType: "hws.service.type.cce", resourceType: "hws.resource.type.cluster" },
  CCENode: { cloudServiceType: "hws.service.type.cce", resourceType: "hws.resource.type.node" },
  CSS: { cloudServiceType: "hws.service.type.css", resourceType: "hws.resource.type.instance" },
  DIS: { cloudServiceType: "hws.service.type.dis", resourceType: "hws.resource.type.stream" },
  DLI: { cloudServiceType: "hws.service.type.dli", resourceType: "hws.resource.type.queue" },
  DWS: { cloudServiceType: "hws.service.type.dws", resourceType: "hws.resource.type.cluster" },
  MRS: { cloudServiceType: "hws.service.type.mrs", resourceType: "hws.resource.type.cluster" },
  APIG: { cloudServiceType: "hws.service.type.apig", resourceType: "hws.resource.type.environment" },
  FunctionGraph: { cloudServiceType: "hws.service.type.functiongraph", resourceType: "hws.resource.type.function" },
  KMS: { cloudServiceType: "hws.service.type.kms", resourceType: "hws.resource.type.key" },
  LTS: { cloudServiceType: "hws.service.type.lts", resourceType: "hws.resource.type.loggroup" },
  SMN: { cloudServiceType: "hws.service.type.smn", resourceType: "hws.resource.type.topic" },
  CBR: { cloudServiceType: "hws.service.type.cbr", resourceType: "hws.resource.type.vault" },
  CFW: { cloudServiceType: "hws.service.type.cfw", resourceType: "hws.resource.type.firewall" },
  WAF: { cloudServiceType: "hws.service.type.waf", resourceType: "hws.resource.type.instance" },
  DDOS: { cloudServiceType: "hws.service.type.ddos", resourceType: "hws.resource.type.bg" },
  HSS: { cloudServiceType: "hws.service.type.hss", resourceType: "hws.resource.type.host" },
  IAM: { cloudServiceType: "hws.service.type.iam", resourceType: "hws.resource.type.user" },
  DEW: { cloudServiceType: "hws.service.type.dew", resourceType: "hws.resource.type.key" },
  DMS: { cloudServiceType: "hws.service.type.dms", resourceType: "hws.resource.type.instance" },
  DMSKafka: { cloudServiceType: "hws.service.type.dms", resourceType: "hws.resource.type.kafka.instance" },
  CDN: { cloudServiceType: "hws.service.type.cdn", resourceType: "hws.resource.type.domain" },
  DC: { cloudServiceType: "hws.service.type.dc", resourceType: "hws.resource.type.virtualinterface" },
  ER: { cloudServiceType: "hws.service.type.er", resourceType: "hws.resource.type.virtualgateway" },
  GA: { cloudServiceType: "hws.service.type.ga", resourceType: "hws.resource.type.listener" },
  VPCEP: { cloudServiceType: "hws.service.type.vpcep", resourceType: "hws.resource.type.endpoint" },
  SFS: { cloudServiceType: "hws.service.type.sfs", resourceType: "hws.resource.type.share" },
  "SFS Turbo": { cloudServiceType: "hws.service.type.sfs", resourceType: "hws.resource.type.share" },
  ModelArts: { cloudServiceType: "hws.service.type.modelarts", resourceType: "hws.resource.type.workspace" },
  Workspace: { cloudServiceType: "hws.service.type.workspace", resourceType: "hws.resource.type.desktop" },
  CCS: { cloudServiceType: "hws.service.type.ccs", resourceType: "hws.resource.type.cluster" },
};

export interface InquiryPricingInput {
  serviceCode: string;
  regionId: string;
  productId: string;
  resourceSize?: number;
  usageValue: number;
  resourceSpecCode?: string;
  productNum?: number;
}

export interface InquiryPricingResult {
  amount: number;
  currency: string;
  measureId: number;
  productId: string;
}

const inquiryCache = new Map<string, { expiresAt: number; data: InquiryPricingResult }>();
const INQUIRY_CACHE_TTL_MS = 60_000;

function buildInquiryCacheKey(input: InquiryPricingInput): string {
  return `${input.serviceCode}|${input.regionId}|${input.productId}|${input.resourceSize ?? 1}|${input.usageValue}`;
}

export async function fetchInquiryPricing(input: InquiryPricingInput): Promise<InquiryPricingResult> {
  const cacheKey = buildInquiryCacheKey(input);
  const cached = inquiryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const regionMap = huaweiRegions[input.regionId as HuaweiRegionKey];
  const catalogRegionId = regionMap?.catalogRegionId ?? input.regionId;

  const serviceInfo = SERVICE_TYPE_MAP[input.serviceCode];
  if (!serviceInfo) {
    throw new Error(`No service mapping for ${input.serviceCode}`);
  }

  const resourceSpecCode = input.resourceSpecCode ?? serviceInfo.defaultSpec ?? "";

  const productInfo = {
    id: `${Date.now()}-0-${input.productId}`,
    cloudServiceType: serviceInfo.cloudServiceType,
    resourceType: serviceInfo.resourceType,
    resourceSpecCode,
    productNum: input.productNum ?? 1,
    resourceSize: input.resourceSize ?? 1,
    resouceSizeMeasureId: serviceInfo.measureId ?? 17,
    usageFactor: "Duration",
    usageMeasureId: 4,
    usageValue: input.usageValue,
  };

  const payload = {
    regionId: catalogRegionId,
    chargingMode: 1,
    periodType: 4,
    periodNum: 1,
    subscriptionNum: 1,
    siteCode: "HWC",
    productInfos: [productInfo],
  };

  const url = `${INQUIRY_API_URL}?servieName=${input.serviceCode.toLowerCase()}`;

  const response = await sendHttpRequest({
    method: "POST",
    url,
    headers: INQUIRY_HEADERS,
    body: JSON.stringify(payload),
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    const errorBody = response.bodyText.slice(0, 500);
    throw new Error(`Inquiry API failed: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(response.bodyText);
  } catch {
    throw new Error("Inquiry API response is not valid JSON");
  }

  const data = json as Record<string, unknown>;
  if (data.exceptionId) {
    const descArgs = Array.isArray(data.descArgs) ? data.descArgs[0] : null;
    const reasonArgs = Array.isArray(data.reasonArgs) ? data.reasonArgs[0] : null;
    throw new Error(`Inquiry API error: ${data.exceptionId} - ${descArgs ?? reasonArgs ?? "Unknown error"}`);
  }

  const result: InquiryPricingResult = {
    amount: Number(data.amount) || 0,
    currency: String(data.currency) || "USD",
    measureId: Number(data.measureId) || 1,
    productId: input.productId,
  };

  inquiryCache.set(cacheKey, { expiresAt: Date.now() + INQUIRY_CACHE_TTL_MS, data: result });
  return result;
}

export function clearInquiryCache(): void {
  inquiryCache.clear();
}

export function getServiceTypeInfo(serviceCode: string): { cloudServiceType: string; resourceType: string } | undefined {
  return SERVICE_TYPE_MAP[serviceCode];
}