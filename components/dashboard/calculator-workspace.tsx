"use client";
import { NativeCalculatorPanel } from "@/components/calculators/native-calculator-panel";

import { CalculatorPanelRouter } from "@/components/calculators/calculator-panel-router";
import { FreeServicePanel } from "@/components/calculators/free-service-panel";
import { ServiceBatchAddPanel } from "@/components/calculators/service-batch-add-panel";
import { UnsupportedServicePanel } from "@/components/calculators/unsupported-service-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionGrid } from "@/components/ui/option-grid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardModel } from "@/lib/dashboard/use-dashboard";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { type BillingOption } from "@/lib/page-utils";
import { supportedBatchAddServiceCodes, supportedCalculatorServiceCodes } from "@/lib/service-config";
import Image from "next/image";

export function CalculatorWorkspace({
  nativeEditingProduct,
  saveNativeProduct,
  calculatorController,
  projectStore,
  locationState,
  activeTab,
  setActiveTab,
  selectedServiceMeta,
  selectedService,
  selectedServiceDefinition,
  selectedServiceDefinitionStatus,
  editingProductId,
  isSignedIn,
  regionValue,
  setRegionValue,
  billingMode,
  setBillingMode,
  usageHours,
  setUsageHours,
}: DashboardModel["calculator"]) {
  const {
    isSelectedServiceFree,
    isSelectedServiceImplemented,
    selectedEstimateParts,
    displayQuantityValue,
    quantityLabel,
    addToListMessage,
    showGlobalQuantityControl,
    updateInstanceCount,
    instanceCount,
    handleCancelEdit,
    addToListPending,
    handleAddToList,
    showBillingHeader,
    showSharedUsageHours,
    calculatorBillingOptions,
    calculatorPanelProps,
    isSelectedServiceBatchAddImplemented,
    batchPanelProps,
  } = calculatorController;
  const { selectedListId } = projectStore;
  const { updateUsageHours } = locationState;
  return (
    <>
      <Card className="@container/workspace min-w-0 overflow-visible shadow-sm">
        <Tabs
          value={activeTab}
          onValueChange={(tab) => {
            if (
              editingProductId &&
              ((nativeEditingProduct && tab !== "huawei-live") || (!nativeEditingProduct && tab === "huawei-live"))
            )
              calculatorController.handleCancelEdit();
            setActiveTab(tab);
          }}
        >
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 @min-[740px]/workspace:flex-row @min-[740px]/workspace:items-center @min-[740px]/workspace:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src={selectedServiceMeta.icon}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-lg object-contain"
                />
                <div className="min-w-0">
                  <CardTitle className="text-xl @min-[640px]/workspace:text-2xl">
                    {activeTab === "huawei-live" ? "Huawei live calculator" : selectedService}
                  </CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-zinc-500">{selectedServiceMeta.code}</p>
                    {selectedServiceDefinition ? (
                      <Badge variant="secondary">
                        {selectedServiceDefinitionStatus === "pilot" ? "JSON Pilot" : "JSON Config"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <TabsList className="grid w-full max-w-full grid-cols-3 @min-[480px]/workspace:w-fit">
                <TabsTrigger className="min-w-0 whitespace-normal text-xs @min-[480px]/workspace:text-sm" value="huawei-live">Huawei live</TabsTrigger>
                <TabsTrigger className="min-w-0 whitespace-normal text-xs @min-[480px]/workspace:text-sm" value="calculator">Price Calculator</TabsTrigger>
                <TabsTrigger className="min-w-0 whitespace-normal text-xs @min-[480px]/workspace:text-sm" value="batch-add">Batch add</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <Separator />

          <TabsContent value="huawei-live">
            <NativeCalculatorPanel
              editingProduct={nativeEditingProduct}
              onSave={saveNativeProduct}
              onCancelEdit={calculatorController.handleCancelEdit}
            />
          </TabsContent>
          <TabsContent value="calculator">
            {isSelectedServiceFree ? (
              <FreeServicePanel serviceName={selectedService} serviceCode={selectedServiceMeta.code} />
            ) : isSelectedServiceImplemented ? (
              <>
                <CardContent data-calculator-shortcut-root className="space-y-4 py-4 pb-6">
                  <div className="grid gap-4 @min-[480px]/workspace:grid-cols-2">
                    <div className="space-y-2" data-calculator-focus-group>
                      <p className="text-sm text-zinc-600">Description (Optional)</p>
                      <Input
                        value={selectedService}
                        readOnly
                        data-calculator-focus-target
                        className="w-full max-w-none"
                      />
                    </div>

                    <section className="space-y-3" data-calculator-focus-group>
                      <p className="text-sm font-medium">Region</p>
                      <Select value={regionValue} onValueChange={(value) => setRegionValue(value as HuaweiRegionKey)}>
                        <SelectTrigger data-calculator-focus-target className="w-full max-w-none bg-white">
                          <SelectValue>{huaweiRegions[regionValue].full}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(huaweiRegions).map(([value, labels]) => (
                            <SelectItem
                              key={value}
                              value={value}
                              onClick={() => setRegionValue(value as HuaweiRegionKey)}
                            >
                              {labels.short}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </section>
                  </div>

                  {showBillingHeader ? (
                    <section
                      className={`grid gap-4 ${billingMode === "Pay-per-use" && showSharedUsageHours ? "@min-[640px]/workspace:grid-cols-[minmax(0,1fr)_240px]" : ""}`}
                    >
                      <div className="space-y-3" data-calculator-focus-group>
                        <p className="text-sm font-medium">Billing Mode</p>
                        <OptionGrid
                          items={calculatorBillingOptions.map((o) => ({
                            value: o,
                            label: o,
                          }))}
                          value={billingMode}
                          onChange={(value) => {
                            setBillingMode(value as BillingOption);
                          }}
                          name="Billing Mode"
                        />
                      </div>
                      {billingMode === "Pay-per-use" && showSharedUsageHours ? (
                        <div className="space-y-3" data-calculator-focus-group>
                          <p className="text-sm font-medium">Usage Hours</p>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-11 rounded-none px-3"
                                onClick={() => updateUsageHours(String(Number(usageHours || "744") - 24))}
                              >
                                -
                              </Button>
                              <Input
                                value={usageHours}
                                data-calculator-focus-target
                                onChange={(event) => {
                                  const digitsOnly = event.target.value.replace(/\D/g, "");
                                  if (digitsOnly === "") {
                                    setUsageHours("");
                                    return;
                                  }
                                  updateUsageHours(digitsOnly);
                                }}
                                onBlur={() => updateUsageHours(usageHours || "744")}
                                inputMode="numeric"
                                className="h-11 w-24 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-11 rounded-none px-3"
                                onClick={() => updateUsageHours(String(Number(usageHours || "744") + 24))}
                              >
                                +
                              </Button>
                            </div>
                            <span className="text-sm font-medium text-zinc-500">hours</span>
                          </div>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  <CalculatorPanelRouter {...calculatorPanelProps} />
                </CardContent>
                <div className="sticky bottom-3 z-40 mx-3 grid gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 px-3 py-3 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)] backdrop-blur @min-[560px]/workspace:grid-cols-[minmax(0,1fr)_auto] @min-[560px]/workspace:items-center">
                  <div className="min-w-0">
                    <p className="text-2xl @min-[560px]/workspace:text-3xl leading-none font-semibold tracking-tight text-zinc-950">
                      {selectedEstimateParts.amount}
                    </p>
                    <p className="mt-0.5 leading-tight text-sm text-zinc-500">
                      {selectedEstimateParts.timeframe ? `${selectedEstimateParts.timeframe} · ` : ""}
                      {displayQuantityValue} {quantityLabel}
                      {displayQuantityValue === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-col justify-center gap-2 @min-[560px]/workspace:items-end">
                    {addToListMessage ? <p className="text-sm text-zinc-500">{addToListMessage}</p> : null}
                    <div className="flex flex-wrap items-center gap-2 @min-[560px]/workspace:justify-end">
                      {showGlobalQuantityControl ? (
                        <div className="flex items-center gap-2">
                          <span className="sr-only text-sm font-medium text-zinc-600 @min-[560px]/workspace:not-sr-only">{quantityLabel}s</span>
                          <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 rounded-none px-3"
                              onClick={() => updateInstanceCount(String(Number(instanceCount || "1") - 1))}
                            >
                              -
                            </Button>
                            <Input
                              value={instanceCount}
                              onChange={(event) => {
                                const digitsOnly = event.target.value.replace(/\D/g, "");
                                if (digitsOnly === "") {
                                  updateInstanceCount("");
                                  return;
                                }
                                updateInstanceCount(digitsOnly);
                              }}
                              onBlur={() => updateInstanceCount(instanceCount || "1")}
                              inputMode="numeric"
                              aria-label={quantityLabel + " quantity"}
                              className="h-10 w-12 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 rounded-none px-3"
                              onClick={() => updateInstanceCount(String(Number(instanceCount || "1") + 1))}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {editingProductId ? (
                        <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={addToListPending}>
                          Cancel
                        </Button>
                      ) : null}
                      <Button
                        data-calculator-add-button
                        onClick={handleAddToList}
                        disabled={addToListPending || !selectedListId || !isSignedIn}
                        className="bg-zinc-950 hover:bg-zinc-800"
                      >
                        {addToListPending
                          ? editingProductId
                            ? "Saving..."
                            : "Adding..."
                          : editingProductId
                            ? "Save Changes"
                            : "Add to List"}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <UnsupportedServicePanel
                title={`Calculator not implemented yet for ${selectedService}`}
                description={`This dashboard calculator currently supports ${supportedCalculatorServiceCodes.join(", ")} only.`}
              />
            )}
          </TabsContent>

          <TabsContent value="batch-add">
            {isSelectedServiceBatchAddImplemented && batchPanelProps ? (
              <ServiceBatchAddPanel {...batchPanelProps} />
            ) : (
              <UnsupportedServicePanel
                title={`Batch add not implemented yet for ${selectedService}`}
                description={`Batch input currently supports ${supportedBatchAddServiceCodes.join(", ")} only.`}
              />
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
