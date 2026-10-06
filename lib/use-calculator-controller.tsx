import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addCalculatorBatch,
  applyProductMutation,
  saveCalculatorProducts,
  type ProductMutationMethod,
  type SavedCartProduct,
} from "@/lib/calculator-cart";
import { splitPriceDisplay } from "@/lib/calculator-page-helpers";
import type { AppProduct } from "@/lib/calculator-types";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import {
  freeAlwaysServiceCodes,
  getConfigurableServiceBundleByCode,
  supportedBatchAddServiceCodes,
  supportedCalculatorServiceCodes,
  type ServiceDefinition,
} from "@/lib/service-config";
import { useConfigurableServiceRuntime } from "@/lib/use-configurable-service-runtime";

import type {
  CalculatorControllerInput,
  CalculatorControllerResult,
} from "@/lib/calculator/controller-types";
import { useCustomCalculator } from "@/lib/calculator/use-custom-calculator";
export type {
  CalculatorControllerInput,
  CalculatorControllerResult,
} from "@/lib/calculator/controller-types";

function normalizeUsageHours(
  nextValue: string,
  setUsageHours: (value: string) => void,
) {
  if (nextValue === "") {
    setUsageHours("");
    return;
  }

  const parsed = Number(nextValue);
  if (Number.isNaN(parsed)) {
    return;
  }

  setUsageHours(String(Math.min(87600, Math.max(1, parsed))));
}

