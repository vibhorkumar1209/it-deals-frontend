/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://it-deals-api.onrender.com",
  },
  // Keep SSE streams alive — disable response buffering on Vercel Pro
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Accel-Buffering", value: "no" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  // Avoid re-bundling large server-only packages into the client
  serverExternalPackages: ["@anthropic-ai/sdk"],
};
export default nextConfig;
