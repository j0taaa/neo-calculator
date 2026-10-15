import { notFound } from "next/navigation";
import { DesignWorkbench } from "@/components/design-proposals/workbench";
import { directions } from "@/components/design-proposals/directions";

export function generateStaticParams() {
  return directions.map(({ id }) => ({ direction: id }));
}
export default async function DesignPage({
  params,
}: {
  params: Promise<{ direction: string }>;
}) {
  const { direction } = await params;
  const proposal = directions.find(({ id }) => id === direction);
  if (!proposal) notFound();
  return <DesignWorkbench direction={proposal.id} />;
}
