// Shared calculator and cart data contracts. No UI or runtime dependencies.

export type BillingOption = "Pay-per-use" | "RI" | "Yearly/Monthly" | "One-time";
export type FlavorBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY" | "RI" | "ONETIME";
export type FlavorPriceSource = "catalog_plan" | "rate_inquiry";

export type CatalogFlavor = {
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

export type FlavorCard = {
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
  riPrice: string | null;
  description: string | null;
  productType: "ecs" | "flexus-l";
  serviceCode: string;
  serviceName: string;
  referencePlanId?: string;
  includedSystemDiskGiB?: number;
  peakBandwidthMbit?: number;
  dataPackageTiB?: number;
};

export type DiskPricing<SystemDiskOption extends string> = {
  currency: string;
  prices: Record<SystemDiskOption, Partial<Record<FlavorBillingMode, number>>>;
};

export type AppList = {
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

export type AppProduct = ProductMutationBody & {
  id: string;
  createdAt?: string;
  updatedAt: string;
};

export type AppProject = {
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

export type HuaweiCartSummary = {
  key: string;
  name: string;
  updateTime: number;
  billingMode: string | null;
  totalAmount: number | null;
  originalAmount: number | null;
  associatedListId: string | null;
};

export type ProductMutationBody = {
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
};
