import { PrismaClient } from "../generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// 本地开发使用 SQLite 文件，生产使用 Turso/libsql cloud
const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const adapter = new PrismaLibSql({
  url: dbUrl,
  ...(authToken ? { authToken } : {}),
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
