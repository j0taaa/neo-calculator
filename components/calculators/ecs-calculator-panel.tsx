"use client";
import type { ReactNode } from "react";
import { EcsFlavorPicker, type EcsFlavorPickerProps } from "./ecs-flavor-picker";
import { CalculatorDiskConfigSection, type CalculatorDiskConfigSectionProps } from "./calculator-disk-config-section";

export function EcsCalculatorPanel({ diskConfigProps, children, ...picker }: EcsFlavorPickerProps & {
  diskConfigProps: CalculatorDiskConfigSectionProps;
  children?: ReactNode;
}) {
  return <>
    <EcsFlavorPicker {...picker} />
    <CalculatorDiskConfigSection {...diskConfigProps} />
    {children}
  </>;
}
