import {
  getFirstListId,
  getResponseError,
} from "@/lib/calculator-page-helpers";
import type { AppProject } from "@/lib/calculator-types";
import { useEffect, useMemo, useState } from "react";

type Options = {
  session: { user: { id: string } } | null;
};

export function useProjectStore({ session }: Options) {
  const userId = session?.user.id;
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<AppProject[]>([]);

  const [projectsLoading, setProjectsLoading] = useState(false);

  const [projectsError, setProjectsError] = useState("");

  const [selectedListId, setSelectedListId] = useState("");

  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});

  const totalProjectLists = useMemo(
    () => projects.reduce((sum, project) => sum + project.lists.length, 0),
    [projects],
  );

  const totalProjectProducts = useMemo(
    () =>
      projects.reduce(
        (sum, project) =>
          sum +
          project.lists.reduce(
            (listSum, list) => listSum + list.productCount,
            0,
          ),
        0,
      ),
    [projects],
  );

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project] as const)),
    [projects],
  );

  const listsById = useMemo(
    () =>
      new Map(
        projects.flatMap((project) =>
          project.lists.map((list) => [list.id, { list, project }] as const),
        ),
      ),
    [projects],
  );

  const selectedProject = useMemo(
    () =>
      projects.find((project) =>
        project.lists.some((list) => list.id === selectedListId),
      ) ?? null,
    [projects, selectedListId],
  );

  const selectedList = useMemo(
    () =>
      selectedProject?.lists.find((list) => list.id === selectedListId) ?? null,
    [selectedProject, selectedListId],
  );

  useEffect(() => {
    if (!userId) {
      setLoadedUserId(null);
      setProjects([]);
      setProjectsError("");
      setProjectsLoading(false);
      setSelectedListId("");
      return;
    }

    let cancelled = false;
    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | AppProject[]
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(getResponseError(payload, "Failed to load projects"));
        }

        if (cancelled) return;
        const projectData = payload as AppProject[];
        setProjects(projectData);
        setSelectedListId((current) => {
          if (
            current &&
            projectData.some((project) =>
              project.lists.some((list) => list.id === current),
            )
          ) {
            return current;
          }

          return getFirstListId(projectData);
        });
        setExpandedProjects((current) => {
          const nextState: Record<string, boolean> = {};
          projectData.forEach((project, index) => {
            nextState[project.id] = current[project.id] ?? index === 0;
          });
          return nextState;
        });
      } catch (error) {
        if (cancelled) return;
        setProjectsError(
          error instanceof Error ? error.message : "Failed to load projects",
        );
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
          setLoadedUserId(userId);
        }
      }
    };

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const reloadProjectsSnapshot = async (
    preferredListId?: string,
    preferredProjectId?: string,
  ) => {
    const response = await fetch("/api/projects", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(getResponseError(payload, "Failed to load projects"));
    }

    const payload = (await response.json()) as AppProject[];
    setProjects(payload);
    setSelectedListId((current) => {
      const nextPreferredListId =
        preferredListId &&
        payload.some((project) =>
          project.lists.some((list) => list.id === preferredListId),
        )
          ? preferredListId
          : null;
      if (nextPreferredListId) {
        return nextPreferredListId;
      }

      if (
        current &&
        payload.some((project) =>
          project.lists.some((list) => list.id === current),
        )
      ) {
        return current;
      }

      return getFirstListId(payload);
    });
    setExpandedProjects((current) => {
      const nextState: Record<string, boolean> = {};
      payload.forEach((project, index) => {
        nextState[project.id] =
          project.id === preferredProjectId
            ? true
            : (current[project.id] ?? index === 0);
      });
      return nextState;
    });
  };

  const toggleProject = (projectName: string) => {
    setExpandedProjects((current) => ({
      ...current,
      [projectName]: !current[projectName],
    }));
  };
  return {
    projects,
    setProjects,
    projectsLoading,
    projectsReady: !userId || loadedUserId === userId,
    projectsError,
    setProjectsError,
    selectedListId,
    setSelectedListId,
    expandedProjects,
    setExpandedProjects,
    totalProjectLists,
    totalProjectProducts,
    projectsById,
    listsById,
    selectedProject,
    selectedList,
    reloadProjectsSnapshot,
    toggleProject,
  };
}
