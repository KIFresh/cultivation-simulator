import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { withApiErrorHandling } from "@/lib/api-error";
import * as fs from "fs";
import * as path from "path";

const BACKUP_DIR = path.join(process.cwd(), "prisma", "backups");

async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;

  if (!fs.existsSync(BACKUP_DIR)) {
    return NextResponse.json({ backups: [] });
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
    .sort()
    .reverse()
    .map((f) => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      let age: number | null = null;
      let realm: string | null = null;
      try {
        const content = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), "utf-8"));
        age = content?.cultivator?.age ?? null;
        realm = content?.cultivator?.realm ?? null;
      } catch {
        // 备份文件损坏时仍列出，仅缺年龄/境界
      }
      return {
        filename: f,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        age,
        realm,
      };
    });

  return NextResponse.json({ backups: files });
}

export const GET = withApiErrorHandling(handler);