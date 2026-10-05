import {
  getFirstListId,
  getResponseError,
} from "@/lib/calculator-page-helpers";
import type { AppList, AppProject } from "@/lib/calculator-types";
import { type HuaweiRegionKey } from "@/lib/huawei-regions";
import { type ActiveModal, type BillingOption } from "@/lib/page-utils";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

type Options = {
  session: { user: { id: string } } | null;
  setProjectsError: Dispatch<SetStateAction<string>>;
  setProjects: Dispatch<SetStateAction<AppProject[]>>;
  setExpandedProjects: Dispatch<SetStateAction<Record<string, boolean>>>;
  cookieValue: string;
  setSelectedListId: Dispatch<SetStateAction<string>>;
  setActiveModal: Dispatch<SetStateAction<ActiveModal>>;
  setHuaweiActionMessage: Dispatch<SetStateAction<string>>;
  loadHuaweiCarts: () => Promise<void>;
  setProjectCloneNameDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setProjectCloneTargetRegions: Dispatch<
    SetStateAction<Record<string, "" | HuaweiRegionKey>>
  >;
  setProjectCloneTargetBillingModes: Dispatch<
    SetStateAction<Record<string, "" | BillingOption>>
  >;
  setProjectCloneMessages: Dispatch<SetStateAction<Record<string, string>>>;
  setProjectCloneMessageErrors: Dispatch<
    SetStateAction<Record<string, boolean>>
  >;
  editingProductListId: string | null;
  handleCancelEdit: () => void;
};

export function useProjectActions({
  session,
  setProjectsError,
  setProjects,
  setExpandedProjects,
  cookieValue,
  setSelectedListId,
  setActiveModal,
  setHuaweiActionMessage,
  loadHuaweiCarts,
  setProjectCloneNameDrafts,
  setProjectCloneTargetRegions,
  setProjectCloneTargetBillingModes,
  setProjectCloneMessages,
  setProjectCloneMessageErrors,
  editingProductListId,
  handleCancelEdit,
}: Options) {
  const [newProjectName, setNewProjectName] = useState("");

  const [newProjectPending, setNewProjectPending] = useState(false);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [projectNameDrafts, setProjectNameDrafts] = useState<
    Record<string, string>
  >({});

  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(
    null,
  );

  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );

  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});

  const [listBaseDrafts, setListBaseDrafts] = useState<Record<string, string>>(
    {},
  );

  const [listPendingProjectId, setListPendingProjectId] = useState<
    string | null
  >(null);

  const [deletingListId, setDeletingListId] = useState<string | null>(null);

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
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(getResponseError(payload, "Unable to create project"));
      }

      const project = (await response.json()) as Omit<AppProject, "lists">;
      setProjects((current) => [{ ...project, lists: [] }, ...current]);
      setExpandedProjects((current) => ({ ...current, [project.id]: true }));
      setProjectNameDrafts((current) => ({
        ...current,
        [project.id]: project.name,
      }));
      setNewProjectName("");
    } catch (error) {
      setProjectsError(
        error instanceof Error ? error.message : "Unable to create project",
      );
    } finally {
      setNewProjectPending(false);
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
      setProjectsError(
        "Save a Huawei Cloud cookie before importing a Huawei cart.",
      );
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
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
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
      setActiveModal((current) =>
        current?.kind === "project-add-cart" &&
        "projectId" in current &&
        current.projectId === projectId
          ? null
          : current,
      );
      setHuaweiActionMessage(
        baseCartKey
          ? `Imported ${list.name} from Huawei Cloud Calculator.`
          : "",
      );
      if (baseCartKey) {
        await loadHuaweiCarts();
      }
    } catch (error) {
      setProjectsError(
        error instanceof Error ? error.message : "Unable to create list",
      );
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
        | {
            id: string;
            name: string;
            description: string | null;
            updatedAt: string;
          }
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
      setProjectNameDrafts((current) => ({
        ...current,
        [project.id]: payload.name,
      }));
      setEditingProjectId(null);
    } catch (error) {
      setProjectsError(
        error instanceof Error ? error.message : "Unable to rename project",
      );
    } finally {
      setRenamingProjectId(null);
    }
  };

  const handleDeleteProject = async (project: AppProject) => {
    const confirmed = window.confirm(
      `Delete "${project.name}" and all of its lists and products?`,
    );
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
      setEditingProjectId((current) =>
        current === project.id ? null : current,
      );
      await loadHuaweiCarts();
    } catch (error) {
      setProjectsError(
        error instanceof Error ? error.message : "Unable to delete project",
      );
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleDeleteList = async (list: AppList, projectId: string) => {
    const confirmed = window.confirm(
      `Delete "${list.name}" and all of its products?`,
    );
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
      setHuaweiActionMessage(
        error instanceof Error ? error.message : "Unable to delete cart",
      );
    } finally {
      setDeletingListId(null);
    }
  };
  return {
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
    listBaseDrafts,
    setListBaseDrafts,
    listPendingProjectId,
    deletingListId,
    handleCreateProject,
    handleCreateList,
    handleStartProjectRename,
    handleCancelProjectRename,
    handleRenameProject,
    handleDeleteProject,
    handleDeleteList,
  };
}
