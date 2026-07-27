import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";

function parseHistory(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// GET — 获取家庭成员列表
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) return apiError("缺少用户标识", 401, "NO_USER_ID");

    const cultivatorId = searchParams.get("cultivatorId");
    if (cultivatorId && cultivatorId !== cultivator.id) {
      return apiError("无权访问", 403, "FORBIDDEN");
    }

    const members = await prisma.familyMember.findMany({
      where: { cultivatorId: cultivator.id },
      orderBy: { relation: "asc" },
    });

    const result = members.map((m) => ({
      ...m,
      dialogueHistory: parseHistory(m.dialogueHistory),
    }));

    return NextResponse.json({ members: result });
  } catch (error) {
    console.error("获取家庭失败:", error);
    return NextResponse.json({ error: "获取家庭成员失败" }, { status: 500 });
  }
}

// POST — 覆盖保存家庭成员
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const userId = body?.userId;
    if (!userId) return apiError("缺少用户标识", 401, "NO_USER_ID");

    const members = Array.isArray(body?.members) ? (body.members as unknown[]) : null;
    if (!members || members.length === 0) {
      return apiError("缺少家庭成员数据", 400, "NO_MEMBERS");
    }

    await prisma.familyMember.deleteMany({ where: { cultivatorId: cultivator.id } });

    await prisma.familyMember.createMany({
      data: members.map((raw) => {
        const m = raw as Record<string, unknown>;
        return {
          cultivatorId: cultivator.id,
          relation: String(m.relation ?? ""),
          name: String(m.name ?? ""),
          age: typeof m.age === "number" ? m.age : Number(m.age) || 0,
          alive: m.alive === undefined ? true : Boolean(m.alive),
          intimacy: typeof m.intimacy === "number" ? m.intimacy : 50,
        };
      }),
    });

    return NextResponse.json({ success: true, count: members.length });
  } catch (error) {
    console.error("保存家庭失败:", error);
    return NextResponse.json({ error: "保存家庭成员失败" }, { status: 500 });
  }
}
