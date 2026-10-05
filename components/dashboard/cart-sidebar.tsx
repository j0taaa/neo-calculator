"use client";
import { type ActionMenuItem } from "@/components/home-page-shell-parts";
import { Copy, Download, Link2, RefreshCw, Share2, Trash2 } from "lucide-react";

import { ActionMenu } from "@/components/home-page-shell-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { isRecord, splitProductPriceSummary } from "@/lib/calculator-page-helpers";
import type { DashboardModel } from "@/lib/dashboard/use-dashboard";
import { getServiceMeta, type CartSortOption } from "@/lib/page-utils";
import { getProductConfigSummary } from "@/lib/product-config-summary";
import { formatDateTime } from "@/lib/utils";
import { Pencil, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import Image from "next/image";

export function CartSidebar({
  projectStore,
  huawei,
  cloning,
  sharing,
  cart,
  calculatorController,
  transfer,
  projectActions,
  openActionModal,
  isCartMenuOpen,
  setIsCartMenuOpen,
  editingProductId,
  isSignedIn,
}: DashboardModel["cart"]) {
  const { selectedList, selectedProject, selectedListId } = projectStore;
  const { huaweiActionMessage, handleSyncSelectedList, syncingHuaweiListId } = huawei;
  const { cloneActionMessage, cloneActionIsError } = cloning;
  const { listShareMessages } = sharing;
  const {
    filteredCartProducts,
    selectedCartProducts,
    cartSearchQuery,
    setCartSearchQuery,
    cartFilterAreaRef,
    isCartFiltersOpen,
    hasActiveCartFilters,
    setIsCartFiltersOpen,
    setCartServiceFilter,
    setCartSortOption,
    cartServiceFilter,
    cartServiceFilterOptions,
    cartSortOption,
    selectedCartItemCount,
    clearCartItemSelection,
    cartClipboardMessage,
    cartClipboardMessageIsError,
    selectedCartItemIds,
    toggleCartItemSelection,
    deletingProductId,
    handleDeleteProduct,
  } = cart;
  const { handleCancelEdit, addToListPending, handleAddToList, handleEditProduct } = calculatorController;
  const { handleOpenListExport } = transfer;
  const { handleDeleteList, deletingListId } = projectActions;
  const selectedCartMenuItems: ActionMenuItem[] =
    selectedList && selectedProject
      ? [
          {
            label: selectedList.huaweiCartKey ? "Sync Huawei Cart" : "Create Huawei Cart",
            icon: <RefreshCw className="size-4" />,
            onSelect: () => {
              void handleSyncSelectedList();
            },
            disabled: syncingHuaweiListId === selectedList.id,
          },
          {
            label: "Link Huawei Cart",
            icon: <Link2 className="size-4" />,
            onSelect: () => openActionModal({ kind: "list-link", listId: selectedList.id }),
          },
          {
            label: "Export Cart JSON",
            icon: <Download className="size-4" />,
            onSelect: () => handleOpenListExport(selectedProject, selectedList),
          },
          {
            label: "Clone Cart",
            icon: <Copy className="size-4" />,
            onSelect: () => openActionModal({ kind: "list-clone", listId: selectedList.id }),
          },
          ...(selectedList.canShare
            ? [
                {
                  label: "Share Cart",
                  icon: <Share2 className="size-4" />,
                  onSelect: () =>
                    openActionModal({
                      kind: "list-share",
                      listId: selectedList.id,
                    }),
                },
              ]
            : []),
          {
            label: "Delete Cart",
            icon: <Trash2 className="size-4" />,
            onSelect: () => {
              void handleDeleteList(selectedList, selectedProject.id);
            },
            disabled: deletingListId === selectedList.id,
          },
        ]
      : [];
  return (
    <>
      <Card className="min-w-0 overflow-hidden shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 basis-full">
              <CardTitle>Cart Contents</CardTitle>
              <p className="mt-1 truncate text-sm text-zinc-500">
                {selectedList && selectedProject
                  ? `${selectedProject.name} / ${selectedList.name}`
                  : "Select a list to see its saved products."}
              </p>
              {selectedList?.huaweiCartKey ? (
                <p className="mt-1 text-xs text-zinc-400">
                  Linked to Huawei cart {selectedList.huaweiCartName || selectedList.huaweiCartKey}
                </p>
              ) : null}
              {selectedList?.huaweiLastSyncedAt ? (
                <p className="mt-1 text-xs text-zinc-400">
                  Last Huawei sync: {formatDateTime(selectedList.huaweiLastSyncedAt)}
                </p>
              ) : null}
              {selectedList?.huaweiLastError ? (
                <p className="mt-1 text-xs text-red-600">{selectedList.huaweiLastError}</p>
              ) : null}
              {selectedList && (huaweiActionMessage || cloneActionMessage || listShareMessages[selectedList.id]) ? (
                <div className="mt-2 space-y-1 text-xs">
                  {huaweiActionMessage ? <p className="text-zinc-500">{huaweiActionMessage}</p> : null}
                  {cloneActionMessage ? (
                    <p className={cloneActionIsError ? "text-red-600" : "text-zinc-500"}>{cloneActionMessage}</p>
                  ) : null}
                  {listShareMessages[selectedList.id] ? (
                    <p className="text-zinc-500">{listShareMessages[selectedList.id]}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {filteredCartProducts.length === selectedCartProducts.length
                  ? `${selectedCartProducts.length} items`
                  : `${filteredCartProducts.length} of ${selectedCartProducts.length} items`}
              </Badge>
              {selectedList?.huaweiCartKey ? <Badge variant="secondary">Huawei linked</Badge> : null}
              {selectedList?.canShare ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    openActionModal({
                      kind: "list-share",
                      listId: selectedList.id,
                    })
                  }
                  aria-label={`Share ${selectedList.name}`}
                >
                  <Share2 className="size-4" />
                </Button>
              ) : null}
              {selectedList ? (
                <ActionMenu
                  open={isCartMenuOpen}
                  onOpenChange={setIsCartMenuOpen}
                  label={`Open actions for ${selectedList.name}`}
                  items={selectedCartMenuItems}
                />
              ) : null}
            </div>
          </div>
          {selectedList ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={cartSearchQuery}
                  onChange={(event) => setCartSearchQuery(event.target.value)}
                  placeholder="Search cart items"
                  className="h-10 bg-white pl-9"
                  aria-label="Search cart items"
                />
              </div>
              <div ref={cartFilterAreaRef} className="relative">
                <Button
                  type="button"
                  variant={isCartFiltersOpen || hasActiveCartFilters ? "default" : "outline"}
                  size="icon"
                  onClick={() => setIsCartFiltersOpen((current) => !current)}
                  aria-label="Open cart filters"
                  aria-expanded={isCartFiltersOpen}
                >
                  <SlidersHorizontal className="size-4" />
                </Button>
                {isCartFiltersOpen ? (
                  <div className="absolute top-full right-0 z-20 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-950">Filter & Sort</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          setCartSearchQuery("");
                          setCartServiceFilter("__all");
                          setCartSortOption("default");
                        }}
                        disabled={!hasActiveCartFilters}
                      >
                        <RotateCcw className="size-4" />
                        Default
                      </Button>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium tracking-[0.16em] text-zinc-500 uppercase">Service</p>
                        <Select
                          value={cartServiceFilter}
                          onValueChange={(value) => setCartServiceFilter(value ?? "__all")}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all">All services</SelectItem>
                            {cartServiceFilterOptions.map((option) => (
                              <SelectItem key={option.serviceCode} value={option.serviceCode}>
                                {option.serviceName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium tracking-[0.16em] text-zinc-500 uppercase">Order</p>
                        <Select
                          value={cartSortOption}
                          onValueChange={(value) => setCartSortOption(value as CartSortOption)}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Saved order</SelectItem>
                            <SelectItem value="title-asc">Title A-Z</SelectItem>
                            <SelectItem value="title-desc">Title Z-A</SelectItem>
                            <SelectItem value="price-desc">Price high to low</SelectItem>
                            <SelectItem value="price-asc">Price low to high</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {selectedList && selectedCartItemCount > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <p className="font-medium">
                {selectedCartItemCount} item
                {selectedCartItemCount === 1 ? "" : "s"} selected
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-blue-700 hover:text-blue-800"
                onClick={clearCartItemSelection}
              >
                Stop selecting
              </Button>
            </div>
          ) : null}
          {selectedList && cartClipboardMessage && cartClipboardMessageIsError ? (
            <p className="mt-3 text-xs text-red-600">{cartClipboardMessage}</p>
          ) : null}
        </CardHeader>
        <Separator />
        <CardContent className="px-0">
          <ScrollArea className="px-4 [&>[data-slot=scroll-area-viewport]]:max-h-72 xl:[&>[data-slot=scroll-area-viewport]]:max-h-[calc(100dvh-22rem)]">
            <div className="space-y-3 py-3">
              {!selectedList ? (
                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                  Create a list and select it to use it as the active cart.
                </div>
              ) : null}

              {selectedList && selectedCartProducts.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                  This cart is empty.
                </div>
              ) : null}

              {selectedList && selectedCartProducts.length > 0 && filteredCartProducts.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                  No cart items matched the current search or filter settings.
                </div>
              ) : null}

              {filteredCartProducts.map((product) => {
                const serviceMeta = getServiceMeta(product.serviceCode, product.serviceName);
                const priceSummary = splitProductPriceSummary(product);
                const priceWarning =
                  isRecord(product.pricing) && typeof product.pricing.priceWarning === "string"
                    ? product.pricing.priceWarning
                    : null;
                const isEditingProduct = editingProductId === product.id;
                const isSelectedProduct = selectedCartItemIds.includes(product.id);

                return (
                  <div
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelectedProduct}
                    onClick={() => toggleCartItemSelection(product.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleCartItemSelection(product.id);
                      }
                    }}
                    className={`rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      isSelectedProduct
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : isEditingProduct
                          ? "border-zinc-950 bg-zinc-50"
                          : "border-zinc-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          {serviceMeta ? (
                            <Image
                              src={serviceMeta.icon}
                              alt=""
                              width={28}
                              height={28}
                              className="mt-0.5 size-7 rounded-md object-contain"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">{product.title}</p>
                              {isSelectedProduct ? (
                                <Badge className="bg-blue-600 text-white hover:bg-blue-600">Selected</Badge>
                              ) : null}
                              {isEditingProduct ? <Badge>Editing</Badge> : null}
                            </div>
                            <p className="mt-1 text-sm text-zinc-500">{getProductConfigSummary(product)}</p>
                            <p className="mt-1 text-xs text-zinc-400">
                              {product.serviceCode} · {product.productType.toUpperCase()} · Qty {product.quantity}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-semibold text-zinc-950">{priceSummary.amount}</p>
                        <p className="text-sm text-zinc-500">{priceSummary.timeframe ?? "Saved item"}</p>
                        {priceWarning ? <p className="mt-1 text-xs text-amber-600">{priceWarning}</p> : null}
                        <div className="mt-3 flex items-center gap-2 sm:justify-end">
                          {isEditingProduct ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCancelEdit();
                                }}
                                disabled={addToListPending || deletingProductId === product.id}
                              >
                                Cancel
                              </Button>
                              {product.productType !== "huawei-native" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleAddToList();
                                  }}
                                  disabled={
                                    addToListPending ||
                                    !selectedListId ||
                                    !isSignedIn ||
                                    deletingProductId === product.id
                                  }
                                >
                                  {addToListPending ? "Saving..." : "Save Changes"}
                                </Button>
                              )}
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (product.serviceCode.startsWith("HWC:")) {
                                  window.location.assign(
                                    `/synchronized?service=${encodeURIComponent(product.serviceCode.slice(4))}&edit=${encodeURIComponent(product.id)}`,
                                  );
                                } else {
                                  handleEditProduct(product);
                                }
                              }}
                              disabled={deletingProductId === product.id}
                              aria-label={`Edit ${product.title}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteProduct(product);
                            }}
                            disabled={deletingProductId === product.id}
                            aria-label={
                              deletingProductId === product.id ? `Deleting ${product.title}` : `Delete ${product.title}`
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}
