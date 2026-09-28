import {
  copyText,
  getResponseError,
  parseJsonFile,
} from "@/lib/calculator-page-helpers";
import type { AppList, AppProject } from "@/lib/calculator-types";
import { type ResourceExportModalState } from "@/lib/page-utils";
import {
  buildListExportPayload,
  buildNamedExportFilename,
  buildProjectExportPayload,
  downloadProjectWorkbookFile,
  downloadTextFile,
} from "@/lib/resource-export";
import type { Dispatch, SetStateAction } from "react";
import { useRef, useState } from "react";

type Options = {
  session: { user: { id: string } } | null;
  setProjectsError: Dispatch<SetStateAction<string>>;
  reloadProjectsSnapshot: (
    preferredListId?: string | undefined,
    preferredProjectId?: string | undefined,
  ) => Promise<void>;
};

export function useResourceTransfer({
  session,
  setProjectsError,
  reloadProjectsSnapshot,
}: Options) {
  const [importProjectPending, setImportProjectPending] = useState(false);

  const [importProjectMessage, setImportProjectMessage] = useState("");

  const [importProjectMessageIsError, setImportProjectMessageIsError] =
    useState(false);

  const [resourceExportModal, setResourceExportModal] =
    useState<ResourceExportModalState>(null);

  const [resourceExportActionMessage, setResourceExportActionMessage] =
    useState("");

  const [projectImportMessages, setProjectImportMessages] = useState<
    Record<string, string>
  >({});

  const [projectImportMessageErrors, setProjectImportMessageErrors] = useState<
    Record<string, boolean>
  >({});

  const [projectExportMessages, setProjectExportMessages] = useState<
    Record<string, string>
  >({});

  const [projectExportMessageErrors, setProjectExportMessageErrors] = useState<
    Record<string, boolean>
  >({});

  const [importCartTargetProjectId, setImportCartTargetProjectId] = useState<
    string | null
  >(null);

  const [importCartPendingProjectId, setImportCartPendingProjectId] = useState<
    string | null
  >(null);

  const projectImportInputRef = useRef<HTMLInputElement>(null);

  const cartImportInputRef = useRef<HTMLInputElement>(null);

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
    setProjectImportMessageErrors((current) => ({
      ...current,
      [projectId]: false,
    }));
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
        | {
            projectId: string;
            firstListId: string | null;
            name: string;
            importedListCount: number;
            importedProductCount: number;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !result || !("projectId" in result)) {
        throw new Error(getResponseError(result, "Unable to import project"));
      }

      await reloadProjectsSnapshot(
        result.firstListId ?? undefined,
        result.projectId,
      );
      setImportProjectMessage(
        `Imported project ${result.name} with ${result.importedListCount} cart(s) and ${result.importedProductCount} product(s).`,
      );
      setImportProjectMessageIsError(false);
    } catch (error) {
      setImportProjectMessage(
        error instanceof Error ? error.message : "Unable to import project",
      );
      setImportProjectMessageIsError(true);
    } finally {
      setImportProjectPending(false);
    }
  };

  const handleImportCartFile = async (projectId: string, file: File) => {
    setImportCartPendingProjectId(projectId);
    setProjectImportMessages((current) => ({ ...current, [projectId]: "" }));
    setProjectImportMessageErrors((current) => ({
      ...current,
      [projectId]: false,
    }));
    setProjectsError("");

    try {
      const payload = await parseJsonFile(file);
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, targetProjectId: projectId }),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            projectId: string;
            listId: string;
            name: string;
            importedProductCount: number;
            error?: never;
          }
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
      setProjectImportMessageErrors((current) => ({
        ...current,
        [projectId]: false,
      }));
    } catch (error) {
      setProjectImportMessages((current) => ({
        ...current,
        [projectId]:
          error instanceof Error ? error.message : "Unable to import cart",
      }));
      setProjectImportMessageErrors((current) => ({
        ...current,
        [projectId]: true,
      }));
    } finally {
      setImportCartPendingProjectId(null);
      setImportCartTargetProjectId(null);
    }
  };

  const openResourceExportModal = (
    title: string,
    description: string,
    payload: unknown,
    filename: string,
  ) => {
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
    setProjectExportMessageErrors((current) => ({
      ...current,
      [project.id]: false,
    }));

    try {
      // First, create a share link for the project
      const shareResponse = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType: "project",
          resourceId: project.id,
          mode: "copy",
        }),
      });
      const sharePayload = (await shareResponse.json().catch(() => null)) as {
        shareUrl?: string;
        error?: string;
      } | null;

      // Get the full share URL or undefined if creation failed
      const shareUrl =
        shareResponse.ok && sharePayload?.shareUrl
          ? new URL(sharePayload.shareUrl, window.location.origin).toString()
          : undefined;

      const downloaded = await downloadProjectWorkbookFile(project, shareUrl);
      setProjectExportMessages((current) => ({
        ...current,
        [project.id]: downloaded
          ? "Excel export download started."
          : "Unable to start the Excel download in this browser.",
      }));
      setProjectExportMessageErrors((current) => ({
        ...current,
        [project.id]: !downloaded,
      }));
    } catch (error) {
      setProjectExportMessages((current) => ({
        ...current,
        [project.id]:
          error instanceof Error
            ? error.message
            : "Unable to export the project as Excel.",
      }));
      setProjectExportMessageErrors((current) => ({
        ...current,
        [project.id]: true,
      }));
    }
  };

  const handleCopyResourceExport = async () => {
    if (!resourceExportModal) {
      return;
    }

    const copied = await copyText(resourceExportModal.json);
    setResourceExportActionMessage(
      copied
        ? "JSON copied to clipboard."
        : "Clipboard access is unavailable in this browser.",
    );
  };

  const handleDownloadResourceExport = () => {
    if (!resourceExportModal) {
      return;
    }

    const downloaded = downloadTextFile(
      resourceExportModal.filename,
      resourceExportModal.json,
      "application/json;charset=utf-8",
    );
    setResourceExportActionMessage(
      downloaded
        ? "JSON file download started."
        : "Unable to start the JSON download in this browser.",
    );
  };
  return {
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
    importCartTargetProjectId,
    importCartPendingProjectId,
    projectImportInputRef,
    cartImportInputRef,
    openProjectImportPicker,
    openCartImportPicker,
    handleImportProjectFile,
    handleImportCartFile,
    handleOpenProjectExport,
    handleOpenListExport,
    handleExportProjectExcel,
    handleCopyResourceExport,
    handleDownloadResourceExport,
  };
}
