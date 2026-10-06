"use client";

import { useHuaweiDirectory } from "@/lib/calculator/use-huawei-directory";
import { useNativeBatch } from "@/lib/calculator/use-native-batch";
import { calculatorServices, huaweiServiceId, nativeRegion, legacyRegion, nativeMode, type CalculatorScope } from "@/lib/calculator/service-directory";
import { parseNativeSelection, selectionBillingMode } from "@/lib/huawei-native/native-selection";
import { nativeBillingModes } from "@/lib/huawei-native/native-billing";
import { isHuaweiCalculatorProduct } from "@/lib/huawei-native/legacy-product";

import { applyProductMutation, saveCalculatorProducts } from "@/lib/calculator-cart";
import { useNavbar } from "@/components/navbar-context";
import { useSessionContext } from "@/components/session-provider";
import { getResponseError } from "@/lib/calculator-page-helpers";
import type { AppProduct, ProductMutationBody } from "@/lib/calculator-types";
import { useCalculatorShortcuts } from "@/lib/dashboard/use-calculator-shortcuts";
import { useCartContents } from "@/lib/dashboard/use-cart-contents";
import { useDashboardKeyboard } from "@/lib/dashboard/use-dashboard-keyboard";
import { useDashboardUrl } from "@/lib/dashboard/use-dashboard-url";
import { useHuaweiCarts } from "@/lib/dashboard/use-huawei-carts";
import { useProjectActions } from "@/lib/dashboard/use-project-actions";
import { useProjectStore } from "@/lib/dashboard/use-project-store";
import { useResourceCloning } from "@/lib/dashboard/use-resource-cloning";
import { useResourceSharing } from "@/lib/dashboard/use-resource-sharing";
import { useResourceTransfer } from "@/lib/dashboard/use-resource-transfer";
import { type HuaweiRegionKey } from "@/lib/huawei-regions";
import { type ActiveModal, type BillingOption } from "@/lib/page-utils";
import { getConfigurableServiceBundleByCode, serviceCatalog } from "@/lib/service-config";
import { useCalculatorController } from "@/lib/use-calculator-controller";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function useDashboard() {
  const { session, isPending: isSessionPending } = useSessionContext();

  const { setConfig } = useNavbar();

  const hasMounted = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);

  const showSessionState = hasMounted && !isSessionPending;

  const isSignedIn = showSessionState && Boolean(session);

  const [query, setQuery] = useState("");

  const [selectedService, setSelectedService] = useState("Elastic Cloud Server");

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  const [regionValue, setRegionValue] = useState<HuaweiRegionKey>("la-sao-paulo1");

  const [billingMode, setBillingMode] = useState<BillingOption>("Pay-per-use");

  const [usageHours, setUsageHours] = useState("744");

  const projectStore = useProjectStore({ session });

  const huawei = useHuaweiCarts({
    session,
    selectedList: projectStore.selectedList,
    selectedListId: projectStore.selectedListId,
    setProjects: projectStore.setProjects,
  });

  const transfer = useResourceTransfer({
    session,
    setProjectsError: projectStore.setProjectsError,
    reloadProjectsSnapshot: projectStore.reloadProjectsSnapshot,
  });

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [editingProductListId, setEditingProductListId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("calculator");

  const cloning = useResourceCloning({
    selectedList: projectStore.selectedList,
    selectedListId: projectStore.selectedListId,
    selectedProject: projectStore.selectedProject,
    setProjects: projectStore.setProjects,
    setSelectedListId: projectStore.setSelectedListId,
    setExpandedProjects: projectStore.setExpandedProjects,
  });

  const sharing = useResourceSharing();

  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);

  const [isProjectCreateMenuOpen, setIsProjectCreateMenuOpen] = useState(false);

  const [isCartMenuOpen, setIsCartMenuOpen] = useState(false);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const searchAreaRef = useRef<HTMLDivElement>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const profileAreaRef = useRef<HTMLDivElement>(null);

  const listboxId = `${useId()}-services`;

  const [nativeEditingProduct, setNativeEditingProduct] = useState<AppProduct | null>(null);
  const { directory, error: directoryError, retry: retryDirectory } = useHuaweiDirectory();
  const services = useMemo(() => {
    const result = calculatorServices(serviceCatalog, directory);
    if (selectedService.startsWith("HUAWEI:") && !result.some(service => service.code === selectedService))
      result.push({ name: selectedService, code: selectedService, icon: "/globe.svg", huaweiId: huaweiServiceId(selectedService) });
    if (nativeEditingProduct && !result.some(service => service.name === nativeEditingProduct.serviceName || service.huaweiId === huaweiServiceId(nativeEditingProduct.serviceCode))) {
      result.push({ name: nativeEditingProduct.serviceName, code: nativeEditingProduct.serviceCode, icon: "/globe.svg", huaweiId: huaweiServiceId(nativeEditingProduct.serviceCode) });
    }
    return result;
  }, [directory, nativeEditingProduct, selectedService]);
  const normalizedQuery = query.trim().toLowerCase();

  const suggestions = normalizedQuery
    ? services
        .filter(
          (service) =>
            service.name.toLowerCase().includes(normalizedQuery) ||
            service.code.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 8)
    : services.filter(service => ["ECS", "EVS", "OBS", "ELB", "DCS", "NAT", "Flexus L", "VPC"].includes(service.code)).slice(0, 8);

  const selectedServiceMeta = useMemo(
    () => services.find((service) => service.name === selectedService) ?? services[0],
    [selectedService, services],
  );

  const selectedServiceCode = selectedServiceMeta.code;

  const selectedServiceBundle = getConfigurableServiceBundleByCode(selectedServiceCode);

  const selectedServiceDefinition = selectedServiceBundle?.service ?? null;

  const selectedServiceDefinitionStatus = selectedServiceBundle?.metadata.status ?? null;

  const hasSuggestions = isSearchOpen && suggestions.length > 0;

  const activeDescendant = hasSuggestions ? `${listboxId}-${activeSuggestionIndex}` : undefined;

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

  const legacyEditing = !!editingProductId && !nativeEditingProduct;
  const useNative = !legacyEditing && (!!selectedServiceMeta.huaweiId || !!nativeEditingProduct);
  const nativeScope: CalculatorScope = {
    service: selectedServiceMeta.huaweiId ?? huaweiServiceId(selectedServiceMeta.code),
    region: nativeRegion(regionValue), billingMode: nativeMode(billingMode),
  };
  const setNativeScope = (scope: CalculatorScope) => {
    const meta = services.find(service => service.huaweiId === scope.service);
    if (meta) { setSelectedService(meta.name); setQuery(meta.name); }
    setRegionValue((legacyRegion(scope.region) ?? scope.region) as HuaweiRegionKey);
    setBillingMode(nativeBillingModes[scope.billingMode].label);
  };
  const compatibilityBilling = useCallback((value: BillingOption) => { if (!useNative) setBillingMode(value); }, [useNative]);
  const legacyController = useCalculatorController({
    enabled: legacyEditing || (!!directory && (!useNative || (activeTab === "batch-add" && !!legacyRegion(regionValue)))),
    selectedService,
    selectedServiceMeta,
    regionValue: (legacyRegion(regionValue) ?? "la-sao-paulo1") as HuaweiRegionKey,
    setRegionValue,
    billingMode,
    setBillingMode: compatibilityBilling,
    usageHours,
    setUsageHours,
    selectedListId: projectStore.selectedListId,
    setSelectedListId: projectStore.setSelectedListId,
    editingProductId,
    setEditingProductId,
    editingProductListId,
    setEditingProductListId,
    activeTab,
    setActiveTab,
    session,
    isSignedIn,
    setProjects: projectStore.setProjects,
    setSelectedService,
    setQuery,
    mutateListProduct,
  });

  const calculatorController = {
    ...legacyController,
    handleEditProduct: (product: AppProduct, listId = projectStore.selectedListId) => {
      if (!isHuaweiCalculatorProduct(product)) {
        setNativeEditingProduct(null);
        legacyController.handleEditProduct(product, listId);
        return;
      }
      const serviceId = product.serviceCode.startsWith("HWC:") ? product.serviceCode.slice(4) :
        product.serviceCode.startsWith("HUAWEI:") ? product.serviceCode.slice(7) : huaweiServiceId(product.serviceCode);
      const meta = services.find(service => (service.huaweiId ?? huaweiServiceId(service.code)) === serviceId);
      setSelectedService(meta?.name ?? product.serviceName);
      setQuery(meta?.name ?? product.serviceName);
      try {
        const selection = parseNativeSelection((product.config as { selection?: unknown } | null)?.selection);
        setRegionValue((legacyRegion(selection.region) ?? selection.region) as HuaweiRegionKey);
        setBillingMode(nativeBillingModes[selectionBillingMode(selection)].label);
      } catch { /* The native panel presents preserved legacy or invalid selections for recovery. */ }
      setNativeEditingProduct(product);
      setEditingProductId(product.id);
      setEditingProductListId(listId);
      projectStore.setSelectedListId(listId);
      setActiveTab("calculator");
    },
    handleCancelEdit: () => {
      setNativeEditingProduct(null);
      legacyController.handleCancelEdit();
    },
  };
  const saveNativeProduct = async (product: ProductMutationBody, editing = true) => {
    if (!isSignedIn) throw new Error("Sign in to save carts and projects.");
    if (!projectStore.selectedListId) throw new Error("Create or select a cart first.");
    await saveCalculatorProducts(
      { buildRequestBodies: () => product },
      {
        listId: projectStore.selectedListId,
        editing:
          editing && nativeEditingProduct && editingProductId && editingProductListId
            ? { productId: editingProductId, listId: editingProductListId }
            : undefined,
      },
      {
        mutate: mutateListProduct,
        onSaved: (saved, method) => projectStore.setProjects((current) => applyProductMutation(current, saved, method)),
      },
    );
  };

  const nativeBatch = useNativeBatch(product => saveNativeProduct(product, false));

  useCalculatorShortcuts({ activeTab });

  const projectActions = useProjectActions({
    session,
    setProjectsError: projectStore.setProjectsError,
    setProjects: projectStore.setProjects,
    setExpandedProjects: projectStore.setExpandedProjects,
    cookieValue: huawei.cookieValue,
    setSelectedListId: projectStore.setSelectedListId,
    setActiveModal,
    setHuaweiActionMessage: huawei.setHuaweiActionMessage,
    loadHuaweiCarts: huawei.loadHuaweiCarts,
    setProjectCloneNameDrafts: cloning.setProjectCloneNameDrafts,
    setProjectCloneTargetRegions: cloning.setProjectCloneTargetRegions,
    setProjectCloneTargetBillingModes: cloning.setProjectCloneTargetBillingModes,
    setProjectCloneMessages: cloning.setProjectCloneMessages,
    setProjectCloneMessageErrors: cloning.setProjectCloneMessageErrors,
    editingProductListId,
    handleCancelEdit: calculatorController.handleCancelEdit,
  });

  const cart = useCartContents({
    selectedList: projectStore.selectedList,
    selectedListId: projectStore.selectedListId,
    setAddToListMessage: calculatorController.setAddToListMessage,
    setProjects: projectStore.setProjects,
    editingProductId,
    handleCancelEdit: calculatorController.handleCancelEdit,
    isSignedIn,
    mutateListProduct,
  });

  const locationState = useDashboardUrl({
    services,
    directoryReady: !!directory || !!directoryError,
    setUsageHours,
    setSelectedService,
    setQuery,
    setRegionValue,
    setBillingMode,
    setActiveTab,
    applyServiceUrlState: calculatorController.applyServiceUrlState,
    ready: !isSessionPending && projectStore.projectsReady,
    projects: projectStore.projects,
    setSelectedListId: projectStore.setSelectedListId,
    handleEditProduct: calculatorController.handleEditProduct,
    handleCancelEdit: calculatorController.handleCancelEdit,
    projectsById: projectStore.projectsById,
    setActiveModal,
    listsById: projectStore.listsById,
    selectedServiceCode,
    regionValue,
    billingMode,
    usageHours,
    activeTab,
    writeServiceUrlState: calculatorController.writeServiceUrlState,
    selectedProject: projectStore.selectedProject,
    selectedListId: projectStore.selectedListId,
    editingProductId,
    editingProductListId,
    activeModal,
  });

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!openProjectMenuId && !isCartMenuOpen && !isProjectCreateMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-action-menu-root]")) {
        return;
      }

      setOpenProjectMenuId(null);
      setIsProjectCreateMenuOpen(false);
      setIsCartMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isCartMenuOpen, isProjectCreateMenuOpen, openProjectMenuId]);

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

  if (
    activeModal &&
    (("projectId" in activeModal && !projectStore.projectsById.has(activeModal.projectId)) ||
      ("listId" in activeModal && !projectStore.listsById.has(activeModal.listId)))
  )
    setActiveModal(null);

  const handleSelectService = (service: string) => {
    calculatorController.handleCancelEdit();
    setActiveTab("calculator");
    setSelectedService(service);
    setQuery(service);
    setIsSearchOpen(false);
    setActiveSuggestionIndex(0);
    const serviceMeta = services.find((entry) => entry.name === service);
    if (serviceMeta) {
      calculatorController.resetForServiceCode(serviceMeta.code);
    }
  };

  useEffect(() => {
    setConfig({
      searchQuery: query,
      onSearchClick: () => { setQuery(""); setActiveSuggestionIndex(0); setIsSearchOpen(true); },
      cookieValue: huawei.cookieValue,
      cookieValueSaved: huawei.cookieValue,
      onCookieChange: huawei.setCookieDraft,
      onSaveCookie: huawei.handleSaveCookie,
      huaweiCartsLoading: huawei.huaweiCartsLoading,
      loadHuaweiCarts: huawei.loadHuaweiCarts,
      showHuaweiCarts: true,
    });
  }, [
    query,
    huawei.cookieValue,
    huawei.huaweiCartsLoading,
    huawei.loadHuaweiCarts,
    setConfig,
    huawei.handleSaveCookie,
    huawei.setCookieDraft,
  ]);

  const openActionModal = (modal: Exclude<ActiveModal, null>) => {
    setOpenProjectMenuId(null);
    setIsCartMenuOpen(false);
    setActiveModal(modal);
  };

  useDashboardKeyboard({
    searchAreaRef,
    setIsSearchOpen,
    profileAreaRef,
    cartFilterAreaRef: cart.cartFilterAreaRef,
    setIsCartFiltersOpen: cart.setIsCartFiltersOpen,
    searchInputRef,
    selectedList: projectStore.selectedList,
    filteredCartProducts: cart.filteredCartProducts,
    selectAllVisibleCartItems: cart.selectAllVisibleCartItems,
    selectedCartItems: cart.selectedCartItems,
    setCartCopyNotice: cart.setCartCopyNotice,
    handleCutSelectedCartItems: cart.handleCutSelectedCartItems,
    selectedCartItemCount: cart.selectedCartItemCount,
    clearCartItemSelection: cart.clearCartItemSelection,
    isSignedIn,
    selectedListId: projectStore.selectedListId,
    handlePasteCartItemsFromText: cart.handlePasteCartItemsFromText,
  });

  return {
    cartCopyNotice: cart.cartCopyNotice,
    serviceSearch: {
      isSearchOpen,
      searchAreaRef,
      searchInputRef,
      query,
      setIsSearchOpen,
      setQuery,
      setActiveSuggestionIndex,
      suggestions,
      activeSuggestionIndex,
      handleSelectService,
      listboxId,
      hasSuggestions,
      activeDescendant,
      normalizedQuery,
    },
    projects: {
      huawei,
      projectStore,
      projectActions,
      transfer,
      cloning,
      sharing,
      isSignedIn,
      isProjectCreateMenuOpen,
      setIsProjectCreateMenuOpen,
      openActionModal,
      openProjectMenuId,
      setOpenProjectMenuId,
    },
    calculator: {
      services, directory, directoryError, retryDirectory, nativeScope, setNativeScope, useNative, nativeBatch,
      openServiceSearch: () => { setQuery(""); setActiveSuggestionIndex(0); setIsSearchOpen(true); },
      nativeEditingProduct,
      saveNativeProduct,
      calculatorController,
      projectStore,
      locationState,
      activeTab,
      setActiveTab,
      selectedServiceMeta,
      selectedService,
      selectedServiceDefinition,
      selectedServiceDefinitionStatus,
      editingProductId,
      isSignedIn,
      regionValue,
      setRegionValue,
      billingMode,
      setBillingMode,
      usageHours,
      setUsageHours,
    },
    cart: {
      projectStore,
      huawei,
      cloning,
      sharing,
      cart,
      calculatorController,
      transfer,
      projectActions,
      openActionModal,
      isCartMenuOpen,
      setIsCartMenuOpen,
      editingProductId,
      isSignedIn,
    },
    imports: { transfer },
    exportDialog: { transfer },
    actionDialog: {
      projectActions,
      huawei,
      cloning,
      sharing,
      projectStore,
      activeModal,
      setActiveModal,
    },
  };
}

export type DashboardModel = ReturnType<typeof useDashboard>;
