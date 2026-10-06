import type { AppList, AppProduct, AppProject } from "@/lib/calculator-types";
import {
  parseDashboardUrlState,
  type DashboardUrlState,
} from "@/lib/dashboard-url-state";
import { type HuaweiRegionKey } from "@/lib/huawei-regions";
import {
  getServiceMeta,
  isBillingOption,
  type ActiveModal,
  type BillingOption,
} from "@/lib/page-utils";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  services: import("@/lib/calculator/service-directory").CalculatorService[];
  directoryReady: boolean;
  setUsageHours: Dispatch<SetStateAction<string>>;
  setSelectedService: Dispatch<SetStateAction<string>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setRegionValue: Dispatch<SetStateAction<HuaweiRegionKey>>;
  setBillingMode: Dispatch<SetStateAction<BillingOption>>;
  setActiveTab: Dispatch<SetStateAction<string>>;
  applyServiceUrlState: (state: DashboardUrlState) => void;
  ready: boolean;
  projects: AppProject[];
  setSelectedListId: Dispatch<SetStateAction<string>>;
  handleEditProduct: (
    product: AppProduct,
    sourceListId?: string | undefined,
  ) => void;
  handleCancelEdit: () => void;
  projectsById: Map<string, AppProject>;
  setActiveModal: Dispatch<SetStateAction<ActiveModal>>;
  listsById: Map<
    string,
    { readonly list: AppList; readonly project: AppProject }
  >;
  selectedServiceCode: string;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHours: string;
  activeTab: string;
  writeServiceUrlState: (params: URLSearchParams) => void;
  selectedProject: AppProject | null;
  selectedListId: string;
  editingProductId: string | null;
  editingProductListId: string | null;
  activeModal: ActiveModal;
};

