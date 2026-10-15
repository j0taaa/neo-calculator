"use client";

import type { DashboardModel } from "@/lib/dashboard/use-dashboard";
import { ResourceImportDialog } from "./resource-import-dialog";

export function ResourceImportInputs({ transfer }: DashboardModel["imports"]) {
  const {
    projectImportInputRef,
    handleImportProjectFile,
    cartImportInputRef,
    handleImportCartFile,
    resourceImportDialog,
    setResourceImportDialog,
    chooseResourceImportFile,
  } = transfer;
  if (!resourceImportDialog) return null;
  return (
    <ResourceImportDialog kind={resourceImportDialog.kind} onClose={() => setResourceImportDialog(null)} onChooseFile={chooseResourceImportFile}>
      <input
        ref={projectImportInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            setResourceImportDialog(null);
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
          const projectId = resourceImportDialog.kind === "cart" ? resourceImportDialog.projectId : null;
          if (file && projectId) {
            setResourceImportDialog(null);
            void handleImportCartFile(projectId, file);
          }
        }}
      />
    </ResourceImportDialog>
  );
}