export function useCalculatorController({
  enabled = true,
  selectedService,
  selectedServiceMeta,
  regionValue,
  setRegionValue,
  billingMode,
  setBillingMode,
  usageHours,
  setUsageHours,
  selectedListId,
  setSelectedListId,
  editingProductId,
  setEditingProductId,
  editingProductListId,
  setEditingProductListId,
  setActiveTab,
  session,
  isSignedIn,
  setProjects,
  setSelectedService,
  setQuery,
  mutateListProduct,
}: CalculatorControllerInput): CalculatorControllerResult {
  const selectedServiceCode = selectedServiceMeta.code;
  const selectedServiceBundle =
    getConfigurableServiceBundleByCode(selectedServiceCode);
  const selectedServiceDefinition: ServiceDefinition | null =
    selectedServiceBundle?.service ?? null;
  const isSelectedServiceImplemented =
    supportedCalculatorServiceCodes.includes(selectedServiceCode);
  const isSelectedServiceFree =
    freeAlwaysServiceCodes.includes(selectedServiceCode);
  const isSelectedServiceBatchAddImplemented =
    supportedBatchAddServiceCodes.includes(selectedServiceCode);

  const [instanceCount, setInstanceCount] = useState("1");
  const [addToListPending, setAddToListPending] = useState(false);
  const [addToListMessage, setAddToListMessage] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [batchAddPending, setBatchAddPending] = useState(false);
  const [batchAddMessage, setBatchAddMessage] = useState("");

  const usageHoursValue = Number.isFinite(Number(usageHours))
    ? Math.max(1, Number(usageHours))
    : 744;
  const instanceCountValue = Number.isFinite(Number(instanceCount))
    ? Math.max(1, Number(instanceCount))
    : 1;
  const configurableRuntime = useConfigurableServiceRuntime({
    enabled,
    selectedServiceCode,
    selectedService,
    selectedServiceDefinition,
    regionValue,
    billingMode,
    setBillingMode,
    usageHours,
    usageHoursValue,
    updateUsageHours: (value) => normalizeUsageHours(value, setUsageHours),
    instanceCountValue,
  });

  const customRuntime = useCustomCalculator({
    enabled,
    selectedService,
    selectedServiceCode,
    regionValue,
    billingMode,
    usageHoursValue,
    instanceCountValue,
  });
  const { isCustomService, applyServiceUrlState, writeServiceUrlState } =
    customRuntime;
  const selectedEstimate = isCustomService
    ? customRuntime.estimate.selectedEstimate
    : configurableRuntime.selectedEstimate;
  const quantityLabel = isCustomService
    ? customRuntime.estimate.quantityLabel
    : configurableRuntime.quantityLabel;
  const showGlobalQuantityControl = isCustomService
    ? customRuntime.estimate.showGlobalQuantityControl
    : configurableRuntime.showGlobalQuantityControl;
  const selectedEstimateParts = splitPriceDisplay(selectedEstimate);
  const displayQuantityValue = showGlobalQuantityControl
    ? instanceCountValue
    : 1;
  const calculatorBillingOptions =
    configurableRuntime.activeBillingOptions ?? customRuntime.billingOptions;
  useEffect(() => {
    if (enabled && !calculatorBillingOptions.includes(billingMode))
      setBillingMode(calculatorBillingOptions[0]);
  }, [enabled, billingMode, calculatorBillingOptions, setBillingMode]);

  const updateInstanceCount = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setInstanceCount("");
      return;
    }
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      return;
    }
    setInstanceCount(String(Math.min(999, Math.max(1, parsed))));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingProductId(null);
    setEditingProductListId(null);
    setAddToListMessage("");
  }, [setEditingProductId, setEditingProductListId]);

  const handleEditProduct = useCallback(
    (product: AppProduct, sourceListId = selectedListId) => {
      const customHydrated = customRuntime.hydrateProduct(product);
      const hydrated = customHydrated.handled
        ? customHydrated
        : configurableRuntime.hydrateProduct(product);
      if (!hydrated.handled) {
        setAddToListMessage(
          hydrated.error ??
            "This product cannot be edited from the calculator.",
        );
        return;
      }

      setSelectedService(product.serviceName);
      setQuery(product.serviceName);
      if (hydrated.nextRegion) {
        setRegionValue(hydrated.nextRegion);
      }
      if (hydrated.nextBillingMode) {
        setBillingMode(hydrated.nextBillingMode);
      }
      if (hydrated.nextUsageHours) {
        setUsageHours(hydrated.nextUsageHours);
      }
      if (hydrated.nextInstanceCount) {
        setInstanceCount(hydrated.nextInstanceCount);
      }
      setEditingProductId(product.id);
      setSelectedListId(sourceListId);
      setEditingProductListId(sourceListId);
      setActiveTab("calculator");
      setAddToListMessage("Editing item. Save changes when ready.");
    },
    [
      customRuntime,
      configurableRuntime,
      selectedListId,
      setSelectedService,
      setQuery,
      setRegionValue,
      setBillingMode,
      setUsageHours,
      setEditingProductId,
      setSelectedListId,
      setEditingProductListId,
      setActiveTab,
    ],
  );

  const addToListError = configurableRuntime.isConfigurableService
    ? configurableRuntime.addToListError
    : customRuntime.addToListError;
  const productSource = configurableRuntime.isConfigurableService
    ? configurableRuntime
    : customRuntime.productSource;
  const cartWriter = {
    mutate: mutateListProduct,
    onSaved: (product: SavedCartProduct, method: ProductMutationMethod) => {
      setProjects((current) => applyProductMutation(current, product, method));
    },
  };

  const handleAddToList = async () => {
    if (!session) {
      setAddToListMessage("Sign in to save carts and projects.");
      return;
    }
    if (!isSelectedServiceImplemented) {
      setAddToListMessage(
        `${selectedService} is not implemented in the calculator yet.`,
      );
      return;
    }
    if (!selectedListId) {
      setAddToListMessage("Create a list first.");
      return;
    }
    if (addToListError) {
      setAddToListMessage(addToListError);
      return;
    }

    setAddToListPending(true);
    setAddToListMessage("");

    try {
      setAddToListMessage(
        await saveCalculatorProducts(
          productSource,
          {
            listId: selectedListId,
            editing:
              editingProductId && editingProductListId
                ? { productId: editingProductId, listId: editingProductListId }
                : undefined,
          },
          cartWriter,
        ),
      );

      setEditingProductId(null);
      setEditingProductListId(null);
    } catch (error) {
      setAddToListMessage(
        error instanceof Error
          ? error.message
          : "Unable to add product to list",
      );
    } finally {
      setAddToListPending(false);
    }
  };

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
    if (customRuntime.batchError) {
      setBatchAddMessage(customRuntime.batchError);
      return;
    }
    setBatchAddPending(true);
    setBatchAddMessage("");
    try {
      setBatchAddMessage(
        await addCalculatorBatch(
          productSource,
          selectedListId,
          batchInput,
          cartWriter,
        ),
      );
    } catch (error) {
      setBatchAddMessage(
        error instanceof Error ? error.message : "Batch add failed.",
      );
    } finally {
      setBatchAddPending(false);
    }
  };

  const resetForServiceCode = useCallback(
    (serviceCode: string) => {
      const bundle = getConfigurableServiceBundleByCode(serviceCode);
      if (bundle) {
        configurableRuntime.applyDefaultsForServiceCode(serviceCode);
      }
    },
    [configurableRuntime],
  );

  const regionOptions = useMemo(
    () =>
      Object.entries(huaweiRegions).map(([value, labels]) => ({
        value,
        label: labels.full,
      })),
    [],
  );
  const sharedBatchProps = {
    regionValue,
    regionOptions,
    onRegionChange: (value: string) => setRegionValue(value as HuaweiRegionKey),
    batchInput,
    onBatchInputChange: setBatchInput,
    batchAddMessage,
    onSubmit: handleBatchAdd,
    submitDisabled: batchAddPending || !selectedListId || !isSignedIn,
    submitLabel: batchAddPending ? "Adding Batch..." : "Add Batch",
  };
  const batchPanelProps: CalculatorControllerResult["batchPanelProps"] =
    !isSelectedServiceBatchAddImplemented
      ? null
      : isCustomService
        ? { ...sharedBatchProps, ...customRuntime.batchPanel }
        : configurableRuntime.isConfigurableService &&
            configurableRuntime.batchPanel
          ? {
              ...sharedBatchProps,
              kind: "declarative",
              ...configurableRuntime.batchPanel,
            }
          : null;

  return {
    isSelectedServiceImplemented,
    isSelectedServiceFree,
    isSelectedServiceBatchAddImplemented,
    showBillingHeader: configurableRuntime.isConfigurableService
      ? configurableRuntime.usesSharedBillingHeader
      : true,
    calculatorBillingOptions,
    showSharedUsageHours: configurableRuntime.showSharedUsageHours,
    selectedEstimate,
    selectedEstimateParts,
    quantityLabel,
    showGlobalQuantityControl,
    displayQuantityValue,
    instanceCount,
    updateInstanceCount,
    addToListPending,
    addToListMessage,
    setAddToListMessage,
    batchInput,
    setBatchInput,
    batchAddPending,
    batchAddMessage,
    calculatorPanelProps: {
      panel: isCustomService
        ? customRuntime.panel
        : configurableRuntime.panelProps
          ? { kind: "configurable", props: configurableRuntime.panelProps }
          : null,
    },
    batchPanelProps,
    handleAddToList,
    handleBatchAdd,
    handleEditProduct,
    handleCancelEdit,
    applyServiceUrlState,
    writeServiceUrlState,
    resetForServiceCode,
  };
}
