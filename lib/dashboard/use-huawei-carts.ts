import { getResponseError } from "@/lib/calculator-page-helpers";
import type {
  AppList,
  AppProject,
  HuaweiCartSummary,
} from "@/lib/calculator-types";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";

type Options = {
  session: { user: { id: string } } | null;
  selectedList: AppList | null;
  selectedListId: string;
  setProjects: Dispatch<SetStateAction<AppProject[]>>;
};

export function useHuaweiCarts({
  session,
  selectedList,
  selectedListId,
  setProjects,
}: Options) {
  const [cookieValue, setCookieValue] = useState("");

  const [cookieDraft, setCookieDraft] = useState("");

  const [selectedHuaweiCartKey, setSelectedHuaweiCartKey] = useState("");

  const [huaweiCarts, setHuaweiCarts] = useState<HuaweiCartSummary[]>([]);

  const [huaweiCartsLoading, setHuaweiCartsLoading] = useState(false);

  const [huaweiCartsError, setHuaweiCartsError] = useState("");

  const [huaweiCartsSyncedAt, setHuaweiCartsSyncedAt] = useState<string | null>(
    null,
  );

  const [linkingHuaweiListId, setLinkingHuaweiListId] = useState<string | null>(
    null,
  );

  const [syncingHuaweiListId, setSyncingHuaweiListId] = useState<string | null>(
    null,
  );

  const [huaweiActionMessage, setHuaweiActionMessage] = useState("");

  const [syncingHuaweiProjectId, setSyncingHuaweiProjectId] = useState<
    string | null
  >(null);

  const [projectHuaweiMessages, setProjectHuaweiMessages] = useState<
    Record<string, string>
  >({});

  const [projectHuaweiMessageErrors, setProjectHuaweiMessageErrors] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const storedCookie =
      window.localStorage.getItem("neoCalculator.huaweiCookie") ?? "";
    setCookieValue(storedCookie);
    setCookieDraft(storedCookie);
  }, []);

  const loadHuaweiCarts = useCallback(async () => {
    if (!cookieValue.trim()) {
      setHuaweiCarts([]);
      setHuaweiCartsError("");
      setHuaweiCartsSyncedAt(null);
      return;
    }

    setHuaweiCartsLoading(true);
    setHuaweiCartsError("");

    try {
      const response = await fetch("/api/huawei/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as {
        carts?: HuaweiCartSummary[];
        syncedAt?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          getResponseError(payload, "Unable to load Huawei carts"),
        );
      }

      setHuaweiCarts(payload?.carts ?? []);
      setHuaweiCartsSyncedAt(payload?.syncedAt ?? new Date().toISOString());
    } catch (error) {
      setHuaweiCarts([]);
      setHuaweiCartsSyncedAt(null);
      setHuaweiCartsError(
        error instanceof Error ? error.message : "Unable to load Huawei carts",
      );
    } finally {
      setHuaweiCartsLoading(false);
    }
  }, [cookieValue]);

  useEffect(() => {
    void loadHuaweiCarts();
  }, [loadHuaweiCarts, session?.user.id]);

  useEffect(() => {
    setSelectedHuaweiCartKey(selectedList?.huaweiCartKey ?? "");
  }, [selectedList?.huaweiCartKey, selectedList?.id]);

  const handleSaveCookie = useCallback(() => {
    window.localStorage.setItem("neoCalculator.huaweiCookie", cookieDraft);
    setCookieValue(cookieDraft);
    setHuaweiActionMessage("");
  }, [cookieDraft]);

  const handleLinkSelectedList = async () => {
    if (!selectedListId || !selectedHuaweiCartKey) {
      return;
    }

    const targetCart = huaweiCarts.find(
      (cart) => cart.key === selectedHuaweiCartKey,
    );
    if (!targetCart) {
      setHuaweiActionMessage("Choose a Huawei cart first.");
      return;
    }

    setLinkingHuaweiListId(selectedListId);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          huaweiCartKey: targetCart.key,
          huaweiCartName: targetCart.name,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            id: string;
            projectId: string;
            huaweiCartKey: string | null;
            huaweiCartName: string | null;
            huaweiLastError: string | null;
            updatedAt: string;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(
          getResponseError(payload, "Unable to link Huawei cart"),
        );
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === payload.projectId
            ? {
                ...project,
                updatedAt: payload.updatedAt,
                lists: project.lists.map((list) =>
                  list.id === payload.id
                    ? {
                        ...list,
                        updatedAt: payload.updatedAt,
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setHuaweiActionMessage(`Linked ${targetCart.name} to this Neo cart.`);
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(
        error instanceof Error ? error.message : "Unable to link Huawei cart",
      );
    } finally {
      setLinkingHuaweiListId(null);
    }
  };

  const handleSyncSelectedList = async () => {
    if (!selectedListId) {
      return;
    }

    if (!cookieValue.trim()) {
      setHuaweiActionMessage("Save a Huawei Cloud cookie before syncing.");
      return;
    }

    setSyncingHuaweiListId(selectedListId);
    setHuaweiActionMessage("");

    try {
      const response = await fetch(`/api/lists/${selectedListId}/huawei-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            listId: string;
            projectId: string;
            huaweiCartKey: string;
            huaweiCartName: string;
            huaweiLastSyncedAt: string;
            huaweiLastError: string | null;
            updatedAt: string;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(
          getResponseError(
            payload,
            "Unable to sync with Huawei Cloud Calculator",
          ),
        );
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
                        huaweiCartKey: payload.huaweiCartKey,
                        huaweiCartName: payload.huaweiCartName,
                        huaweiLastSyncedAt: payload.huaweiLastSyncedAt,
                        huaweiLastError: payload.huaweiLastError,
                      }
                    : list,
                ),
              }
            : project,
        ),
      );
      setSelectedHuaweiCartKey(payload.huaweiCartKey);
      setHuaweiActionMessage(
        `Synced ${selectedList?.name ?? "cart"} to Huawei Cloud Calculator.`,
      );
      await loadHuaweiCarts();
    } catch (error) {
      setHuaweiActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to sync with Huawei Cloud Calculator",
      );
    } finally {
      setSyncingHuaweiListId(null);
    }
  };

  const handleSyncProjectHuawei = async (project: AppProject) => {
    if (!cookieValue.trim()) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]:
          "Save a Huawei Cloud cookie before creating Huawei carts.",
      }));
      setProjectHuaweiMessageErrors((current) => ({
        ...current,
        [project.id]: true,
      }));
      return;
    }

    if (project.lists.length === 0) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]: "This project does not have carts to sync.",
      }));
      setProjectHuaweiMessageErrors((current) => ({
        ...current,
        [project.id]: true,
      }));
      return;
    }

    setSyncingHuaweiProjectId(project.id);
    setProjectHuaweiMessages((current) => ({ ...current, [project.id]: "" }));
    setProjectHuaweiMessageErrors((current) => ({
      ...current,
      [project.id]: false,
    }));

    try {
      const response = await fetch(`/api/projects/${project.id}/huawei-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            projectId: string;
            updatedAt: string;
            syncedCount: number;
            failedCount: number;
            lists: Array<{
              id: string;
              huaweiCartKey: string | null;
              huaweiCartName: string | null;
              huaweiLastSyncedAt: string | null;
              huaweiLastError: string | null;
              updatedAt: string;
            }>;
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("projectId" in payload)) {
        throw new Error(
          getResponseError(
            payload,
            "Unable to create Huawei carts for this project",
          ),
        );
      }

      const listUpdates = new Map(payload.lists.map((list) => [list.id, list]));

      setProjects((current) =>
        current.map((item) =>
          item.id === project.id
            ? {
                ...item,
                updatedAt: payload.updatedAt,
                lists: item.lists.map((list) => {
                  const update = listUpdates.get(list.id);
                  if (!update) {
                    return list;
                  }

                  return {
                    ...list,
                    updatedAt: update.updatedAt,
                    huaweiCartKey: update.huaweiCartKey,
                    huaweiCartName: update.huaweiCartName,
                    huaweiLastSyncedAt: update.huaweiLastSyncedAt,
                    huaweiLastError: update.huaweiLastError,
                  };
                }),
              }
            : item,
        ),
      );
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]:
          payload.failedCount > 0
            ? `Created or updated ${payload.syncedCount} Huawei cart(s). ${payload.failedCount} cart(s) failed.`
            : `Created or updated ${payload.syncedCount} Huawei cart(s) for this project.`,
      }));
      setProjectHuaweiMessageErrors((current) => ({
        ...current,
        [project.id]: payload.failedCount > 0,
      }));
      await loadHuaweiCarts();
    } catch (error) {
      setProjectHuaweiMessages((current) => ({
        ...current,
        [project.id]:
          error instanceof Error
            ? error.message
            : "Unable to create Huawei carts for this project",
      }));
      setProjectHuaweiMessageErrors((current) => ({
        ...current,
        [project.id]: true,
      }));
    } finally {
      setSyncingHuaweiProjectId(null);
    }
  };
  return {
    cookieValue,
    setCookieDraft,
    selectedHuaweiCartKey,
    setSelectedHuaweiCartKey,
    huaweiCarts,
    huaweiCartsLoading,
    huaweiCartsError,
    huaweiCartsSyncedAt,
    linkingHuaweiListId,
    syncingHuaweiListId,
    huaweiActionMessage,
    setHuaweiActionMessage,
    syncingHuaweiProjectId,
    projectHuaweiMessages,
    projectHuaweiMessageErrors,
    loadHuaweiCarts,
    handleSaveCookie,
    handleLinkSelectedList,
    handleSyncSelectedList,
    handleSyncProjectHuawei,
  };
}
