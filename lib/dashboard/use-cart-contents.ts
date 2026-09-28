import { applyProductMutation } from "@/lib/calculator-cart";
import {
  copyText,
  getResponseError,
  splitProductPriceSummary,
} from "@/lib/calculator-page-helpers";
import type {
  AppList,
  AppProduct,
  AppProject,
  ProductMutationBody,
} from "@/lib/calculator-types";
import {
  getProductOrderTimestamp,
  removeProductFromProjects,
  toClipboardProductMutationBody,
  type CartSortOption,
} from "@/lib/page-utils";
import { getProductConfigSummary } from "@/lib/product-config-summary";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Options = {
  selectedList: AppList | null;
  selectedListId: string;
  setAddToListMessage: Dispatch<SetStateAction<string>>;
  setProjects: Dispatch<SetStateAction<AppProject[]>>;
  editingProductId: string | null;
  handleCancelEdit: () => void;
  isSignedIn: boolean;
  mutateListProduct: (
    requestUrl: string,
    requestMethod: "POST" | "PATCH",
    requestBody: ProductMutationBody,
    fallbackError: string,
  ) => Promise<
    ProductMutationBody & {
      id: string;
      createdAt?: string | undefined;
      updatedAt: string;
    } & { listId: string; projectId: string; error?: undefined }
  >;
};

