import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neo Calculator Dashboard",
  description: "Simple black and white cloud calculator dashboard UI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
