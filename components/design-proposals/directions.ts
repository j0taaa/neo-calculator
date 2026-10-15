export const directions = [
  { id: "studio", name: "Studio", description: "Light workspace" },
  { id: "console", name: "Console", description: "Dark console" },
  { id: "atelier", name: "Atelier", description: "Warm, spacious layout" },
] as const;
export type Direction = (typeof directions)[number]["id"];
