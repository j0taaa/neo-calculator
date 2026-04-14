import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res-static.hc-cdn.cn",
      },
    ],
  },
};

export default nextConfig;
