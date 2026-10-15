import { SnapshotStore } from "./store";
import { huaweiServiceId } from "../calculator/service-directory";
import { rateInquiry } from "./rating";
import type { Inquiry } from "../huawei-native/types";

/** Compatibility adapter for existing catalog parsers. Runtime Huawei access is impossible. */
export async function snapshotResponse(
  urlString: string,
  method: string,
  body?: string | null,
) {
  const url = new URL(urlString),
    store = new SnapshotStore(),
    release = await store.active();
  let bodyText: string;
  if (method === "GET" && url.pathname.endsWith("/api/menuInfo"))
    bodyText = release.menu;
  else if (method === "GET" && url.pathname.endsWith("/api/config")) {
    const service = url.searchParams.get("urlPath") ?? "",
      key = Object.keys(release.scopes).find((key) =>
        key.startsWith(service + "/"),
      );
    if (!key) throw new Error("No synchronized configuration for this service");
    bodyText = (await store.scope(release, service, key.split("/")[1], false))
      .config;
  } else if (method === "GET" && url.pathname.endsWith("/api/productInfo")) {
    const scope = await store.scope(
      release,
      url.searchParams.get("urlPath") ?? "",
      url.searchParams.get("region") ?? "",
      false,
    );
    bodyText = JSON.stringify(scope.products);
  } else if (
    method === "POST" &&
    url.pathname.endsWith("/inquiry/resource") &&
    body
  ) {
    const inquiry = JSON.parse(body) as Inquiry;
    const service = huaweiServiceId(url.searchParams.get("servieName") ?? "");
    const scope = await store.scope(release, service, inquiry.regionId, false);
    bodyText = JSON.stringify(rateInquiry(scope, inquiry));
  } else
    throw new Error(
      "Huawei source requests are only allowed in the daily synchronization job",
    );
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    contentType: "application/json",
    bodyText,
    durationMs: 0,
  };
}
