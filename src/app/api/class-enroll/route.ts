import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

interface ClassInfo {
  id: string;
  name: string;
  school: string;
  cost: number;
  attr: string;
  desc: string;
}

const CLASSES: ClassInfo[] = [
  { id: "talisman", name: "符箓入门", school: "符箓阁", cost: 30, attr: "insight", desc: "学习绘制符箓，增益悟性。" },
  { id: "alchemy_intro", name: "丹道基础", school: "丹鼎峰", cost: 35, attr: "spirit", desc: "初窥丹道，固本培元。" },
  { id: "sword", name: "剑修启蒙", school: "御剑台", cost: 40, attr: "root", desc: "修习剑诀，淬炼根骨。" },
  { id: "array", name: "阵法初解", school: "天机殿", cost: 45, attr: "mind", desc: "研习阵法，磨炼心性。" },
];

interface EnrollInfo {
  classId: string;
  name: string;
  school: string;
  enrolledAt: string;
}

function parseEnroll(raw: string | null): EnrollInfo | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as EnrollInfo) : null;
  } catch {
    return null;
  }
}

// GET — 入学状态与可选课程
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    return NextResponse.json({ classEnroll: parseEnroll(cultivator.classEnroll), availableClasses: CLASSES });
  } catch (error) {
    logger.error("获取学堂信息失败:", error);
    return NextResponse.json({ error: "获取学堂信息失败" }, { status: 500 });
  }
}

// POST — 选修一门课程
async function postHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const body = await parseJsonBody(request);
  const cls = CLASSES.find((c) => c.id === body?.classId);
  if (!cls) {
    return NextResponse.json({ error: "未找到该课程", success: false }, { status: 404 });
  }

  const current = parseEnroll(cultivator.classEnroll);
  if (current && current.classId === cls.id) {
    return NextResponse.json({ error: "已选修此课程", success: false }, { status: 400 });
  }
  if (cultivator.gold < cls.cost) {
    return NextResponse.json({ error: "灵石不足，无法入学", success: false }, { status: 400 });
  }

  const enroll: EnrollInfo = {
    classId: cls.id,
    name: cls.name,
    school: cls.school,
    enrolledAt: new Date().toISOString(),
  };

  const updated = await prisma.cultivator.update({
    where: { id: cultivator.id },
    data: { gold: { increment: -cls.cost }, classEnroll: JSON.stringify(enroll) },
  });

  return NextResponse.json({ success: true, classEnroll: enroll, gold: updated.gold });
}

export const POST = withApiErrorHandling(postHandler);
