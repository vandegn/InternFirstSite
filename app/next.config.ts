import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  transpilePackages: ['@zoom/meetingsdk'],
};

export default nextConfig;
