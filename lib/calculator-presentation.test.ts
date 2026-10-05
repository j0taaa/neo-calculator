import { expect, test } from "bun:test";
import { buildCalculatorEstimate, buildCalculatorSelectionNotes, buildCalculatorSelectionSummary } from "./calculator-presentation";
import { formatFlavorAmount, toFlavorCard, toFlexusLFlavorCard } from "./calculator-page-helpers";
import { flexusLPlans } from "./flexus-l-catalog";
import type { BillingOption, CatalogFlavor } from "./calculator-types";

const flavor: CatalogFlavor = {
  resourceSpecCode: "c7.large.4", family: "c7", architecture: "x86", series: "c", description: "Test compute",
  cpu: 2, ramGiB: 8, prices: { ONDEMAND: 0.1, MONTHLY: 50, RI: 400 }, currency: "USD", updatedAt: "2026-01-01",
};

for (const billing of ["Pay-per-use", "Yearly/Monthly", "RI"] satisfies BillingOption[]) {
  test(`ECS presentation preserves compute plus disk pricing and quantity for ${billing}`, () => {
    const disk = { label: "Disk", currency: "USD", amount: 4, suffix: "/mo" };
    const card = toFlavorCard(flavor, billing, 744, disk);
    const result = buildCalculatorEstimate({ serviceCode: "ECS", instanceCountValue: 3, selectedFlavorCard: card, selectedFlexusLPlan: null }, formatFlavorAmount);
    expect(result.selectedEstimate).toBe({ "Pay-per-use": "USD 235.20/744h", "Yearly/Monthly": "USD 162.00/mo", RI: "USD 1212.00" }[billing]);
    expect(buildCalculatorSelectionNotes({ serviceCode: "ECS", selectedFlavorCard: card, selectedDiskPrice: disk }, formatFlavorAmount))
      .toEqual([`Flavor ${card.flavorPrice} + Disk USD 4.00/mo`]);
    expect(buildCalculatorSelectionSummary({
      serviceCode: "ECS", selectedFlavor: card.name, selectedFlavorCard: card, selectedFlexusLPlan: null,
      vcpuValue: "2", ramValue: "8", systemDiskType: "General Purpose SSD V2", systemDiskSize: "80", activeDiskSizeMin: 40,
      isGpSsd2Selected: true, gpSsd2IopsValue: 3000, gpSsd2ThroughputValue: 125, selectedDiskPrice: disk,
    }, formatFlavorAmount)).toContain("80 GiB | 3000 IOPS | 125 MB/s | Disk USD 4.00/mo");
  });
}

test("Flexus L bundle price is identical in standalone and ECS selection", () => {
  const plan = flexusLPlans[0];
  const card = toFlexusLFlavorCard(plan, "Yearly/Monthly", 744);
  for (const code of ["ECS", "Flexus L"]) {
    const result = buildCalculatorEstimate({ serviceCode: code, instanceCountValue: 2, selectedFlavorCard: card, selectedFlexusLPlan: plan }, formatFlavorAmount);
    expect(result.selectedEstimate).toBe(formatFlavorAmount("USD", plan.monthlyPriceUsd * 2, "/mo"));
  }
  expect(buildCalculatorSelectionNotes({ serviceCode: "ECS", selectedFlavorCard: card, selectedDiskPrice: null }, formatFlavorAmount)[0]).toContain("disk settings below are ignored");
});

test("an unavailable ECS selection never shows a hardcoded sample price", () => {
  expect(buildCalculatorEstimate({ serviceCode: "ECS", instanceCountValue: 4, selectedFlavorCard: null, selectedFlexusLPlan: null }, formatFlavorAmount).selectedEstimate).toBe("USD 0.0000");
});
