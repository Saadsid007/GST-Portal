import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  experimental: {
    useTypeScriptCli: true,
    // A full multi-marketplace batch of xlsx/csv exports far exceeds the 1 MB
    // Server Action body default.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
