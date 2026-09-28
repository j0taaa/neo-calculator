import { copyText } from "@/lib/calculator-page-helpers";
import type { AppList, AppProduct } from "@/lib/calculator-types";
import { isEditableTarget } from "@/lib/page-utils";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";

type Options = {
  searchAreaRef: RefObject<HTMLDivElement | null>;
  setIsSearchOpen: Dispatch<SetStateAction<boolean>>;
  profileAreaRef: RefObject<HTMLDivElement | null>;
  cartFilterAreaRef: RefObject<HTMLDivElement | null>;
  setIsCartFiltersOpen: Dispatch<SetStateAction<boolean>>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  selectedList: AppList | null;
  filteredCartProducts: AppProduct[];
  selectAllVisibleCartItems: () => void;
  selectedCartItems: AppProduct[];
  setCartCopyNotice: Dispatch<SetStateAction<string>>;
  handleCutSelectedCartItems: () => Promise<void>;
  selectedCartItemCount: number;
  clearCartItemSelection: () => void;
  isSignedIn: boolean;
  selectedListId: string;
  handlePasteCartItemsFromText: (clipboardText: string) => Promise<void>;
};

export function useDashboardKeyboard({
  searchAreaRef,
  setIsSearchOpen,
  profileAreaRef,
  cartFilterAreaRef,
  setIsCartFiltersOpen,
  searchInputRef,
  selectedList,
  filteredCartProducts,
  selectAllVisibleCartItems,
  selectedCartItems,
  setCartCopyNotice,
  handleCutSelectedCartItems,
  selectedCartItemCount,
  clearCartItemSelection,
  isSignedIn,
  selectedListId,
  handlePasteCartItemsFromText,
}: Options) {
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-slot='select-content']")) {
        return;
      }

      if (searchAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsSearchOpen(false);

      if (profileAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      if (cartFilterAreaRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsCartFiltersOpen(false);
    };

    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        if (
          isEditableTarget(event.target) ||
          !selectedList ||
          filteredCartProducts.length === 0
        ) {
          return;
        }

        const selectedText = window.getSelection()?.toString().trim();
        if (selectedText) {
          return;
        }

        event.preventDefault();
        selectAllVisibleCartItems();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        if (isEditableTarget(event.target)) {
          return;
        }

        const selectedText = window.getSelection()?.toString().trim();
        if (selectedText) {
          return;
        }

        if (!selectedCartItems.length) {
          return;
        }

        event.preventDefault();
        void copyText(JSON.stringify(selectedCartItems, null, 2));
        setCartCopyNotice(
          `${selectedCartItems.length} element${selectedCartItems.length === 1 ? "" : "s"} copied`,
        );
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
        if (isEditableTarget(event.target)) {
          return;
        }

        const selectedText = window.getSelection()?.toString().trim();
        if (selectedText) {
          return;
        }

        if (!selectedCartItems.length) {
          return;
        }

        event.preventDefault();
        void handleCutSelectedCartItems();
        return;
      }

      if (
        event.key === "Escape" &&
        selectedCartItemCount > 0 &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        clearCartItemSelection();
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target) || !isSignedIn || !selectedListId) {
        return;
      }

      const clipboardText = event.clipboardData?.getData("text");
      if (!clipboardText?.trim()) {
        return;
      }

      event.preventDefault();
      void handlePasteCartItemsFromText(clipboardText);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("paste", handlePaste);
    };
  }, [
    cartFilterAreaRef,
    clearCartItemSelection,
    filteredCartProducts,
    handleCutSelectedCartItems,
    handlePasteCartItemsFromText,
    isSignedIn,
    profileAreaRef,
    searchAreaRef,
    searchInputRef,
    selectAllVisibleCartItems,
    selectedCartItemCount,
    selectedCartItems,
    selectedList,
    selectedListId,
    setCartCopyNotice,
    setIsCartFiltersOpen,
    setIsSearchOpen,
  ]);
  return {};
}
