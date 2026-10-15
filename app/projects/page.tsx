"use client";
import { ActionMenu, ActionModal, type ActionMenuItem } from "@/components/home-page-shell-parts";
import { getCartCloneDefaultName, getProjectCloneDefaultName, getResponseError } from "@/lib/calculator-page-helpers";
import type { AppList, AppProject, BillingOption } from "@/lib/calculator-types";
import { useProjectActions } from "@/lib/dashboard/use-project-actions";
import { useProjectCloning } from "@/lib/dashboard/use-project-cloning";
import { useResourceSharing } from "@/lib/dashboard/use-resource-sharing";
import { useResourceTransfer } from "@/lib/dashboard/use-resource-transfer";
import type { ActiveModal } from "@/lib/page-utils";
import { getProductConfigSummary as getProductSpecsSummary } from "@/lib/product-config-summary";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ProjectAddCartModalContent } from "@/components/project-add-cart-modal-content";
import { ResourceImportInputs } from "@/components/dashboard/resource-import-inputs";
import { useSessionContext } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { findServiceCatalogEntry } from "@/lib/service-config";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Link2,
  Pencil,
  Plus,
  Share2,
  ShoppingCart,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const billingOptions: BillingOption[] = ["Pay-per-use", "RI", "Yearly/Monthly", "One-time"];

function getServiceMeta(serviceCode: string, serviceName: string) {
  return findServiceCatalogEntry(serviceCode, serviceName);
}

