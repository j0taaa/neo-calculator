"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { ArrowRightLeft, Check, ChevronDown, ChevronRight, Copy, Download, Link2, MoreHorizontal, Pencil, RefreshCw, Share2, Trash2, X } from "lucide-react";

type BillingOption = "Pay-per-use" | "RI" | "Yearly/Monthly";

type AppProduct = {
  id: string;
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
  createdAt?: string;
  updatedAt: string;
};

type AppList = {
  id: string;
  name: string;
  ownerUserId: string;
  accessLevel: "owner" | "project_collaborator" | "list_collaborator";
  canShare: boolean;
  huaweiCartKey: string | null;
  huaweiCartName: string | null;
  huaweiLastSyncedAt: string | null;
  huaweiLastError: string | null;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  products: AppProduct[];
};

function formatObsRequestSummary(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const normalized = value / 10_000;
  const displayValue = Number.isInteger(normalized)
    ? normalized.toLocaleString()
    : Number(normalized.toFixed(4)).toLocaleString();
  return `${displayValue} x 10k ${label}`;
}

type AppProject = {
  id: string;
  name: string;
  ownerUserId: string;
  accessLevel: "owner" | "project_collaborator" | "list_collaborator";
  canShare: boolean;
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

type ActionMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

type ActiveModal =
  | { kind: "project-huawei"; projectId: string }
  | { kind: "project-clone"; projectId: string }
  | { kind: "project-share"; projectId: string }
  | { kind: "list-move"; listId: string }
  | { kind: "list-link"; listId: string }
  | { kind: "list-clone"; listId: string }
  | { kind: "list-share"; listId: string }
  | null;

type ResourceExportModalState = {
  title: string;
  description: string;
  json: string;
  filename: string;
} | null;

const billingOptions: BillingOption[] = ["Pay-per-use", "RI", "Yearly/Monthly"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProductSpecsSummary(product: AppProduct) {
  if (!isRecord(product.config)) {
    return null;
  }

  const vcpu = typeof product.config.vcpu === "number" ? product.config.vcpu : Number(product.config.vcpu ?? 0);
  const ramGiB = typeof product.config.ramGiB === "number" ? product.config.ramGiB : Number(product.config.ramGiB ?? 0);
  const systemDisk = isRecord(product.config.systemDisk) ? product.config.systemDisk : null;
  const diskType = typeof product.config.diskType === "string"
    ? product.config.diskType
    : systemDisk && typeof systemDisk.type === "string"
      ? systemDisk.type
      : null;
  const diskSizeGiB = typeof product.config.diskSizeGiB === "number"
    ? product.config.diskSizeGiB
    : systemDisk && typeof systemDisk.sizeGiB === "number"
      ? systemDisk.sizeGiB
      : null;
  const diskIops = typeof product.config.iops === "number"
    ? product.config.iops
    : systemDisk && typeof systemDisk.iops === "number"
      ? systemDisk.iops
      : null;
  const diskThroughput = typeof product.config.throughput === "number"
    ? product.config.throughput
    : systemDisk && typeof systemDisk.throughput === "number"
      ? systemDisk.throughput
      : null;
  const includedSystemDiskGiB = typeof product.config.systemDiskGiB === "number"
    ? product.config.systemDiskGiB
    : null;
  const peakBandwidthMbit = typeof product.config.peakBandwidthMbit === "number"
    ? product.config.peakBandwidthMbit
    : null;
  const dataPackageTiB = typeof product.config.dataPackageTiB === "number"
    ? product.config.dataPackageTiB
    : null;
  const storageClass = typeof product.config.storageClass === "string"
    ? product.config.storageClass
    : null;
  const obsProductType = typeof product.config.productType === "string"
    ? product.config.productType
    : null;
  const obsRedundancy = typeof product.config.redundancy === "string"
    ? product.config.redundancy
    : null;
  const storageAmount = typeof product.config.storageAmount === "number"
    ? product.config.storageAmount
    : typeof product.config.storageGiB === "number"
      ? product.config.storageGiB
      : null;
  const storageUnit = typeof product.config.storageUnit === "string"
    ? product.config.storageUnit
    : "GB";
  const storageGiB = typeof product.config.storageGiB === "number"
    ? product.config.storageGiB
    : null;
  const durationMonths = typeof product.config.durationMonths === "number"
    ? product.config.durationMonths
    : null;
  const minimumStorageDays = typeof product.config.minimumStorageDays === "number"
    ? product.config.minimumStorageDays
    : null;
  const outboundTrafficAmount = typeof product.config.outboundTrafficAmount === "number"
    ? product.config.outboundTrafficAmount
    : null;
  const outboundTrafficUnit = typeof product.config.outboundTrafficUnit === "string"
    ? product.config.outboundTrafficUnit
    : "GB";
  const readRequests = typeof product.config.readRequests === "number" ? product.config.readRequests : null;
  const writeRequests = typeof product.config.writeRequests === "number" ? product.config.writeRequests : null;
  const deleteRequests = typeof product.config.deleteRequests === "number" ? product.config.deleteRequests : null;
  const pullTrafficAmount = typeof product.config.pullTrafficAmount === "number"
    ? product.config.pullTrafficAmount
    : null;
  const pullTrafficUnit = typeof product.config.pullTrafficUnit === "string"
    ? product.config.pullTrafficUnit
    : "GB";
  const replicationTrafficAmount = typeof product.config.replicationTrafficAmount === "number"
    ? product.config.replicationTrafficAmount
    : null;
  const replicationTrafficUnit = typeof product.config.replicationTrafficUnit === "string"
    ? product.config.replicationTrafficUnit
    : "GB";
  const parts: string[] = [];

  if (obsProductType) {
    parts.push(obsProductType);
  }

  if (storageClass) {
    parts.push(storageClass);
  }

  if (obsRedundancy) {
    parts.push(obsRedundancy);
  }

  if (typeof storageAmount === "number" && Number.isFinite(storageAmount) && storageAmount > 0) {
    parts.push(`${storageAmount} ${storageUnit}`);
  }

  if (typeof storageGiB === "number" && Number.isFinite(storageGiB) && storageGiB > 0) {
    parts.push(`${storageGiB} GiB effective`);
  }

  if (Number.isFinite(vcpu) && vcpu > 0) {
    parts.push(`${vcpu} vCPUs`);
  }

  if (Number.isFinite(ramGiB) && ramGiB > 0) {
    parts.push(`${ramGiB} GiB RAM`);
  }

  if (diskType) {
    parts.push(diskType);
  }

  if (typeof diskSizeGiB === "number" && Number.isFinite(diskSizeGiB) && diskSizeGiB > 0) {
    parts.push(`${diskSizeGiB} GiB`);
  } else if (typeof includedSystemDiskGiB === "number" && Number.isFinite(includedSystemDiskGiB) && includedSystemDiskGiB > 0) {
    parts.push(`${includedSystemDiskGiB} GiB system disk`);
  }

  if (typeof diskIops === "number" && Number.isFinite(diskIops) && diskIops > 0) {
    parts.push(`${diskIops} IOPS`);
  }

  if (typeof diskThroughput === "number" && Number.isFinite(diskThroughput) && diskThroughput > 0) {
    parts.push(`${diskThroughput} MB/s`);
  }

  if (typeof peakBandwidthMbit === "number" && Number.isFinite(peakBandwidthMbit) && peakBandwidthMbit > 0) {
    parts.push(`${peakBandwidthMbit} Mbit/s`);
  }

  if (typeof dataPackageTiB === "number" && Number.isFinite(dataPackageTiB) && dataPackageTiB > 0) {
    parts.push(`${dataPackageTiB} TB/month`);
  }

  if (typeof durationMonths === "number" && Number.isFinite(durationMonths) && durationMonths > 0) {
    parts.push(`${durationMonths}mo`);
  }

  if (typeof outboundTrafficAmount === "number" && Number.isFinite(outboundTrafficAmount) && outboundTrafficAmount > 0) {
    parts.push(`Outbound ${outboundTrafficAmount} ${outboundTrafficUnit}`);
  }

  if (typeof pullTrafficAmount === "number" && Number.isFinite(pullTrafficAmount) && pullTrafficAmount > 0) {
    parts.push(`Pull ${pullTrafficAmount} ${pullTrafficUnit}`);
  }

  if (typeof replicationTrafficAmount === "number" && Number.isFinite(replicationTrafficAmount) && replicationTrafficAmount > 0) {
    parts.push(`CRR ${replicationTrafficAmount} ${replicationTrafficUnit}`);
  }

  const readRequestSummary = typeof readRequests === "number" ? formatObsRequestSummary(readRequests, "reads") : null;
  if (readRequestSummary) {
    parts.push(readRequestSummary);
  }

  const writeRequestSummary = typeof writeRequests === "number" ? formatObsRequestSummary(writeRequests, "writes") : null;
  if (writeRequestSummary) {
    parts.push(writeRequestSummary);
  }

  const deleteRequestSummary = typeof deleteRequests === "number" ? formatObsRequestSummary(deleteRequests, "deletes") : null;
  if (deleteRequestSummary) {
    parts.push(deleteRequestSummary);
  }

  if (typeof minimumStorageDays === "number" && Number.isFinite(minimumStorageDays) && minimumStorageDays > 0) {
    parts.push(`${minimumStorageDays}-day minimum`);
  }

  return parts.length ? parts.join(" · ") : null;
}

function getResponseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  return fallback;
}

async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function downloadJsonFile(filename: string, contents: string) {
  if (typeof document === "undefined") {
    return false;
  }

  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
  return true;
}

function slugifyExportName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "resource";
}