export function useDashboardUrl({
  services, directoryReady,
  setUsageHours,
  setSelectedService,
  setQuery,
  setRegionValue,
  setBillingMode,
  setActiveTab,
  applyServiceUrlState,
  ready,
  projects,
  setSelectedListId,
  handleEditProduct,
  handleCancelEdit,
  projectsById,
  setActiveModal,
  listsById,
  selectedServiceCode,
  regionValue,
  billingMode,
  usageHours,
  activeTab,
  writeServiceUrlState,
  selectedProject,
  selectedListId,
  editingProductId,
  editingProductListId,
  activeModal,
}: Options) {
  const [initialized, setInitialized] = useState(false);
  const pendingUrlStateRef = useRef<DashboardUrlState | null>(null);

  const hasInitializedUrlStateRef = useRef(false);

  const isApplyingUrlStateRef = useRef(false);

  const [urlStateVersion, setUrlStateVersion] = useState(0);

  const queueUrlStateFromLocation = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    setInitialized(false);
    pendingUrlStateRef.current = parseDashboardUrlState(window.location.search);
    setUrlStateVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    queueUrlStateFromLocation();
  }, [queueUrlStateFromLocation]);

  useEffect(() => {
    const handlePopState = () => {
      queueUrlStateFromLocation();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [queueUrlStateFromLocation]);

  const updateUsageHours = useCallback(
    (nextValue: string) => {
      if (nextValue === "") {
        setUsageHours("");
        return;
      }

      const parsed = Number(nextValue);
      if (Number.isNaN(parsed)) return;
      const bounded = Math.min(87600, Math.max(1, parsed));
      setUsageHours(String(bounded));
    },
    [setUsageHours],
  );

  useEffect(() => {
    const pendingUrlState = pendingUrlStateRef.current;
    if (!pendingUrlState) {
      if (!hasInitializedUrlStateRef.current) {
        hasInitializedUrlStateRef.current = true;
      }
      return;
    }

    isApplyingUrlStateRef.current = true;

    try {
      if (pendingUrlState.serviceCode?.startsWith("HUAWEI:") && !directoryReady && !services.some(service => service.code === pendingUrlState.serviceCode)) return;
      if (pendingUrlState.serviceCode) {
        const serviceMeta = services.find(service => service.code === pendingUrlState.serviceCode) ?? getServiceMeta(pendingUrlState.serviceCode, pendingUrlState.serviceCode);
        if (serviceMeta) {
          setSelectedService(serviceMeta.name);
          setQuery(serviceMeta.name);
        } else if (pendingUrlState.serviceCode.startsWith("HUAWEI:")) {
          setSelectedService(pendingUrlState.serviceCode);
          setQuery(pendingUrlState.serviceCode);
        }
      }

      if (pendingUrlState.region && /^[a-z0-9-]{1,80}$/.test(pendingUrlState.region)) {
        setRegionValue(pendingUrlState.region);
      }

      if (
        pendingUrlState.billingMode &&
        isBillingOption(pendingUrlState.billingMode)
      ) {
        setBillingMode(pendingUrlState.billingMode);
      }

      if (pendingUrlState.usageHours) {
        updateUsageHours(pendingUrlState.usageHours);
      }

      if (pendingUrlState.tab) {
        setActiveTab(pendingUrlState.tab);
      }

      applyServiceUrlState(pendingUrlState);

      if (!ready) {
        return;
      }

      const preferredProject = pendingUrlState.projectId
        ? (projects.find(
            (project) => project.id === pendingUrlState.projectId,
          ) ?? null)
        : null;
      const preferredList = pendingUrlState.listId
        ? (projects
            .flatMap((project) => project.lists)
            .find((list) => list.id === pendingUrlState.listId) ?? null)
        : null;
      const resolvedListId =
        preferredList?.id ?? preferredProject?.lists[0]?.id ?? "";

      if (pendingUrlState.listId || pendingUrlState.projectId) {
        setSelectedListId(resolvedListId);
      }

      if (pendingUrlState.editProductId) {
        const targetListId =
          pendingUrlState.editProductListId ?? resolvedListId;
        const targetList = targetListId
          ? (projects
              .flatMap((project) => project.lists)
              .find((list) => list.id === targetListId) ?? null)
          : (projects.flatMap(project => project.lists)
              .find(list => list.products.some(product => product.id === pendingUrlState.editProductId)) ?? null);
        const targetProduct =
          targetList?.products.find(
            (product) => product.id === pendingUrlState.editProductId,
          ) ?? null;

        if (targetProduct && targetList) {
          handleEditProduct(targetProduct, targetList.id);
        } else {
          handleCancelEdit();
        }
      } else {
        handleCancelEdit();
      }

      if (pendingUrlState.modalKind) {
        if (
          pendingUrlState.modalKind === "project-huawei" ||
          pendingUrlState.modalKind === "project-clone" ||
          pendingUrlState.modalKind === "project-share"
        ) {
          const modalProjectId =
            pendingUrlState.modalProjectId ?? pendingUrlState.projectId;
          if (modalProjectId && projectsById.has(modalProjectId)) {
            setActiveModal({
              kind: pendingUrlState.modalKind,
              projectId: modalProjectId,
            });
          } else {
            setActiveModal(null);
          }
        } else {
          const modalListId =
            pendingUrlState.modalListId ?? pendingUrlState.listId;
          if (modalListId && listsById.has(modalListId)) {
            setActiveModal({
              kind: pendingUrlState.modalKind,
              listId: modalListId,
            });
          } else {
            setActiveModal(null);
          }
        }
      } else {
        setActiveModal(null);
      }

      pendingUrlStateRef.current = null;
      hasInitializedUrlStateRef.current = true;
      setInitialized(true);
    } finally {
      isApplyingUrlStateRef.current = false;
    }
  }, [
    services, directoryReady,
    applyServiceUrlState,
    handleCancelEdit,
    handleEditProduct,
    listsById,
    projects,
    projectsById,
    ready,
    setActiveModal,
    setActiveTab,
    setBillingMode,
    setQuery,
    setRegionValue,
    setSelectedListId,
    setSelectedService,
    updateUsageHours,
    urlStateVersion,
  ]);

  useEffect(() => {
    if (
      !hasInitializedUrlStateRef.current ||
      isApplyingUrlStateRef.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    const params = new URLSearchParams();
    params.set("service", selectedServiceCode);
    params.set("region", regionValue);
    params.set("billing", billingMode);
    params.set("hours", usageHours);
    params.set("tab", activeTab);
    writeServiceUrlState(params);
    if (selectedProject?.id) {
      params.set("project", selectedProject.id);
    }
    if (selectedListId) {
      params.set("list", selectedListId);
    }
    if (editingProductId) {
      params.set("editProduct", editingProductId);
    }
    if (editingProductListId) {
      params.set("editList", editingProductListId);
    }
    if (activeModal) {
      params.set("modal", activeModal.kind);
      if ("projectId" in activeModal) {
        params.set("modalProject", activeModal.projectId);
      } else {
        params.set("modalList", activeModal.listId);
      }
    }

    const currentUrl = new URL(window.location.href);
    const nextSearch = params.toString();
    if (currentUrl.searchParams.toString() === nextSearch) {
      return;
    }

    const nextUrl = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ""}${currentUrl.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [
    activeModal,
    activeTab,
    applyServiceUrlState,
    billingMode,
    editingProductId,
    editingProductListId,
    regionValue,
    selectedListId,
    selectedProject?.id,
    selectedServiceCode,
    usageHours,
    writeServiceUrlState,
  ]);
  return { updateUsageHours, initialized };
}
