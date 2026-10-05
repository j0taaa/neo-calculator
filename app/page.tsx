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
    <div className="min-h-screen bg-zinc-100 bg-grid-pattern p-3 text-zinc-900 sm:p-4 lg:p-6">
      {cartCopyNotice ? (
        <div className="pointer-events-none fixed top-3 left-1/2 z-[80] -translate-x-1/2 px-4">
          <div className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 shadow-[0_18px_40px_-28px_rgba(37,99,235,0.45)]">
            {cartCopyNotice}
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4">
        <ServiceSearch {...dashboard.serviceSearch} />
        <ResourceImportInputs {...dashboard.imports} />

        <main className="dashboard-grid relative z-0">
          <div className="dashboard-calculator min-w-0">
            <CalculatorWorkspace {...dashboard.calculator} />
          </div>

          <aside className="dashboard-projects min-w-0" aria-label="Projects">
            <ProjectSidebar {...dashboard.projects} />
          </aside>

          <aside className="dashboard-cart min-w-0" aria-label="Cart">
            <CartSidebar {...dashboard.cart} />
          </aside>
        </main>
        <ResourceExportDialog {...dashboard.exportDialog} />
        <ResourceActionDialog {...dashboard.actionDialog} />
      </div>
    </div>
  );
}
