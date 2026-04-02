"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { CalculatorPanelRouter } from "@/components/calculators/calculator-panel-router";
import { ActionMenu, ActionModal, type ActionMenuItem } from "@/components/home-page-shell-parts";
import { ServiceBatchAddPanel } from "@/components/calculators/service-batch-add-panel";
import { UnsupportedServicePanel } from "@/components/calculators/unsupported-service-panel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  findServiceCatalogEntry,
  getConfigurableServiceBundleByCode,
  serviceCatalog,
  supportedBatchAddServiceCodes,
  supportedCalculatorServiceCodes,
} from "@/lib/service-config";
import { useSessionContext } from "@/components/session-provider";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import {
  buildListExportPayload,
  buildNamedExportFilename,
  buildProjectExportPayload,
  downloadProjectWorkbookFile,
  downloadTextFile,
} from "@/lib/resource-export";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronDown, ChevronRight, Copy, Download, Link2, Pencil, RefreshCw, Search, Share2, Trash2, Upload, UserCircle2, X } from "lucide-react";
import {
  copyText,
  getCartCloneDefaultName,
  getFirstListId,
  getProjectCloneDefaultName,
  getResponseError,
  parseJsonFile,
  splitProductPriceSummary,
  type AppList,
  type AppProduct,
  type AppProject,
  type BillingOption as PageBillingOption,
  type HuaweiCartSummary,
  type ProductMutationBody,
} from "@/lib/calculator-page-helpers";
import { getProductConfigSummary } from "@/lib/product-config-summary";
import { parseDashboardUrlState, type ActiveModalKind, type DashboardUrlState } from "@/lib/dashboard-url-state";
import { useCalculatorController } from "@/lib/use-calculator-controller";

const services = serviceCatalog;
const options = {
  billing: ["Pay-per-use", "RI", "Yearly/Monthly", "One-time"],
} as const;

type BillingOption = PageBillingOption;

type ActiveModal =
  | { kind: ActiveModalKind; projectId: string }
  | { kind: ActiveModalKind; listId: string }
  | null;

type ResourceExportModalState = {
  title: string;
  description: string;
  json: string;
  filename: string;
} | null;

function getServiceMeta(serviceCode: string, serviceName: string) {
  return findServiceCatalogEntry(serviceCode, serviceName);
}

function isBillingOption(value: unknown): value is BillingOption {
  return value === "Pay-per-use" || value === "RI" || value === "Yearly/Monthly" || value === "One-time";
}

function OptionGrid({
  items,
  value,
  onChange,
}: {
  items: BillingOption[];
  value: BillingOption;
  onChange: (value: BillingOption) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <Button
          key={item}
          type="button"
          variant={item === value ? "default" : "secondary"}
          className="justify-start rounded-md"
          aria-pressed={item === value}
          onClick={() => onChange(item)}
        >
          {item}
        </Button>
      ))}
    </div>
  );
}