export default function ProjectsPage() {
  const { session, isPending: isSessionPending } = useSessionContext();
  const hasMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listNameDrafts, setListNameDrafts] = useState<Record<string, string>>({});
  const [renamingListId, setRenamingListId] = useState<string | null>(null);

  const [listProjectDrafts, setListProjectDrafts] = useState<Record<string, string>>({});
  const [movingListId, setMovingListId] = useState<string | null>(null);

  const [listCloneNameDrafts, setListCloneNameDrafts] = useState<Record<string, string>>({});
  const [listCloneTargetRegions, setListCloneTargetRegions] = useState<Record<string, HuaweiRegionKey | "">>({});
  const [listCloneTargetBillingModes, setListCloneTargetBillingModes] = useState<Record<string, BillingOption | "">>(
    {},
  );
  const [cloningListId, setCloningListId] = useState<string | null>(null);
  const [listCloneMessages, setListCloneMessages] = useState<Record<string, string>>({});
  const [listCloneMessageErrors, setListCloneMessageErrors] = useState<Record<string, boolean>>({});
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [openListMenuId, setOpenListMenuId] = useState<string | null>(null);
  const [isProjectCreateMenuOpen, setIsProjectCreateMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const cloneableRegions = (
    Object.entries(huaweiRegions) as Array<[HuaweiRegionKey, (typeof huaweiRegions)[HuaweiRegionKey]]>
  ).filter(([, labels]) => Boolean(labels.catalogRegionId));

  const totals = useMemo(() => {
    const listCount = projects.reduce((sum, project) => sum + project.lists.length, 0);
    const productCount = projects.reduce(
      (sum, project) => sum + project.lists.reduce((listSum, list) => listSum + list.productCount, 0),
      0,
    );

    return {
      listCount,
      productCount,
    };
  }, [projects]);

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project] as const)), [projects]);

  const listsById = useMemo(
    () => new Map(projects.flatMap((project) => project.lists.map((list) => [list.id, { list, project }] as const))),
    [projects],
  );

  const activeProject =
    activeModal == null
      ? null
      : "projectId" in activeModal
        ? (projectsById.get(activeModal.projectId) ?? null)
        : (listsById.get(activeModal.listId)?.project ?? null);

  const activeList =
    activeModal != null && "listId" in activeModal ? (listsById.get(activeModal.listId)?.list ?? null) : null;

  const loadProjects = useCallback(async () => {
    if (!session?.user.id) {
      setProjects([]);
      setProjectsError("");
      setProjectsLoading(false);
      return;
    }

    setProjectsLoading(true);
    setProjectsError("");

    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as AppProject[] | { error?: string } | null;

      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(getResponseError(payload, "Failed to load projects"));
      }

      setProjects(payload);
      setExpandedProjects((current) => {
        const nextState: Record<string, boolean> = {};
        payload.forEach((project, index) => {
          nextState[project.id] = current[project.id] ?? index === 0;
        });
        return nextState;
      });
      setExpandedLists((current) => {
        const nextState = { ...current };
        const validListIds = new Set(payload.flatMap((project) => project.lists.map((list) => list.id)));
        Object.keys(nextState).forEach((listId) => {
          if (!validListIds.has(listId)) {
            delete nextState[listId];
          }
        });
        return nextState;
      });
    } catch (error) {
      setProjects([]);
      setProjectsError(error instanceof Error ? error.message : "Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);


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

  const handleStartListRename = (list: AppList) => {
    setEditingListId(list.id);
    setListNameDrafts((current) => ({
      ...current,
      [list.id]: current[list.id] ?? list.name,
    }));
    setProjectsError("");
  };

  const handleCancelListRename = (list: AppList) => {
    setEditingListId((current) => (current === list.id ? null : current));
    setListNameDrafts((current) => ({
      ...current,
      [list.id]: list.name,
    }));
  };

  const handleRenameList = async (list: AppList, projectId: string) => {
    const name = (listNameDrafts[list.id] ?? list.name).trim();
    if (!name) {
      setProjectsError("Cart name is required.");
      return;
    }

    if (name === list.name) {
      setEditingListId(null);
      return;
    }

    setRenamingListId(list.id);
    setProjectsError("");

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { id: string; projectId: string; name: string; updatedAt: string }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to rename cart"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((item) =>
                  item.id === payload.id
                    ? {
                        ...item,
                        name: payload.name,
                        updatedAt: payload.updatedAt,
                      }
                    : item,
                ),
              }
            : project,
        ),
      );
      setListNameDrafts((current) => ({ ...current, [list.id]: payload.name }));
      setEditingListId(null);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to rename cart");
    } finally {
      setRenamingListId(null);
    }
  };

  const handleMoveList = async (list: AppList, projectId: string) => {
    const targetProjectId = listProjectDrafts[list.id] ?? projectId;

    if (!targetProjectId || targetProjectId === projectId) {
      return;
    }

    setMovingListId(list.id);
    setProjectsError("");

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: targetProjectId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            id: string;
            projectId: string;
            previousProjectId?: string;
            updatedAt: string;
            huaweiCartKey: string | null;
            huaweiCartName: string | null;
            huaweiLastError: string | null;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to move cart"));
      }

      setProjects((current) => {
        const sourceProjectId = payload.previousProjectId ?? projectId;
        const sourceProject = current.find((item) => item.id === sourceProjectId) ?? null;
        const sourceList = sourceProject?.lists.find((item) => item.id === payload.id) ?? null;

        if (!sourceList) {
          return current;
        }

        const movedList: AppList = {
          ...sourceList,
          updatedAt: payload.updatedAt,
          huaweiCartKey: payload.huaweiCartKey,
          huaweiCartName: payload.huaweiCartName,
          huaweiLastError: payload.huaweiLastError,
        };

        return current.map((project) => {
          if (project.id === sourceProjectId) {
            return {
              ...project,
              updatedAt: payload.updatedAt,
              lists: project.lists.filter((item) => item.id !== payload.id),
            };
          }

          if (project.id === payload.projectId) {
            return {
              ...project,
              updatedAt: payload.updatedAt,
              lists: [movedList, ...project.lists],
            };
          }

          return project;
        });
      });
      setExpandedProjects((current) => ({
        ...current,
        [projectId]: true,
        [targetProjectId]: true,
      }));
      setExpandedLists((current) => ({ ...current, [list.id]: true }));
      setListProjectDrafts((current) => ({ ...current, [list.id]: targetProjectId }));
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to move cart");
    } finally {
      setMovingListId(null);
    }
  };

  const handleCloneList = async (list: AppList, projectId: string) => {
    setCloningListId(list.id);
    setListCloneMessages((current) => ({ ...current, [list.id]: "" }));
    setListCloneMessageErrors((current) => ({ ...current, [list.id]: false }));

    try {
      const response = await fetch(`/api/lists/${list.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: listCloneNameDrafts[list.id]?.trim() || undefined,
          targetRegion: listCloneTargetRegions[list.id] || undefined,
          targetBillingMode: listCloneTargetBillingModes[list.id] || undefined,
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
          project.id === projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: [...project.lists, payload],
              }
            : project,
        ),
      );
      setExpandedProjects((current) => ({ ...current, [projectId]: true }));
      setExpandedLists((current) => ({ ...current, [payload.id]: true }));
      setListCloneNameDrafts((current) => ({ ...current, [list.id]: "" }));
      setListCloneTargetRegions((current) => ({ ...current, [list.id]: "" }));
      setListCloneTargetBillingModes((current) => ({ ...current, [list.id]: "" }));
      setListCloneMessages((current) => ({
        ...current,
        [list.id]: `Cloned ${list.name} into ${payload.name}. Converted ${payload.cloneSummary?.convertedEcsCount ?? 0} ECS item(s).`,
      }));
      setListCloneMessageErrors((current) => ({ ...current, [list.id]: false }));
    } catch (error) {
      setListCloneMessages((current) => ({
        ...current,
        [list.id]: error instanceof Error ? error.message : "Unable to clone cart",
      }));
      setListCloneMessageErrors((current) => ({ ...current, [list.id]: true }));
    } finally {
      setCloningListId(null);
    }
  };

  const [, setSelectedListId] = useState("");
  const { sharingProjectKey, sharingListKey, projectShareMessages, listShareMessages, handleCreateShare } =
    useResourceSharing();
  const transfer = useResourceTransfer({ session, setProjectsError, reloadProjectsSnapshot: loadProjects });
  const {
    importProjectPending,
    importProjectMessage,
    importProjectMessageIsError,
    resourceExportModal,
    setResourceExportModal,
    resourceExportActionMessage,
    projectImportMessages,
    projectImportMessageErrors,
    projectExportMessages,
    projectExportMessageErrors,
    importCartPendingProjectId,
    openProjectImportPicker,
    openCartImportPicker,
    handleOpenProjectExport,
    handleOpenListExport,
    handleExportProjectExcel,
    handleCopyResourceExport,
    handleDownloadResourceExport,
  } = transfer;
  const {
    projectCloneNameDrafts,
    setProjectCloneNameDrafts,
    projectCloneTargetRegions,
    setProjectCloneTargetRegions,
    projectCloneTargetBillingModes,
    setProjectCloneTargetBillingModes,
    cloningProjectId,
    projectCloneMessages,
    setProjectCloneMessages,
    projectCloneMessageErrors,
    setProjectCloneMessageErrors,
    handleCloneProject,
  } = useProjectCloning({ setProjects, setExpandedProjects });
  const {
    newProjectName,
    setNewProjectName,
    newProjectPending,
    editingProjectId,
    projectNameDrafts,
    setProjectNameDrafts,
    renamingProjectId,
    deletingProjectId,
    listDrafts,
    setListDrafts,
    listPendingProjectId,
    deletingListId,
    handleCreateProject,
    handleCreateList,
    handleStartProjectRename,
    handleCancelProjectRename,
    handleRenameProject,
    handleDeleteProject,
    handleDeleteList,
  } = useProjectActions({
    session,
    setProjectsError,
    setProjects,
    setExpandedProjects,
    setSelectedListId,
    setActiveModal: (modal) => setActiveModal(modal),
    setProjectCloneNameDrafts,
    setProjectCloneTargetRegions,
    setProjectCloneTargetBillingModes,
    setProjectCloneMessages,
    setProjectCloneMessageErrors,
    editingProductListId: null,
    handleCancelEdit: () => {},
  });

  const openActionModal = (modal: Exclude<ActiveModal, null>) => {
    setOpenProjectMenuId(null);
    setOpenListMenuId(null);
    setActiveModal(modal);
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((current) => ({
      ...current,
      [projectId]: !current[projectId],
    }));
  };

  const toggleList = (listId: string) => {
    setExpandedLists((current) => ({
      ...current,
      [listId]: !current[listId],
    }));
  };

  const activeProjectCloneTargetRegion = activeProject ? (projectCloneTargetRegions[activeProject.id] ?? "") : "";
  const activeProjectCloneTargetBillingMode = activeProject
    ? (projectCloneTargetBillingModes[activeProject.id] ?? "")
    : "";
  const activeProjectCloneMessage = activeProject ? (projectCloneMessages[activeProject.id] ?? "") : "";
  const activeProjectCloneMessageIsError = activeProject
    ? (projectCloneMessageErrors[activeProject.id] ?? false)
    : false;

  const projectCreateMenuItems: ActionMenuItem[] = [
    {
      label: "Import Project",
      icon: <Upload className="size-4" />,
      onSelect: openProjectImportPicker,
      disabled: importProjectPending,
    },
  ];
  const activeProjectShareMessage = activeProject ? (projectShareMessages[activeProject.id] ?? "") : "";
  const isActiveProjectCloning = activeProject ? cloningProjectId === activeProject.id : false;

  const activeListParentProjectId =
    activeList && activeProject && "listId" in (activeModal ?? {}) ? activeProject.id : "";
  const activeListTargetProjectId =
    activeList && activeProject ? (listProjectDrafts[activeList.id] ?? activeProject.id) : "";

  const activeListCloneTargetRegion = activeList ? (listCloneTargetRegions[activeList.id] ?? "") : "";
  const activeListCloneTargetBillingMode = activeList ? (listCloneTargetBillingModes[activeList.id] ?? "") : "";
  const activeListCloneMessage = activeList ? (listCloneMessages[activeList.id] ?? "") : "";
  const activeListCloneMessageIsError = activeList ? (listCloneMessageErrors[activeList.id] ?? false) : false;

  const activeListShareMessage = activeList ? (listShareMessages[activeList.id] ?? "") : "";
  const isActiveListMoving = activeList ? movingListId === activeList.id : false;

  const isActiveListCloning = activeList ? cloningListId === activeList.id : false;
  const showSessionState = hasMounted && !isSessionPending;
  const anyProjectExpanded = Object.values(expandedProjects).some(Boolean);

  return (
    <main className="min-h-screen bg-zinc-100 bg-grid-pattern px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Projects</h1>
        {!showSessionState ? (
          <Card>
            <CardContent className="py-12 text-center text-zinc-500">Checking session...</CardContent>
          </Card>
        ) : null}
        {showSessionState && !session ? (
          <Card className="mx-auto max-w-xl shadow-sm">
            <CardHeader>
              <CardTitle>Sign in to use projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-500">
              <p>
                Sign in to organize carts into projects. Local carts can be saved, exported and shared without an account.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/sign-in" className={buttonVariants()}>Sign In</Link>
                <Link href="/cart" className={buttonVariants({ variant: "outline" })}>Open local carts</Link>
              </div>
            </CardContent>
          </Card>
        ) : null}
        <ResourceImportInputs transfer={transfer} />

        {showSessionState && session ? (
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {projects.length} project{projects.length !== 1 ? "s" : ""}, {totals.listCount} cart
                    {totals.listCount !== 1 ? "s" : ""}, {totals.productCount} product
                    {totals.productCount !== 1 ? "s" : ""}.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="New project name"
                />
                <Button
                  size="sm"
                  onClick={handleCreateProject}
                  disabled={newProjectPending}
                  className="bg-zinc-950 hover:bg-zinc-800"
                >
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
                <p className={`text-sm ${importProjectMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                  {importProjectMessage}
                </p>
              ) : null}
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[75vh] px-4">
                <div className={`grid gap-4 py-4 ${anyProjectExpanded ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"}`}>
                  {projectsLoading ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      Loading projects...
                    </div>
                  ) : null}
                  {!projectsLoading && projects.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                      No projects found.
                    </div>
                  ) : null}

                  {projects.map((project) => {
                    const isExpanded = expandedProjects[project.id] ?? false;
                    const isEditingProject = editingProjectId === project.id;
                    const isRenamingProject = renamingProjectId === project.id;
                    const isDeletingProject = deletingProjectId === project.id;

                    const projectImportMessage = projectImportMessages[project.id] ?? "";
                    const projectImportMessageIsError = projectImportMessageErrors[project.id] ?? false;
                    const projectExportMessage = projectExportMessages[project.id] ?? "";
                    const projectExportMessageIsError = projectExportMessageErrors[project.id] ?? false;
                    const cloneMessage = projectCloneMessages[project.id] ?? "";
                    const cloneMessageIsError = projectCloneMessageErrors[project.id] ?? false;
                    const projectShareMessage = projectShareMessages[project.id] ?? "";
                    const projectMenuItems: ActionMenuItem[] = [
                      {
                        label: "Import Cart",
                        icon: <Upload className="size-4" />,
                        onSelect: () => openCartImportPicker(project.id),
                        disabled: importCartPendingProjectId === project.id,
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
                      <div
                        key={project.id}
                        className={`rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md ${isExpanded ? "xl:col-span-2" : ""}`}
                      >
                        <div className="flex items-start gap-3 p-5">
                          <div className="min-w-0 flex-1">
                            {isEditingProject ? (
                              <div className="space-y-2">
                                <Input
                                  value={projectNameDrafts[project.id] ?? project.name}
                                  onChange={(event) =>
                                    setProjectNameDrafts((current) => ({
                                      ...current,
                                      [project.id]: event.target.value,
                                    }))
                                  }
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
                                <p className="text-lg font-semibold text-zinc-950">{project.name}</p>
                                <p className="mt-1 text-sm text-zinc-500">
                                  {project.lists.length} carts ·{" "}
                                  {project.lists.reduce((sum, list) => sum + list.productCount, 0)} products · Updated{" "}
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
                                >
                                  <Check className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelProjectRename(project)}
                                  disabled={isRenamingProject}
                                >
                                  <X className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Add cart to ${project.name}`}
                                  onClick={() => openActionModal({ kind: "project-add-cart", projectId: project.id })}
                                  disabled={listPendingProjectId === project.id}
                                >
                                  <Plus className="size-4" />
                                </Button>
                                {project.canShare ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Share ${project.name}`}
                                    onClick={() => openActionModal({ kind: "project-share", projectId: project.id })}
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Rename ${project.name}`}
                                  onClick={() => handleStartProjectRename(project)}
                                  disabled={isDeletingProject}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleProject(project.id)}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${project.name}`}
                              onClick={() => void handleDeleteProject(project)}
                              disabled={isDeletingProject || isRenamingProject}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="border-t border-zinc-100 p-5">
                            <div className="space-y-4">
                              {
                              cloneMessage ||
                              projectImportMessage ||
                              projectExportMessage ||
                              projectShareMessage ? (
                                <div className="rounded-xl border bg-zinc-50 p-3">
                                  <div className="space-y-1 text-xs">

                                    {cloneMessage ? (
                                      <p className={cloneMessageIsError ? "text-red-600" : "text-zinc-600"}>
                                        {cloneMessage}
                                      </p>
                                    ) : null}
                                    {projectImportMessage ? (
                                      <p className={projectImportMessageIsError ? "text-red-600" : "text-zinc-600"}>
                                        {projectImportMessage}
                                      </p>
                                    ) : null}
                                    {projectExportMessage ? (
                                      <p className={projectExportMessageIsError ? "text-red-600" : "text-zinc-600"}>
                                        {projectExportMessage}
                                      </p>
                                    ) : null}
                                    {projectShareMessage ? (
                                      <p className="text-zinc-600">{projectShareMessage}</p>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                              <div className={`grid gap-3 grid-cols-1 ${isExpanded ? "" : "lg:grid-cols-2"}`}>
                                {project.lists.length === 0 ? (
                                  <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                                    This project does not have carts yet.
                                  </div>
                                ) : null}

                                {project.lists.map((list) => {
                                  const isListExpanded = expandedLists[list.id] ?? false;
                                  const isEditingList = editingListId === list.id;
                                  const isRenamingList = renamingListId === list.id;

                                  const listCloneMessage = listCloneMessages[list.id] ?? "";
                                  const listCloneMessageIsError = listCloneMessageErrors[list.id] ?? false;
                                  const listShareMessage = listShareMessages[list.id] ?? "";
                                  const listMenuItems: ActionMenuItem[] = [
                                    {
                                      label: "Move Cart",
                                      icon: <ArrowRightLeft className="size-4" />,
                                      onSelect: () => openActionModal({ kind: "list-move", listId: list.id }),
                                    },
                                    {
                                      label: "Export to Huawei Cloud",
                                      icon: <Link2 className="size-4" />,
                                      onSelect: () => { window.location.href = `/huawei-carts?exportCart=${encodeURIComponent(list.id)}`; },
                                    },
                                    {
                                      label: "Export Cart JSON",
                                      icon: <Download className="size-4" />,
                                      onSelect: () => handleOpenListExport(project, list),
                                    },
                                    {
                                      label: "Clone Cart",
                                      icon: <Copy className="size-4" />,
                                      onSelect: () => openActionModal({ kind: "list-clone", listId: list.id }),
                                    },
                                    ...(list.canShare
                                      ? [
                                          {
                                            label: "Share Cart",
                                            icon: <Share2 className="size-4" />,
                                            onSelect: () => openActionModal({ kind: "list-share", listId: list.id }),
                                          },
                                        ]
                                      : []),
                                  ];

                                  return (
                                    <div
                                      key={list.id}
                                      className="rounded-xl border border-zinc-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                                    >
                                      <div className="flex items-start gap-2 p-4">
                                        <div className="min-w-0 flex-1">
                                          {isEditingList ? (
                                            <div className="space-y-2">
                                              <Input
                                                value={listNameDrafts[list.id] ?? list.name}
                                                onChange={(event) =>
                                                  setListNameDrafts((current) => ({
                                                    ...current,
                                                    [list.id]: event.target.value,
                                                  }))
                                                }
                                                onKeyDown={(event) => {
                                                  if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    void handleRenameList(list, project.id);
                                                  }

                                                  if (event.key === "Escape") {
                                                    event.preventDefault();
                                                    handleCancelListRename(list);
                                                  }
                                                }}
                                                autoFocus
                                                placeholder="Cart name"
                                              />
                                              <p className="text-xs text-zinc-500">
                                                Press Enter to save or Escape to cancel.
                                              </p>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              className="min-w-0 w-full text-left"
                                              onClick={() => toggleList(list.id)}
                                              aria-expanded={isListExpanded}
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                      <ShoppingCart className="size-4 shrink-0 text-zinc-500" />
                                                      <p className="truncate font-medium text-zinc-950">{list.name}</p>
                                                    </div>

                                                  </div>
                                                  <p className="mt-1 text-sm text-zinc-500">
                                                    {list.productCount} products · Created {formatDate(list.createdAt)}
                                                  </p>

                                                </div>
                                                <Badge variant="outline">{list.productCount}</Badge>
                                              </div>
                                            </button>
                                          )}
                                        </div>
                                        {isEditingList ? (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => void handleRenameList(list, project.id)}
                                              disabled={isRenamingList}
                                            >
                                              <Check className="size-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleCancelListRename(list)}
                                              disabled={isRenamingList}
                                            >
                                              <X className="size-4" />
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            {list.canShare ? (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Share ${list.name}`}
                                                onClick={() => openActionModal({ kind: "list-share", listId: list.id })}
                                              >
                                                <Share2 className="size-4" />
                                              </Button>
                                            ) : null}
                                            <ActionMenu
                                              open={openListMenuId === list.id}
                                              onOpenChange={(open) => setOpenListMenuId(open ? list.id : null)}
                                              label={`Open actions for ${list.name}`}
                                              items={listMenuItems}
                                            />
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleStartListRename(list)}
                                              disabled={deletingListId === list.id}
                                            >
                                              <Pencil className="size-4" />
                                            </Button>
                                          </>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => toggleList(list.id)}
                                          aria-expanded={isListExpanded}
                                        >
                                          {isListExpanded ? (
                                            <ChevronDown className="size-4" />
                                          ) : (
                                            <ChevronRight className="size-4" />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => void handleDeleteList(list, project.id)}
                                          disabled={deletingListId === list.id}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </div>

                                      {isListExpanded ? (
                                        <div className="border-t border-zinc-200 px-4 py-3">
                                          <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
                                            {

                                            listCloneMessage ||
                                            listShareMessage ? (
                                              <div className="rounded-lg border bg-white p-3 text-xs">
                                                <div className="space-y-1">

                                                  {listCloneMessage ? (
                                                    <p
                                                      className={
                                                        listCloneMessageIsError ? "text-red-600" : "text-zinc-600"
                                                      }
                                                    >
                                                      {listCloneMessage}
                                                    </p>
                                                  ) : null}
                                                  {listShareMessage ? (
                                                    <p className="text-zinc-600">{listShareMessage}</p>
                                                  ) : null}
                                                </div>
                                              </div>
                                            ) : null}
                                            {list.products.length === 0 ? (
                                              <div className="lg:col-span-2 2xl:col-span-3 rounded-lg border border-dashed bg-white p-4 text-sm text-zinc-500">
                                                This cart does not have products yet.
                                              </div>
                                            ) : (
                                              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                                                {list.products.map((product) => {
                                                  const specsSummary = getProductSpecsSummary(product);
                                                  const serviceMeta = getServiceMeta(
                                                    product.serviceCode,
                                                    product.serviceName,
                                                  );

                                                  return (
                                                    <div
                                                      key={product.id}
                                                      className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 transition-colors hover:bg-zinc-50"
                                                    >
                                                      <div className="flex items-start justify-between gap-3">
                                                        <div className="flex min-w-0 items-start gap-3">
                                                          {serviceMeta ? (
                                                            <Image
                                                              src={serviceMeta.icon}
                                                              alt=""
                                                              width={36}
                                                              height={36}
                                                              className="mt-0.5 size-9 shrink-0 rounded-md object-contain"
                                                            />
                                                          ) : (
                                                            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-medium text-zinc-500">
                                                              {product.serviceCode.slice(0, 2).toUpperCase()}
                                                            </div>
                                                          )}
                                                          <div className="min-w-0">
                                                            <p className="font-medium text-zinc-950">{product.title}</p>
                                                            <p className="mt-1 text-sm text-zinc-500">
                                                              {product.serviceName} · Qty {product.quantity}
                                                            </p>
                                                            {specsSummary ? (
                                                              <p className="mt-1 text-xs text-zinc-400">
                                                                {specsSummary}
                                                              </p>
                                                            ) : null}
                                                          </div>
                                                        </div>
                                                        <Badge variant="outline">{product.quantity}</Badge>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : null}
      </div>
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
              {resourceExportActionMessage ||
                `${formatNumber(resourceExportModal.json.split("\n").length)} lines ready to copy or download.`}
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
            activeModal.kind === "project-add-cart"
              ? "Add Cart"
              : activeModal.kind === "project-clone"
                  ? "Clone Project"
                  : activeModal.kind === "project-share"
                    ? "Share Project"
                    : activeModal.kind === "list-move"
                      ? "Move Cart"
                      : activeModal.kind === "list-clone"
                          ? "Clone Cart"
                          : "Share Cart"
          }
          description={
            activeModal.kind === "project-add-cart"
              ? "Create a new cart in this project."
              : activeModal.kind === "project-clone"
                  ? "Clone every cart in this project into a new project, with optional region and billing conversion."
                  : activeModal.kind === "project-share"
                    ? "Choose whether recipients should import a detached copy or join a collaborative project."
                    : activeModal.kind === "list-move"
                      ? "Reassign this cart to a different project without cloning it."
                      : activeModal.kind === "list-clone"
                          ? "Clone this cart with optional region and billing conversion."
                          : "Create a detached copy link or a collaborative cart link for this cart only."
          }
          onClose={() => setActiveModal(null)}
        >
          {activeModal.kind === "project-add-cart" ? (
            <ProjectAddCartModalContent
              projectId={activeProject.id}
              listName={listDrafts[activeProject.id] ?? ""}
              onListNameChange={(value) => setListDrafts((current) => ({ ...current, [activeProject.id]: value }))}

              pending={listPendingProjectId === activeProject.id}
              onSubmit={() => void handleCreateList(activeProject.id)}
            />
          ) : null}

          {activeModal.kind === "project-clone" ? (
            <>
              <Input
                value={projectCloneNameDrafts[activeProject.id] ?? ""}
                onChange={(event) =>
                  setProjectCloneNameDrafts((current) => ({
                    ...current,
                    [activeProject.id]: event.target.value,
                  }))
                }
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
                    }))
                  }
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
                    }))
                  }
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
                    {billingOptions.map((option) => (
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
                <Button
                  variant="outline"
                  onClick={() => void handleCloneProject(activeProject)}
                  disabled={isActiveProjectCloning}
                >
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
                  {sharingProjectKey === `project:${activeProject.id}:collaborate`
                    ? "Sharing..."
                    : "Collaborative Link"}
                </Button>
              </div>
              {activeProjectShareMessage ? <p className="text-sm text-zinc-600">{activeProjectShareMessage}</p> : null}
            </>
          ) : null}

          {activeList && activeModal.kind === "list-move" ? (
            <>
              <Select
                value={activeListTargetProjectId}
                onValueChange={(value) =>
                  setListProjectDrafts((current) => ({
                    ...current,
                    [activeList.id]: value || activeProject.id,
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((candidateProject) => (
                    <SelectItem key={candidateProject.id} value={candidateProject.id}>
                      {candidateProject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => void handleMoveList(activeList, activeListParentProjectId)}
                  disabled={
                    activeListTargetProjectId === activeListParentProjectId || isActiveListMoving || projects.length < 2
                  }
                >
                  {isActiveListMoving ? "Moving Cart..." : "Move to Project"}
                </Button>
              </div>
            </>
          ) : null}

          {activeList && activeModal.kind === "list-clone" ? (
            <>
              <Input
                value={listCloneNameDrafts[activeList.id] ?? ""}
                onChange={(event) =>
                  setListCloneNameDrafts((current) => ({
                    ...current,
                    [activeList.id]: event.target.value,
                  }))
                }
                placeholder={getCartCloneDefaultName(
                  activeList.name,
                  activeListCloneTargetRegion,
                  activeListCloneTargetBillingMode,
                )}
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Select
                  value={activeListCloneTargetRegion || "__keep"}
                  onValueChange={(value) =>
                    setListCloneTargetRegions((current) => ({
                      ...current,
                      [activeList.id]: value && value !== "__keep" ? (value as HuaweiRegionKey) : "",
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {activeListCloneTargetRegion
                        ? `Region: ${huaweiRegions[activeListCloneTargetRegion].short}`
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
                  value={activeListCloneTargetBillingMode || "__keep"}
                  onValueChange={(value) =>
                    setListCloneTargetBillingModes((current) => ({
                      ...current,
                      [activeList.id]: value && value !== "__keep" ? (value as BillingOption) : "",
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {activeListCloneTargetBillingMode
                        ? `Billing: ${activeListCloneTargetBillingMode}`
                        : "Keep current billing"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep">Keep current billing</SelectItem>
                    {billingOptions.map((option) => (
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
                <p className="text-sm text-zinc-500">Huawei links are not copied to cloned carts.</p>
              )}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => void handleCloneList(activeList, activeListParentProjectId)}
                  disabled={isActiveListCloning}
                >
                  {isActiveListCloning ? "Cloning Cart..." : "Clone Cart"}
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
    </main>
  );
}
