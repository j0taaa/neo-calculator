"use client";

import type { DashboardModel } from "@/lib/dashboard/use-dashboard";

export function ResourceImportInputs({ transfer }: DashboardModel["imports"]) {
  const {
    projectImportInputRef,
    handleImportProjectFile,
    cartImportInputRef,
    importCartTargetProjectId,
    handleImportCartFile,
  } = transfer;
  return (
    <>
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
        }}
      />
    </>
  );
}
