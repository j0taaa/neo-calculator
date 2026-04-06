"use client";

import { useState, useEffect } from "react";
import { Copy, Key, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiKeyData {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ApiKeyManager() {
  const [apiKey, setApiKey] = useState<ApiKeyData | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchApiKey = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.key || null);
      }
    } catch (error) {
      console.error("Failed to fetch API key:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKey();
  }, []);

  const generateKey = async () => {
    setLoading(true);
    setNewKey(null);
    try {
      const response = await fetch("/api/api-keys", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setNewKey(data.key);
        setApiKey({
          id: data.id,
          createdAt: data.createdAt,
          lastUsedAt: null,
        });
      }
    } catch (error) {
      console.error("Failed to generate API key:", error);
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async () => {
    if (!confirm("Are you sure you want to revoke your API key? This cannot be undone.")) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/api-keys", { method: "DELETE" });
      if (response.ok) {
        setApiKey(null);
        setNewKey(null);
      }
    } catch (error) {
      console.error("Failed to revoke API key:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Key className="size-4 text-zinc-500" />
        <p className="text-sm font-semibold text-zinc-950">API Key</p>
      </div>
      <p className="text-xs text-zinc-500">
        Use your API key to access NeoCalculator programmatically via the API.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="size-4 animate-spin text-zinc-400" />
        </div>
      ) : newKey ? (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            Save this key now! It won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-2 py-1 text-xs font-mono text-zinc-900 break-all">
              {newKey}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => copyToClipboard(newKey)}
            >
              <Copy className="size-3" />
            </Button>
          </div>
          {copied && <p className="text-xs text-green-600">Copied to clipboard!</p>}
        </div>
      ) : apiKey ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Key ID</p>
                <p className="font-mono text-sm text-zinc-900">{apiKey.id}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
              <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
              {apiKey.lastUsedAt && (
                <span>Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateKey}
              disabled={loading}
            >
              <RefreshCw className="mr-1 size-3" />
              Regenerate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={revokeKey}
              disabled={loading}
              className="text-red-600 hover:bg-red-50"
            >
              Revoke
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={generateKey} disabled={loading}>
          <Key className="mr-2 size-4" />
          Generate API Key
        </Button>
      )}

      <div className="mt-4 border-t border-zinc-100 pt-3">
        <p className="text-xs text-zinc-500">
          Use the key in the <code className="rounded bg-zinc-100 px-1">X-API-Key</code> header
          when making requests to private API endpoints.
        </p>
      </div>
    </div>
  );
}