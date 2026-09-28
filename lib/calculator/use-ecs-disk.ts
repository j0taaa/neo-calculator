import {
  ecsDiskSizeBounds,
  getGpSsd2IopsBounds,
  getGpSsd2ThroughputBounds,
  gpSsd2IopsBounds,
  gpSsd2ThroughputBounds,
  normalizeGpSsd2Iops,
  normalizeGpSsd2Throughput,
  systemDiskOptions,
  type SystemDiskOption,
} from "@/lib/configurable-runtime-utils";
import { useCallback, useMemo, useState } from "react";

const activeDiskSizeBounds = ecsDiskSizeBounds;

export function useEcsDisk() {
  const [systemDiskType, setSystemDiskType] =
    useState<SystemDiskOption>("High I/O");

  const [systemDiskSize, setSystemDiskSize] = useState("40");

  const [gpSsd2Iops, setGpSsd2Iops] = useState("3000");

  const [gpSsd2Throughput, setGpSsd2Throughput] = useState("125");

  const systemDiskSizeValue = Number.isFinite(Number(systemDiskSize))
    ? Math.max(ecsDiskSizeBounds.min, Number(systemDiskSize))
    : ecsDiskSizeBounds.min;

  const isGpSsd2Selected = systemDiskType === "General Purpose SSD V2";

  const gpSsd2IopsValue = isGpSsd2Selected
    ? normalizeGpSsd2Iops(gpSsd2Iops, systemDiskSizeValue)
    : null;

  const gpSsd2IopsRange = isGpSsd2Selected
    ? getGpSsd2IopsBounds(systemDiskSizeValue)
    : null;

  const gpSsd2ThroughputValue =
    isGpSsd2Selected && gpSsd2IopsValue != null
      ? normalizeGpSsd2Throughput(gpSsd2Throughput, gpSsd2IopsValue)
      : null;

  const gpSsd2ThroughputRange =
    isGpSsd2Selected && gpSsd2IopsValue != null
      ? getGpSsd2ThroughputBounds(gpSsd2IopsValue)
      : null;

  // Normalize dependent disk controls together when the disk size or type changes.
  if (
    isGpSsd2Selected &&
    gpSsd2IopsValue != null &&
    gpSsd2ThroughputValue != null
  ) {
    if (gpSsd2Iops !== String(gpSsd2IopsValue))
      setGpSsd2Iops(String(gpSsd2IopsValue));
    if (gpSsd2Throughput !== String(gpSsd2ThroughputValue))
      setGpSsd2Throughput(String(gpSsd2ThroughputValue));
  }

  const updateSystemDiskSize = useCallback((nextValue: string) => {
    if (nextValue === "") {
      setSystemDiskSize("");
      return;
    }
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) {
      return;
    }
    setSystemDiskSize(
      String(
        Math.min(
          activeDiskSizeBounds.max,
          Math.max(activeDiskSizeBounds.min, parsed),
        ),
      ),
    );
  }, []);

  const updateGpSsd2Iops = useCallback(
    (nextValue: string) => {
      if (nextValue === "") {
        setGpSsd2Iops("");
        return;
      }
      const parsed = Number(nextValue);
      if (Number.isNaN(parsed)) {
        return;
      }
      setGpSsd2Iops(String(normalizeGpSsd2Iops(parsed, systemDiskSizeValue)));
    },
    [systemDiskSizeValue],
  );

  const updateGpSsd2Throughput = useCallback(
    (nextValue: string) => {
      if (nextValue === "") {
        setGpSsd2Throughput("");
        return;
      }
      const parsed = Number(nextValue);
      if (Number.isNaN(parsed)) {
        return;
      }
      setGpSsd2Throughput(
        String(
          normalizeGpSsd2Throughput(
            parsed,
            gpSsd2IopsValue ?? gpSsd2IopsBounds.min,
          ),
        ),
      );
    },
    [gpSsd2IopsValue],
  );

  const calculatorDiskNotes = useMemo(
    () => [
      ...(isGpSsd2Selected
        ? [
            "Current estimate reflects capacity pricing only. Additional GPSSD2 IOPS and throughput charges are not modeled yet.",
          ]
        : []),
      `Minimum ${activeDiskSizeBounds.min} GiB, maximum ${activeDiskSizeBounds.max} GiB.`,
    ],
    [isGpSsd2Selected],
  );

  const calculatorDiskConfigProps = {
    mode: "ecs" as const,
    systemDiskType,
    systemDiskOptions,
    onSystemDiskTypeChange: (value: string) =>
      value && setSystemDiskType(value as SystemDiskOption),
    systemDiskSize,
    onSystemDiskSizeChange: (value: string) => {
      if (value === "") {
        setSystemDiskSize("");
        return;
      }
      updateSystemDiskSize(value);
    },
    onSystemDiskSizeBlur: () =>
      updateSystemDiskSize(systemDiskSize || String(activeDiskSizeBounds.min)),
    onSystemDiskSizeStep: (delta: number) =>
      updateSystemDiskSize(
        String(
          Number(systemDiskSize || String(activeDiskSizeBounds.min)) + delta,
        ),
      ),
    showGpSsd2Controls: isGpSsd2Selected,
    gpSsd2Iops,
    gpSsd2IopsRange,
    onGpSsd2IopsChange: (value: string) => {
      if (value === "") {
        setGpSsd2Iops("");
        return;
      }
      updateGpSsd2Iops(value);
    },
    onGpSsd2IopsBlur: () =>
      updateGpSsd2Iops(
        gpSsd2Iops || String(gpSsd2IopsRange?.min ?? gpSsd2IopsBounds.min),
      ),
    gpSsd2Throughput,
    gpSsd2ThroughputRange,
    onGpSsd2ThroughputChange: (value: string) => {
      if (value === "") {
        setGpSsd2Throughput("");
        return;
      }
      updateGpSsd2Throughput(value);
    },
    onGpSsd2ThroughputBlur: () =>
      updateGpSsd2Throughput(
        gpSsd2Throughput ||
          String(gpSsd2ThroughputRange?.min ?? gpSsd2ThroughputBounds.min),
      ),
    pricingError: undefined,
    pricingLoadingMessage: null,
    notes: calculatorDiskNotes,
  };
  return {
    systemDiskType,
    setSystemDiskType,
    systemDiskSize,
    setSystemDiskSize,
    setGpSsd2Iops,
    setGpSsd2Throughput,
    systemDiskSizeValue,
    isGpSsd2Selected,
    gpSsd2IopsValue,
    gpSsd2ThroughputValue,
    activeDiskSizeBounds,
    calculatorDiskConfigProps,
  };
}
