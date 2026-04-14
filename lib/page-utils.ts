import { findServiceCatalogEntry } from "@/lib/service-config";
import type { AppProduct, AppProject, BillingOption as PageBillingOption, ProductMutationBody } from "@/lib/calculator-page-helpers";
import type { ActiveModalKind } from "@/lib/dashboard-url-state";

export type BillingOption = PageBillingOption;

export type CartSortOption = "default" | "title-asc" | "title-desc" | "price-desc" | "price-asc";

export type ActiveModal =
  | { kind: ActiveModalKind; projectId: string }
  | { kind: ActiveModalKind; listId: string }
  | null;

export type ResourceExportModalState = {
  title: string;
  description: string;
  json: string;
  filename: string;
} | null;

export const BILLING_OPTIONS = ["Pay-per-use", "RI", "Yearly/Monthly", "One-time"] as const;

export function getServiceMeta(serviceCode: string, serviceName: string) {
  return findServiceCatalogEntry(serviceCode, serviceName);
}

export function isBillingOption(value: unknown): value is BillingOption {
  return value === "Pay-per-use" || value === "RI" || value === "Yearly/Monthly" || value === "One-time";
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement
    && (target.isContentEditable
      || target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement)
  );
}

export function isVisibleCalculatorElement(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

export function getCalculatorFocusTarget(group: HTMLElement) {
  const preferredSelectors = [
    "[data-calculator-focus-target]:not([disabled])",
    "input:not([type='hidden']):not([disabled])",
    "textarea:not([disabled])",
    "button[aria-pressed='true']:not([disabled])",
    "button[role='combobox']:not([disabled])",
    "button[data-state='checked']:not([disabled])",
    "button:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];

  for (const selector of preferredSelectors) {
    const match = group.querySelector(selector);
    if (match instanceof HTMLElement && isVisibleCalculatorElement(match)) {
      return match;
    }
  }

  return null;
}

export function isCalculatorSelectTrigger(element: HTMLElement) {
  return element.getAttribute("role") === "combobox" || element.getAttribute("data-slot") === "select-trigger";
}

export function getShortcutDigit(event: Pick<KeyboardEvent, "key" | "code">) {
  const keyDigit = Number(event.key);
  if (Number.isInteger(keyDigit) && keyDigit >= 0 && keyDigit <= 9) {
    return keyDigit;
  }

  const codeMatch = /^Digit([0-9])$/.exec(event.code);
  if (codeMatch) {
    return Number(codeMatch[1]);
  }

  const numpadMatch = /^Numpad([0-9])$/.exec(event.code);
  if (numpadMatch) {
    return Number(numpadMatch[1]);
  }

  return null;
}

export function getVisibleOpenCalculatorSelectItems() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-slot='select-content'] [data-slot='select-item']"))
    .filter((item) => isVisibleCalculatorElement(item) && !item.hasAttribute("data-disabled"));
}

export function chooseOpenCalculatorSelectItem(index: number) {
  const visibleItems = getVisibleOpenCalculatorSelectItems().slice(0, 10);
  const targetItem = visibleItems[index];
  if (!targetItem) {
    return false;
  }

  const rect = targetItem.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const target = document.elementFromPoint(clientX, clientY);
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX, clientY, pointerId: 1, pointerType: "mouse" }));
  target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX, clientY }));
  target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, clientX, clientY, pointerId: 1, pointerType: "mouse" }));
  target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0, clientX, clientY }));
  target.click();
  return true;
}

export function getCalculatorActionButton() {
  const button = document.querySelector<HTMLElement>("[data-calculator-add-button]");
  if (!button || !isVisibleCalculatorElement(button)) {
    return null;
  }

  if (button instanceof HTMLButtonElement && button.disabled) {
    return null;
  }

  if (button.getAttribute("aria-disabled") === "true") {
    return null;
  }

  return button;
}

export function appendProductToProjects(
  current: AppProject[],
  payload: AppProduct & { listId: string; projectId: string },
) {
  return current.map((project) =>
    project.id === payload.projectId
      ? {
          ...project,
          updatedAt: payload.updatedAt,
          lists: project.lists.map((list) =>
            list.id === payload.listId
              ? {
                  ...list,
                  updatedAt: payload.updatedAt,
                  productCount: list.productCount + 1,
                  products: [...list.products, payload],
                }
              : list,
          ),
        }
      : project,
  );
}

export function removeProductFromProjects(
  current: AppProject[],
  payload: { id: string; listId: string; projectId: string; updatedAt: string },
) {
  return current.map((project) =>
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
                  products: list.products.filter((item) => item.id !== payload.id),
                }
              : list,
          ),
        }
      : project,
  );
}

export function getProductOrderTimestamp(product: AppProduct, fallbackIndex: number) {
  const rawTimestamp = product.createdAt ?? product.updatedAt;
  const parsedTimestamp = rawTimestamp ? Date.parse(rawTimestamp) : Number.NaN;
  return Number.isFinite(parsedTimestamp) ? parsedTimestamp : fallbackIndex;
}

export function toClipboardProductMutationBody(value: unknown): ProductMutationBody | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const serviceCode = typeof record.serviceCode === "string" ? record.serviceCode.trim() : "";
  const serviceName = typeof record.serviceName === "string" ? record.serviceName.trim() : "";
  const productType = typeof record.productType === "string" ? record.productType.trim() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const quantityValue = typeof record.quantity === "number" ? record.quantity : Number(record.quantity);
  const quantity = Number.isFinite(quantityValue) ? Math.max(1, Math.floor(quantityValue)) : 1;

  if (!serviceCode || !serviceName || !productType || !title) {
    return null;
  }

  return {
    serviceCode,
    serviceName,
    productType,
    title,
    quantity,
    config: record.config ?? {},
    pricing: record.pricing ?? null,
  };
}