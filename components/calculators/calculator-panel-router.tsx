"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";

// Lazy load special calculator panels
const EcsCalculatorPanel = dynamic(
  () => import("@/components/calculators/ecs-calculator-panel").then((mod) => mod.EcsCalculatorPanel),
  { ssr: false },
);

const FlexusLCalculatorPanel = dynamic(
  () => import("@/components/calculators/flexus-l-calculator-panel").then((mod) => mod.FlexusLCalculatorPanel),
  { ssr: false },
);

type CalculatorPanelRouterProps = {
  activeServiceCode: string;
  configurablePanel: ComponentProps<typeof ConfigurableServicePanel> | null;
  ecsPanel: ComponentProps<typeof EcsCalculatorPanel>;
  flexusLPanel: ComponentProps<typeof FlexusLCalculatorPanel>;
};

export function CalculatorPanelRouter({
  activeServiceCode,
  configurablePanel,
  ecsPanel,
  flexusLPanel,
}: CalculatorPanelRouterProps) {
  switch (activeServiceCode) {
    case "ECS":
      return <EcsCalculatorPanel {...ecsPanel} />;
    case "Flexus L":
      return <FlexusLCalculatorPanel {...flexusLPanel} />;
    default:
      return configurablePanel ? <ConfigurableServicePanel {...configurablePanel} /> : null;
  }
}
