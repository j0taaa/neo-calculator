"use client";

import type { ComponentProps } from "react";

import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";
import { EcsCalculatorPanel } from "@/components/calculators/ecs-calculator-panel";
import { FlexusLCalculatorPanel } from "@/components/calculators/flexus-l-calculator-panel";

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
