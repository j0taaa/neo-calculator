import type { HuaweiRegionKey } from "@/lib/huawei-regions";
import type { BillingOption } from "@/lib/calculator-page-helpers";

export type ActiveModalKind =
  | "project-add-cart"
  | "project-huawei"
  | "project-clone"
  | "project-share"
  | "list-link"
  | "list-clone"
  | "list-share";

export type DashboardTab = "calculator" | "batch-add";

export type DashboardUrlState = {
  serviceCode?: string;
  region?: HuaweiRegionKey;
  billingMode?: BillingOption;
  usageHours?: string;
  tab?: DashboardTab;
  projectId?: string;
  listId?: string;
  editProductId?: string;
  editProductListId?: string;
  modalKind?: ActiveModalKind;
  modalProjectId?: string;
  modalListId?: string;
  flavorQuery?: string;
  flavorPage?: number;
  flavorSort?: string;
  flavorPageSize?: number;
  selectedFlavor?: string;
  minVcpuValue?: string;
  minRamValue?: string;
  showFlexusLInEcs?: boolean;
};

const dashboardTabs = ["calculator", "batch-add"] as const;
const modalKinds = ["project-add-cart", "project-huawei", "project-clone", "project-share", "list-link", "list-clone", "list-share"] as const;

function isDashboardTab(value: unknown): value is DashboardTab {
  return typeof value === "string" && (dashboardTabs as readonly string[]).includes(value);
}

function isModalKind(value: unknown): value is ActiveModalKind {
  return typeof value === "string" && (modalKinds as readonly string[]).includes(value);
}

export function parseDashboardUrlState(search: string): DashboardUrlState {
  const params = new URLSearchParams(search);
  const parsedFlavorPage = Number(params.get("flavorPage"));
  const parsedFlavorPageSize = Number(params.get("flavorPageSize"));

  return {
    serviceCode: params.get("service") || undefined,
    region: (params.get("region") as HuaweiRegionKey | null) ?? undefined,
    billingMode: (params.get("billing") as BillingOption | null) ?? undefined,
    usageHours: params.get("hours") || undefined,
    tab: isDashboardTab(params.get("tab")) ? (params.get("tab") as DashboardTab) : undefined,
    projectId: params.get("project") || undefined,
    listId: params.get("list") || undefined,
    editProductId: params.get("editProduct") || undefined,
    editProductListId: params.get("editList") || undefined,
    modalKind: isModalKind(params.get("modal")) ? (params.get("modal") as ActiveModalKind) : undefined,
    modalProjectId: params.get("modalProject") || undefined,
    modalListId: params.get("modalList") || undefined,
    flavorQuery: params.get("flavorQuery") || undefined,
    flavorPage: Number.isFinite(parsedFlavorPage) && parsedFlavorPage > 0 ? Math.floor(parsedFlavorPage) : undefined,
    flavorSort: params.get("flavorSort") || undefined,
    flavorPageSize: Number.isFinite(parsedFlavorPageSize) && parsedFlavorPageSize > 0 ? Math.floor(parsedFlavorPageSize) : undefined,
    selectedFlavor: params.get("flavor") || undefined,
    minVcpuValue: params.get("minVcpu") || undefined,
    minRamValue: params.get("minRam") || undefined,
    showFlexusLInEcs: params.get("flexusL") === "1" ? true : params.get("flexusL") === "0" ? false : undefined,
  };
}
