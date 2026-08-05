import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling } from "@/lib/api-error";

async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  // Support reading a specific backup file via x-backup-filename header
  const backupFilename = request.headers.get("x-backup-filename");
  if (backupFilename) {
    const fs = await import("fs");
    const path = await import("path");
    const backupPath = path.join(process.cwd(), "prisma", "backups", backupFilename);
    if (!fs.existsSync(backupPath)) {
      return NextResponse.json({ error: "备份文件不存在" }, { status: 404 });
    }
    const content = fs.readFileSync(backupPath, "utf-8");
    return NextResponse.json(JSON.parse(content));
  }

  const [familyMembers, events, memoryEntries] = await Promise.all([
    prisma.familyMember.findMany({ where: { cultivatorId: cultivator.id } }),
    prisma.gameEvent.findMany({ where: { cultivatorId: cultivator.id } }),
    prisma.memoryEntry.findMany({ where: { cultivatorId: cultivator.id } }),
  ]);

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    cultivator,
    familyMembers,
    events,
    memoryEntries,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="cultivation-backup-${Date.now()}.json"`,
    },
  });
}

export const GET = withApiErrorHandling(handler);