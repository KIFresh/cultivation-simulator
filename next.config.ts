import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma + libsql adapter 需要标记为外部包
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client"],
};

export default nextConfig;
