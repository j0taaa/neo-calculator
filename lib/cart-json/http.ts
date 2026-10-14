import { SnapshotStore } from "../huawei-snapshot/store";
import { ResourceCompiler } from "./compile";
import { ResourceDocumentError } from "./types";

export async function readResourceJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ResourceDocumentError([{ path: "/", code: "json.invalid", message: "A JSON body is required" }]);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2000000) {
      await reader.cancel();
      throw new ResourceDocumentError([{ path: "/", code: "document.tooLarge", message: "The JSON document exceeds 2 MB" }]);
    }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ResourceDocumentError([{ path: "/", code: "json.invalid", message: "The body must contain valid JSON" }]); }
}
export async function resourceCompiler(store = new SnapshotStore()) {
  try { return new ResourceCompiler(await store.active(), store); }
  catch { throw new ResourceDocumentError([{ path: "/", code: "catalog.unavailable", message: "The published independent calculator catalog is unavailable" }]); }
}
export async function prepareResourceImport(payload: unknown) {
  return (await (await resourceCompiler()).document(payload)).payload;
}
export function resourceErrorResponse(error: unknown) {
  if (!(error instanceof ResourceDocumentError)) throw error;
  const status = error.issues.some(issue => issue.code === "catalog.unavailable") ? 503 : error.issues.some(issue => issue.code === "document.tooLarge") ? 413 : 422;
  return Response.json({ valid: false, error: error.message, errors: error.issues, ...(error.releaseId ? { releaseId: error.releaseId } : {}) }, { status, headers: { "cache-control": "no-store" } });
}
