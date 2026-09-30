import { useProjectCloning } from "./use-project-cloning";
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

  const [cloneTargetRegion, setCloneTargetRegion] = useState<HuaweiRegionKey | "">("");

  const [cloneTargetBillingMode, setCloneTargetBillingMode] = useState<BillingOption | "">("");

  const [cloningListId, setCloningListId] = useState<string | null>(null);

  const [cloneActionMessage, setCloneActionMessage] = useState("");

  const [cloneActionIsError, setCloneActionIsError] = useState(false);

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
      setCloneActionMessage(error instanceof Error ? error.message : "Unable to clone cart");
    } finally {
      setCloningListId(null);
    }
  };
  return {
    ...useProjectCloning({
      setProjects,
      setExpandedProjects,
      onCloned: (project) => setSelectedListId(project.lists[0]?.id ?? ""),
    }),
    cloneNameDraft,
    setCloneNameDraft,
    cloneTargetRegion,
    setCloneTargetRegion,
    cloneTargetBillingMode,
    setCloneTargetBillingMode,
    cloningListId,
    cloneActionMessage,
    cloneActionIsError,
    handleCloneSelectedList,
  };
}