function buildNamedExportFilename(kind: "project" | "cart", name: string) {
  const timestamp = new Date().toISOString().replace(/[:]/g, "-");
  return `neocalculator-${kind}-${slugifyExportName(name)}-${timestamp}.json`;
}

function buildProjectExportPayload(project: AppProject) {
  const totalProducts = project.lists.reduce((count, list) => count + list.products.length, 0);
  const totalQuantity = project.lists.reduce(
    (count, list) => count + list.products.reduce((sum, product) => sum + product.quantity, 0),
    0,
  );

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    resourceType: "project",
    summary: {
      listCount: project.lists.length,
      productCount: totalProducts,
      totalQuantity,
    },
    project,
  };
}

function buildListExportPayload(project: AppProject, list: AppList) {
  const totalQuantity = list.products.reduce((count, product) => count + product.quantity, 0);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    resourceType: "cart",
    summary: {
      productCount: list.products.length,
      totalQuantity,
    },
    project: {
      id: project.id,
      name: project.name,
      ownerUserId: project.ownerUserId,
      accessLevel: project.accessLevel,
      canShare: project.canShare,
    },
    cart: list,
  };
}

async function parseJsonFile(file: File) {
  const text = await file.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Import file is not valid JSON");
  }
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

function ActionMenu({
  open,
  onOpenChange,
  label,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  items: ActionMenuItem[];
}) {
  return (
    <div data-action-menu-root className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                onOpenChange(false);
                item.onSelect();
              }}
            >
              <span className="text-zinc-500">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActionModal({
  title,
  description,
  onClose,
  children,
  panelClassName,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_100px_-40px_rgba(15,23,42,0.55)] ${panelClassName ?? "max-w-lg"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Close ${title}`} onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-4 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
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
  const [projectImportMessages, setProjectImportMessages] = useState<Record<string, string>>({});
  const [projectImportMessageErrors, setProjectImportMessageErrors] = useState<Record<string, boolean>>({});
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
  const [sharingProjectKey, setSharingProjectKey] = useState<string | null>(null);
  const [sharingListKey, setSharingListKey] = useState<string | null>(null);
  const [projectShareMessages, setProjectShareMessages] = useState<Record<string, string>>({});
  const [listShareMessages, setListShareMessages] = useState<Record<string, string>>({});
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [openListMenuId, setOpenListMenuId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [resourceExportModal, setResourceExportModal] = useState<ResourceExportModalState>(null);
  const [resourceExportActionMessage, setResourceExportActionMessage] = useState("");
  const [importCartTargetProjectId, setImportCartTargetProjectId] = useState<string | null>(null);
  const [importCartPendingProjectId, setImportCartPendingProjectId] = useState<string | null>(null);
  const projectImportInputRef = useRef<HTMLInputElement>(null);
  const cartImportInputRef = useRef<HTMLInputElement>(null);

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

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project] as const)), [projects]);

  const listsById = useMemo(
    () =>
      new Map(
        projects.flatMap((project) =>
          project.lists.map((list) => [list.id, { list, project }] as const),
        ),
      ),
    [projects],
  );

  const activeProject =
    activeModal == null
      ? null
      : "projectId" in activeModal
        ? projectsById.get(activeModal.projectId) ?? null
        : listsById.get(activeModal.listId)?.project ?? null;

  const activeList = activeModal != null && "listId" in activeModal ? listsById.get(activeModal.listId)?.list ?? null : null;

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

      await loadProjects();
      setExpandedProjects((current) => ({ ...current, [result.projectId]: true }));
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

      await loadProjects();
      setExpandedProjects((current) => ({ ...current, [projectId]: true }));
      setExpandedLists((current) => ({ ...current, [result.listId]: true }));
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

  useEffect(() => {
    if (!openProjectMenuId && !openListMenuId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-action-menu-root]")) {
        return;
      }

      setOpenProjectMenuId(null);
      setOpenListMenuId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openProjectMenuId, openListMenuId]);

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

  const handleCreateProject = async () => {
    if (!session) {
      setProjectsError("Sign in to save and share projects.");
      return;
    }

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

  const openActionModal = (modal: Exclude<ActiveModal, null>) => {
    setOpenProjectMenuId(null);
    setOpenListMenuId(null);
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
      buildNamedExportFilename("project", project.name),
    );
  };

  const handleOpenListExport = (project: AppProject, list: AppList) => {
    openResourceExportModal(
      "Export Cart JSON",
      "This export includes the cart, its parent project reference, and every saved product in the cart.",
      buildListExportPayload(project, list),
      buildNamedExportFilename("cart", list.name),
    );
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

    const downloaded = downloadJsonFile(resourceExportModal.filename, resourceExportModal.json);
    setResourceExportActionMessage(downloaded ? "JSON file download started." : "Unable to start the JSON download in this browser.");
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

  const activeProjectCloneTargetRegion = activeProject ? projectCloneTargetRegions[activeProject.id] ?? "" : "";
  const activeProjectCloneTargetBillingMode = activeProject ? projectCloneTargetBillingModes[activeProject.id] ?? "" : "";
  const activeProjectCloneMessage = activeProject ? projectCloneMessages[activeProject.id] ?? "" : "";
  const activeProjectCloneMessageIsError = activeProject ? projectCloneMessageErrors[activeProject.id] ?? false : false;
  const activeProjectHuaweiMessage = activeProject ? projectHuaweiMessages[activeProject.id] ?? "" : "";
  const activeProjectHuaweiMessageIsError = activeProject ? projectHuaweiMessageErrors[activeProject.id] ?? false : false;
  const activeProjectShareMessage = activeProject ? projectShareMessages[activeProject.id] ?? "" : "";
  const isActiveProjectCloning = activeProject ? cloningProjectId === activeProject.id : false;
  const isActiveProjectSyncing = activeProject ? syncingHuaweiProjectId === activeProject.id : false;
  const activeListParentProjectId =
    activeList && activeProject && "listId" in (activeModal ?? {}) ? activeProject.id : "";
  const activeListTargetProjectId = activeList && activeProject ? listProjectDrafts[activeList.id] ?? activeProject.id : "";
  const activeSelectedHuaweiCartKey = activeList ? listHuaweiCartDrafts[activeList.id] ?? activeList.huaweiCartKey ?? "" : "";
  const activeSelectedHuaweiCart = huaweiCarts.find((cart) => cart.key === activeSelectedHuaweiCartKey) ?? null;
  const activeListCloneTargetRegion = activeList ? listCloneTargetRegions[activeList.id] ?? "" : "";
  const activeListCloneTargetBillingMode = activeList ? listCloneTargetBillingModes[activeList.id] ?? "" : "";
  const activeListCloneMessage = activeList ? listCloneMessages[activeList.id] ?? "" : "";
  const activeListCloneMessageIsError = activeList ? listCloneMessageErrors[activeList.id] ?? false : false;
  const activeListHuaweiMessage = activeList ? listHuaweiMessages[activeList.id] ?? "" : "";
  const activeListHuaweiMessageIsError = activeList ? listHuaweiMessageErrors[activeList.id] ?? false : false;
  const activeListShareMessage = activeList ? listShareMessages[activeList.id] ?? "" : "";
  const isActiveListMoving = activeList ? movingListId === activeList.id : false;
  const isActiveListLinking = activeList ? linkingHuaweiListId === activeList.id : false;
  const isActiveListCloning = activeList ? cloningListId === activeList.id : false;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {isSessionPending ? (
          <Card>
            <CardContent className="py-12 text-center text-zinc-500">Checking session...</CardContent>
          </Card>
        ) : null}
        {!isSessionPending && !session ? (
          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle>Sign In To Save And Share</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-500">
              <p>The calculator is available without an account, but saved carts, saved projects, and share links require sign-in.</p>
              <Link href="/" className="inline-flex">
                <Button type="button">Open Calculator</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}
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
            event.target.value = "";
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
            event.target.value = "";
          }}
        />

        {session ? (
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
              <Button variant="outline" size="sm" onClick={openProjectImportPicker} disabled={importProjectPending}>
                {importProjectPending ? "Importing..." : "Import Project"}
              </Button>
            </div>
            {projectsError ? <p className="text-sm text-red-600">{projectsError}</p> : null}
            {importProjectMessage ? (
              <p className={`text-sm ${importProjectMessageIsError ? "text-red-600" : "text-zinc-600"}`}>{importProjectMessage}</p>
            ) : null}
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
                  const projectHuaweiMessage = projectHuaweiMessages[project.id] ?? "";
                  const projectHuaweiMessageIsError = projectHuaweiMessageErrors[project.id] ?? false;
                  const projectImportMessage = projectImportMessages[project.id] ?? "";
                  const projectImportMessageIsError = projectImportMessageErrors[project.id] ?? false;
                  const cloneMessage = projectCloneMessages[project.id] ?? "";
                  const cloneMessageIsError = projectCloneMessageErrors[project.id] ?? false;
                  const projectShareMessage = projectShareMessages[project.id] ?? "";
                  const projectMenuItems: ActionMenuItem[] = [
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
                            <>
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
                              <Button variant="ghost" size="icon" onClick={() => handleStartProjectRename(project)} disabled={isDeletingProject}>
                                <Pencil className="size-4" />
                              </Button>
                            </>
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCartImportPicker(project.id)}
                                disabled={importCartPendingProjectId === project.id}
                              >
                                {importCartPendingProjectId === project.id ? "Importing..." : "Import Cart"}
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
                            {projectHuaweiMessage || cloneMessage || projectImportMessage || projectShareMessage ? (
                              <div className="rounded-xl border bg-zinc-50 p-3">
                                <div className="space-y-1 text-xs">
                                  {projectHuaweiMessage ? (
                                    <p className={projectHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectHuaweiMessage}</p>
                                  ) : null}
                                  {cloneMessage ? (
                                    <p className={cloneMessageIsError ? "text-red-600" : "text-zinc-600"}>{cloneMessage}</p>
                                  ) : null}
                                  {projectImportMessage ? (
                                    <p className={projectImportMessageIsError ? "text-red-600" : "text-zinc-600"}>{projectImportMessage}</p>
                                  ) : null}
                                  {projectShareMessage ? <p className="text-zinc-600">{projectShareMessage}</p> : null}
                                </div>
                              </div>
                            ) : null}
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
                                const listHuaweiMessage = listHuaweiMessages[list.id] ?? "";
                                const listHuaweiMessageIsError = listHuaweiMessageErrors[list.id] ?? false;
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
                                    label: "Link Huawei Cart",
                                    icon: <Link2 className="size-4" />,
                                    onSelect: () => openActionModal({ kind: "list-link", listId: list.id }),
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
                                          <Button variant="ghost" size="icon" onClick={() => handleStartListRename(list)} disabled={deletingListId === list.id}>
                                            <Pencil className="size-4" />
                                          </Button>
                                        </>
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
                                          {list.huaweiCartKey || list.huaweiLastSyncedAt || list.huaweiLastError || listHuaweiMessage || listCloneMessage || listShareMessage ? (
                                            <div className="rounded-lg border bg-white p-3 text-xs">
                                              <div className="space-y-1">
                                                {list.huaweiCartKey ? (
                                                  <p className="text-zinc-600">Linked Huawei cart: {list.huaweiCartName || list.huaweiCartKey}</p>
                                                ) : null}
                                                {list.huaweiLastSyncedAt ? (
                                                  <p className="text-zinc-500">
                                                    Last Huawei sync: {new Date(list.huaweiLastSyncedAt).toLocaleString()}
                                                  </p>
                                                ) : null}
                                                {list.huaweiLastError ? <p className="text-red-600">{list.huaweiLastError}</p> : null}
                                                {listHuaweiMessage ? (
                                                  <p className={listHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}>{listHuaweiMessage}</p>
                                                ) : null}
                                                {listCloneMessage ? (
                                                  <p className={listCloneMessageIsError ? "text-red-600" : "text-zinc-600"}>{listCloneMessage}</p>
                                                ) : null}
                                                {listShareMessage ? <p className="text-zinc-600">{listShareMessage}</p> : null}
                                              </div>
                                            </div>
                                          ) : null}
                                          {list.products.length === 0 ? (
                                            <div className="rounded-lg border border-dashed bg-white p-4 text-sm text-zinc-500">
                                              This cart does not have products yet.
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              {list.products.map((product) => {
                                                const specsSummary = getProductSpecsSummary(product);

                                                return (
                                                  <div key={product.id} className="rounded-lg border bg-white p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                      <div className="min-w-0">
                                                        <p className="font-medium text-zinc-950">{product.title}</p>
                                                        <p className="mt-1 text-sm text-zinc-500">
                                                          {product.serviceName} · Qty {product.quantity}
                                                        </p>
                                                        {specsSummary ? (
                                                          <p className="mt-1 text-xs text-zinc-400">{specsSummary}</p>
                                                        ) : null}
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
              {resourceExportActionMessage || `${resourceExportModal.json.split("\n").length.toLocaleString()} lines ready to copy or download.`}
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
                  : activeModal.kind === "list-move"
                    ? "Move Cart"
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
                  : activeModal.kind === "list-move"
                    ? "Reassign this cart to a different project without cloning it."
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

          {activeList && activeModal.kind === "list-move" ? (
            <>
              <Select
                value={activeListTargetProjectId}
                onValueChange={(value) =>
                  setListProjectDrafts((current) => ({
                    ...current,
                    [activeList.id]: value || activeProject.id,
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
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => void handleMoveList(activeList, activeListParentProjectId)}
                  disabled={activeListTargetProjectId === activeListParentProjectId || isActiveListMoving || projects.length < 2}
                >
                  {isActiveListMoving ? "Moving Cart..." : "Move to Project"}
                </Button>
              </div>
            </>
          ) : null}

          {activeList && activeModal.kind === "list-link" ? (
            <>
              {activeList.huaweiCartKey ? (
                <p className="text-sm text-zinc-600">Linked to {activeList.huaweiCartName || activeList.huaweiCartKey}</p>
              ) : null}
              {activeList.huaweiLastSyncedAt ? (
                <p className="text-sm text-zinc-500">Last Huawei sync: {new Date(activeList.huaweiLastSyncedAt).toLocaleString()}</p>
              ) : null}
              {activeList.huaweiLastError ? <p className="text-sm text-red-600">{activeList.huaweiLastError}</p> : null}
              {activeListHuaweiMessage ? (
                <p className={`text-sm ${activeListHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}`}>
                  {activeListHuaweiMessage}
                </p>
              ) : !cookieValue.trim() ? (
                <p className="text-sm text-zinc-500">Save a Huawei Cloud cookie on the dashboard to load linkable carts here.</p>
              ) : null}
              <Select
                value={activeSelectedHuaweiCartKey || "__unlinked"}
                onValueChange={(value) =>
                  setListHuaweiCartDrafts((current) => ({
                    ...current,
                    [activeList.id]: value && value !== "__unlinked" ? value : "",
                  }))}
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
                  onClick={() => void handleLinkList(activeList, activeListParentProjectId)}
                  disabled={!activeSelectedHuaweiCartKey || isActiveListLinking || !cookieValue.trim()}
                >
                  <Link2 className="mr-2 size-4" />
                  {isActiveListLinking ? "Linking..." : "Link Huawei Cart"}
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
                  }))}
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
                    }))}
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
                    }))}
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
                <Button variant="outline" onClick={() => void handleCloneList(activeList, activeListParentProjectId)} disabled={isActiveListCloning}>
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
