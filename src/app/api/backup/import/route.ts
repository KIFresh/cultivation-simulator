import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling } from "@/lib/api-error";
import { autoBackup } from "@/lib/auto-backup";

async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "无效的存档数据" }, { status: 400 });
  if (!body.version || !body.cultivator) {
    return NextResponse.json({ error: "存档格式不完整" }, { status: 400 });
  }

  const importCultivator = body.cultivator;
  if (importCultivator.id !== cultivator.id) {
    return NextResponse.json({ error: "存档不属于当前角色" }, { status: 400 });
  }

  // 导入前自动创建当前存档的备份，防止覆盖后无法回退
  await autoBackup(cultivator.id).catch(() => {});

  await prisma.$transaction(async (tx) => {
    await tx.familyMember.deleteMany({ where: { cultivatorId: cultivator.id } });
    await tx.gameEvent.deleteMany({ where: { cultivatorId: cultivator.id } });
    await tx.memoryEntry.deleteMany({ where: { cultivatorId: cultivator.id } });

    const { id, userId, user, techniques, familyMembers, events, memoryEntries, ...rest } = importCultivator;
    await tx.cultivator.update({
      where: { id: cultivator.id },
      data: rest,
    });

    if (Array.isArray(body.familyMembers)) {
      for (const m of body.familyMembers) {
        const { id, cultivatorId, ...mData } = m;
        await tx.familyMember.create({ data: { ...mData, cultivatorId: cultivator.id } });
      }
    }

    if (Array.isArray(body.events)) {
      for (const e of body.events) {
        const { id, cultivatorId, ...eData } = e;
        await tx.gameEvent.create({ data: { ...eData, cultivatorId: cultivator.id } });
      }
    }

    if (Array.isArray(body.memoryEntries)) {
      for (const me of body.memoryEntries) {
        const { id, cultivatorId, ...meData } = me;
        await tx.memoryEntry.create({ data: { ...meData, cultivatorId: cultivator.id } });
      }
    }
  });

  return NextResponse.json({ success: true });
}

export const POST = withApiErrorHandling(handler);