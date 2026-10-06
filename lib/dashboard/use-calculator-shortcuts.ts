import {
  chooseOpenCalculatorSelectItem,
  getCalculatorActionButton,
  getCalculatorFocusTarget,
  getShortcutDigit,
  getVisibleOpenCalculatorSelectItems,
  isCalculatorSelectTrigger,
  isVisibleCalculatorElement,
} from "@/lib/page-utils";
import { useCallback, useEffect, useState } from "react";

type Options = {
  activeTab: string;
};

export function useCalculatorShortcuts({
  activeTab,
}: Options) {
  const [isAltShortcutGuideVisible, setIsAltShortcutGuideVisible] =
    useState(false);

  const [
    isAwaitingCalculatorSelectOptionShortcut,
    setIsAwaitingCalculatorSelectOptionShortcut,
  ] = useState(false);

  const [altShortcutGuideRefreshTick, setAltShortcutGuideRefreshTick] =
    useState(0);

  const focusCalculatorInputByIndex = useCallback(
    (index: number) => {
      if (activeTab !== "calculator") {
        return false;
      }

      const shortcutRoot = document.querySelector<HTMLElement>(
        "[data-calculator-shortcut-root]",
      );
      const groups = Array.from(
        shortcutRoot?.querySelectorAll<HTMLElement>(
          "[data-calculator-focus-group]",
        ) ?? [],
      ).filter(isVisibleCalculatorElement);
      const targetGroup = groups[index];
      if (!targetGroup) {
        return false;
      }

      const focusTarget = getCalculatorFocusTarget(targetGroup);
      if (!focusTarget) {
        return false;
      }

      focusTarget.focus();
      if (
        focusTarget instanceof HTMLInputElement ||
        focusTarget instanceof HTMLTextAreaElement
      ) {
        focusTarget.select();
        return true;
      }

      if (focusTarget instanceof HTMLSelectElement) return true;

      if (isCalculatorSelectTrigger(focusTarget)) {
        setIsAwaitingCalculatorSelectOptionShortcut(true);
        focusTarget.click();
        window.setTimeout(() => {
          setAltShortcutGuideRefreshTick((current) => current + 1);
        }, 0);
      }

      return true;
    },
    [activeTab],
  );

  const triggerCalculatorAddShortcut = useCallback(() => {
    if (activeTab !== "calculator") {
      return false;
    }

    const actionButton = getCalculatorActionButton();
    if (!actionButton) {
      return false;
    }

    actionButton.click();
    return true;
  }, [activeTab]);

  useEffect(() => {
    const handleAltDigitShortcut = (event: KeyboardEvent) => {
      if (
        isAwaitingCalculatorSelectOptionShortcut &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        const digit = getShortcutDigit(event);
        if (digit != null) {
          const targetIndex = digit === 0 ? 9 : digit - 1;
          setIsAwaitingCalculatorSelectOptionShortcut(false);
          event.preventDefault();
          event.stopPropagation();
          window.setTimeout(() => {
            chooseOpenCalculatorSelectItem(targetIndex);
          }, 0);
          return;
        }
      }

      if (
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        const target =
          event.target instanceof HTMLElement ? event.target : null;
        const optionGrid = target?.closest<HTMLElement>("[data-option-grid]");
        if (optionGrid) {
          const digit = getShortcutDigit(event);
          if (digit != null && digit >= 1) {
            const button = optionGrid.querySelector<HTMLButtonElement>(`[data-option-grid-button="${digit}"]`);
            if (button && !button.matches(":disabled")) {
              event.preventDefault();
              event.stopPropagation();
              button.click();
              button.focus();
              return;
            }
          }
        }
      }

      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "a"
      ) {
        if (triggerCalculatorAddShortcut()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const digit = getShortcutDigit(event);
      if (digit == null) {
        return;
      }

      const targetIndex = digit === 0 ? 9 : digit - 1;
      if (focusCalculatorInputByIndex(targetIndex)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("keydown", handleAltDigitShortcut, true);
    return () =>
      document.removeEventListener("keydown", handleAltDigitShortcut, true);
  }, [
    focusCalculatorInputByIndex,
    isAwaitingCalculatorSelectOptionShortcut,
    triggerCalculatorAddShortcut,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Alt" && !event.ctrlKey && !event.metaKey) {
        setIsAltShortcutGuideVisible(true);
      }

      if (event.key === "Escape") {
        setIsAwaitingCalculatorSelectOptionShortcut(false);
      }
    };

    const clearGuide = () => setIsAltShortcutGuideVisible(false);

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", clearGuide, true);
    window.addEventListener("blur", clearGuide);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", clearGuide, true);
      window.removeEventListener("blur", clearGuide);
    };
  }, []);

  useEffect(() => {
    const shortcutRoot = document.querySelector<HTMLElement>(
      "[data-calculator-shortcut-root]",
    );
    const groups = Array.from(
      shortcutRoot?.querySelectorAll<HTMLElement>(
        "[data-calculator-focus-group]",
      ) ?? [],
    );
    const actionButton = document.querySelector<HTMLElement>(
      "[data-calculator-add-button]",
    );

    const clearShortcutAttributes = () => {
      groups.forEach((group) => {
        group.removeAttribute("data-calculator-shortcut-index");
        group.removeAttribute("data-calculator-shortcut-visible");
      });
      getVisibleOpenCalculatorSelectItems().forEach((item) => {
        item.removeAttribute("data-calculator-shortcut-index");
        item.removeAttribute("data-calculator-shortcut-visible");
      });
      actionButton?.removeAttribute("data-calculator-shortcut-index");
      actionButton?.removeAttribute("data-calculator-shortcut-visible");
    };

    clearShortcutAttributes();

    if (
      (!isAltShortcutGuideVisible &&
        !isAwaitingCalculatorSelectOptionShortcut) ||
      activeTab !== "calculator"
    ) {
      return clearShortcutAttributes;
    }

    const syncShortcutAttributes = () => {
      clearShortcutAttributes();
      const visibleOpenSelectItems = getVisibleOpenCalculatorSelectItems();

      if (isAltShortcutGuideVisible) {
        groups
          .filter(isVisibleCalculatorElement)
          .slice(0, 10)
          .forEach((group, index) => {
            group.setAttribute(
              "data-calculator-shortcut-index",
              index === 9 ? "0" : String(index + 1),
            );
            group.setAttribute("data-calculator-shortcut-visible", "true");
          });
      }

      visibleOpenSelectItems.slice(0, 10).forEach((item, index) => {
        item.setAttribute(
          "data-calculator-shortcut-index",
          index === 9 ? "0" : String(index + 1),
        );
        item.setAttribute("data-calculator-shortcut-visible", "true");
      });

      const visibleActionButton = getCalculatorActionButton();
      if (visibleActionButton && isAltShortcutGuideVisible) {
        visibleActionButton.setAttribute("data-calculator-shortcut-index", "A");
        visibleActionButton.setAttribute(
          "data-calculator-shortcut-visible",
          "true",
        );
      }
    };

    syncShortcutAttributes();

    const observer = new MutationObserver(() => {
      syncShortcutAttributes();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "data-open",
        "data-starting-style",
        "data-ending-style",
        "data-highlighted",
      ],
    });

    return () => {
      observer.disconnect();
      clearShortcutAttributes();
    };
  }, [
    activeTab,
    altShortcutGuideRefreshTick,
    isAltShortcutGuideVisible,
    isAwaitingCalculatorSelectOptionShortcut,
  ]);
  return {};
}
