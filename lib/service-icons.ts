import icons from "../public/service-icons/index.json";
export function localServiceIcon(icon: string) {
  return (
    (icons as Record<string, string>)[icon] ??
    (icon.startsWith("https://res-static.hc-cdn.cn/") ? "/globe.svg" : icon)
  );
}
