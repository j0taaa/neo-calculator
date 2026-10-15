import type { Metadata } from "next";
import "@/components/design-proposals/designs.css";

export const metadata: Metadata = {
  title: "Design proposals · NeoCalculator",
  robots: { index: false, follow: false },
};

export default function DesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="neo-designs">{children}</div>;
}
