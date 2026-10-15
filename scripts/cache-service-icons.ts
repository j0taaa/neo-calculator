import { mkdir, writeFile } from "node:fs/promises";
import { serviceRegistryDocument } from "../config/services/index";
const root = "public/service-icons",
  prefix =
    "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/";
const urls = [
  ...new Set(serviceRegistryDocument.services.map((service) => service.icon)),
];
const paths: Record<string, string> = {};
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      if (!url.startsWith(prefix)) continue;
      const path = url.slice(prefix.length);
      if (!/^[\w/-]+\.png$/.test(path))
        throw new Error("Unsupported icon path");
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        await mkdir(root + "/" + path.slice(0, path.lastIndexOf("/")), {
          recursive: true,
        });
        await writeFile(
          root + "/" + path,
          Buffer.from(await response.arrayBuffer()),
        );
        paths[url] = "/service-icons/" + path;
      } catch {
        paths[url] = "/globe.svg";
        console.error("Icon unavailable", path);
      }
    }
  }),
);
await mkdir(root, { recursive: true });
await writeFile(root + "/index.json", JSON.stringify(paths, null, 2) + "\n");
console.log("Cached", Object.keys(paths).length, "service icons");
