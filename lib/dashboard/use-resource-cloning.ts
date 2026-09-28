import { getResponseError } from "@/lib/calculator-page-helpers";
import type { AppList, AppProject } from "@/lib/calculator-types";
import { type HuaweiRegionKey } from "@/lib/huawei-regions";
import { type BillingOption } from "@/lib/page-utils";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

type Options = {
  selectedList: AppList | null;
  selectedListId: string;
  selectedProject: AppProject | null;
  setProjects: Dispatch<SetStateAction<AppProject[]>>;
  setSelectedListId: Dispatch<SetStateAction<string>>;
  setExpandedProjects: Dispatch<SetStateAction<Record<string, boolean>>>;
};

export function useResourceCloning({
  selectedList,
  selectedListId,
  selectedProject,
  setProjects,
  setSelectedListId,
  setExpandedProjects,
}: Options) {
  const [cloneNameDraft, setCloneNameDraft] = useState("");

  const [cloneTargetRegion, setCloneTargetRegion] = useState<
    HuaweiRegionKey | ""
  >("");

  const [cloneTargetBillingMode, setCloneTargetBillingMode] = useState<
    BillingOption | ""
  >("");

  const [cloningListId, setCloningListId] = useState<string | null>(null);

  const [cloneActionMessage, setCloneActionMessage] = useState("");

  const [cloneActionIsError, setCloneActionIsError] = useState(false);

  const [projectCloneNameDrafts, setProjectCloneNameDrafts] = useState<
    Record<string, string>
  >({});

  const [projectCloneTargetRegions, setProjectCloneTargetRegions] = useState<
    Record<string, HuaweiRegionKey | "">
  >({});

  const [projectCloneTargetBillingModes, setProjectCloneTargetBillingModes] =
    useState<Record<string, BillingOption | "">>({});

  const [cloningProjectId, setCloningProjectId] = useState<string | null>(null);

  const [projectCloneMessages, setProjectCloneMessages] = useState<
    Record<string, string>
  >({});

  const [projectCloneMessageErrors, setProjectCloneMessageErrors] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setCloneNameDraft("");
    setCloneTargetRegion("");
    setCloneTargetBillingMode("");
  }, [selectedList?.id]);

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
      setCloneActionMessage(
        error instanceof Error ? error.message : "Unable to clone cart",
      );
    } finally {
      setCloningListId(null);
    }
  };

  const handleCloneProject = async (project: AppProject) => {
    setCloningProjectId(project.id);
    setProjectCloneMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectCloneMessageErrors((current) => ({
      ...current,
      [project.id]: false,
    }));

    try {
      const response = await fetch(`/api/projects/${project.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectCloneNameDrafts[project.id]?.trim() || undefined,
          targetRegion: projectCloneTargetRegions[project.id] || undefined,
          targetBillingMode:
            projectCloneTargetBillingModes[project.id] || undefined,
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
      setProjectCloneNameDrafts((current) => ({
        ...current,
        [project.id]: "",
      }));
      setProjectCloneTargetRegions((current) => ({
        ...current,
        [project.id]: "",
      }));
      setProjectCloneTargetBillingModes((current) => ({
        ...current,
        [project.id]: "",
      }));
      setProjectCloneMessages((current) => ({
        ...current,
        [project.id]: `Cloned ${project.name} into ${payload.name}. Converted ${payload.cloneSummary?.convertedEcsCount ?? 0} ECS item(s).`,
      }));
      setProjectCloneMessageErrors((current) => ({
        ...current,
        [project.id]: false,
      }));
    } catch (error) {
      setProjectCloneMessages((current) => ({
        ...current,
        [project.id]:
          error instanceof Error ? error.message : "Unable to clone project",
      }));
      setProjectCloneMessageErrors((current) => ({
        ...current,
        [project.id]: true,
      }));
    } finally {
      setCloningProjectId(null);
    }
  };
  return {
    cloneNameDraft,
    setCloneNameDraft,
    cloneTargetRegion,
    setCloneTargetRegion,
    cloneTargetBillingMode,
    setCloneTargetBillingMode,
    cloningListId,
    cloneActionMessage,
    cloneActionIsError,
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
    handleCloneSelectedList,
    handleCloneProject,
  };
}
