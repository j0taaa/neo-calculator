"use client";

import { ActionModal } from "@/components/home-page-shell-parts";
import { Button } from "@/components/ui/button";
import type { DashboardModel } from "@/lib/dashboard/use-dashboard";
import { formatNumber } from "@/lib/utils";
import { Copy, Download } from "lucide-react";

export function ResourceExportDialog({
  transfer,
}: DashboardModel["exportDialog"]) {
  const {
    resourceExportModal,
    setResourceExportModal,
    resourceExportActionMessage,
    handleCopyResourceExport,
    handleDownloadResourceExport,
  } = transfer;
  return (
    <>
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
              {resourceExportActionMessage ||
                `${formatNumber(resourceExportModal.json.split("\n").length)} lines ready to copy or download.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCopyResourceExport()}
              >
                <Copy className="size-4" />
                Copy JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadResourceExport}
              >
                <Download className="size-4" />
                Download JSON
              </Button>
            </div>
          </div>
        </ActionModal>
      ) : null}
    </>
  );
}