export default function Home() {
  const { session, isPending: isSessionPending } = useSessionContext();
  const [hasMounted, setHasMounted] = useState(false);
  const showSessionState = hasMounted && !isSessionPending;
  const isSignedIn = showSessionState && Boolean(session);

  const [query, setQuery] = useState("");
  const [selectedService, setSelectedService] = useState("Elastic Cloud Server");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [cookieValue, setCookieValue] = useState("");
  const [cookieDraft, setCookieDraft] = useState("");
  const [regionValue, setRegionValue] = useState<HuaweiRegionKey>("la-sao-paulo1");
  const [billingMode, setBillingMode] = useState<BillingOption>("Pay-per-use");
  const [usageHours, setUsageHours] = useState("744");
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPending, setNewProjectPending] = useState(false);
  const [importProjectPending, setImportProjectPending] = useState(false);
  const [importProjectMessage, setImportProjectMessage] = useState("");
  const [importProjectMessageIsError, setImportProjectMessageIsError] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectNameDrafts, setProjectNameDrafts] = useState<Record<string, string>>({});
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [listBaseDrafts, setListBaseDrafts] = useState<Record<string, string>>({});
  const [listPendingProjectId, setListPendingProjectId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedHuaweiCartKey, setSelectedHuaweiCartKey] = useState("");
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductListId, setEditingProductListId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("calculator");
  const [resourceExportModal, setResourceExportModal] = useState<ResourceExportModalState>(null);
  const [resourceExportActionMessage, setResourceExportActionMessage] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [huaweiCarts, setHuaweiCarts] = useState<HuaweiCartSummary[]>([]);
  const [huaweiCartsLoading, setHuaweiCartsLoading] = useState(false);
  const [huaweiCartsError, setHuaweiCartsError] = useState("");
  const [huaweiCartsSyncedAt, setHuaweiCartsSyncedAt] = useState<string | null>(null);
  const [linkingHuaweiListId, setLinkingHuaweiListId] = useState<string | null>(null);
  const [syncingHuaweiListId, setSyncingHuaweiListId] = useState<string | null>(null);
  const [huaweiActionMessage, setHuaweiActionMessage] = useState("");
  const [cloneNameDraft, setCloneNameDraft] = useState("");
  const [cloneTargetRegion, setCloneTargetRegion] = useState<HuaweiRegionKey | "">("");
  const [cloneTargetBillingMode, setCloneTargetBillingMode] = useState<BillingOption | "">("");
  const [cloningListId, setCloningListId] = useState<string | null>(null);
  const [cloneActionMessage, setCloneActionMessage] = useState("");
  const [cloneActionIsError, setCloneActionIsError] = useState(false);
  const [projectCloneNameDrafts, setProjectCloneNameDrafts] = useState<Record<string, string>>({});
  const [projectCloneTargetRegions, setProjectCloneTargetRegions] = useState<Record<string, HuaweiRegionKey | "">>({});
  const [projectCloneTargetBillingModes, setProjectCloneTargetBillingModes] = useState<Record<string, BillingOption | "">>({});
  const [cloningProjectId, setCloningProjectId] = useState<string | null>(null);
  const [projectCloneMessages, setProjectCloneMessages] = useState<Record<string, string>>({});
  const [projectCloneMessageErrors, setProjectCloneMessageErrors] = useState<Record<string, boolean>>({});
  const [syncingHuaweiProjectId, setSyncingHuaweiProjectId] = useState<string | null>(null);
  const [projectHuaweiMessages, setProjectHuaweiMessages] = useState<Record<string, string>>({});
  const [projectHuaweiMessageErrors, setProjectHuaweiMessageErrors] = useState<Record<string, boolean>>({});
  const [projectImportMessages, setProjectImportMessages] = useState<Record<string, string>>({});
  const [projectImportMessageErrors, setProjectImportMessageErrors] = useState<Record<string, boolean>>({});
  const [projectExportMessages, setProjectExportMessages] = useState<Record<string, string>>({});
  const [projectExportMessageErrors, setProjectExportMessageErrors] = useState<Record<string, boolean>>({});
  const [sharingProjectKey, setSharingProjectKey] = useState<string | null>(null);
  const [sharingListKey, setSharingListKey] = useState<string | null>(null);
  const [projectShareMessages, setProjectShareMessages] = useState<Record<string, string>>({});
  const [listShareMessages, setListShareMessages] = useState<Record<string, string>>({});
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [isProjectCreateMenuOpen, setIsProjectCreateMenuOpen] = useState(false);
  const [isCartMenuOpen, setIsCartMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [importCartTargetProjectId, setImportCartTargetProjectId] = useState<string | null>(null);
  const [importCartPendingProjectId, setImportCartPendingProjectId] = useState<string | null>(null);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileAreaRef = useRef<HTMLDivElement>(null);
  const projectImportInputRef = useRef<HTMLInputElement>(null);
  const cartImportInputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${useId()}-services`;
  const pendingUrlStateRef = useRef<DashboardUrlState | null>(null);
  const hasInitializedUrlStateRef = useRef(false);
  const isApplyingUrlStateRef = useRef(false);
  const [urlStateVersion, setUrlStateVersion] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = normalizedQuery
    ? services
        .filter((service) =>
          service.name.toLowerCase().includes(normalizedQuery) || service.code.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 8)
    : [];
  const selectedServiceMeta = services.find((service) => service.name === selectedService) ?? services[0];
  const selectedServiceCode = selectedServiceMeta.code;
  const selectedServiceBundle = getConfigurableServiceBundleByCode(selectedServiceCode);
  const selectedServiceDefinition = selectedServiceBundle?.service ?? null;
  const selectedServiceDefinitionStatus = selectedServiceBundle?.metadata.status ?? null;
  const hasSuggestions = isSearchOpen && suggestions.length > 0;
  const activeDescendant = hasSuggestions ? `${listboxId}-${activeSuggestionIndex}` : undefined;
  const totalProjectLists = projects.reduce((sum, project) => sum + project.lists.length, 0);
  const totalProjectProducts = projects.reduce(
    (sum, project) => sum + project.lists.reduce((listSum, list) => listSum + list.productCount, 0),
    0,
  );
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project] as const)), [projects]);
  const listsById = useMemo(
    () => new Map(projects.flatMap((project) => project.lists.map((list) => [list.id, { list, project }] as const))),
    [projects],
  );
  const selectedProject = projects.find((project) => project.lists.some((list) => list.id === selectedListId)) ?? null;
  const selectedList = selectedProject?.lists.find((list) => list.id === selectedListId) ?? null;
  const selectedCartProducts = selectedList?.products ?? [];
  const activeProject =
    activeModal == null
      ? null
      : "projectId" in activeModal
        ? projectsById.get(activeModal.projectId) ?? null
        : listsById.get(activeModal.listId)?.project ?? null;
  const activeList = activeModal != null && "listId" in activeModal ? listsById.get(activeModal.listId)?.list ?? null : null;
  const cloneableRegions = (Object.entries(huaweiRegions) as Array<[HuaweiRegionKey, (typeof huaweiRegions)[HuaweiRegionKey]]>)
    .filter(([, labels]) => Boolean(labels.catalogRegionId));

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

  const calculatorController = useCalculatorController({
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
    activeTab,
    setActiveTab,
    session,
    isSignedIn,
    setProjects,
    setSelectedService,
    setQuery,
    mutateListProduct,
  });
  const {
    isSelectedServiceImplemented,
    isSelectedServiceBatchAddImplemented,
    showBillingHeader,
    calculatorBillingOptions,
    showSharedUsageHours,
    selectedEstimateParts,
    quantityLabel,
    showGlobalQuantityControl,
    displayQuantityValue,
    instanceCount,
    updateInstanceCount,
    addToListPending,
    addToListMessage,
    setAddToListMessage,
    calculatorPanelProps,
    batchPanelProps,
    handleAddToList,
    handleEditProduct,
    handleCancelEdit,
    applyServiceUrlState,
    writeServiceUrlState,
    resetForServiceCode,
  } = calculatorController;
  const queueUrlStateFromLocation = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    pendingUrlStateRef.current = parseDashboardUrlState(window.location.search);
    setUrlStateVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    setHasMounted(true);
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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (searchAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsSearchOpen(false);

      if (profileAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsProfileOpen(false);
    };

    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleShortcut);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

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

  useEffect(() => {
    if (!activeModal) {
      return;
    }

    if ("projectId" in activeModal && !projectsById.has(activeModal.projectId)) {
      setActiveModal(null);
      return;
    }

    if ("listId" in activeModal && !listsById.has(activeModal.listId)) {
      setActiveModal(null);
    }
  }, [activeModal, listsById, projectsById]);

  useEffect(() => {
    if (!session?.user.id) {
      setProjects([]);
      setProjectsError("");
      setProjectsLoading(false);
      setSelectedListId("");
      return;
    }

    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(getResponseError(payload, "Failed to load projects"));
        }

        const payload = (await response.json()) as AppProject[];
        setProjects(payload);
        setSelectedListId((current) => {
          if (current && payload.some((project) => project.lists.some((list) => list.id === current))) {
            return current;
          }

          return getFirstListId(payload);
        });
        setExpandedProjects((current) => {
          const nextState: Record<string, boolean> = {};
          payload.forEach((project, index) => {
            nextState[project.id] = current[project.id] ?? index === 0;
          });
          return nextState;
        });
      } catch (error) {
        setProjectsError(error instanceof Error ? error.message : "Failed to load projects");
      } finally {
        setProjectsLoading(false);
      }
    };

    void loadProjects();
  }, [session?.user.id]);

  useEffect(() => {
    const storedCookie = window.localStorage.getItem("neoCalculator.huaweiCookie") ?? "";
    setCookieValue(storedCookie);
    setCookieDraft(storedCookie);
  }, []);

  const loadHuaweiCarts = useCallback(async () => {
    if (!cookieValue.trim()) {
      setHuaweiCarts([]);
      setHuaweiCartsError("");
      setHuaweiCartsSyncedAt(null);
      return;
    }

    setHuaweiCartsLoading(true);
    setHuaweiCartsError("");

    try {
      const response = await fetch("/api/huawei/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { carts?: HuaweiCartSummary[]; syncedAt?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(getResponseError(payload, "Unable to load Huawei carts"));
      }

      setHuaweiCarts(payload?.carts ?? []);
      setHuaweiCartsSyncedAt(payload?.syncedAt ?? new Date().toISOString());
    } catch (error) {
      setHuaweiCarts([]);
      setHuaweiCartsSyncedAt(null);
      setHuaweiCartsError(error instanceof Error ? error.message : "Unable to load Huawei carts");
    } finally {
      setHuaweiCartsLoading(false);
    }
  }, [cookieValue]);

  useEffect(() => {
    void loadHuaweiCarts();
  }, [loadHuaweiCarts, session?.user.id]);

  useEffect(() => {
    setSelectedHuaweiCartKey(selectedList?.huaweiCartKey ?? "");
  }, [selectedList?.huaweiCartKey, selectedList?.id]);

  useEffect(() => {
    setCloneNameDraft("");
    setCloneTargetRegion("");
    setCloneTargetBillingMode("");
  }, [selectedList?.id]);

  const handleSelectService = (service: string) => {
    setSelectedService(service);
    setQuery(service);
    setIsSearchOpen(false);
    setActiveSuggestionIndex(0);
    const serviceMeta = services.find((entry) => entry.name === service);
    if (serviceMeta) {
      resetForServiceCode(serviceMeta.code);
    }
  };

  const handleSaveCookie = () => {
    window.localStorage.setItem("neoCalculator.huaweiCookie", cookieDraft);
    setCookieValue(cookieDraft);
    setIsProfileOpen(false);
    setHuaweiActionMessage("");
  };

  const reloadProjectsSnapshot = async (preferredListId?: string, preferredProjectId?: string) => {
    const response = await fetch("/api/projects", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(getResponseError(payload, "Failed to load projects"));
    }

    const payload = (await response.json()) as AppProject[];
    setProjects(payload);
    setSelectedListId((current) => {
      const nextPreferredListId = preferredListId
        && payload.some((project) => project.lists.some((list) => list.id === preferredListId))
        ? preferredListId
        : null;
      if (nextPreferredListId) {
        return nextPreferredListId;
      }

      if (current && payload.some((project) => project.lists.some((list) => list.id === current))) {
        return current;
      }

      return getFirstListId(payload);
    });
    setExpandedProjects((current) => {
      const nextState: Record<string, boolean> = {};
      payload.forEach((project, index) => {
        nextState[project.id] = project.id === preferredProjectId ? true : (current[project.id] ?? index === 0);
      });
      return nextState;
    });
  };

  const openProjectImportPicker = () => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    setImportProjectMessage("");
    setImportProjectMessageIsError(false);
    if (projectImportInputRef.current) {
      projectImportInputRef.current.value = "";
      projectImportInputRef.current.click();
    }
  };

  const openCartImportPicker = (projectId: string) => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    setImportCartTargetProjectId(projectId);
    setProjectImportMessages((current) => ({ ...current, [projectId]: "" }));
    setProjectImportMessageErrors((current) => ({ ...current, [projectId]: false }));
    if (cartImportInputRef.current) {
      cartImportInputRef.current.value = "";
      cartImportInputRef.current.click();
    }
  };

  const handleImportProjectFile = async (file: File) => {
    setImportProjectPending(true);
    setImportProjectMessage("");
    setImportProjectMessageIsError(false);
    setProjectsError("");

    try {
      const payload = await parseJsonFile(file);
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const result = (await response.json().catch(() => null)) as
        | { projectId: string; firstListId: string | null; name: string; importedListCount: number; importedProductCount: number; error?: never }
        | { error?: string }
        | null;

      if (!response.ok || !result || !("projectId" in result)) {
        throw new Error(getResponseError(result, "Unable to import project"));
      }

      await reloadProjectsSnapshot(result.firstListId ?? undefined, result.projectId);
      setImportProjectMessage(
        `Imported project ${result.name} with ${result.importedListCount} cart(s) and ${result.importedProductCount} product(s).`,
      );
      setImportProjectMessageIsError(false);
    } catch (error) {
      setImportProjectMessage(error instanceof Error ? error.message : "Unable to import project");
      setImportProjectMessageIsError(true);
    } finally {
      setImportProjectPending(false);
    }
  };

  const handleImportCartFile = async (projectId: string, file: File) => {
    setImportCartPendingProjectId(projectId);
    setProjectImportMessages((current) => ({ ...current, [projectId]: "" }));
    setProjectImportMessageErrors((current) => ({ ...current, [projectId]: false }));
    setProjectsError("");

    try {
      const payload = await parseJsonFile(file);
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, targetProjectId: projectId }),
      });
      const result = (await response.json().catch(() => null)) as
        | { projectId: string; listId: string; name: string; importedProductCount: number; error?: never }
        | { error?: string }
        | null;

      if (!response.ok || !result || !("listId" in result)) {
        throw new Error(getResponseError(result, "Unable to import cart"));
      }

      await reloadProjectsSnapshot(result.listId, projectId);
      setProjectImportMessages((current) => ({
        ...current,
        [projectId]: `Imported cart ${result.name} with ${result.importedProductCount} product(s).`,
      }));
      setProjectImportMessageErrors((current) => ({ ...current, [projectId]: false }));
    } catch (error) {
      setProjectImportMessages((current) => ({
        ...current,
        [projectId]: error instanceof Error ? error.message : "Unable to import cart",
      }));
      setProjectImportMessageErrors((current) => ({ ...current, [projectId]: true }));
    } finally {
      setImportCartPendingProjectId(null);
      setImportCartTargetProjectId(null);
    }
  };

  const handleCreateProject = async () => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    const name = newProjectName.trim();
    if (!name) return;

    setNewProjectPending(true);
    setProjectsError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(getResponseError(payload, "Unable to create project"));
      }

      const project = (await response.json()) as Omit<AppProject, "lists">;
      setProjects((current) => [{ ...project, lists: [] }, ...current]);
      setExpandedProjects((current) => ({ ...current, [project.id]: true }));
      setProjectNameDrafts((current) => ({ ...current, [project.id]: project.name }));
      setNewProjectName("");
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create project");
    } finally {
      setNewProjectPending(false);
    }
  };

  const handleCreateShare = async (resourceType: "project" | "list", resourceId: string, mode: "copy" | "collaborate") => {
    const setPending = resourceType === "project" ? setSharingProjectKey : setSharingListKey;
    const setMessages = resourceType === "project" ? setProjectShareMessages : setListShareMessages;

    setPending(`${resourceType}:${resourceId}:${mode}`);
    setMessages((current) => ({ ...current, [resourceId]: "" }));

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, mode }),
      });
      const payload = (await response.json().catch(() => null)) as { shareUrl?: string; error?: string } | null;

      if (!response.ok || !payload?.shareUrl) {
        throw new Error(getResponseError(payload, "Unable to create share link"));
      }

      const shareUrl = new URL(payload.shareUrl, window.location.origin).toString();
      const copied = await copyText(shareUrl);
      setMessages((current) => ({
        ...current,
        [resourceId]: copied
          ? mode === "copy"
            ? "Copy link copied."
            : "Collaborative link copied."
          : `${mode === "copy" ? "Copy" : "Collaborative"} link: ${shareUrl}`,
      }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [resourceId]: error instanceof Error ? error.message : "Unable to create share link",
      }));
    } finally {
      setPending(null);
    }
  };

  const handleCreateList = async (projectId: string) => {
    if (!session) {
      setProjectsError("Sign in to save carts and projects.");
      return;
    }

    const name = listDrafts[projectId]?.trim();
    const baseCartKey = listBaseDrafts[projectId] ?? "";
    const usingHuaweiBase = Boolean(baseCartKey);
    if (!name && !usingHuaweiBase) return;
    if (usingHuaweiBase && !cookieValue.trim()) {
      setProjectsError("Save a Huawei Cloud cookie before importing a Huawei cart.");
      return;
    }

    setListPendingProjectId(projectId);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          huaweiCartKey: baseCartKey || null,
          cookie: baseCartKey ? cookieValue : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(getResponseError(payload, "Unable to create list"));
      }

      const list = (await response.json()) as AppList & { projectId: string };
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: list.updatedAt,
                lists: [...project.lists, list],
              }
            : project,
        ),
      );
      setSelectedListId((current) => current || list.id);
      setListDrafts((current) => ({ ...current, [projectId]: "" }));
      setListBaseDrafts((current) => ({ ...current, [projectId]: "" }));
      setExpandedProjects((current) => ({ ...current, [projectId]: true }));
      setHuaweiActionMessage(baseCartKey ? `Imported ${list.name} from Huawei Cloud Calculator.` : "");
      if (baseCartKey) {
        await loadHuaweiCarts();
      }
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create list");
    } finally {
      setListPendingProjectId(null);
    }
  };

  const handleLinkSelectedList = async () => {
    if (!selectedListId || !selectedHuaweiCartKey) {
      return;
    }

    const targetCart = huaweiCarts.find((cart) => cart.key === selectedHuaweiCartKey);
    if (!targetCart) {
      setHuaweiActionMessage("Choose a Huawei cart first.");
      return;
    }

    setLinkingHuaweiListId(selectedListId);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          huaweiCartKey: targetCart.key,
          huaweiCartName: targetCart.name,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            id: string;
            projectId: string;
            huaweiCartKey: string | null;
            huaweiCartName: string | null;
            huaweiLastError: string | null;
            updatedAt: string;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to link Huawei cart"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.id
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setHuaweiActionMessage(`Linked ${targetCart.name} to this Neo cart.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to link Huawei cart");
    } finally {
      setLinkingHuaweiListId(null);
    }
  };

  const handleSyncSelectedList = async () => {
    if (!selectedListId) {
      return;
    }

    if (!cookieValue.trim()) {
      setHuaweiActionMessage("Save a Huawei Cloud cookie before syncing.");
      return;
    }

    setSyncingHuaweiListId(selectedListId);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}/huawei-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            listId: string;
            projectId: string;
            huaweiCartKey: string;
            huaweiCartName: string;
            huaweiLastSyncedAt: string;
            huaweiLastError: string | null;
            updatedAt: string;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to sync with Huawei Cloud Calculator"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.listId
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastSyncedAt: payload.huaweiLastSyncedAt,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setSelectedHuaweiCartKey(payload.huaweiCartKey);
      setHuaweiActionMessage(`Synced ${selectedList?.name ?? "cart"} to Huawei Cloud Calculator.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to sync with Huawei Cloud Calculator");
    } finally {
      setSyncingHuaweiListId(null);
    }
  };

  const handleCloneSelectedList = async () => {
    if (!selectedListId || !selectedProject || !selectedList) {
      return;
    }

    setCloningListId(selectedListId);
    setCloneActionMessage("");
    setCloneActionIsError(false);

    try {
      const response = await fetch(`/api/lists/${selectedListId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cloneNameDraft.trim() || undefined,
          targetRegion: cloneTargetRegion || undefined,
          targetBillingMode: cloneTargetBillingMode || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AppList & {
            projectId: string;
            cloneSummary?: {
              totalProducts: number;
              convertedEcsCount: number;
              copiedUnchangedCount: number;
              copiedUnsupportedCount: number;
            };
            error?: never;
          })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to clone cart"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: [...project.lists, payload],
              }
            : project,
        ),
      );
      setSelectedListId(payload.id);
      setCloneNameDraft("");
      setCloneTargetRegion("");
      setCloneTargetBillingMode("");
      setCloneActionMessage(
        `Cloned ${selectedList.name} into ${payload.name}. Converted ${payload.cloneSummary?.convertedEcsCount ?? 0} ECS item(s).`,
      );
    } catch (error) {
      setCloneActionIsError(true);
      setCloneActionMessage(error instanceof Error ? error.message : "Unable to clone cart");
    } finally {
      setCloningListId(null);
    }
  };

  const handleCloneProject = async (project: AppProject) => {
    setCloningProjectId(project.id);
    setProjectCloneMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: false }));

    try {
      const response = await fetch(`/api/projects/${project.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectCloneNameDrafts[project.id]?.trim() || undefined,
          targetRegion: projectCloneTargetRegions[project.id] || undefined,
          targetBillingMode: projectCloneTargetBillingModes[project.id] || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AppProject & {
            cloneSummary?: {
              totalLists: number;
              totalProducts: number;
              convertedEcsCount: number;
              copiedUnchangedCount: number;
              copiedUnsupportedCount: number;
            };
            error?: never;
          })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("lists" in payload)) {
        throw new Error(getResponseError(payload, "Unable to clone project"));
      }

      setProjects((current) => [payload, ...current]);
      setExpandedProjects((current) => ({ ...current, [payload.id]: true }));
      setSelectedListId(payload.lists[0]?.id ?? "");
      setProjectCloneNameDrafts((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneTargetRegions((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneTargetBillingModes((current) => ({ ...current, [project.id]: "" }));
      setProjectCloneMessages((current) => ({
        ...current,
        [project.id]: `Cloned ${project.name} into ${payload.name}. Converted ${payload.cloneSummary?.convertedEcsCount ?? 0} ECS item(s).`,
      }));
      setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: false }));
    } catch (error) {
      setProjectCloneMessages((current) => ({
        ...current,
        [project.id]: error instanceof Error ? error.message : "Unable to clone project",
      }));
      setProjectCloneMessageErrors((current) => ({ ...current, [project.id]: true }));
    } finally {
      setCloningProjectId(null);
    }
  };

  const handleSyncProjectHuawei = async (project: AppProject) => {
    if (!cookieValue.trim()) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: "Save a Huawei Cloud cookie before creating Huawei carts.",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
      return;
    }

    if (project.lists.length === 0) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: "This project does not have carts to sync.",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
      return;
    }

    setSyncingHuaweiProjectId(project.id);
    setProjectHuaweiMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: false }));

    try {
      const response = await fetch(`/api/projects/${project.id}/huawei-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            projectId: string;
            updatedAt: string;
            syncedCount: number;
            failedCount: number;
            lists: Array<{
              id: string;
              huaweiCartKey: string | null;
              huaweiCartName: string | null;
              huaweiLastSyncedAt: string | null;
              huaweiLastError: string | null;
              updatedAt: string;
            }>;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to create Huawei carts for this project"));
      }

      const listUpdates = new Map(payload.lists.map((list) => [list.id, list]));

      setProjects((current) =>
        current.map((item) =>
          item.id === project.id
            ? {
                ...item,
                updatedAt: payload.updatedAt,
                lists: item.lists.map((list) => {
                  const update = listUpdates.get(list.id);
                  if (!update) {
                    return list;
                  }

                  return {
                    ...list,
                    updatedAt: update.updatedAt,
                    huaweiCartKey: update.huaweiCartKey,
                    huaweiCartName: update.huaweiCartName,
                    huaweiLastSyncedAt: update.huaweiLastSyncedAt,
                    huaweiLastError: update.huaweiLastError,
                  };
                }),
              }
            : item,
        ),
      );
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]:
          payload.failedCount > 0
            ? `Created or updated ${payload.syncedCount} Huawei cart(s). ${payload.failedCount} cart(s) failed.`
            : `Created or updated ${payload.syncedCount} Huawei cart(s) for this project.`,
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: payload.failedCount > 0 }));
      await loadHuaweiCarts();
    } catch (error) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: error instanceof Error ? error.message : "Unable to create Huawei carts for this project",
      }));
      setProjectHuaweiMessageErrors((current) => ({ ...current, [project.id]: true }));
    } finally {
      setSyncingHuaweiProjectId(null);
    }
  };

  const openActionModal = (modal: Exclude<ActiveModal, null>) => {
    setOpenProjectMenuId(null);
    setIsCartMenuOpen(false);
    setActiveModal(modal);
  };

  const openResourceExportModal = (title: string, description: string, payload: unknown, filename: string) => {
    setResourceExportActionMessage("");
    setResourceExportModal({
      title,
      description,
      json: JSON.stringify(payload, null, 2),
      filename,
    });
  };

  const handleOpenProjectExport = (project: AppProject) => {
    openResourceExportModal(
      "Export Project JSON",
      "This export includes the full project, all carts in it, and every saved product.",
      buildProjectExportPayload(project),
      buildNamedExportFilename("project", project.name, "json"),
    );
  };

  const handleOpenListExport = (project: AppProject, list: AppList) => {
    openResourceExportModal(
      "Export Cart JSON",
      "This export includes the cart, its parent project reference, and every saved product in the cart.",
      buildListExportPayload(project, list),
      buildNamedExportFilename("cart", list.name, "json"),
    );
  };

  const handleExportProjectExcel = async (project: AppProject) => {
    setProjectExportMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectExportMessageErrors((current) => ({ ...current, [project.id]: false }));

    try {
      // First, create a share link for the project
      const shareResponse = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          resourceType: "project", 
          resourceId: project.id, 
          mode: "copy" 
        }),
      });
      const sharePayload = (await shareResponse.json().catch(() => null)) as { shareUrl?: string; error?: string } | null;

      // Get the full share URL or undefined if creation failed
      const shareUrl = shareResponse.ok && sharePayload?.shareUrl
        ? new URL(sharePayload.shareUrl, window.location.origin).toString()
        : undefined;

      const downloaded = await downloadProjectWorkbookFile(project, shareUrl);
      setProjectExportMessages((current) => ({
        ...current,
        [project.id]: downloaded ? "Excel export download started." : "Unable to start the Excel download in this browser.",
      }));
      setProjectExportMessageErrors((current) => ({ ...current, [project.id]: !downloaded }));
    } catch (error) {
      setProjectExportMessages((current) => ({
        ...current,
        [project.id]: error instanceof Error ? error.message : "Unable to export the project as Excel.",
      }));
      setProjectExportMessageErrors((current) => ({ ...current, [project.id]: true }));
    }
  };

  const handleCopyResourceExport = async () => {
    if (!resourceExportModal) {
      return;
    }

    const copied = await copyText(resourceExportModal.json);
    setResourceExportActionMessage(copied ? "JSON copied to clipboard." : "Clipboard access is unavailable in this browser.");
  };

  const handleDownloadResourceExport = () => {
    if (!resourceExportModal) {
      return;
    }

    const downloaded = downloadTextFile(resourceExportModal.filename, resourceExportModal.json, "application/json;charset=utf-8");
    setResourceExportActionMessage(downloaded ? "JSON file download started." : "Unable to start the JSON download in this browser.");
  };

  const toggleProject = (projectName: string) => {
    setExpandedProjects((current) => ({
      ...current,
      [projectName]: !current[projectName],
    }));
  };

  const handleStartProjectRename = (project: AppProject) => {
    setEditingProjectId(project.id);
    setProjectNameDrafts((current) => ({
      ...current,
      [project.id]: current[project.id] ?? project.name,
    }));
    setProjectsError("");
  };

  const handleCancelProjectRename = (project: AppProject) => {
    setEditingProjectId((current) => (current === project.id ? null : current));
    setProjectNameDrafts((current) => ({
      ...current,
      [project.id]: project.name,
    }));
  };

  const handleRenameProject = async (project: AppProject) => {
    const name = (projectNameDrafts[project.id] ?? project.name).trim();
    if (!name) {
      setProjectsError("Project name is required.");
      return;
    }

    if (name === project.name) {
      setEditingProjectId(null);
      return;
    }

    setRenamingProjectId(project.id);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; name: string; description: string | null; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("updatedAt" in payload)) {
        throw new Error(getResponseError(payload, "Unable to rename project"));
      }

      setProjects((current) =>
        current.map((item) =>
          item.id === payload.id
            ? {
                ...item,
                name: payload.name,
                description: payload.description,
                updatedAt: payload.updatedAt,
              }
            : item,
        ),
      );
      setProjectNameDrafts((current) => ({ ...current, [project.id]: payload.name }));
      setEditingProjectId(null);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to rename project");
    } finally {
      setRenamingProjectId(null);
    }
  };

  const handleDeleteProject = async (project: AppProject) => {
    const confirmed = window.confirm(`Delete "${project.name}" and all of its lists and products?`);
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id);
    setProjectsError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; deleted: true }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("deleted" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete project"));
      }

      setProjects((current) => {
        const nextProjects = current.filter((item) => item.id !== payload.id);
        setSelectedListId((currentListId) => {
          if (!project.lists.some((list) => list.id === currentListId)) {
            return currentListId;
          }

          return getFirstListId(nextProjects);
        });
        return nextProjects;
      });
      setExpandedProjects((current) => {
        const nextState = { ...current };
        delete nextState[project.id];
        return nextState;
      });
      setProjectNameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneNameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneTargetRegions((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneTargetBillingModes((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[project.id];
        return nextDrafts;
      });
      setProjectCloneMessages((current) => {
        const nextMessages = { ...current };
        delete nextMessages[project.id];
        return nextMessages;
      });
      setProjectCloneMessageErrors((current) => {
        const nextFlags = { ...current };
        delete nextFlags[project.id];
        return nextFlags;
      });
      setEditingProjectId((current) => (current === project.id ? null : current));
      await loadHuaweiCarts();
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to delete project");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleDeleteList = async (list: AppList, projectId: string) => {
    const confirmed = window.confirm(`Delete "${list.name}" and all of its products?`);
    if (!confirmed) {
      return;
    }

    setDeletingListId(list.id);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; projectId: string; deleted: true; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("deleted" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete cart"));
      }

      setProjects((current) => {
        const nextProjects = current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.filter((item) => item.id !== payload.id),
              }
            : project,
        );
        setSelectedListId((currentListId) => {
          if (currentListId !== payload.id) {
            return currentListId;
          }

          return getFirstListId(nextProjects);
        });
        return nextProjects;
      });
      if (editingProductListId === payload.id) {
        handleCancelEdit();
      }
      setHuaweiActionMessage(`Deleted ${list.name}.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(error instanceof Error ? error.message : "Unable to delete cart");
    } finally {
      setDeletingListId(null);
    }
  };

  function updateUsageHours(nextValue: string) {
    if (nextValue === "") {
      setUsageHours("");
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(87600, Math.max(1, parsed));
    setUsageHours(String(bounded));
  }

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
      if (pendingUrlState.serviceCode) {
        const serviceMeta = getServiceMeta(pendingUrlState.serviceCode, pendingUrlState.serviceCode);
        if (serviceMeta) {
          setSelectedService(serviceMeta.name);
          setQuery(serviceMeta.name);
        }
      }

      if (pendingUrlState.region && pendingUrlState.region in huaweiRegions) {
        setRegionValue(pendingUrlState.region);
      }

      if (pendingUrlState.billingMode && isBillingOption(pendingUrlState.billingMode)) {
        setBillingMode(pendingUrlState.billingMode);
      }

      if (pendingUrlState.usageHours) {
        updateUsageHours(pendingUrlState.usageHours);
      }

      if (pendingUrlState.tab) {
        setActiveTab(pendingUrlState.tab);
      }

      applyServiceUrlState(pendingUrlState);

      const shouldWaitForProjects = Boolean(session?.user.id) && projectsLoading;
      if (shouldWaitForProjects) {
        return;
      }

      const preferredProject = pendingUrlState.projectId
        ? projects.find((project) => project.id === pendingUrlState.projectId) ?? null
        : null;
      const preferredList =
        pendingUrlState.listId
          ? projects.flatMap((project) => project.lists).find((list) => list.id === pendingUrlState.listId) ?? null
          : null;
      const resolvedListId = preferredList?.id
        ?? preferredProject?.lists[0]?.id
        ?? "";

      if (pendingUrlState.listId || pendingUrlState.projectId) {
        setSelectedListId(resolvedListId);
      }

      if (pendingUrlState.editProductId) {
        const targetListId = pendingUrlState.editProductListId ?? resolvedListId;
        const targetList = targetListId
          ? projects.flatMap((project) => project.lists).find((list) => list.id === targetListId) ?? null
          : null;
        const targetProduct = targetList?.products.find((product) => product.id === pendingUrlState.editProductId) ?? null;

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
          pendingUrlState.modalKind === "project-huawei"
          || pendingUrlState.modalKind === "project-clone"
          || pendingUrlState.modalKind === "project-share"
        ) {
          const modalProjectId = pendingUrlState.modalProjectId ?? pendingUrlState.projectId;
          if (modalProjectId && projectsById.has(modalProjectId)) {
            setActiveModal({ kind: pendingUrlState.modalKind, projectId: modalProjectId });
          } else {
            setActiveModal(null);
          }
        } else {
          const modalListId = pendingUrlState.modalListId ?? pendingUrlState.listId;
          if (modalListId && listsById.has(modalListId)) {
            setActiveModal({ kind: pendingUrlState.modalKind, listId: modalListId });
          } else {
            setActiveModal(null);
          }
        }
      } else {
        setActiveModal(null);
      }

      pendingUrlStateRef.current = null;
      hasInitializedUrlStateRef.current = true;
    } finally {
      isApplyingUrlStateRef.current = false;
    }
  }, [applyServiceUrlState, handleCancelEdit, handleEditProduct, listsById, projects, projectsById, projectsLoading, session?.user.id, urlStateVersion]);

  useEffect(() => {
    if (!hasInitializedUrlStateRef.current || isApplyingUrlStateRef.current || typeof window === "undefined") {
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

  const handleDeleteProduct = async (product: AppProduct) => {
    if (!selectedListId) {
      return;
    }

    setDeletingProductId(product.id);
    setAddToListMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}/products/${product.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; listId: string; projectId: string; deleted: true; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete product"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.listId
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        productCount: Math.max(0, list.productCount - 1),
                        products: list.products.filter((item) => item.id !== payload.id),
                      }
                    : list,
                ),
              }
            : project,
        ),
      );

      if (editingProductId === payload.id) {
        handleCancelEdit();
      }

      setAddToListMessage("Product deleted.");
    } catch (error) {
      setAddToListMessage(error instanceof Error ? error.message : "Unable to delete product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const activeProjectCloneTargetRegion = activeProject ? projectCloneTargetRegions[activeProject.id] ?? "" : "";
  const activeProjectCloneTargetBillingMode = activeProject ? projectCloneTargetBillingModes[activeProject.id] ?? "" : "";
  const activeProjectCloneMessage = activeProject ? projectCloneMessages[activeProject.id] ?? "" : "";
  const activeProjectCloneMessageIsError = activeProject ? projectCloneMessageErrors[activeProject.id] ?? false : false;
  const activeProjectHuaweiMessage = activeProject ? projectHuaweiMessages[activeProject.id] ?? "" : "";
  const activeProjectHuaweiMessageIsError = activeProject ? projectHuaweiMessageErrors[activeProject.id] ?? false : false;
  const projectCreateMenuItems: ActionMenuItem[] = [
    {
      label: "Import Project",
      icon: <Upload className="size-4" />,
      onSelect: openProjectImportPicker,
      disabled: importProjectPending || !isSignedIn,
    },
  ];
  const activeProjectShareMessage = activeProject ? projectShareMessages[activeProject.id] ?? "" : "";
  const activeSelectedHuaweiCartKey = activeList ? selectedHuaweiCartKey || activeList.huaweiCartKey || "" : "";
  const activeSelectedHuaweiCart = huaweiCarts.find((cart) => cart.key === activeSelectedHuaweiCartKey) ?? null;
  const activeListCloneMessage = activeList ? cloneActionMessage : "";
  const activeListCloneMessageIsError = activeList ? cloneActionIsError : false;
  const activeListHuaweiMessage = activeList ? huaweiActionMessage : "";
  const activeListShareMessage = activeList ? listShareMessages[activeList.id] ?? "" : "";
  const isActiveProjectCloning = activeProject ? cloningProjectId === activeProject.id : false;
  const isActiveProjectSyncing = activeProject ? syncingHuaweiProjectId === activeProject.id : false;
  const isActiveListLinking = activeList ? linkingHuaweiListId === activeList.id : false;
  const isActiveListCloning = activeList ? cloningListId === activeList.id : false;
  const selectedCartMenuItems: ActionMenuItem[] =
    selectedList && selectedProject
      ? [
          {
            label: selectedList.huaweiCartKey ? "Sync Huawei Cart" : "Create Huawei Cart",
            icon: <RefreshCw className="size-4" />,
            onSelect: () => {
              void handleSyncSelectedList();
            },
            disabled: syncingHuaweiListId === selectedList.id,
          },
          {
            label: "Link Huawei Cart",
            icon: <Link2 className="size-4" />,
            onSelect: () => openActionModal({ kind: "list-link", listId: selectedList.id }),
          },
          {
            label: "Export Cart JSON",
            icon: <Download className="size-4" />,
            onSelect: () => handleOpenListExport(selectedProject, selectedList),
          },
          {
            label: "Clone Cart",
            icon: <Copy className="size-4" />,
            onSelect: () => openActionModal({ kind: "list-clone", listId: selectedList.id }),
          },
          ...(selectedList.canShare
            ? [
                {
                  label: "Share Cart",
                  icon: <Share2 className="size-4" />,
                  onSelect: () => openActionModal({ kind: "list-share", listId: selectedList.id }),
                },
              ]
            : []),
          {
            label: "Delete Cart",
            icon: <Trash2 className="size-4" />,
            onSelect: () => {
              void handleDeleteList(selectedList, selectedProject.id);
            },
            disabled: deletingListId === selectedList.id,
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900 lg:p-6">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
        <header className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:gap-6">
              <div className="justify-self-start">
                <Link href="/" className="block">
                  <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">NeoCalculator</p>
                </Link>
              </div>
              <nav className="flex items-center gap-2">
                <Link
                  href="/projects"
                  className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                  Projects
                </Link>
                <Link
                  href="/"
                  className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  Dashboard
                </Link>
              </nav>
            </div>
            <div className="flex items-center justify-end gap-3">
              {isSignedIn ? (
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-zinc-900">{session?.user.name || session?.user.email}</p>
                  <p className="text-xs text-zinc-500">{session?.user.email}</p>
                </div>
              ) : showSessionState ? null : <div className="hidden h-9 w-40 sm:block" aria-hidden="true" />}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10"
                aria-label="Reload Huawei carts"
                onClick={() => void loadHuaweiCarts()}
                disabled={huaweiCartsLoading || !cookieValue.trim()}
              >
                <RefreshCw className={`size-4 ${huaweiCartsLoading ? "animate-spin" : ""}`} />
              </Button>
              <div ref={profileAreaRef} className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-full border border-zinc-200"
                  aria-label="Open Huawei cookie settings"
                  aria-expanded={isProfileOpen}
                  onClick={() => setIsProfileOpen((current) => !current)}
                >
                  <UserCircle2 className="size-5" />
                </Button>

                {isProfileOpen ? (
                  <div className="absolute top-full right-0 z-50 mt-3 w-[min(92vw,380px)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-950">Huawei Cloud Cookie</p>
                      <p className="text-sm text-zinc-500">
                        Paste your website cookie string. It will be saved locally in this browser and works even before you sign in.
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={cookieDraft}
                        onChange={(event) => setCookieDraft(event.target.value)}
                        className="min-h-32 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-3 focus:ring-zinc-200"
                        placeholder="cookie_name=value; other_cookie=value;"
                      />
                      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                        <span>{cookieValue ? "Cookie saved locally" : "No cookie saved yet"}</span>
                        <span>{cookieDraft.length} chars</span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCookieDraft(cookieValue);
                            setIsProfileOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="button" onClick={handleSaveCookie}>
                          Save Cookie
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {isSignedIn ? (
                <Button type="button" variant="outline" onClick={() => authClient.signOut()}>
                  Sign Out
                </Button>
              ) : showSessionState ? (
                <>
                  <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
                    Sign In
                  </Link>
                  <Link href="/sign-up" className={buttonVariants()}>
                    Create Account
                  </Link>
                </>
              ) : (
                <div className="h-8 w-44" aria-hidden="true" />
              )}
            </div>
          </div>
        </header>

        <div className="relative z-30 px-1 py-1 sm:px-2">
          <div className="flex justify-center">
            <div ref={searchAreaRef} className="relative z-40 w-full max-w-3xl">
              <label htmlFor="service-search" className="sr-only">
                Search services
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-5 z-10 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <Input
                id="service-search"
                ref={searchInputRef}
                value={query}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setIsSearchOpen(true);
                  setActiveSuggestionIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    if (suggestions.length === 0) {
                      return;
                    }

                    event.preventDefault();
                    setIsSearchOpen(true);
                    setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
                  }

                  if (event.key === "ArrowUp") {
                    if (suggestions.length === 0) {
                      return;
                    }

                    event.preventDefault();
                    setIsSearchOpen(true);
                    setActiveSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
                  }

                  if (event.key === "Enter" && suggestions[activeSuggestionIndex]) {
                    event.preventDefault();
                    handleSelectService(suggestions[activeSuggestionIndex].name);
                  }

                  if (event.key === "Escape") {
                    setIsSearchOpen(false);
                  }
                }}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={hasSuggestions}
                aria-activedescendant={activeDescendant}
                className="h-16 rounded-full border-zinc-200 bg-white pr-26 pl-14 text-base shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]"
                placeholder="Search service name"
              />
              <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
                Ctrl K
              </div>

              {isSearchOpen && normalizedQuery ? (
                suggestions.length > 0 ? (
                  <div
                    id={listboxId}
                    role="listbox"
                    className="absolute top-full right-0 left-0 z-50 mt-3 overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]"
                  >
                    <div className="border-b border-zinc-100 px-5 py-3 text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">
                      Suggested services
                    </div>
                    <div className="p-2">
                      {suggestions.map((service, index) => (
                        <button
                          key={service.name}
                          id={`${listboxId}-${index}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeSuggestionIndex}
                          className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                            index === activeSuggestionIndex ? "bg-zinc-950 text-white" : "text-zinc-900 hover:bg-zinc-100"
                          }`}
                          onMouseEnter={() => setActiveSuggestionIndex(index)}
                          onClick={() => handleSelectService(service.name)}
                        >
                          <div className="flex items-center gap-3">
                            <Image src={service.icon} alt="" width={36} height={36} className="size-9 rounded-md object-contain" />
                            <div>
                              <p className="font-medium">{service.name}</p>
                              <p
                                className={`text-sm ${
                                  index === activeSuggestionIndex ? "text-zinc-300" : "text-zinc-500"
                                }`}
                              >
                                {service.code}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                index === activeSuggestionIndex ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {service.code}
                            </p>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                index === activeSuggestionIndex ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              Enter
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="absolute top-full right-0 left-0 z-50 mt-3 rounded-[28px] border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-500 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                    No services matched your search.
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
        <input
          ref={projectImportInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleImportProjectFile(file);
            }
          }}
        />
        <input
          ref={cartImportInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const projectId = importCartTargetProjectId;
            if (file && projectId) {
              void handleImportCartFile(projectId, file);
            }
          }}
        />

        <main className="relative z-0 grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
          <Card className="overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Projects</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    {isSignedIn ? "Projects and lists are scoped to your account." : "Browse anonymously. Sign in when you want to save carts and projects."}
                  </p>
                  {huaweiCartsSyncedAt ? (
                    <p className="mt-1 text-xs text-zinc-400">Huawei carts synced {formatDateTime(huaweiCartsSyncedAt)}</p>
                  ) : null}
                  {huaweiCartsError ? <p className="mt-1 text-xs text-red-600">{huaweiCartsError}</p> : null}
                </div>
                <Badge variant="secondary">{projects.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="New project name"
                    disabled={!isSignedIn}
                  />
                  <Button variant="outline" size="sm" onClick={handleCreateProject} disabled={newProjectPending || !isSignedIn}>
                    {newProjectPending ? "Adding..." : "New Project"}
                  </Button>
                  <ActionMenu
                    open={isProjectCreateMenuOpen}
                    onOpenChange={setIsProjectCreateMenuOpen}
                    label="Open project actions"
                    items={projectCreateMenuItems}
                  />
                </div>
                {projectsError ? <p className="text-sm text-red-600">{projectsError}</p> : null}
                {importProjectMessage ? (
                  <p className={`text-sm ${importProjectMessageIsError ? "text-red-600" : "text-zinc-600"}`}>{importProjectMessage}</p>
                ) : null}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[620px] px-4 xl:h-[calc(100vh-15rem)]">
                <div className="space-y-3 py-3">
                  {!isSignedIn ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      Sign in to save carts and projects. The calculator and Huawei cookie tools still work without an account.
                    </div>
                  ) : null}
                  {projectsLoading ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">Loading projects...</div>
                  ) : null}
                  {projects.map((project) => {
                    const isExpanded = expandedProjects[project.id] ?? false;
                    const isEditingProject = editingProjectId === project.id;
                    const isRenamingProject = renamingProjectId === project.id;
                    const isDeletingProject = deletingProjectId === project.id;
                  const projectCloneMessage = projectCloneMessages[project.id] ?? "";
                  const projectCloneIsError = projectCloneMessageErrors[project.id] ?? false;
                  const projectHuaweiMessage = projectHuaweiMessages[project.id] ?? "";
                  const projectHuaweiMessageIsError = projectHuaweiMessageErrors[project.id] ?? false;
                  const projectImportMessage = projectImportMessages[project.id] ?? "";
                  const projectImportMessageIsError = projectImportMessageErrors[project.id] ?? false;
                  const projectExportMessage = projectExportMessages[project.id] ?? "";
                  const projectExportMessageIsError = projectExportMessageErrors[project.id] ?? false;
                  const projectShareMessage = projectShareMessages[project.id] ?? "";
                    const projectMenuItems: ActionMenuItem[] = [
                      {
                        label: "Rename Project",
                        icon: <Pencil className="size-4" />,
                        onSelect: () => handleStartProjectRename(project),
                        disabled: isDeletingProject,
                      },
                      {
                        label: "Import Cart",
                        icon: <Upload className="size-4" />,
                        onSelect: () => openCartImportPicker(project.id),
                        disabled: importCartPendingProjectId === project.id,
                      },
                      {
                        label: "Create Huawei Carts",
                        icon: <RefreshCw className="size-4" />,
                        onSelect: () => openActionModal({ kind: "project-huawei", projectId: project.id }),
                      },
                      {
                        label: "Clone Project",
                        icon: <Copy className="size-4" />,
                        onSelect: () => openActionModal({ kind: "project-clone", projectId: project.id }),
                      },
                      {
                        label: "Export Project JSON",
                        icon: <Download className="size-4" />,
                        onSelect: () => handleOpenProjectExport(project),
                      },
                      {
                        label: "Export Project Excel",
                        icon: <Download className="size-4" />,
                        onSelect: () => void handleExportProjectExcel(project),
                      },
                      ...(project.canShare
                        ? [
                            {
                              label: "Share Project",
                              icon: <Share2 className="size-4" />,
                              onSelect: () => openActionModal({ kind: "project-share", projectId: project.id }),
                            },
                          ]
                        : []),
                    ];

                    return (
                      <div key={project.id} className="rounded-lg border bg-white">
                        <div className="flex items-start gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            {isEditingProject ? (
                              <div className="space-y-2 pr-2">
                                <Input
                                  value={projectNameDrafts[project.id] ?? project.name}
                                  onChange={(event) =>
                                    setProjectNameDrafts((current) => ({
                                      ...current,
                                      [project.id]: event.target.value,
                                    }))}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleRenameProject(project);
                                    }

                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      handleCancelProjectRename(project);
                                    }
                                  }}
                                  autoFocus
                                  placeholder="Project name"
                                />
                                <p className="text-xs text-zinc-500">Press Enter to save or Escape to cancel.</p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="min-w-0 text-left"
                                onClick={() => toggleProject(project.id)}
                                aria-expanded={isExpanded}
                              >
                                <p className="font-medium">{project.name}</p>
                                <p className="text-sm text-zinc-500">
                                  {project.lists.length} lists · {project.lists.reduce((sum, list) => sum + list.productCount, 0)} products ·{" "}
                                  {formatDate(project.updatedAt)}
                                </p>
                              </button>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isEditingProject ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleRenameProject(project)}
                                  disabled={isRenamingProject}
                                  aria-label="Save project name"
                                >
                                  <Check className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelProjectRename(project)}
                                  disabled={isRenamingProject}
                                  aria-label="Cancel project rename"
                                >
                                  <X className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                {project.canShare ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openActionModal({ kind: "project-share", projectId: project.id })}
                                    aria-label={`Share ${project.name}`}
                                  >
                                    <Share2 className="size-4" />
                                  </Button>
                                ) : null}
                                <ActionMenu
                                  open={openProjectMenuId === project.id}
                                  onOpenChange={(open) => setOpenProjectMenuId(open ? project.id : null)}
                                  label={`Open actions for ${project.name}`}
                                  items={projectMenuItems}
                                />
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleProject(project.id)}
                              aria-label={isExpanded ? "Collapse project" : "Expand project"}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleDeleteProject(project)}
                              disabled={isDeletingProject || isRenamingProject}
                              aria-label="Delete project"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="border-t border-zinc-100 px-3 py-3">
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  value={listDrafts[project.id] ?? ""}
                                  onChange={(event) => setListDrafts((current) => ({ ...current, [project.id]: event.target.value }))}
                                  placeholder="New list name"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCreateList(project.id)}
                                  disabled={listPendingProjectId === project.id}
                                >
                                  {listPendingProjectId === project.id ? "Adding..." : "Add List"}
                                </Button>
                              </div>
                              <Select
                                value={listBaseDrafts[project.id] || "__blank"}
                                onValueChange={(value) => {
                                  const nextValue = value && value !== "__blank" ? value : "";
                                  setListBaseDrafts((current) => ({
                                    ...current,
                                    [project.id]: nextValue,
                                  }));
                                }}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue>
                                    {listBaseDrafts[project.id]
                                      ? `Base: ${huaweiCarts.find((cart) => cart.key === listBaseDrafts[project.id])?.name ?? "Huawei cart"}`
                                      : "Base: Blank Neo cart"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__blank">Blank Neo cart</SelectItem>
                                  {huaweiCarts.map((cart) => {
                                    return (
                                      <SelectItem key={cart.key} value={cart.key} disabled={Boolean(cart.associatedListId)}>
                                        {cart.name}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              {projectHuaweiMessage || projectCloneMessage || projectImportMessage || projectExportMessage || projectShareMessage ? (
                                <div className="rounded-lg border bg-zinc-50 p-3">
                                  <div className="space-y-1 text-xs">
                                    {projectHuaweiMessage ? (
                                      <p className={projectHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectHuaweiMessage}</p>
                                    ) : null}
                                    {projectCloneMessage ? (
                                      <p className={projectCloneIsError ? "text-red-600" : "text-zinc-600"}>{projectCloneMessage}</p>
                                    ) : null}
                                    {projectImportMessage ? (
                                      <p className={projectImportMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectImportMessage}</p>
                                    ) : null}
                                    {projectExportMessage ? (
                                      <p className={projectExportMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectExportMessage}</p>
                                    ) : null}
                                    {projectShareMessage ? <p className="text-zinc-600">{projectShareMessage}</p> : null}
                                  </div>
                                </div>
                              ) : null}
                              {project.lists.map((item) => (
                                <div
                                  key={item.id}
                                  className={`flex items-start gap-2 rounded-lg border p-3 ${
                                    selectedListId === item.id ? "border-zinc-950 bg-white" : "border-zinc-200 bg-zinc-50"
                                  }`}
                                >
                                  <button type="button" onClick={() => setSelectedListId(item.id)} className="min-w-0 flex-1 text-left">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-medium">{item.name}</p>
                                          {item.huaweiCartKey ? <Badge variant="secondary">Huawei linked</Badge> : null}
                                        </div>
                                        <p className="text-sm text-zinc-500">
                                          {item.productCount} products · Created {formatDate(item.createdAt)}
                                        </p>
                                        {item.huaweiCartName ? <p className="text-xs text-zinc-400">{item.huaweiCartName}</p> : null}
                                      </div>
                                      <Badge variant="outline">{item.productCount}</Badge>
                                    </div>
                                  </button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void handleDeleteList(item, project.id)}
                                    disabled={deletingListId === item.id}
                                    aria-label={`Delete ${item.name}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              ))}
                              {project.lists.length === 0 ? (
                                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                                  This project does not have lists yet.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                    {projects.length} projects containing {totalProjectLists} lists and {totalProjectProducts} products.
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Image src={selectedServiceMeta.icon} alt="" width={40} height={40} className="size-10 rounded-lg object-contain" />
                    <div>
                      <CardTitle className="text-2xl">{selectedService}</CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-zinc-500">{selectedServiceMeta.code}</p>
                        {selectedServiceDefinition ? <Badge variant="secondary">{selectedServiceDefinitionStatus === "pilot" ? "JSON Pilot" : "JSON Config"}</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <TabsList>
                    <TabsTrigger value="calculator">Price Calculator</TabsTrigger>
                    <TabsTrigger value="batch-add">Batch add</TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <Separator />

              <TabsContent value="calculator">
                {isSelectedServiceImplemented ? (
                  <>
                    <div className="fixed right-4 bottom-4 left-4 z-40 grid gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)] backdrop-blur xl:left-1/2 xl:w-[min(920px,calc(100vw-48rem))] xl:-translate-x-1/2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                      <div className="min-w-0">
                        <p className="text-[2.125rem] leading-none font-semibold tracking-tight text-zinc-950">{selectedEstimateParts.amount}</p>
                        <p className="mt-0.5 leading-tight text-sm text-zinc-500">
                          {selectedEstimateParts.timeframe ? `${selectedEstimateParts.timeframe} · ` : ""}
                          {displayQuantityValue} {quantityLabel}
                          {displayQuantityValue === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-col justify-center gap-2 xl:items-end">
                        {addToListMessage ? <p className="text-sm text-zinc-500">{addToListMessage}</p> : null}
                        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                          {showGlobalQuantityControl ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-600">{quantityLabel}s</span>
                              <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-10 rounded-none px-3"
                                  onClick={() => updateInstanceCount(String(Number(instanceCount || "1") - 1))}
                                >
                                  -
                                </Button>
                                <Input
                                  value={instanceCount}
                                  onChange={(event) => {
                                    const digitsOnly = event.target.value.replace(/\D/g, "");
                                    if (digitsOnly === "") {
                                      updateInstanceCount("");
                                      return;
                                    }
                                    updateInstanceCount(digitsOnly);
                                  }}
                                  onBlur={() => updateInstanceCount(instanceCount || "1")}
                                  inputMode="numeric"
                                  className="h-10 w-16 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-10 rounded-none px-3"
                                  onClick={() => updateInstanceCount(String(Number(instanceCount || "1") + 1))}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          ) : null}
                          {editingProductId ? (
                            <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={addToListPending}>
                              Cancel
                            </Button>
                          ) : null}
                          <Button onClick={handleAddToList} disabled={addToListPending || !selectedListId || !isSignedIn}>
                            {addToListPending ? (editingProductId ? "Saving..." : "Adding...") : editingProductId ? "Save Changes" : "Add to List"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <CardContent className="space-y-6 py-5 pb-44">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm text-zinc-600">Description (Optional)</p>
                          <Input value={selectedService} readOnly className="max-w-sm lg:max-w-none" />
                        </div>

                        <section className="space-y-3">
                          <p className="text-sm font-medium">Region</p>
                          <Select value={regionValue} onValueChange={(value) => setRegionValue(value as HuaweiRegionKey)}>
                            <SelectTrigger className="max-w-sm bg-white lg:max-w-none">
                              <SelectValue>{huaweiRegions[regionValue].full}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(huaweiRegions).map(([value, labels]) => (
                                <SelectItem key={value} value={value}>
                                  {labels.short}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </section>
                      </div>

                      {showBillingHeader ? (
                        <section className={`grid gap-4 ${billingMode === "Pay-per-use" && showSharedUsageHours ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Billing Mode</p>
                            <OptionGrid
                              items={calculatorBillingOptions}
                              value={billingMode}
                              onChange={(value) => {
                                setBillingMode(value);
                              }}
                            />
                          </div>
                          {billingMode === "Pay-per-use" && showSharedUsageHours ? (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Usage Hours</p>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-11 rounded-none px-3"
                                    onClick={() => updateUsageHours(String(Number(usageHours || "744") - 24))}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    value={usageHours}
                                    onChange={(event) => {
                                      const digitsOnly = event.target.value.replace(/\D/g, "");
                                      if (digitsOnly === "") {
                                        setUsageHours("");
                                        return;
                                      }
                                      updateUsageHours(digitsOnly);
                                    }}
                                    onBlur={() => updateUsageHours(usageHours || "744")}
                                    inputMode="numeric"
                                    className="h-11 w-24 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-11 rounded-none px-3"
                                    onClick={() => updateUsageHours(String(Number(usageHours || "744") + 24))}
                                  >
                                    +
                                  </Button>
                                </div>
                                <span className="text-sm font-medium text-zinc-500">hours</span>
                              </div>
                            </div>
                          ) : null}
                        </section>
                      ) : null}
                      <CalculatorPanelRouter
                        activeServiceCode={calculatorPanelProps.activeServiceCode}
                        configurablePanel={calculatorPanelProps.configurablePanel as never}
                        ecsPanel={calculatorPanelProps.ecsPanel as never}
                        flexusLPanel={calculatorPanelProps.flexusLPanel as never}
                      />
                    </CardContent>
                  </>
                ) : (
                  <UnsupportedServicePanel
                    title={`Calculator not implemented yet for ${selectedService}`}
                    description={`This dashboard calculator currently supports ${supportedCalculatorServiceCodes.join(", ")} only.`}
                  />
                )}
              </TabsContent>

              <TabsContent value="batch-add">
                {isSelectedServiceBatchAddImplemented && batchPanelProps ? (
                  <ServiceBatchAddPanel {...batchPanelProps} />
                ) : (
                  <UnsupportedServicePanel
                    title={`Batch add not implemented yet for ${selectedService}`}
                    description={`Batch input currently supports ${supportedBatchAddServiceCodes.join(", ")} only. Select Elastic Cloud Server, Flexus L Instance, Elastic Volume Service, or Object Storage Service to use it.`}
                  />
                )}
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
            <CardHeader className="pb-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <CardTitle>Cart Contents</CardTitle>
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {selectedList && selectedProject ? `${selectedProject.name} / ${selectedList.name}` : "Select a list to see its saved products."}
                  </p>
                  {selectedList?.huaweiCartKey ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      Linked to Huawei cart {selectedList.huaweiCartName || selectedList.huaweiCartKey}
                    </p>
                  ) : null}
                  {selectedList?.huaweiLastSyncedAt ? (
                    <p className="mt-1 text-xs text-zinc-400">Last Huawei sync: {formatDateTime(selectedList.huaweiLastSyncedAt)}</p>
                  ) : null}
                  {selectedList?.huaweiLastError ? <p className="mt-1 text-xs text-red-600">{selectedList.huaweiLastError}</p> : null}
                  {selectedList && (huaweiActionMessage || cloneActionMessage || listShareMessages[selectedList.id]) ? (
                    <div className="mt-2 space-y-1 text-xs">
                      {huaweiActionMessage ? <p className="text-zinc-500">{huaweiActionMessage}</p> : null}
                      {cloneActionMessage ? (
                        <p className={cloneActionIsError ? "text-red-600" : "text-zinc-500"}>{cloneActionMessage}</p>
                      ) : null}
                      {listShareMessages[selectedList.id] ? <p className="text-zinc-500">{listShareMessages[selectedList.id]}</p> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Badge variant="outline">{selectedCartProducts.length} items</Badge>
                  {selectedList?.huaweiCartKey ? <Badge variant="secondary">Huawei linked</Badge> : null}
                  {selectedList?.canShare ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openActionModal({ kind: "list-share", listId: selectedList.id })}
                      aria-label={`Share ${selectedList.name}`}
                    >
                      <Share2 className="size-4" />
                    </Button>
                  ) : null}
                  {selectedList ? (
                    <ActionMenu
                      open={isCartMenuOpen}
                      onOpenChange={setIsCartMenuOpen}
                      label={`Open actions for ${selectedList.name}`}
                      items={selectedCartMenuItems}
                    />
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[620px] px-4 xl:h-[calc(100vh-15rem)]">
                <div className="space-y-3 py-3">
                  {!selectedList ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      Create a list and select it to use it as the active cart.
                    </div>
                  ) : null}

                  {selectedList && selectedCartProducts.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      This cart is empty.
                    </div>
                  ) : null}

                  {selectedCartProducts.map((product) => {
                    const serviceMeta = getServiceMeta(product.serviceCode, product.serviceName);
                    const priceSummary = splitProductPriceSummary(product);
                    const isEditingProduct = editingProductId === product.id;

                    return (
                      <div
                        key={product.id}
                        className={`rounded-lg border p-4 ${
                          isEditingProduct ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              {serviceMeta ? (
                                <Image
                                  src={serviceMeta.icon}
                                  alt=""
                                  width={28}
                                  height={28}
                                  className="mt-0.5 size-7 rounded-md object-contain"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-medium">{product.title}</p>
                                  {isEditingProduct ? <Badge>Editing</Badge> : null}
                                </div>
                                <p className="mt-1 text-sm text-zinc-500">{getProductConfigSummary(product)}</p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {product.serviceCode} · {product.productType.toUpperCase()} · Qty {product.quantity}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-lg font-semibold text-zinc-950">{priceSummary.amount}</p>
                            <p className="text-sm text-zinc-500">{priceSummary.timeframe ?? "Saved item"}</p>
                            <div className="mt-3 flex items-center gap-2 sm:justify-end">
                              {isEditingProduct ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    disabled={addToListPending || deletingProductId === product.id}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAddToList}
                                    disabled={addToListPending || !selectedListId || !isSignedIn || deletingProductId === product.id}
                                  >
                                    {addToListPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEditProduct(product)}
                                  disabled={deletingProductId === product.id}
                                  aria-label={`Edit ${product.title}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteProduct(product)}
                                disabled={deletingProductId === product.id}
                                aria-label={deletingProductId === product.id ? `Deleting ${product.title}` : `Delete ${product.title}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </main>
        {resourceExportModal ? (
          <ActionModal
            title={resourceExportModal.title}
            description={resourceExportModal.description}
            onClose={() => setResourceExportModal(null)}
            panelClassName="max-w-4xl"
          >
            <textarea
              value={resourceExportModal.json}
              readOnly
              spellCheck={false}
              className="h-[26rem] w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-xs leading-6 text-zinc-800 outline-none"
              aria-label="Resource export JSON"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">
                {resourceExportActionMessage || `${formatNumber(resourceExportModal.json.split("\n").length)} lines ready to copy or download.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void handleCopyResourceExport()}>
                  <Copy className="size-4" />
                  Copy JSON
                </Button>
                <Button type="button" variant="outline" onClick={handleDownloadResourceExport}>
                  <Download className="size-4" />
                  Download JSON
                </Button>
              </div>
            </div>
          </ActionModal>
        ) : null}
        {activeModal && activeProject ? (
          <ActionModal
            title={
              activeModal.kind === "project-huawei"
                ? "Create Huawei Carts"
                : activeModal.kind === "project-clone"
                  ? "Clone Project"
                  : activeModal.kind === "project-share"
                    ? "Share Project"
                    : activeModal.kind === "list-link"
                      ? "Link Huawei Cart"
                      : activeModal.kind === "list-clone"
                        ? "Clone Cart"
                        : "Share Cart"
            }
            description={
              activeModal.kind === "project-huawei"
                ? "Create or update one Huawei cart for every NeoCalculator cart in this project."
                : activeModal.kind === "project-clone"
                  ? "Clone every cart in this project into a new project, with optional region and billing conversion."
                  : activeModal.kind === "project-share"
                    ? "Choose whether recipients should import a detached copy or join a collaborative project."
                    : activeModal.kind === "list-link"
                      ? "Link this cart to an existing Huawei calculator cart using the saved Huawei Cloud cookie."
                      : activeModal.kind === "list-clone"
                        ? "Clone this cart with optional region and billing conversion."
                        : "Create a detached copy link or a collaborative cart link for this cart only."
            }
            onClose={() => setActiveModal(null)}
          >
            {activeModal.kind === "project-huawei" ? (
              <>
                {activeProjectHuaweiMessage ? (
                  <p className={`text-sm ${activeProjectHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeProjectHuaweiMessage}
                  </p>
                ) : !cookieValue.trim() ? (
                  <p className="text-sm text-zinc-500">Save a Huawei Cloud cookie on the dashboard to enable project sync.</p>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Existing Huawei-linked carts are updated; unlinked carts will create new Huawei carts.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => void handleSyncProjectHuawei(activeProject)}
                    disabled={isActiveProjectSyncing || activeProject.lists.length === 0 || !cookieValue.trim()}
                  >
                    {isActiveProjectSyncing ? "Creating Huawei Carts..." : "Create Huawei Carts"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeModal.kind === "project-clone" ? (
              <>
                <Input
                  value={projectCloneNameDrafts[activeProject.id] ?? ""}
                  onChange={(event) =>
                    setProjectCloneNameDrafts((current) => ({
                      ...current,
                      [activeProject.id]: event.target.value,
                    }))}
                  placeholder={getProjectCloneDefaultName(
                    activeProject.name,
                    activeProjectCloneTargetRegion,
                    activeProjectCloneTargetBillingMode,
                  )}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={activeProjectCloneTargetRegion || "__keep"}
                    onValueChange={(value) =>
                      setProjectCloneTargetRegions((current) => ({
                        ...current,
                        [activeProject.id]: value && value !== "__keep" ? (value as HuaweiRegionKey) : "",
                      }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {activeProjectCloneTargetRegion
                          ? `Region: ${huaweiRegions[activeProjectCloneTargetRegion].short}`
                          : "Keep current region"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current region</SelectItem>
                      {cloneableRegions.map(([value, labels]) => (
                        <SelectItem key={value} value={value}>
                          {labels.short}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={activeProjectCloneTargetBillingMode || "__keep"}
                    onValueChange={(value) =>
                      setProjectCloneTargetBillingModes((current) => ({
                        ...current,
                        [activeProject.id]: value && value !== "__keep" ? (value as BillingOption) : "",
                      }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {activeProjectCloneTargetBillingMode
                          ? `Billing: ${activeProjectCloneTargetBillingMode}`
                          : "Keep current billing"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current billing</SelectItem>
                      {options.billing.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeProjectCloneMessage ? (
                  <p className={`text-sm ${activeProjectCloneMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeProjectCloneMessage}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">Huawei links are not copied to the cloned project.</p>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => void handleCloneProject(activeProject)} disabled={isActiveProjectCloning}>
                    {isActiveProjectCloning ? "Cloning Project..." : "Clone Project"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeModal.kind === "project-share" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("project", activeProject.id, "copy")}
                    disabled={sharingProjectKey === `project:${activeProject.id}:copy`}
                  >
                    {sharingProjectKey === `project:${activeProject.id}:copy` ? "Sharing..." : "Copy Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("project", activeProject.id, "collaborate")}
                    disabled={sharingProjectKey === `project:${activeProject.id}:collaborate`}
                  >
                    {sharingProjectKey === `project:${activeProject.id}:collaborate` ? "Sharing..." : "Collaborative Link"}
                  </Button>
                </div>
                {activeProjectShareMessage ? <p className="text-sm text-zinc-600">{activeProjectShareMessage}</p> : null}
              </>
            ) : null}

            {activeList && activeModal.kind === "list-link" ? (
              <>
                {activeList.huaweiCartKey ? (
                  <p className="text-sm text-zinc-600">Linked to {activeList.huaweiCartName || activeList.huaweiCartKey}</p>
                ) : null}
                {activeList.huaweiLastSyncedAt ? (
                  <p className="text-sm text-zinc-500">Last Huawei sync: {formatDateTime(activeList.huaweiLastSyncedAt)}</p>
                ) : null}
                {activeList.huaweiLastError ? <p className="text-sm text-red-600">{activeList.huaweiLastError}</p> : null}
                {activeListHuaweiMessage ? (
                  <p className="text-sm text-zinc-600">{activeListHuaweiMessage}</p>
                ) : !cookieValue.trim() ? (
                  <p className="text-sm text-zinc-500">Save a Huawei Cloud cookie on the dashboard to load linkable carts here.</p>
                ) : null}
                <Select
                  value={activeSelectedHuaweiCartKey || "__unlinked"}
                  onValueChange={(value) => setSelectedHuaweiCartKey(value && value !== "__unlinked" ? value : "")}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {activeSelectedHuaweiCartKey
                        ? `Huawei: ${activeSelectedHuaweiCart?.name ?? activeList.huaweiCartName ?? activeSelectedHuaweiCartKey}`
                        : "Choose Huawei cart to link"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unlinked">No Huawei link selected</SelectItem>
                    {activeList.huaweiCartKey && !huaweiCarts.some((cart) => cart.key === activeList.huaweiCartKey) ? (
                      <SelectItem value={activeList.huaweiCartKey}>
                        {activeList.huaweiCartName ?? activeList.huaweiCartKey}
                      </SelectItem>
                    ) : null}
                    {huaweiCarts.map((cart) => {
                      const linkedElsewhere = Boolean(cart.associatedListId && cart.associatedListId !== activeList.id);
                      return (
                        <SelectItem key={cart.key} value={cart.key} disabled={linkedElsewhere}>
                          {cart.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={handleLinkSelectedList}
                    disabled={!activeSelectedHuaweiCartKey || isActiveListLinking}
                  >
                    {isActiveListLinking ? "Linking..." : "Link Huawei Cart"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeList && activeModal.kind === "list-clone" ? (
              <>
                <Input
                  value={cloneNameDraft}
                  onChange={(event) => setCloneNameDraft(event.target.value)}
                  placeholder={getCartCloneDefaultName(activeList.name, cloneTargetRegion, cloneTargetBillingMode)}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={cloneTargetRegion || "__keep"}
                    onValueChange={(value) => setCloneTargetRegion(value && value !== "__keep" ? (value as HuaweiRegionKey) : "")}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {cloneTargetRegion ? `Region: ${huaweiRegions[cloneTargetRegion].short}` : "Keep current region"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current region</SelectItem>
                      {cloneableRegions.map(([value, labels]) => (
                        <SelectItem key={value} value={value}>
                          {labels.short}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={cloneTargetBillingMode || "__keep"}
                    onValueChange={(value) => setCloneTargetBillingMode(value && value !== "__keep" ? (value as BillingOption) : "")}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue>
                        {cloneTargetBillingMode ? `Billing: ${cloneTargetBillingMode}` : "Keep current billing"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep">Keep current billing</SelectItem>
                      {options.billing.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeListCloneMessage ? (
                  <p className={`text-sm ${activeListCloneMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                    {activeListCloneMessage}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">ECS items are reselected by the cheapest flavor that meets or exceeds the current vCPU and RAM.</p>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleCloneSelectedList} disabled={isActiveListCloning}>
                    {isActiveListCloning ? "Cloning..." : "Clone Cart"}
                  </Button>
                </div>
              </>
            ) : null}

            {activeList && activeModal.kind === "list-share" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("list", activeList.id, "copy")}
                    disabled={sharingListKey === `list:${activeList.id}:copy`}
                  >
                    {sharingListKey === `list:${activeList.id}:copy` ? "Sharing..." : "Copy Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateShare("list", activeList.id, "collaborate")}
                    disabled={sharingListKey === `list:${activeList.id}:collaborate`}
                  >
                    {sharingListKey === `list:${activeList.id}:collaborate` ? "Sharing..." : "Collaborative Link"}
                  </Button>
                </div>
                {activeListShareMessage ? <p className="text-sm text-zinc-600">{activeListShareMessage}</p> : null}
              </>
            ) : null}
          </ActionModal>
        ) : null}
      </div>
    </div>
  );
}
