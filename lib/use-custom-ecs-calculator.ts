import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { findFlexusLPlan, flexusLPlans } from "@/lib/flexus-l-catalog";
import {
  getDiskPriceForBillingOption,
  getFlavorPriceForBillingOption,
  toFlavorCard,
  toFlexusLFlavorCard,
  type BillingOption,
  type CatalogFlavor,
  type DiskPricing,
} from "@/lib/calculator-page-helpers";
import { type HuaweiRegionKey } from "@/lib/huawei-regions";
import { ecsDiskSizeBounds, type SystemDiskOption } from "@/lib/configurable-runtime-utils";

type UseCustomEcsCalculatorInput = {
  isEcsCalculator: boolean;
  isFlexusLCalculator: boolean;
  canShowFlexusLInEcs: boolean;
  showFlexusLInEcs: boolean;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHoursValue: number;
  minVcpuValue: string;
  minRamValue: string;
  flavorQuery: string;
  flavorSort: string;
  flavorPage: number;
  flavorPageSize: number;
  systemDiskType: SystemDiskOption;
  systemDiskSizeValue: number;
  selectedFlavor: string;
  setSelectedFlavor: (value: string) => void;
  setVcpuValue: (value: string) => void;
  setRamValue: (value: string) => void;
  setFlavorPage: (value: number | ((current: number) => number)) => void;
};

export function buildFlavorAutoSelectKey(input: {
  minVcpuValue: string;
  minRamValue: string;
  flavorQuery: string;
  flavorSort: string;
  regionValue: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHoursValue: number;
  systemDiskType: SystemDiskOption;
  systemDiskSizeValue: number;
  includeFlexusL: boolean;
}) {
  return [
    input.minVcpuValue,
    input.minRamValue,
    input.flavorQuery.trim().toLowerCase(),
    input.flavorSort,
    input.regionValue,
    input.billingMode,
    String(input.usageHoursValue),
    input.systemDiskType,
    String(input.systemDiskSizeValue),
    input.includeFlexusL ? "with-flexus-l" : "ecs-only",
  ].join("|");
}

