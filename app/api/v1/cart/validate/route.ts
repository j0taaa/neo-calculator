import { resourceCompiler, readResourceJson, resourceErrorResponse } from "@/lib/cart-json/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = await readResourceJson(request);
    const compiler = await resourceCompiler();
    const { normalized, totals, productCount } = await compiler.document(input);
    return Response.json({ valid: true, releaseId: compiler.release.id, normalized, totals, productCount }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return resourceErrorResponse(error); }
}
