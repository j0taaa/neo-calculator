import { publishedResourceSchema, resourceSchemaOrigin } from "@/lib/cart-json/schema";
import { resourceCompiler, resourceErrorResponse } from "@/lib/cart-json/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const compiler = await resourceCompiler();
    const url = new URL(request.url);
    return Response.json(publishedResourceSchema(compiler.release, resourceSchemaOrigin(request)), { headers: {
      "content-type": "application/schema+json", "cache-control": "no-store",
      ...(url.searchParams.get("download") === "1" ? { "content-disposition": 'attachment; filename="neocalculator-resource-schema.json"' } : {}),
    } });
  } catch (error) { return resourceErrorResponse(error); }
}
