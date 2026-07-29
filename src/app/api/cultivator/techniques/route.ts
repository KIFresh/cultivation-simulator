import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TECHNIQUES, type Technique } from "@/lib/technique-data";
import { requireCultivator } from "@/lib/auth-helpers";

// GET — 读取修炼者的功法列表
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const records = await prisma.cultivatorTechnique.findMany({
      where: { cultivatorId: cultivator.id },
    });

    return NextResponse.json({ techniques: records, allTechniques: TECHNIQUES });
  } catch (error) {
    console.error("读取功法失败:", error);
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}

// POST — 装备/卸下功法
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    const body = await request.json();
    const { action } = body;

    // === 装备功法 ===
    if (action === "equip") {
      const { techniqueId, slot } = body;
      if (!techniqueId || !slot || slot < 1 || slot > 3) {
        return NextResponse.json({ error: "参数错误：需要 techniqueId 和 slot(1-3)" }, { status: 400 });
      }
      if (!TECHNIQUES[techniqueId]) {
        return NextResponse.json({ error: "功法不存在" }, { status: 400 });
      }

      // 找到该修炼者的目标功法记录
      const targetRecord = await prisma.cultivatorTechnique.findFirst({
        where: { cultivatorId: cultivator.id, techniqueId },
      });
      if (!targetRecord) {
        return NextResponse.json({ error: "尚未获得该功法" }, { status: 400 });
      }

      // 事务：先腾空槽位，再装备新功法
      await prisma.$transaction([
        prisma.cultivatorTechnique.updateMany({
          where: { cultivatorId: cultivator.id, equipSlot: slot },
          data: { equipSlot: null },
        }),
        prisma.cultivatorTechnique.update({
          where: { id: targetRecord.id },
          data: { equipSlot: slot },
        }),
      ]);

      const freshRecords = await prisma.cultivatorTechnique.findMany({
        where: { cultivatorId: cultivator.id },
      });
      return NextResponse.json({ success: true, techniques: freshRecords });
    }

    // === 卸下功法 ===
    if (action === "unequip") {
      const { slot, techniqueId } = body;

      const where = slot !== undefined
        ? { cultivatorId: cultivator.id, equipSlot: slot as number }
        : techniqueId
          ? { cultivatorId: cultivator.id, techniqueId: techniqueId as string }
          : null;

      if (!where) {
        return NextResponse.json({ error: "需要 slot 或 techniqueId" }, { status: 400 });
      }

      await prisma.cultivatorTechnique.updateMany({
        where,
        data: { equipSlot: null },
      });

      const freshRecords = await prisma.cultivatorTechnique.findMany({
        where: { cultivatorId: cultivator.id },
      });
      return NextResponse.json({ success: true, techniques: freshRecords });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    console.error("功法操作失败:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}