export const huaweiRegions = {
  "la-sao-paulo1": {
    short: "LA-Sao Paulo1",
    full: "Sao Paulo, Brazil (1)",
    catalogRegionId: "sa-brazil-1",
  },
  "la-santiago": {
    short: "LA-Santiago",
    full: "Santiago, Chile",
    catalogRegionId: "la-south-2",
  },
  "cn-hong-kong": {
    short: "CN-Hong Kong",
    full: "Hong Kong, China",
    catalogRegionId: "ap-southeast-1",
  },
  "ap-bangkok": {
    short: "AP-Bangkok",
    full: "Bangkok, Thailand",
    catalogRegionId: "ap-southeast-2",
  },
  "ap-singapore": {
    short: "AP-Singapore",
    full: "Singapore",
    catalogRegionId: "ap-southeast-3",
  },
  "ap-jakarta": {
    short: "AP-Jakarta",
    full: "Jakarta, Indonesia",
    catalogRegionId: "ap-southeast-4",
  },
  "ap-manila": {
    short: "AP-Manila",
    full: "Manila, Philippines",
    catalogRegionId: "ap-southeast-5",
  },
  "ap-kuala-lumpur-op6": {
    short: "AP-Kuala Lumpur-OP6",
    full: "Kuala Lumpur, Malaysia (OP6)",
    catalogRegionId: "my-kualalumpur-1",
  },
  "cn-north-beijing4": {
    short: "CN North-Beijing4",
    full: "Beijing, China (North-Beijing4)",
    catalogRegionId: "cn-north-4",
  },
  "cn-north3": {
    short: "CN North3",
    full: "China North 3",
    catalogRegionId: "cn-north-12",
  },
  "cn-east-shanghai1": {
    short: "CN East-Shanghai1",
    full: "Shanghai, China (East-Shanghai1)",
    catalogRegionId: "cn-east-3",
  },
  "cn-east-qingdao": {
    short: "CN East-Qingdao",
    full: "Qingdao, China",
    catalogRegionId: "cn-east-5",
  },
  "cn-east2": {
    short: "CN East2",
    full: "China East 2",
    catalogRegionId: "cn-east-4",
  },
  "cn-south-guangzhou": {
    short: "CN South-Guangzhou",
    full: "Guangzhou, China",
    catalogRegionId: "cn-south-1",
  },
  "cn-southwest-guiyang1": {
    short: "CN Southwest-Guiyang1",
    full: "Guiyang, China (Southwest-Guiyang1)",
    catalogRegionId: "cn-southwest-2",
  },
  "me-riyadh": {
    short: "ME-Riyadh",
    full: "Riyadh, Saudi Arabia",
    catalogRegionId: "me-east-1",
  },
  "af-johannesburg": {
    short: "AF-Johannesburg",
    full: "Johannesburg, South Africa",
    catalogRegionId: "af-south-1",
  },
  "af-cairo": {
    short: "AF-Cairo",
    full: "Cairo, Egypt",
    catalogRegionId: "af-north-1",
  },
  "eu-paris": {
    short: "EU-Paris",
    full: "Paris, France",
    catalogRegionId: "eu-west-0",
  },
  "eu-dublin": {
    short: "EU-Dublin",
    full: "Dublin, Ireland",
    catalogRegionId: "eu-west-101",
  },
  "tr-istanbul": {
    short: "TR-Istanbul",
    full: "Istanbul, Turkiye",
    catalogRegionId: "tr-west-1",
  },
  "tr-ankara-pur": {
    short: "TR-Ankara-PUR",
    full: "Ankara, Turkiye (PUR)",
    catalogRegionId: null,
  },
  "la-mexico-city1": {
    short: "LA-Mexico City1",
    full: "Mexico City, Mexico (1)",
    catalogRegionId: "na-mexico-1",
  },
  "la-mexico-city2": {
    short: "LA-Mexico City2",
    full: "Mexico City, Mexico (2)",
    catalogRegionId: "la-north-2",
  },
  "la-lima1": {
    short: "LA-Lima1",
    full: "Lima, Peru (1)",
    catalogRegionId: null,
  },
  "la-buenos-aires1": {
    short: "LA-Buenos Aires1",
    full: "Buenos Aires, Argentina (1)",
    catalogRegionId: null,
  },
} as const;

export type HuaweiRegionKey = keyof typeof huaweiRegions;

export function getCatalogRegionId(regionKey: HuaweiRegionKey): string | null {
  return huaweiRegions[regionKey].catalogRegionId;
}

