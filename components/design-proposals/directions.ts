export const directions = [
  {
    id: "studio",
    number: "01",
    name: "Studio",
    tagline: "A clear place to build.",
    description:
      "A light workspace with a quiet sidebar, blue accents, and your estimate always in view.",
    traits: ["Familiar", "Focused", "Light"],
  },
  {
    id: "console",
    number: "02",
    name: "Console",
    tagline: "Everything within reach.",
    description:
      "A dark, compact workbench with a service rail, precise controls, and a detailed resource table.",
    traits: ["Compact", "Technical", "Dark"],
  },
  {
    id: "atelier",
    number: "03",
    name: "Atelier",
    tagline: "Give your next idea room.",
    description:
      "A warm, spacious quote builder with large typography, numbered sections, and an understated green palette.",
    traits: ["Spacious", "Warm", "Guided"],
  },
] as const;
export type Direction = (typeof directions)[number]["id"];
