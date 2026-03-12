"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { Check, ChevronDown, ChevronRight, Link2, Pencil, Trash2, X } from "lucide-react";

type BillingOption = "Pay-per-use" | "RI" | "Yearly/Monthly";

type AppProduct = {
  id: string;
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  updatedAt: string;
};

type AppList = {
  id: string;
  name: string;
  huaweiCartKey: string | null;
  huaweiCartName: string | null;
  huaweiLastSyncedAt: string | null;
  huaweiLastError: string | null;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  products: AppProduct[];
};

type AppProject = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  lists: AppList[];
};

type HuaweiCartSummary = {
  key: string;
  name: string;
  associatedListId: string | null;
};

const billingOptions: BillingOption[] = ["Pay-per-use", "RI", "Yearly/Monthly"];

function getResponseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  return fallback;
}

function getProjectCloneDefaultName(
  projectName: string,
  targetRegion: HuaweiRegionKey | "",
  targetBillingMode: BillingOption | "",
) {
  const base = projectName.trim() || "NeoCalculator project";
  const suffixParts: string[] = [];
  if (targetRegion) {
    suffixParts.push(huaweiRegions[targetRegion].short);
  }
  if (targetBillingMode) {
    suffixParts.push(targetBillingMode);
  }

  return suffixParts.length ? `${base} ${suffixParts.join(" ")}` : `${base} (Copy)`;
}

