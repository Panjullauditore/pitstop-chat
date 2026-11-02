import type { NextConfig } from "next";

const backendPort = process.env.ROOM_BACKEND_PORT || process.env.BACKEND_PORT || "4318";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compression can buffer small SSE writes from the local backend.
  compress: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://127.0.0.1:${backendPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
