import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Vercel-specific: allow external packages
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
