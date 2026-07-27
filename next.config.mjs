/** @type {import("next").NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-libsql", "@libsql/client"],
};

export default nextConfig;