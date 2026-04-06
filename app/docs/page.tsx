"use client";

import { useEffect, useState } from "react";

interface OpenAPISpec {
  info: {
    title: string;
    description: string;
    version: string;
  };
  paths: Record<string, Record<string, {
    summary: string;
    description?: string;
    tags?: string[];
    security?: unknown[];
    parameters?: Array<{
      name: string;
      in: string;
      description?: string;
      required?: boolean;
      schema: { type: string; default?: string; example?: string };
    }>;
    requestBody?: {
      content: Record<string, { schema: unknown }>;
    };
    responses: Record<string, { description: string }>;
  }>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

export default function DocsPage() {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/docs/openapi.json")
      .then((res) => res.json())
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-zinc-500">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-red-600">Error loading API documentation: {error}</p>
        </div>
      </div>
    );
  }

  const publicPaths = Object.entries(spec.paths).filter(([, methods]) => {
    const method = Object.values(methods)[0];
    return method?.tags?.includes("Public");
  });

  const privatePaths = Object.entries(spec.paths).filter(([, methods]) => {
    const method = Object.values(methods)[0];
    return method?.tags?.includes("Private");
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-zinc-200 bg-zinc-50 px-8 py-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-zinc-900">{spec.info.title}</h1>
          <p className="mt-2 text-zinc-600">{spec.info.description}</p>
          <p className="mt-2 text-sm text-zinc-500">Version {spec.info.version}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-8">
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900">Authentication</h2>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-600">
              Private endpoints require an API key. Include it in the <code className="rounded bg-zinc-100 px-1">X-API-Key</code> header.
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Generate an API key in your account settings (click the ⚙️ icon in the navbar).
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900">Public Endpoints</h2>
          <p className="mb-4 text-sm text-zinc-600">These endpoints do not require authentication.</p>
          <div className="space-y-4">
            {publicPaths.map(([path, methods]) => (
              <EndpointCard key={path} path={path} methods={methods} />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900">Private Endpoints</h2>
          <p className="mb-4 text-sm text-zinc-600">These endpoints require API key authentication.</p>
          <div className="space-y-4">
            {privatePaths.map(([path, methods]) => (
              <EndpointCard key={path} path={path} methods={methods} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-900">Base URL</h2>
          <code className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-mono text-zinc-800">
            {window.location.origin}/api/v1
          </code>
        </section>
      </div>
    </div>
  );
}

function EndpointCard({ path, methods }: { path: string; methods: Record<string, { summary: string; description?: string; parameters?: Array<{ name: string; in: string; required?: boolean; schema: { type: string } }> }> }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      {Object.entries(methods).map(([method, details]) => (
        <div key={method} className="flex items-start gap-4">
          <span className={`shrink-0 rounded px-2 py-1 text-xs font-bold uppercase ${
            method === "get" ? "bg-blue-100 text-blue-700" :
            method === "post" ? "bg-green-100 text-green-700" :
            method === "patch" ? "bg-yellow-100 text-yellow-700" :
            method === "delete" ? "bg-red-100 text-red-700" :
            "bg-zinc-100 text-zinc-700"
          }`}>
            {method}
          </span>
          <div className="flex-1">
            <code className="font-mono text-sm text-zinc-900">{path}</code>
            <p className="mt-1 text-sm text-zinc-600">{details.summary}</p>
            {details.description && (
              <p className="mt-1 text-xs text-zinc-500">{details.description}</p>
            )}
            {details.parameters && details.parameters.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-zinc-500 uppercase">Parameters</p>
                <div className="mt-1 space-y-1">
                  {details.parameters.map((param) => (
                    <div key={param.name} className="text-xs text-zinc-600">
                      <span className="font-mono">{param.name}</span>
                      <span className="ml-1 text-zinc-400">({param.in}, {param.schema.type})</span>
                      {param.required && <span className="ml-1 text-red-500">*</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}