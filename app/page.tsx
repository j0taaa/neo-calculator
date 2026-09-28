"use client";

import { CalculatorWorkspace } from "@/components/dashboard/calculator-workspace";
import { CartSidebar } from "@/components/dashboard/cart-sidebar";
import { ProjectSidebar } from "@/components/dashboard/project-sidebar";
import { ResourceActionDialog } from "@/components/dashboard/resource-action-dialog";
import { ResourceExportDialog } from "@/components/dashboard/resource-export-dialog";
import { ResourceImportInputs } from "@/components/dashboard/resource-import-inputs";
import { ServiceSearch } from "@/components/dashboard/service-search";
import { useDashboard } from "@/lib/dashboard/use-dashboard";

export default function Home() {
  const dashboard = useDashboard();
  const { cartCopyNotice } = dashboard;
  return (
    <div className="min-h-screen bg-zinc-100 bg-grid-pattern p-5 text-zinc-900 lg:p-8">
      {cartCopyNotice ? (
        <div className="pointer-events-none fixed top-3 left-1/2 z-[80] -translate-x-1/2 px-4">
          <div className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 shadow-[0_18px_40px_-28px_rgba(37,99,235,0.45)]">
            {cartCopyNotice}
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        <ServiceSearch {...dashboard.serviceSearch} />
        <ResourceImportInputs {...dashboard.imports} />

        <main className="relative z-0 grid items-start gap-8 xl:justify-center xl:grid-cols-[340px_780px_340px] 2xl:grid-cols-[380px_880px_380px]">
          <ProjectSidebar {...dashboard.projects} />

          <CalculatorWorkspace {...dashboard.calculator} />

          <CartSidebar {...dashboard.cart} />
        </main>
        <ResourceExportDialog {...dashboard.exportDialog} />
        <ResourceActionDialog {...dashboard.actionDialog} />
      </div>
    </div>
  );
}
