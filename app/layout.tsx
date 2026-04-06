import type { Metadata } from "next";
import { TopNavbar } from "@/components/top-navbar";
import { SessionProvider } from "@/components/session-provider";
import { NavbarProvider } from "@/components/navbar-context";
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
      <body className="antialiased">
        <SessionProvider>
          <NavbarProvider>
            <TopNavbar />
            {children}
          </NavbarProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
