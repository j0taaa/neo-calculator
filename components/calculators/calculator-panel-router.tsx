"use client";

import type { ComponentProps } from "react";

import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";
import { EcsCalculatorPanel } from "@/components/calculators/ecs-calculator-panel";
import { FlexusLCalculatorPanel } from "@/components/calculators/flexus-l-calculator-panel";

export type CalculatorPanel =
  | { kind: "ecs"; props: ComponentProps<typeof EcsCalculatorPanel> }
  | { kind: "flexus-l"; props: ComponentProps<typeof FlexusLCalculatorPanel> }
  | { kind: "configurable"; props: ComponentProps<typeof ConfigurableServicePanel> };

export function CalculatorPanelRouter({ panel }: { panel: CalculatorPanel | null }) {
  if (!panel) return null;
  switch (panel.kind) {
    case "ecs":
      return <EcsCalculatorPanel {...panel.props} />;
    case "flexus-l":
      return <FlexusLCalculatorPanel {...panel.props} />;
    case "configurable":
      return <ConfigurableServicePanel {...panel.props} />;
  }
}