export function useCartContents({
  selectedList,
  selectedListId,
  setAddToListMessage,
  setProjects,
  editingProductId,
  handleCancelEdit,
  isSignedIn,
  mutateListProduct,
}: Options) {
  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null,
  );

  const [cartSearchQuery, setCartSearchQuery] = useState("");

  const [isCartFiltersOpen, setIsCartFiltersOpen] = useState(false);

  const [cartServiceFilter, setCartServiceFilter] = useState("__all");

  const [cartSortOption, setCartSortOption] =
    useState<CartSortOption>("default");

  const [selectedCartItemIds, setSelectedCartItemIds] = useState<string[]>([]);

  const [cartClipboardMessage, setCartClipboardMessage] = useState("");

  const [cartClipboardMessageIsError, setCartClipboardMessageIsError] =
    useState(false);

  const [cartCopyNotice, setCartCopyNotice] = useState("");

  const cartFilterAreaRef = useRef<HTMLDivElement>(null);

  const selectedCartProducts = useMemo(
    () => selectedList?.products ?? [],
    [selectedList?.products],
  );

  const normalizedCartSearchQuery = cartSearchQuery.trim().toLowerCase();

  const cartServiceFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    selectedCartProducts.forEach((product) => {
      if (!seen.has(product.serviceCode)) {
        seen.set(product.serviceCode, product.serviceName);
      }
    });
    return Array.from(seen.entries()).map(([serviceCode, serviceName]) => ({
      serviceCode,
      serviceName,
    }));
  }, [selectedCartProducts]);

  const filteredCartProducts = useMemo(() => {
    const matchesSearch = (product: AppProduct) => {
      if (!normalizedCartSearchQuery) {
        return true;
      }

      const haystack = [
        product.title,
        product.serviceName,
        product.serviceCode,
        product.productType,
        getProductConfigSummary(product),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedCartSearchQuery);
    };

    const matchesService = (product: AppProduct) => {
      return (
        cartServiceFilter === "__all" ||
        product.serviceCode === cartServiceFilter
      );
    };

    const parsePriceAmount = (product: AppProduct) => {
      const amountText = splitProductPriceSummary(product).amount.replace(
        /[^0-9.]+/g,
        "",
      );
      const amount = Number(amountText);
      return Number.isFinite(amount) ? amount : 0;
    };

    const nextProducts = selectedCartProducts.filter(
      (product) => matchesSearch(product) && matchesService(product),
    );
    switch (cartSortOption) {
      case "title-asc":
        return [...nextProducts].sort((left, right) =>
          left.title.localeCompare(right.title),
        );
      case "title-desc":
        return [...nextProducts].sort((left, right) =>
          right.title.localeCompare(left.title),
        );
      case "price-desc":
        return [...nextProducts].sort(
          (left, right) => parsePriceAmount(right) - parsePriceAmount(left),
        );
      case "price-asc":
        return [...nextProducts].sort(
          (left, right) => parsePriceAmount(left) - parsePriceAmount(right),
        );
      default:
        return [...nextProducts]
          .map((product, index) => ({ product, index }))
          .sort((left, right) => {
            const leftTimestamp = getProductOrderTimestamp(
              left.product,
              left.index,
            );
            const rightTimestamp = getProductOrderTimestamp(
              right.product,
              right.index,
            );
            if (leftTimestamp !== rightTimestamp) {
              return leftTimestamp - rightTimestamp;
            }
            return left.index - right.index;
          })
          .map(({ product }) => product);
    }
  }, [
    cartServiceFilter,
    cartSortOption,
    normalizedCartSearchQuery,
    selectedCartProducts,
  ]);

  const hasActiveCartFilters =
    normalizedCartSearchQuery.length > 0 ||
    cartServiceFilter !== "__all" ||
    cartSortOption !== "default";

  const selectedCartItems = useMemo(
    () =>
      selectedCartProducts.filter((product) =>
        selectedCartItemIds.includes(product.id),
      ),
    [selectedCartItemIds, selectedCartProducts],
  );

  const selectedCartItemCount = useMemo(
    () =>
      selectedCartItemIds.filter((productId) =>
        selectedCartProducts.some((product) => product.id === productId),
      ).length,
    [selectedCartItemIds, selectedCartProducts],
  );

  useEffect(() => {
    setCartSearchQuery("");
    setCartServiceFilter("__all");
    setCartSortOption("default");
    setIsCartFiltersOpen(false);
    setSelectedCartItemIds([]);
    setCartClipboardMessage("");
    setCartClipboardMessageIsError(false);
    setCartCopyNotice("");
  }, [selectedList?.id]);

  useEffect(() => {
    if (!cartCopyNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCartCopyNotice("");
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [cartCopyNotice]);

  useEffect(() => {
    const availableProductIds = new Set(
      selectedCartProducts.map((product) => product.id),
    );
    setSelectedCartItemIds((current) =>
      current.filter((productId) => availableProductIds.has(productId)),
    );
  }, [selectedCartProducts]);

  const handleDeleteProduct = async (product: AppProduct) => {
    if (!selectedListId) {
      return;
    }

    setDeletingProductId(product.id);
    setAddToListMessage("");

    try {
      const response = await fetch(
        `/api/lists/${selectedListId}/products/${product.id}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            id: string;
            listId: string;
            projectId: string;
            deleted: true;
            updatedAt: string;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(getResponseError(payload, "Unable to delete product"));
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.listId
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        productCount: Math.max(0, list.productCount - 1),
                        products: list.products.filter(
                          (item) => item.id !== payload.id,
                        ),
                      }
                    : list,
                ),
              }
            : project,
        ),
      );

      if (editingProductId === payload.id) {
        handleCancelEdit();
      }

      setAddToListMessage("");
      setCartCopyNotice("Product deleted.");
    } catch (error) {
      setAddToListMessage(
        error instanceof Error ? error.message : "Unable to delete product",
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  const toggleCartItemSelection = useCallback((productId: string) => {
    setSelectedCartItemIds((current) =>
      current.includes(productId)
        ? current.filter((currentId) => currentId !== productId)
        : [...current, productId],
    );
  }, []);

  const clearCartItemSelection = useCallback(() => {
    setSelectedCartItemIds([]);
  }, []);

  const selectAllVisibleCartItems = useCallback(() => {
    setSelectedCartItemIds(filteredCartProducts.map((product) => product.id));
  }, [filteredCartProducts]);

  const handleCutSelectedCartItems = useCallback(async () => {
    if (!selectedListId || selectedCartItems.length === 0) {
      return;
    }

    const copied = await copyText(JSON.stringify(selectedCartItems, null, 2));
    if (!copied) {
      setCartClipboardMessageIsError(true);
      setCartClipboardMessage(
        "Clipboard access is unavailable in this browser.",
      );
      return;
    }

    setCartClipboardMessage("");
    setCartClipboardMessageIsError(false);
    const selectedIds = new Set(selectedCartItems.map((product) => product.id));
    const editingSelectionRemoved =
      editingProductId != null && selectedIds.has(editingProductId);

    try {
      for (const product of selectedCartItems) {
        const response = await fetch(
          `/api/lists/${selectedListId}/products/${product.id}`,
          {
            method: "DELETE",
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              id: string;
              listId: string;
              projectId: string;
              deleted: true;
              updatedAt: string;
            }
          | { error?: string }
          | null;

        if (!response.ok || !payload || !("projectId" in payload)) {
          throw new Error(
            getResponseError(payload, `Unable to cut ${product.title}`),
          );
        }

        setProjects((current) => removeProductFromProjects(current, payload));
      }

      if (editingSelectionRemoved) {
        handleCancelEdit();
      }

      clearCartItemSelection();
      setAddToListMessage("");
      setCartCopyNotice(
        `${selectedCartItems.length} item${selectedCartItems.length === 1 ? "" : "s"} cut`,
      );
    } catch (error) {
      setCartClipboardMessageIsError(true);
      setCartClipboardMessage(
        error instanceof Error ? error.message : "Unable to cut cart items.",
      );
    }
  }, [
    clearCartItemSelection,
    editingProductId,
    handleCancelEdit,
    selectedCartItems,
    selectedListId,
    setAddToListMessage,
    setProjects,
  ]);

  const handlePasteCartItemsFromText = useCallback(
    async (clipboardText: string) => {
      if (!isSignedIn) {
        setCartClipboardMessageIsError(true);
        setCartClipboardMessage("Sign in to paste cart items.");
        return;
      }

      if (!selectedListId) {
        setCartClipboardMessageIsError(true);
        setCartClipboardMessage("Select a cart before pasting items.");
        return;
      }

      let parsedClipboard: unknown;
      try {
        parsedClipboard = JSON.parse(clipboardText);
      } catch {
        setCartClipboardMessageIsError(true);
        setCartClipboardMessage("Clipboard does not contain valid JSON.");
        return;
      }

      if (!Array.isArray(parsedClipboard) || parsedClipboard.length === 0) {
        setCartClipboardMessageIsError(true);
        setCartClipboardMessage(
          "Clipboard JSON must be a non-empty array of cart items.",
        );
        return;
      }

      const requestBodies = parsedClipboard
        .map((item) => toClipboardProductMutationBody(item))
        .filter((item): item is ProductMutationBody => item !== null);

      if (requestBodies.length !== parsedClipboard.length) {
        setCartClipboardMessageIsError(true);
        setCartClipboardMessage(
          "Clipboard JSON includes one or more invalid cart items.",
        );
        return;
      }

      try {
        const createdIds: string[] = [];
        for (const requestBody of requestBodies) {
          const createdPayload = await mutateListProduct(
            `/api/lists/${selectedListId}/products`,
            "POST",
            requestBody,
            "Unable to paste cart items",
          );
          createdIds.push(createdPayload.id);
          setProjects((current) =>
            applyProductMutation(current, createdPayload, "POST", "end"),
          );
        }

        setSelectedCartItemIds(createdIds);
        setCartClipboardMessageIsError(false);
        setCartClipboardMessage("");
        setCartCopyNotice(
          `Pasted ${createdIds.length} item${createdIds.length === 1 ? "" : "s"} from clipboard.`,
        );
      } catch (error) {
        setCartClipboardMessageIsError(true);
        setCartClipboardMessage(
          error instanceof Error
            ? error.message
            : "Unable to paste cart items.",
        );
      }
    },
    [isSignedIn, mutateListProduct, selectedListId, setProjects],
  );
  return {
    deletingProductId,
    cartSearchQuery,
    setCartSearchQuery,
    isCartFiltersOpen,
    setIsCartFiltersOpen,
    cartServiceFilter,
    setCartServiceFilter,
    cartSortOption,
    setCartSortOption,
    selectedCartItemIds,
    cartClipboardMessage,
    cartClipboardMessageIsError,
    cartCopyNotice,
    setCartCopyNotice,
    cartFilterAreaRef,
    selectedCartProducts,
    cartServiceFilterOptions,
    filteredCartProducts,
    hasActiveCartFilters,
    selectedCartItems,
    selectedCartItemCount,
    handleDeleteProduct,
    toggleCartItemSelection,
    clearCartItemSelection,
    selectAllVisibleCartItems,
    handleCutSelectedCartItems,
    handlePasteCartItemsFromText,
  };
}
