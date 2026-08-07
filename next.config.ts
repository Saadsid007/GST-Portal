import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  images: {
    // Razorpay serves generated UPI QR images from rzp.io. They are rendered
    // unoptimized (a QR must not be resampled — it degrades scannability), but
    // next/image still validates the host against this allowlist.
    remotePatterns: [{ protocol: "https", hostname: "rzp.io" }],
  },
  experimental: {
    useTypeScriptCli: true,
    // A full multi-marketplace batch of xlsx/csv exports far exceeds the 1 MB
    // Server Action body default.
    serverActions: { bodySizeLimit: "25mb" },
  },
  // IndexNow wants its ownership key as plaintext at /<key>.txt. The rewrite is
  // constrained to a hex filename so it cannot shadow real routes or the 404 page;
  // the handler still verifies the key against env before answering.
  async rewrites() {
    return [
      {
        source: "/:key([a-f0-9]{8,128}).txt",
        destination: "/api/indexnow/:key",
      },
    ];
  },
};

export default nextConfig;
