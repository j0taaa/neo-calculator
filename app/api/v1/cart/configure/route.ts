import { assertDocumentStructure } from "@/lib/cart-json/schema";
import { describeConfiguration } from "@/lib/cart-json/compile";
import { resourceCompiler, readResourceJson, resourceErrorResponse } from "@/lib/cart-json/http";
import type { ResourceIntent } from "@/lib/cart-json/types";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = await readResourceJson(request);
    assertDocumentStructure(input, "configure");
    const body = input as { product: ResourceIntent; releaseId?: string };
    const compiler = await resourceCompiler();
    compiler.checkRelease(body.releaseId);
    const { state } = await compiler.configure(body.product);
    return Response.json({ releaseId: compiler.release.id,
      catalogUrl: `/api/v1/public/catalog/${encodeURIComponent(body.product.serviceCode)}?region=${encodeURIComponent(body.product.region)}`,
      ...describeConfiguration(state) }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return resourceErrorResponse(error); }
}
