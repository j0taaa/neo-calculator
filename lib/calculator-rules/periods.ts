export type Period = { value: number | string; periodType: string; backValue?: number; hasPromotion?: boolean; disabled?: boolean };
export type Term = { key: string; label: string; disabled: boolean };

/** The price catalog records billing terms separately from their displayed labels. */
export function periodChoices(periods: Period[]): Term[] {
  const result: Term[] = [];
  for (const period of periods) {
    const value = Number(period.backValue ?? period.value), measure = period.periodType === "YEAR" ? 19 : 20;
    const monthsAsYears = measure === 20 && value >= 12 && value % 12 === 0;
    const displayed = monthsAsYears ? value / 12 : value, year = measure === 19 || monthsAsYears;
    if (monthsAsYears) {
      const equivalent = periods.find(p => p.periodType === "YEAR" && Number(p.backValue ?? p.value) === displayed);
      if (equivalent && (equivalent.hasPromotion || !period.hasPromotion)) continue;
    }
    const label = `${displayed} ${year ? displayed === 1 ? "year" : "years" : displayed === 1 ? "month" : "months"}`;
    if (year && result.some(p => p.label === label)) continue;
    result.push({ key: `${value}_${measure}`, label, disabled: Boolean(period.disabled) });
  }
  return result;
}
