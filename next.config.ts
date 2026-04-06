import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res-static.hc-cdn.cn",
      },
    ],
  },
  // Optimize package imports to reduce bundle size
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-dialog",
      "@radix-ui/react-accordion",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-separator",
    ],
  },
  // Disable source maps in development for faster compilation
  productionBrowserSourceMaps: false,
};

export default nextConfig;