function getCartCloneDefaultName(
  listName: string,
  targetRegion: HuaweiRegionKey | "",
  targetBillingMode: BillingOption | "",
) {
  const base = listName.trim() || "NeoCalculator cart";
  const suffixParts: string[] = [];
  if (targetRegion) {
    suffixParts.push(huaweiRegions[targetRegion].short);
  }
  if (targetBillingMode) {
    suffixParts.push(targetBillingMode);
  }

  return suffixParts.length ? `${base} (${suffixParts.join(" · ")})` : `${base} (Copy)`;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPending, setNewProjectPending] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectNameDrafts, setProjectNameDrafts] = useState<Record<string, string>>({});
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [listBaseDrafts, setListBaseDrafts] = useState<Record<string, string>>({});
  const [listPendingProjectId, setListPendingProjectId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listNameDrafts, setListNameDrafts] = useState<Record<string, string>>({});
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [cookieValue, setCookieValue] = useState("");
  const [huaweiCarts, setHuaweiCarts] = useState<HuaweiCartSummary[]>([]);
  const [huaweiCartsError, setHuaweiCartsError] = useState("");
  const [huaweiCartsSyncedAt, setHuaweiCartsSyncedAt] = useState<string | null>(null);
  const [listProjectDrafts, setListProjectDrafts] = useState<Record<string, string>>({});
  const [movingListId, setMovingListId] = useState<string | null>(null);
  const [listHuaweiCartDrafts, setListHuaweiCartDrafts] = useState<Record<string, string>>({});
  const [linkingHuaweiListId, setLinkingHuaweiListId] = useState<string | null>(null);
  const [listHuaweiMessages, setListHuaweiMessages] = useState<Record<string, string>>({});
  const [listHuaweiMessageErrors, setListHuaweiMessageErrors] = useState<Record<string, boolean>>({});
  const [syncingHuaweiProjectId, setSyncingHuaweiProjectId] = useState<string | null>(null);
  const [projectHuaweiMessages, setProjectHuaweiMessages] = useState<Record<string, string>>({});
  const [projectHuaweiMessageErrors, setProjectHuaweiMessageErrors] = useState<Record<string, boolean>>({});
  const [projectCloneNameDrafts, setProjectCloneNameDrafts] = useState<Record<string, string>>({});
  const [projectCloneTargetRegions, setProjectCloneTargetRegions] = useState<Record<string, HuaweiRegionKey | "">>({});
  const [projectCloneTargetBillingModes, setProjectCloneTargetBillingModes] = useState<Record<string, BillingOption | "">>({});
  const [cloningProjectId, setCloningProjectId] = useState<string | null>(null);
  const [projectCloneMessages, setProjectCloneMessages] = useState<Record<string, string>>({});
  const [projectCloneMessageErrors, setProjectCloneMessageErrors] = useState<Record<string, boolean>>({});
  const [listCloneNameDrafts, setListCloneNameDrafts] = useState<Record<string, string>>({});
  const [listCloneTargetRegions, setListCloneTargetRegions] = useState<Record<string, HuaweiRegionKey | "">>({});
  const [listCloneTargetBillingModes, setListCloneTargetBillingModes] = useState<Record<string, BillingOption | "">>({});
  const [cloningListId, setCloningListId] = useState<string | null>(null);
  const [listCloneMessages, setListCloneMessages] = useState<Record<string, string>>({});
  const [listCloneMessageErrors, setListCloneMessageErrors] = useState<Record<string, boolean>>({});

  const cloneableRegions = (Object.entries(huaweiRegions) as Array<[HuaweiRegionKey, (typeof huaweiRegions)[HuaweiRegionKey]]>)
    .filter(([, labels]) => Boolean(labels.catalogRegionId));

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

  const loadProjects = useCallback(async () => {
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
  }, []);

  const loadHuaweiCarts = useCallback(async () => {
    if (!cookieValue.trim()) {
      setHuaweiCarts([]);
      setHuaweiCartsError("");
      setHuaweiCartsSyncedAt(null);
      return;
    }

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
    }
  }, [cookieValue]);

  useEffect(() => {
    const storedCookie = window.localStorage.getItem("neoCalculator.huaweiCookie") ?? "";
    setCookieValue(storedCookie);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadHuaweiCarts();
  }, [loadHuaweiCarts]);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) {
      return;
    }

    setNewProjectPending(true);
    setProjectsError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as (Omit<AppProject, "lists"> & { error?: never }) | { error?: string } | null;

      if (!response.ok || !payload || !("id" in payload)) {
        throw new Error(getResponseError(payload, "Unable to create project"));
      }

      setProjects((current) => [{ ...payload, lists: [] }, ...current]);
      setExpandedProjects((current) => ({ ...current, [payload.id]: true }));
      setProjectNameDrafts((current) => ({ ...current, [payload.id]: payload.name }));
      setNewProjectName("");
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create project");
    } finally {
      setNewProjectPending(false);
    }
  };

  const handleCreateList = async (projectId: string) => {
    const name = listDrafts[projectId]?.trim();
    const baseCartKey = listBaseDrafts[projectId] ?? "";
    const usingHuaweiBase = Boolean(baseCartKey);

    if (!name && !usingHuaweiBase) {
      return;
    }

    if (usingHuaweiBase && !cookieValue.trim()) {
      setProjectsError("Save a Huawei Cloud cookie on the main dashboard before importing a Huawei cart.");
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
      const payload = (await response.json().catch(() => null)) as
        | (AppList & { projectId: string; error?: never })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to create cart"));
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
      setListDrafts((current) => ({ ...current, [projectId]: "" }));
      setListBaseDrafts((current) => ({ ...current, [projectId]: "" }));

      if (baseCartKey) {
        await loadHuaweiCarts();
      }
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to create cart");
    } finally {
      setListPendingProjectId(null);
    }
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
    const confirmed = window.confirm(`Delete "${project.name}" and all of its carts and products?`);
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

      setProjects((current) => current.filter((item) => item.id !== payload.id));
      setExpandedProjects((current) => {
        const nextState = { ...current };
        delete nextState[project.id];
        return nextState;
      });
      setProjectNameDrafts((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setProjectCloneNameDrafts((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setProjectCloneTargetRegions((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setProjectCloneTargetBillingModes((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setProjectHuaweiMessages((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setProjectHuaweiMessageErrors((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setProjectCloneMessages((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setProjectCloneMessageErrors((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setExpandedLists((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListNameDrafts((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListProjectDrafts((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListHuaweiCartDrafts((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListHuaweiMessages((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListHuaweiMessageErrors((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListCloneNameDrafts((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListCloneTargetRegions((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListCloneTargetBillingModes((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListCloneMessages((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
      setListCloneMessageErrors((current) => {
        const next = { ...current };
        project.lists.forEach((list) => {
          delete next[list.id];
        });
        return next;
      });
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
    setProjectsError("");

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

      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.filter((item) => item.id !== payload.id),
              }
            : project,
        ),
      );
      setExpandedLists((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListNameDrafts((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListProjectDrafts((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListHuaweiCartDrafts((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListHuaweiMessages((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListHuaweiMessageErrors((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListCloneNameDrafts((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListCloneTargetRegions((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListCloneTargetBillingModes((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListCloneMessages((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      setListCloneMessageErrors((current) => {
        const next = { ...current };
        delete next[list.id];
        return next;
      });
      await loadHuaweiCarts();
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to delete cart");
    } finally {
      setDeletingListId(null);
    }
  };

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

  const handleLinkList = async (list: AppList, projectId: string) => {
    const selectedHuaweiCartKey = listHuaweiCartDrafts[list.id] ?? list.huaweiCartKey ?? "";
    const targetCart = huaweiCarts.find((cart) => cart.key === selectedHuaweiCartKey);
    const targetCartName = targetCart?.name ?? (selectedHuaweiCartKey === list.huaweiCartKey ? list.huaweiCartName : null);

    if (!selectedHuaweiCartKey || !targetCartName) {
      setListHuaweiMessages((current) => ({
        ...current,
        [list.id]: "Choose a Huawei cart first.",
      }));
      setListHuaweiMessageErrors((current) => ({ ...current, [list.id]: true }));
      return;
    }

    setLinkingHuaweiListId(list.id);
    setListHuaweiMessages((current) => ({ ...current, [list.id]: "" }));
    setListHuaweiMessageErrors((current) => ({ ...current, [list.id]: false }));

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          huaweiCartKey: selectedHuaweiCartKey,
          huaweiCartName: targetCartName,
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
          project.id === projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((item) =>
                  item.id === payload.id
                    ? {
                        ...item,
                        updatedAt: payload.updatedAt,
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : item,
                ),
              }
            : project,
        ),
      );
      setListHuaweiCartDrafts((current) => ({
        ...current,
        [list.id]: payload.huaweiCartKey ?? "",
      }));
      setListHuaweiMessages((current) => ({
        ...current,
        [list.id]: `Linked ${payload.huaweiCartName ?? targetCartName} to this cart.`,
      }));
      setListHuaweiMessageErrors((current) => ({ ...current, [list.id]: false }));
      await loadHuaweiCarts();
    } catch (error) {
      setListHuaweiMessages((current) => ({
        ...current,
        [list.id]: error instanceof Error ? error.message : "Unable to link Huawei cart",
      }));
      setListHuaweiMessageErrors((current) => ({ ...current, [list.id]: true }));
    } finally {
      setLinkingHuaweiListId(null);
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
        [project.id]: "Save a Huawei Cloud cookie on the dashboard before creating Huawei carts.",
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
      setListHuaweiCartDrafts((current) => {
        const next = { ...current };
        payload.lists.forEach((list) => {
          next[list.id] = list.huaweiCartKey ?? "";
        });
        return next;
      });
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

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">Projects</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Project Manager</h1>
            <p className="mt-2 text-sm text-zinc-500">
              {projects.length} projects, {totals.listCount} carts, {totals.productCount} products.
            </p>
            {huaweiCartsSyncedAt ? (
              <p className="mt-1 text-xs text-zinc-400">Huawei carts synced {new Date(huaweiCartsSyncedAt).toLocaleString()}</p>
            ) : null}
            {huaweiCartsError ? <p className="mt-1 text-xs text-red-600">{huaweiCartsError}</p> : null}
          </div>
          <Link href="/" className="text-sm text-zinc-500 underline-offset-4 hover:underline">
            Back to dashboard
          </Link>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>My Projects</CardTitle>
                <p className="mt-1 text-sm text-zinc-500">The same project controls from the sidebar, with expandable carts and products.</p>
              </div>
              <Badge variant="secondary">{projects.length}</Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="New project name"
              />
              <Button variant="outline" size="sm" onClick={handleCreateProject} disabled={newProjectPending}>
                {newProjectPending ? "Adding..." : "New Project"}
              </Button>
            </div>
            {projectsError ? <p className="text-sm text-red-600">{projectsError}</p> : null}
          </CardHeader>
          <Separator />
          <CardContent className="px-0">
            <ScrollArea className="h-[75vh] px-4">
              <div className="space-y-4 py-4">
                {projectsLoading ? (
                  <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">Loading projects...</div>
                ) : null}
                {!projectsLoading && projects.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">No projects found.</div>
                ) : null}

                {projects.map((project) => {
                  const isExpanded = expandedProjects[project.id] ?? false;
                  const isEditingProject = editingProjectId === project.id;
                  const isRenamingProject = renamingProjectId === project.id;
                  const isDeletingProject = deletingProjectId === project.id;
                  const isCloningProject = cloningProjectId === project.id;
                  const isSyncingHuaweiProject = syncingHuaweiProjectId === project.id;
                  const projectCloneTargetRegion = projectCloneTargetRegions[project.id] ?? "";
                  const projectHuaweiMessage = projectHuaweiMessages[project.id] ?? "";
                  const projectHuaweiMessageIsError = projectHuaweiMessageErrors[project.id] ?? false;
                  const cloneMessage = projectCloneMessages[project.id] ?? "";
                  const cloneMessageIsError = projectCloneMessageErrors[project.id] ?? false;

                  return (
                    <div key={project.id} className="rounded-2xl border bg-white">
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
                            <button type="button" className="min-w-0 text-left" onClick={() => toggleProject(project.id)} aria-expanded={isExpanded}>
                              <p className="text-lg font-semibold text-zinc-950">{project.name}</p>
                              <p className="mt-1 text-sm text-zinc-500">
                                {project.lists.length} carts · {project.lists.reduce((sum, list) => sum + list.productCount, 0)} products · Updated{" "}
                                {new Date(project.updatedAt).toLocaleDateString()}
                              </p>
                            </button>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {isEditingProject ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => void handleRenameProject(project)} disabled={isRenamingProject}>
                                <Check className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleCancelProjectRename(project)} disabled={isRenamingProject}>
                                <X className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleStartProjectRename(project)} disabled={isDeletingProject}>
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => toggleProject(project.id)} aria-expanded={isExpanded}>
                            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
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
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={listDrafts[project.id] ?? ""}
                                onChange={(event) => setListDrafts((current) => ({ ...current, [project.id]: event.target.value }))}
                                placeholder="New cart name"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleCreateList(project.id)}
                                disabled={listPendingProjectId === project.id}
                              >
                                {listPendingProjectId === project.id ? "Adding..." : "Add Cart"}
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
                                {huaweiCarts.map((cart) => (
                                  <SelectItem key={cart.key} value={cart.key} disabled={Boolean(cart.associatedListId)}>
                                    {cart.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="rounded-xl border bg-zinc-50 p-4">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-zinc-900">Huawei Cloud Calculator</p>
                                <p className="text-xs text-zinc-500">
                                  Create or update one Huawei cart for every NeoCalculator cart in this project.
                                </p>
                              </div>
                              <div className="mt-3 grid gap-2">
                                {projectHuaweiMessage ? (
                                  <p className={`text-xs ${projectHuaweiMessageIsError ? "text-red-600" : "text-zinc-500"}`}>
                                    {projectHuaweiMessage}
                                  </p>
                                ) : !cookieValue.trim() ? (
                                  <p className="text-xs text-zinc-400">Save a Huawei Cloud cookie on the dashboard to enable project sync.</p>
                                ) : (
                                  <p className="text-xs text-zinc-400">
                                    Existing Huawei-linked carts are updated; unlinked carts will create new Huawei carts.
                                  </p>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleSyncProjectHuawei(project)}
                                  disabled={isSyncingHuaweiProject || project.lists.length === 0 || !cookieValue.trim()}
                                >
                                  {isSyncingHuaweiProject ? "Creating Huawei Carts..." : "Create Huawei Carts"}
                                </Button>
                              </div>
                            </div>

                            <div className="rounded-xl border bg-zinc-50 p-4">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-zinc-900">Clone Project</p>
                                <p className="text-xs text-zinc-500">
                                  Clone every cart in this project into a new project, with optional region and billing conversion.
                                </p>
                              </div>
                              <div className="mt-3 grid gap-2">
                                <Input
                                  value={projectCloneNameDrafts[project.id] ?? ""}
                                  onChange={(event) =>
                                    setProjectCloneNameDrafts((current) => ({
                                      ...current,
                                      [project.id]: event.target.value,
                                    }))}
                                  placeholder={getProjectCloneDefaultName(
                                    project.name,
                                    projectCloneTargetRegions[project.id] ?? "",
                                    projectCloneTargetBillingModes[project.id] ?? "",
                                  )}
                                />
                                <div className="grid gap-2 md:grid-cols-2">
                                  <Select
                                    value={projectCloneTargetRegions[project.id] || "__keep"}
                                    onValueChange={(value) =>
                                      setProjectCloneTargetRegions((current) => ({
                                        ...current,
                                        [project.id]: value && value !== "__keep" ? (value as HuaweiRegionKey) : "",
                                      }))}
                                  >
                                    <SelectTrigger className="bg-white">
                                      <SelectValue>
                                        {projectCloneTargetRegion
                                          ? `Region: ${huaweiRegions[projectCloneTargetRegion].short}`
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
                                    value={projectCloneTargetBillingModes[project.id] || "__keep"}
                                    onValueChange={(value) =>
                                      setProjectCloneTargetBillingModes((current) => ({
                                        ...current,
                                        [project.id]: value && value !== "__keep" ? (value as BillingOption) : "",
                                      }))}
                                  >
                                    <SelectTrigger className="bg-white">
                                      <SelectValue>
                                        {projectCloneTargetBillingModes[project.id]
                                          ? `Billing: ${projectCloneTargetBillingModes[project.id]}`
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
                                {cloneMessage ? (
                                  <p className={`text-xs ${cloneMessageIsError ? "text-red-600" : "text-zinc-500"}`}>{cloneMessage}</p>
                                ) : (
                                  <p className="text-xs text-zinc-400">Huawei links are not copied to the cloned project.</p>
                                )}
                                <Button variant="outline" size="sm" onClick={() => void handleCloneProject(project)} disabled={isCloningProject}>
                                  {isCloningProject ? "Cloning Project..." : "Clone Project"}
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {project.lists.length === 0 ? (
                                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                                  This project does not have carts yet.
                                </div>
                              ) : null}

                              {project.lists.map((list) => {
                                const isListExpanded = expandedLists[list.id] ?? false;
                                const isEditingList = editingListId === list.id;
                                const isRenamingList = renamingListId === list.id;
                                const selectedProjectId = listProjectDrafts[list.id] ?? project.id;
                                const selectedHuaweiCartKey = listHuaweiCartDrafts[list.id] ?? list.huaweiCartKey ?? "";
                                const selectedHuaweiCart = huaweiCarts.find((cart) => cart.key === selectedHuaweiCartKey) ?? null;
                                const listHuaweiMessage = listHuaweiMessages[list.id] ?? "";
                                const listHuaweiMessageIsError = listHuaweiMessageErrors[list.id] ?? false;
                                const listCloneTargetRegion = listCloneTargetRegions[list.id] ?? "";
                                const isCloningList = cloningListId === list.id;
                                const listCloneMessage = listCloneMessages[list.id] ?? "";
                                const listCloneMessageIsError = listCloneMessageErrors[list.id] ?? false;

                                return (
                                  <div key={list.id} className="rounded-xl border bg-zinc-50">
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
                                                }))}
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
                                            <p className="text-xs text-zinc-500">Press Enter to save or Escape to cancel.</p>
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
                                                  <p className="font-medium text-zinc-950">{list.name}</p>
                                                  {list.huaweiCartKey ? <Badge variant="secondary">Huawei linked</Badge> : null}
                                                </div>
                                                <p className="mt-1 text-sm text-zinc-500">
                                                  {list.productCount} products · Created {new Date(list.createdAt).toLocaleDateString()}
                                                </p>
                                                {list.huaweiCartName ? <p className="mt-1 text-xs text-zinc-400">{list.huaweiCartName}</p> : null}
                                              </div>
                                              <Badge variant="outline">{list.productCount}</Badge>
                                            </div>
                                          </button>
                                        )}
                                      </div>
                                      {isEditingList ? (
                                        <>
                                          <Button variant="ghost" size="icon" onClick={() => void handleRenameList(list, project.id)} disabled={isRenamingList}>
                                            <Check className="size-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" onClick={() => handleCancelListRename(list)} disabled={isRenamingList}>
                                            <X className="size-4" />
                                          </Button>
                                        </>
                                      ) : (
                                        <Button variant="ghost" size="icon" onClick={() => handleStartListRename(list)} disabled={deletingListId === list.id}>
                                          <Pencil className="size-4" />
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="icon" onClick={() => toggleList(list.id)} aria-expanded={isListExpanded}>
                                        {isListExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
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
                                        <div className="space-y-3">
                                          <div className="rounded-lg border bg-white p-3">
                                            <div className="space-y-1">
                                              <p className="text-sm font-medium text-zinc-900">Move Cart</p>
                                              <p className="text-xs text-zinc-500">Reassign this cart to a different project without cloning it.</p>
                                            </div>
                                            <div className="mt-3 grid gap-2">
                                              <Select
                                                value={selectedProjectId}
                                                onValueChange={(value) =>
                                                  setListProjectDrafts((current) => ({
                                                    ...current,
                                                    [list.id]: value || project.id,
                                                  }))}
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
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void handleMoveList(list, project.id)}
                                                disabled={selectedProjectId === project.id || movingListId === list.id || projects.length < 2}
                                              >
                                                {movingListId === list.id ? "Moving Cart..." : "Move to Project"}
                                              </Button>
                                            </div>
                                          </div>

                                          <div className="rounded-lg border bg-white p-3">
                                            <div className="space-y-1">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-medium text-zinc-900">Huawei Cloud Calculator</p>
                                                {list.huaweiCartKey ? <Badge variant="secondary">Linked</Badge> : null}
                                              </div>
                                              <p className="text-xs text-zinc-500">
                                                Link this cart to an existing Huawei calculator cart using the saved Huawei Cloud cookie.
                                              </p>
                                            </div>
                                            {list.huaweiCartKey ? (
                                              <p className="mt-3 text-xs text-zinc-500">Linked to {list.huaweiCartName || list.huaweiCartKey}</p>
                                            ) : null}
                                            {list.huaweiLastSyncedAt ? (
                                              <p className="mt-1 text-xs text-zinc-400">
                                                Last Huawei sync: {new Date(list.huaweiLastSyncedAt).toLocaleString()}
                                              </p>
                                            ) : null}
                                            {list.huaweiLastError ? <p className="mt-1 text-xs text-red-600">{list.huaweiLastError}</p> : null}
                                            {listHuaweiMessage ? (
                                              <p className={`mt-1 text-xs ${listHuaweiMessageIsError ? "text-red-600" : "text-zinc-500"}`}>
                                                {listHuaweiMessage}
                                              </p>
                                            ) : !cookieValue.trim() ? (
                                              <p className="mt-1 text-xs text-zinc-400">
                                                Save a Huawei Cloud cookie on the dashboard to load linkable carts here.
                                              </p>
                                            ) : null}
                                            <div className="mt-3 grid gap-2">
                                              <Select
                                                value={selectedHuaweiCartKey || "__unlinked"}
                                                onValueChange={(value) =>
                                                  setListHuaweiCartDrafts((current) => ({
                                                    ...current,
                                                    [list.id]: value && value !== "__unlinked" ? value : "",
                                                  }))}
                                              >
                                                <SelectTrigger className="bg-white">
                                                  <SelectValue>
                                                    {selectedHuaweiCartKey
                                                      ? `Huawei: ${selectedHuaweiCart?.name ?? list.huaweiCartName ?? selectedHuaweiCartKey}`
                                                      : "Choose Huawei cart to link"}
                                                  </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="__unlinked">No Huawei link selected</SelectItem>
                                                  {list.huaweiCartKey && !huaweiCarts.some((cart) => cart.key === list.huaweiCartKey) ? (
                                                    <SelectItem value={list.huaweiCartKey}>
                                                      {list.huaweiCartName ?? list.huaweiCartKey}
                                                    </SelectItem>
                                                  ) : null}
                                                  {huaweiCarts.map((cart) => {
                                                    const linkedElsewhere = Boolean(cart.associatedListId && cart.associatedListId !== list.id);
                                                    return (
                                                      <SelectItem key={cart.key} value={cart.key} disabled={linkedElsewhere}>
                                                        {cart.name}
                                                      </SelectItem>
                                                    );
                                                  })}
                                                </SelectContent>
                                              </Select>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void handleLinkList(list, project.id)}
                                                disabled={!selectedHuaweiCartKey || linkingHuaweiListId === list.id || !cookieValue.trim()}
                                              >
                                                <Link2 className="mr-2 size-4" />
                                                {linkingHuaweiListId === list.id ? "Linking..." : "Link Huawei Cart"}
                                              </Button>
                                            </div>
                                          </div>

                                          <div className="rounded-lg border bg-white p-3">
                                            <div className="space-y-1">
                                              <p className="text-sm font-medium text-zinc-900">Clone Cart</p>
                                              <p className="text-xs text-zinc-500">
                                                Clone this cart with optional region and billing conversion.
                                              </p>
                                            </div>
                                            <div className="mt-3 grid gap-2">
                                              <Input
                                                value={listCloneNameDrafts[list.id] ?? ""}
                                                onChange={(event) =>
                                                  setListCloneNameDrafts((current) => ({
                                                    ...current,
                                                    [list.id]: event.target.value,
                                                  }))}
                                                placeholder={getCartCloneDefaultName(
                                                  list.name,
                                                  listCloneTargetRegions[list.id] ?? "",
                                                  listCloneTargetBillingModes[list.id] ?? "",
                                                )}
                                              />
                                              <div className="grid gap-2 md:grid-cols-2">
                                                <Select
                                                  value={listCloneTargetRegions[list.id] || "__keep"}
                                                  onValueChange={(value) =>
                                                    setListCloneTargetRegions((current) => ({
                                                      ...current,
                                                      [list.id]: value && value !== "__keep" ? (value as HuaweiRegionKey) : "",
                                                    }))}
                                                >
                                                  <SelectTrigger className="bg-white">
                                                    <SelectValue>
                                                      {listCloneTargetRegion
                                                        ? `Region: ${huaweiRegions[listCloneTargetRegion].short}`
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
                                                  value={listCloneTargetBillingModes[list.id] || "__keep"}
                                                  onValueChange={(value) =>
                                                    setListCloneTargetBillingModes((current) => ({
                                                      ...current,
                                                      [list.id]: value && value !== "__keep" ? (value as BillingOption) : "",
                                                    }))}
                                                >
                                                  <SelectTrigger className="bg-white">
                                                    <SelectValue>
                                                      {listCloneTargetBillingModes[list.id]
                                                        ? `Billing: ${listCloneTargetBillingModes[list.id]}`
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
                                              {listCloneMessage ? (
                                                <p className={`text-xs ${listCloneMessageIsError ? "text-red-600" : "text-zinc-500"}`}>{listCloneMessage}</p>
                                              ) : (
                                                <p className="text-xs text-zinc-400">Huawei links are not copied to cloned carts.</p>
                                              )}
                                              <Button variant="outline" size="sm" onClick={() => void handleCloneList(list, project.id)} disabled={isCloningList}>
                                                {isCloningList ? "Cloning Cart..." : "Clone Cart"}
                                              </Button>
                                            </div>
                                          </div>

                                          {list.products.length === 0 ? (
                                            <div className="rounded-lg border border-dashed bg-white p-4 text-sm text-zinc-500">
                                              This cart does not have products yet.
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              {list.products.map((product) => (
                                                <div key={product.id} className="rounded-lg border bg-white p-3">
                                                  <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                      <p className="font-medium text-zinc-950">{product.title}</p>
                                                      <p className="mt-1 text-sm text-zinc-500">
                                                        {product.serviceName} · Qty {product.quantity}
                                                      </p>
                                                    </div>
                                                    <Badge variant="outline">{product.quantity}</Badge>
                                                  </div>
                                                </div>
                                              ))}
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
      </div>
    </main>
  );
}
