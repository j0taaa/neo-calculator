import { useState, type Dispatch, type SetStateAction } from "react";
import type { AppProject, BillingOption } from "@/lib/calculator-types";
import type { HuaweiRegionKey } from "@/lib/huawei-regions";
import { getResponseError } from "@/lib/calculator-page-helpers";
export function useProjectCloning({
  setProjects,
  setExpandedProjects,
  onCloned,
}: {
  onCloned?: (project: AppProject) => void;
  setProjects: Dispatch<SetStateAction<AppProject[]>>;
  setExpandedProjects: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const [projectCloneNameDrafts, setProjectCloneNameDrafts] = useState<Record<string, string>>({});
  const [projectCloneTargetRegions, setProjectCloneTargetRegions] = useState<Record<string, HuaweiRegionKey | "">>({});
  const [projectCloneTargetBillingModes, setProjectCloneTargetBillingModes] = useState<
    Record<string, BillingOption | "">
  >({});
  const [cloningProjectId, setCloningProjectId] = useState<string | null>(null);
  const [projectCloneMessages, setProjectCloneMessages] = useState<Record<string, string>>({});
  const [projectCloneMessageErrors, setProjectCloneMessageErrors] = useState<Record<string, boolean>>({});
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
      onCloned?.(payload);
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
        [project.id]: error instanceof Error ? error.message : "Unable to clone project",
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
  };
}
