"use client";

import { CalculatorDiskConfigSection, type CalculatorDiskConfigSectionProps } from "./calculator-disk-config-section";

type EvsCalculatorPanelProps = {
  diskConfigProps: CalculatorDiskConfigSectionProps;
};

export function EvsCalculatorPanel({ diskConfigProps }: EvsCalculatorPanelProps) {
  return <CalculatorDiskConfigSection {...diskConfigProps} />;
}
