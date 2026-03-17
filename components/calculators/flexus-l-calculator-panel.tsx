"use client";

type FlexusLPlanCard = {
  id: string;
  title: string;
  vcpu: number;
  ramGiB: number;
  systemDiskGiB: number;
  peakBandwidthMbit: number;
  dataPackageTiB: number;
  monthlyPrice: string;
};

type FlexusLCalculatorPanelProps = {
  plans: FlexusLPlanCard[];
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  selectionSummary: string;
  selectionNotes: string[];
  referenceNote: string;
};

export function FlexusLCalculatorPanel({
  plans,
  selectedPlanId,
  onSelectPlan,
  selectionSummary,
  selectionNotes,
  referenceNote,
}: FlexusLCalculatorPanelProps) {
  return (
    <>
      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium">Plan</p>
          <p className="mt-1 text-sm text-zinc-500">Flexus L uses fixed public plans with bundled system disk, bandwidth, and monthly traffic.</p>
        </div>
        <div className="space-y-2">
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;

            return (
              <button
                key={plan.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left ${
                  isSelected ? "border-zinc-950 bg-white" : "border-zinc-200 bg-white/80"
                }`}
                onClick={() => onSelectPlan(plan.id)}
              >
                <div>
                  <p className="font-medium text-zinc-950">{plan.title}</p>
                  <p className="text-sm text-zinc-500">
                    {plan.systemDiskGiB} GiB system disk · {plan.peakBandwidthMbit} Mbit/s · {plan.dataPackageTiB} TB/month
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-zinc-950">{plan.monthlyPrice}</p>
                  <p className="text-zinc-500">
                    {plan.vcpu} vCPUs · {plan.ramGiB} GiB RAM
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-600">
        {selectionSummary}
        {selectionNotes.map((note) => (
          <p key={note} className="mt-2 text-xs text-zinc-500">
            {note}
          </p>
        ))}
      </div>

      <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
        {referenceNote}
      </div>
    </>
  );
}
