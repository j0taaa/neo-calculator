import { type ComponentProps, type Dispatch, type SetStateAction } from "react";

import type { CalculatorPanelRouter } from "@/components/calculators/calculator-panel-router";
import { ServiceBatchAddPanel } from "@/components/calculators/service-batch-add-panel";
import { type MutateListProduct } from "@/lib/calculator-cart";
import { splitPriceDisplay } from "@/lib/calculator-page-helpers";
import type {
  AppProduct,
  AppProject,
  BillingOption,
} from "@/lib/calculator-types";
import type { DashboardUrlState } from "@/lib/dashboard-url-state";
import { type HuaweiRegionKey } from "@/lib/huawei-regions";
import { type ServiceCatalogEntry } from "@/lib/service-config";

export type CalculatorControllerInput = {
  enabled?: boolean;
  selectedService: string;
  selectedServiceMeta: ServiceCatalogEntry;
  regionValue: HuaweiRegionKey;
  setRegionValue: (value: HuaweiRegionKey) => void;
  billingMode: BillingOption;
  setBillingMode: (value: BillingOption) => void;
  usageHours: string;
  setUsageHours: (value: string) => void;
  selectedListId: string;
  setSelectedListId: (value: string) => void;
  editingProductId: string | null;
  setEditingProductId: (value: string | null) => void;
  editingProductListId: string | null;
  setEditingProductListId: (value: string | null) => void;
  activeTab: string;
  setActiveTab: (value: string) => void;
  session: { user: { id: string } } | null;
  isSignedIn: boolean;
  setProjects: Dispatch<SetStateAction<AppProject[]>>;
  setSelectedService: (value: string) => void;
  setQuery: (value: string) => void;
  mutateListProduct: MutateListProduct;
};

export type CalculatorControllerResult = {
  isSelectedServiceImplemented: boolean;
  isSelectedServiceFree: boolean;
  isSelectedServiceBatchAddImplemented: boolean;
  showBillingHeader: boolean;
  calculatorBillingOptions: BillingOption[];
  showSharedUsageHours: boolean;
  selectedEstimate: string;
  selectedEstimateParts: ReturnType<typeof splitPriceDisplay>;
  quantityLabel: string;
  showGlobalQuantityControl: boolean;
  displayQuantityValue: number;
  instanceCount: string;
  updateInstanceCount: (value: string) => void;
  addToListPending: boolean;
  addToListMessage: string;
  setAddToListMessage: Dispatch<SetStateAction<string>>;
  batchInput: string;
  setBatchInput: Dispatch<SetStateAction<string>>;
  batchAddPending: boolean;
  batchAddMessage: string;
  calculatorPanelProps: ComponentProps<typeof CalculatorPanelRouter>;
  batchPanelProps: ComponentProps<typeof ServiceBatchAddPanel> | null;
  handleAddToList: () => Promise<void>;
  handleBatchAdd: () => Promise<void>;
  handleEditProduct: (product: AppProduct, sourceListId?: string) => void;
  handleCancelEdit: () => void;
  applyServiceUrlState: (state: DashboardUrlState) => void;
  writeServiceUrlState: (params: URLSearchParams) => void;
  resetForServiceCode: (serviceCode: string) => void;
};
