"use client";
import Image from "next/image";
import { NativeCalculatorPanel } from "@/components/calculators/native-calculator-panel";
import { CompatibilityCalculator } from "@/components/calculators/compatibility-calculator";
import { ServiceBatchAddPanel } from "@/components/calculators/service-batch-add-panel";
import { NativeBatchPanel } from "@/components/calculators/native-batch-panel";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { legacyRegion } from "@/lib/calculator/service-directory";
import type { DashboardModel } from "@/lib/dashboard/use-dashboard";

export function CalculatorWorkspace(model: DashboardModel["calculator"]) {
  const { activeTab, setActiveTab, selectedServiceMeta, services, selectService, directory,
    directoryError, retryDirectory, nativeScope, setNativeScope, useNative, nativeEditingProduct,
    saveNativeProduct, calculatorController, nativeBatch, editingProductId, isSignedIn, projectStore } = model;
  return <Card className="@container/workspace min-w-0 overflow-visible shadow-sm">
    <Tabs value={activeTab} onValueChange={tab => {
      if (editingProductId && tab === "batch-add") calculatorController.handleCancelEdit();
      setActiveTab(tab);
    }}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 @min-[740px]/workspace:flex-row @min-[740px]/workspace:items-center @min-[740px]/workspace:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Image src={selectedServiceMeta.icon} alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg object-contain" />
            <div className="min-w-0">
              <CardTitle className="text-xl @min-[640px]/workspace:text-2xl"><h1>{selectedServiceMeta.name}</h1></CardTitle>
              <p className="mt-1 text-sm text-zinc-500">{selectedServiceMeta.code}</p>
            </div>
          </div>
          <TabsList className="grid w-full grid-cols-2 @min-[480px]/workspace:w-fit">
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            <TabsTrigger value="batch-add">Batch add{nativeBatch.items.length ? ` (${nativeBatch.items.length})` : ""}</TabsTrigger>
          </TabsList>
        </div>
        <label className="text-sm font-medium">Service
          <select aria-label="Service" className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm"
            value={selectedServiceMeta.code} onChange={event => selectService(event.target.value)}>
            {services.map(service => <option key={service.code} value={service.code}>{service.code} · {service.name}</option>)}
          </select>
        </label>
      </CardHeader>
    {directoryError && <div role="alert" className="space-y-2 px-4 pb-4 text-sm text-red-700">
      <p>{directoryError}</p><Button variant="outline" onClick={retryDirectory}>Retry Huawei services</Button>
    </div>}
    <TabsContent value="calculator" keepMounted>
      {useNative ? <NativeCalculatorPanel directory={directory} scope={nativeScope} onScopeChange={setNativeScope}
        embedded editingProduct={nativeEditingProduct} onSave={saveNativeProduct}
        canSave={isSignedIn && !!projectStore.selectedListId} onQueue={nativeBatch.busy ? undefined : nativeBatch.enqueue}
        onCancelEdit={calculatorController.handleCancelEdit} /> :
        directory || editingProductId ? <>
          {editingProductId && <p className="px-4 pt-4 text-sm text-zinc-600">Editing a saved estimate. Its original configuration is preserved.</p>}
          <CompatibilityCalculator {...model} />
        </> : !directoryError && <p role="status" className="p-4 text-sm">Loading Huawei services…</p>}
    </TabsContent>
    <TabsContent value="batch-add" keepMounted>
      <NativeBatchPanel {...nativeBatch} canSave={isSignedIn && !!projectStore.selectedListId} onConfigure={() => setActiveTab("calculator")} />
      {calculatorController.batchPanelProps && legacyRegion(nativeScope.region) && <details className="m-4 rounded-lg border">
        <summary className="cursor-pointer p-4 text-sm font-medium">Import existing {selectedServiceMeta.code} text batches</summary>
        <ServiceBatchAddPanel {...calculatorController.batchPanelProps} />
      </details>}
    </TabsContent>
    </Tabs>
  </Card>;
}
