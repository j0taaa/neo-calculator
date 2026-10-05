import { copyText, getResponseError } from "@/lib/calculator-page-helpers";
import { useState } from "react";

export function useResourceSharing() {
  const [sharingProjectKey, setSharingProjectKey] = useState<string | null>(
    null,
  );

  const [sharingListKey, setSharingListKey] = useState<string | null>(null);

  const [projectShareMessages, setProjectShareMessages] = useState<
    Record<string, string>
  >({});

  const [listShareMessages, setListShareMessages] = useState<
    Record<string, string>
  >({});

  const handleCreateShare = async (
    resourceType: "project" | "list",
    resourceId: string,
    mode: "copy" | "collaborate",
  ) => {
    const setPending =
      resourceType === "project" ? setSharingProjectKey : setSharingListKey;
    const setMessages =
      resourceType === "project"
        ? setProjectShareMessages
        : setListShareMessages;

    setPending(`${resourceType}:${resourceId}:${mode}`);
    setMessages((current) => ({ ...current, [resourceId]: "" }));

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, mode }),
      });
      const payload = (await response.json().catch(() => null)) as {
        shareUrl?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.shareUrl) {
        throw new Error(
          getResponseError(payload, "Unable to create share link"),
        );
      }

      const shareUrl = new URL(
        payload.shareUrl,
        window.location.origin,
      ).toString();
      const copied = await copyText(shareUrl);
      setMessages((current) => ({
        ...current,
        [resourceId]: copied
          ? mode === "copy"
            ? "Copy link copied."
            : "Collaborative link copied."
          : `${mode === "copy" ? "Copy" : "Collaborative"} link: ${shareUrl}`,
      }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [resourceId]:
          error instanceof Error
            ? error.message
            : "Unable to create share link",
      }));
    } finally {
      setPending(null);
    }
  };
  return {
    sharingProjectKey,
    sharingListKey,
    projectShareMessages,
    listShareMessages,
    handleCreateShare,
  };
}
