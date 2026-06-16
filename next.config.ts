import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://119.28.70.14:3000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