export function useCustomEcsCalculator({
  isEcsCalculator,
  isFlexusLCalculator,
  canShowFlexusLInEcs,
  showFlexusLInEcs,
  regionValue,
  billingMode,
  usageHoursValue,
  minVcpuValue,
  minRamValue,
  flavorQuery,
  flavorSort,
  flavorPage,
  flavorPageSize,
  systemDiskType,
  systemDiskSizeValue,
  selectedFlavor,
  setSelectedFlavor,
  setVcpuValue,
  setRamValue,
  setFlavorPage,
}: UseCustomEcsCalculatorInput) {
  const [catalogFlavors, setCatalogFlavors] = useState<CatalogFlavor[]>([]);
  const [diskPricing, setDiskPricing] = useState<DiskPricing<SystemDiskOption> | null>(null);
  const [catalogFlavorsLoading, setCatalogFlavorsLoading] = useState(false);
  const [catalogFlavorsError, setCatalogFlavorsError] = useState("");
  const [catalogFlavorsLastCompletedAt, setCatalogFlavorsLastCompletedAt] = useState<string | null>(null);
  const lastFlavorAutoSelectKeyRef = useRef("");

  const selectedDiskPrice = useMemo(
    () => getDiskPriceForBillingOption(
      diskPricing,
      systemDiskType,
      systemDiskSizeValue,
      billingMode,
      usageHoursValue,
      1,
    ),
    [billingMode, diskPricing, systemDiskSizeValue, systemDiskType, usageHoursValue],
  );

  const ecsFlavorCards = useMemo(
    () => catalogFlavors
      .filter((flavor) => getFlavorPriceForBillingOption(flavor, billingMode, usageHoursValue))
      .map((flavor) => toFlavorCard(flavor, billingMode, usageHoursValue, selectedDiskPrice)),
    [billingMode, catalogFlavors, selectedDiskPrice, usageHoursValue],
  );

  const flexusLFlavorCards = useMemo(
    () =>
      isEcsCalculator && canShowFlexusLInEcs && showFlexusLInEcs
        ? flexusLPlans.map((plan) => toFlexusLFlavorCard(plan, billingMode, usageHoursValue))
        : [],
    [billingMode, canShowFlexusLInEcs, isEcsCalculator, showFlexusLInEcs, usageHoursValue],
  );

  const billableFlavors = useMemo(
    () => [...ecsFlavorCards, ...flexusLFlavorCards],
    [ecsFlavorCards, flexusLFlavorCards],
  );

  const minVcpuFilter = Number.isFinite(Number(minVcpuValue)) ? Math.max(0, Number(minVcpuValue)) : 0;
  const minRamFilter = Number.isFinite(Number(minRamValue)) ? Math.max(0, Number(minRamValue)) : 0;

  const filteredFlavors = useMemo(
    () => billableFlavors.filter((flavor) => {
      if (Number(flavor.vcpu) < minVcpuFilter || Number(flavor.ram) < minRamFilter) {
        return false;
      }

      const q = flavorQuery.trim().toLowerCase();
      if (!q) {
        return true;
      }

      return (
        flavor.name.toLowerCase().includes(q)
        || flavor.family.toLowerCase().includes(q)
        || `${flavor.vcpu} ${flavor.ram}`.includes(q)
      );
    }),
    [billableFlavors, flavorQuery, minRamFilter, minVcpuFilter],
  );

  const sortedFlavors = useMemo(
    () => [...filteredFlavors].sort((a, b) => {
      if (flavorSort === "price-desc") return b.priceValue - a.priceValue;
      if (flavorSort === "name-asc") return a.name.localeCompare(b.name);
      if (flavorSort === "vcpu-asc") return Number(a.vcpu) - Number(b.vcpu);
      return a.priceValue - b.priceValue;
    }),
    [filteredFlavors, flavorSort],
  );

  const totalFlavorPages = Math.max(1, Math.ceil(sortedFlavors.length / flavorPageSize));
  const currentFlavorPage = Math.min(flavorPage, totalFlavorPages);
  const visibleFlavors = sortedFlavors.slice((currentFlavorPage - 1) * flavorPageSize, currentFlavorPage * flavorPageSize);
  const selectedFlavorCard = billableFlavors.find((flavor) => flavor.name === selectedFlavor) ?? null;
  const selectedFlexusLPlan = isFlexusLCalculator ? findFlexusLPlan(selectedFlavor) ?? flexusLPlans[0] ?? null : null;

  const flavorAutoSelectKey = buildFlavorAutoSelectKey({
    minVcpuValue,
    minRamValue,
    flavorQuery,
    flavorSort,
    regionValue,
    billingMode,
    usageHoursValue,
    systemDiskType,
    systemDiskSizeValue,
    includeFlexusL: isEcsCalculator && canShowFlexusLInEcs && showFlexusLInEcs,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCalculatorData() {
      if (isEcsCalculator) {
        setCatalogFlavorsLoading(true);
        setCatalogFlavorsError("");

        try {
          const response = await fetch(`/api/catalog/ecs-flavors?region=${encodeURIComponent(regionValue)}`, {
            cache: "no-store",
          });
          const rawBody = await response.text();
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            flavors?: CatalogFlavor[];
            diskPricing?: DiskPricing<SystemDiskOption>;
            error?: string;
            lastCompletedAt?: string | null;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Failed to load ECS flavors");
          }

          if (cancelled) return;

          setCatalogFlavors(payload.flavors ?? []);
          setDiskPricing(payload.diskPricing ?? null);
          setCatalogFlavorsLastCompletedAt(payload.lastCompletedAt ?? null);
          setFlavorPage(1);
          setCatalogFlavorsError(payload.error ?? "");
        } catch (error) {
          if (cancelled) return;
          setCatalogFlavors([]);
          setDiskPricing(null);
          setCatalogFlavorsError(error instanceof Error ? error.message : "Failed to load ECS flavors");
        } finally {
          if (!cancelled) {
            setCatalogFlavorsLoading(false);
          }
        }
        return;
      }

      setCatalogFlavors([]);
      setCatalogFlavorsLastCompletedAt(null);
      setCatalogFlavorsLoading(false);
      setCatalogFlavorsError("");
      setDiskPricing(null);
    }

    void loadCalculatorData();

    return () => {
      cancelled = true;
    };
  }, [isEcsCalculator, regionValue, setFlavorPage]);

  useEffect(() => {
    if (!isEcsCalculator) {
      return;
    }

    if (!sortedFlavors.length) {
      if (selectedFlavor !== "") {
        setSelectedFlavor("");
      }
      return;
    }

    const hasSelectedFlavor = sortedFlavors.some((flavor) => flavor.name === selectedFlavor);
    if (lastFlavorAutoSelectKeyRef.current === flavorAutoSelectKey && hasSelectedFlavor) {
      return;
    }

    const nextFlavor = sortedFlavors[0];
    setSelectedFlavor(nextFlavor.name);
    setVcpuValue(nextFlavor.vcpu);
    setRamValue(nextFlavor.ram);
    lastFlavorAutoSelectKeyRef.current = flavorAutoSelectKey;
  }, [flavorAutoSelectKey, isEcsCalculator, selectedFlavor, setRamValue, setSelectedFlavor, setVcpuValue, sortedFlavors]);

  useEffect(() => {
    if (!isFlexusLCalculator || !flexusLPlans.length) {
      return;
    }

    const nextPlan = findFlexusLPlan(selectedFlavor) ?? flexusLPlans[0];
    if (selectedFlavor !== nextPlan.id) {
      setSelectedFlavor(nextPlan.id);
    }
    if (String(nextPlan.vcpu) !== "") {
      setVcpuValue(String(nextPlan.vcpu));
    }
    if (String(nextPlan.ramGiB) !== "") {
      setRamValue(String(nextPlan.ramGiB));
    }
  }, [isFlexusLCalculator, selectedFlavor, setRamValue, setSelectedFlavor, setVcpuValue]);

  const setCustomSelection = useCallback((input: {
    selectedFlavor: string;
    vcpuValue: string;
    ramValue: string;
    flavorAutoSelectKey?: string;
  }) => {
    if (input.flavorAutoSelectKey) {
      lastFlavorAutoSelectKeyRef.current = input.flavorAutoSelectKey;
    }
    setSelectedFlavor(input.selectedFlavor);
    setVcpuValue(input.vcpuValue);
    setRamValue(input.ramValue);
  }, [setRamValue, setSelectedFlavor, setVcpuValue]);

  return {
    activeDiskSizeBounds: ecsDiskSizeBounds,
    catalogFlavors,
    diskPricing,
    catalogFlavorsLoading,
    catalogFlavorsError,
    catalogFlavorsLastCompletedAt,
    selectedDiskPrice,
    visibleFlavors,
    currentFlavorPage,
    totalFlavorPages,
    selectedFlavorCard,
    selectedFlexusLPlan,
    billableFlavors,
    setCustomSelection,
  };
}
