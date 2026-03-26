"use client";

import type { ComponentProps } from "react";

import { CceCalculatorPanel } from "@/components/calculators/cce-calculator-panel";
import { CciCalculatorPanel } from "@/components/calculators/cci-calculator-panel";
import { ConfigurableServicePanel } from "@/components/calculators/configurable-service-panel";
import { EcsCalculatorPanel } from "@/components/calculators/ecs-calculator-panel";
import { EipCalculatorPanel } from "@/components/calculators/eip-calculator-panel";
import { ElbCalculatorPanel } from "@/components/calculators/elb-calculator-panel";
import { EvsCalculatorPanel } from "@/components/calculators/evs-calculator-panel";
import { FlexusLCalculatorPanel } from "@/components/calculators/flexus-l-calculator-panel";
import { NatCalculatorPanel } from "@/components/calculators/nat-calculator-panel";
import { ObsCalculatorPanel } from "@/components/calculators/obs-calculator-panel";
import { VpnCalculatorPanel } from "@/components/calculators/vpn-calculator-panel";

type CalculatorPanelRouterProps = {
  activeServiceCode: string;
  configurablePanels: Partial<Record<string, ComponentProps<typeof ConfigurableServicePanel>>>;
  ecsPanel: ComponentProps<typeof EcsCalculatorPanel>;
  flexusLPanel: ComponentProps<typeof FlexusLCalculatorPanel>;
  obsFallbackPanel: ComponentProps<typeof ObsCalculatorPanel>;
  evsFallbackPanel: ComponentProps<typeof EvsCalculatorPanel>;
  eipFallbackPanel: ComponentProps<typeof EipCalculatorPanel>;
  elbPanel: ComponentProps<typeof ElbCalculatorPanel>;
  natFallbackPanel: ComponentProps<typeof NatCalculatorPanel>;
  vpnFallbackPanel: ComponentProps<typeof VpnCalculatorPanel>;
  cceFallbackPanel: ComponentProps<typeof CceCalculatorPanel>;
  cciFallbackPanel: ComponentProps<typeof CciCalculatorPanel>;
};

export function CalculatorPanelRouter({
  activeServiceCode,
  configurablePanels,
  ecsPanel,
  flexusLPanel,
  obsFallbackPanel,
  evsFallbackPanel,
  eipFallbackPanel,
  elbPanel,
  natFallbackPanel,
  vpnFallbackPanel,
  cceFallbackPanel,
  cciFallbackPanel,
}: CalculatorPanelRouterProps) {
  switch (activeServiceCode) {
    case "ECS":
      return <EcsCalculatorPanel {...ecsPanel} />;
    case "Flexus L":
      return <FlexusLCalculatorPanel {...flexusLPanel} />;
    case "OBS":
      return configurablePanels.OBS ? <ConfigurableServicePanel {...configurablePanels.OBS} /> : <ObsCalculatorPanel {...obsFallbackPanel} />;
    case "EVS":
      return configurablePanels.EVS ? <ConfigurableServicePanel {...configurablePanels.EVS} /> : <EvsCalculatorPanel {...evsFallbackPanel} />;
    case "EIP":
      return configurablePanels.EIP ? <ConfigurableServicePanel {...configurablePanels.EIP} /> : <EipCalculatorPanel {...eipFallbackPanel} />;
    case "ELB":
      return <ElbCalculatorPanel {...elbPanel} />;
    case "NAT":
      return configurablePanels.NAT ? <ConfigurableServicePanel {...configurablePanels.NAT} /> : <NatCalculatorPanel {...natFallbackPanel} />;
    case "VPN":
      return configurablePanels.VPN ? <ConfigurableServicePanel {...configurablePanels.VPN} /> : <VpnCalculatorPanel {...vpnFallbackPanel} />;
    case "ModelArts":
      return configurablePanels.ModelArts ? <ConfigurableServicePanel {...configurablePanels.ModelArts} /> : null;
    case "CCE":
      return configurablePanels.CCE ? <ConfigurableServicePanel {...configurablePanels.CCE} /> : <CceCalculatorPanel {...cceFallbackPanel} />;
    case "CCI":
      return configurablePanels.CCI ? <ConfigurableServicePanel {...configurablePanels.CCI} /> : <CciCalculatorPanel {...cciFallbackPanel} />;
    default:
      return null;
  }
}
