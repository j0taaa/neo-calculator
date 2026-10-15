import { getApiKeyUser, jsonError, readJsonBody } from "@/lib/api-route";
import type { ProductMutationBody } from "@/lib/calculator-types";
import { apiService } from "@/lib/calculator/api";
import { nativeRegion } from "@/lib/calculator/service-directory";
import { isRecord, productInputError } from "@/lib/product-input";
import { SnapshotStore } from "@/lib/huawei-snapshot/store";
import { verifySnapshotProduct } from "@/lib/huawei-snapshot/product";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!await getApiKeyUser(request.headers))
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  const body = await readJsonBody<unknown>(request);
  if (!isRecord(body) || !Array.isArray(body.products) || !body.products.length || body.products.length > 100)
    return jsonError("products must contain between 1 and 100 products");
  for (const product of body.products) {
    const error = productInputError(product);
    if (error) return jsonError(error);
    if (!isRecord(product) || typeof product.serviceCode !== "string" || !product.serviceCode.trim() || !isRecord(product.config))
      return jsonError("Each product requires serviceCode and config");
  }
  if (body.region !== undefined && (typeof body.region !== "string" || !body.region.trim()))
    return jsonError("region must be a nonempty region ID");

  const store = new SnapshotStore();
  const release = await store.active().catch(() => null);
  if (!release) return jsonError("The daily calculator snapshot is not available yet", 503);
  const region = typeof body.region === "string" ? nativeRegion(body.region.trim()) : undefined;
  if (region && !release.directory.regions.some(entry => entry.id === region))
    return jsonError("Unknown region");

  // Every product in a batch uses one complete release, even during a daily publication.
  const results = [];
  for (const entry of body.products as ProductMutationBody[]) {
    const service = apiService(release.directory, entry.serviceCode.trim());
    const product = { serviceCode: service ? `HUAWEI:${service.id}` : entry.serviceCode,
      serviceName: entry.serviceName?.trim() || service?.name || entry.serviceCode,
      productType: "huawei-native", title: entry.title?.trim() || service?.name || entry.serviceCode,
      quantity: 1, pricing: null, config: entry.config };
    try {
      if (!service) throw new Error(`Unknown synchronized service: ${entry.serviceCode}`);
      if (region && (!isRecord(product.config) || product.config.region !== region))
        throw new Error("Request region does not match the product configuration");
      results.push(await verifySnapshotProduct(product, store, true, release));
    } catch (error) {
      results.push({ ...product, pricing: null, error: error instanceof Error ? error.message : "Unable to calculate this configuration" });
    }
  }
  const failed = results.filter(result => "error" in result).length;
  return Response.json({ region: region ?? null, calculatedAt: new Date().toISOString(), releaseId: release.id, results },
    { status: failed === 0 ? 200 : failed === results.length ? 422 : 207, headers: { "cache-control": "no-store" } });
}
