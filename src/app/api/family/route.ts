import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { withApiErrorHandling, badRequest, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { getCareerDisplayName, initializeFamilyCareer, NEUTRAL_FAMILY_ECONOMIC_BACKGROUND } from "@/lib/family-career";

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
async function getHandler(request: NextRequest) {
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
}

// POST — 覆盖保存家庭成员
async function postHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const body = await parseJsonBody(request);
  const userId = body?.userId;
  if (!userId) return apiError("缺少用户标识", 401, "NO_USER_ID");

    const members = Array.isArray(body?.members) ? (body.members as unknown[]) : null;
    if (!members || members.length === 0) {
      return apiError("缺少家庭成员数据", 400, "NO_MEMBERS");
    }

    await prisma.$transaction(async (tx) => {
      const existingMembers = await tx.familyMember.findMany({
        where: { cultivatorId: cultivator.id },
      });
      const existingById = new Map(existingMembers.map((member) => [member.id, member]));
      const existingByIdentity = new Map(existingMembers.map((member) => [
        `${member.relation}\u0000${member.name}`,
        member,
      ]));

      const savedMembers = members.map((raw) => {
        const m = raw as Record<string, unknown>;
        const relation = String(m.relation ?? "");
        const name = String(m.name ?? "");
        const clientId = typeof m.id === "string" ? m.id : undefined;
        // ID is preferred; the unique (relation, name) pair supports legacy clients that omit it.
        const existing = (clientId && existingById.get(clientId))
          ?? existingByIdentity.get(`${relation}\u0000${name}`);

        // Existing members are entirely server-managed. Preserve their full database snapshot,
        // including relationship, life state, intimacy, and all career/economic fields.
        if (existing) return existing;

        // New members accept only these client-controlled fields.
        const age = Math.min(Math.max(typeof m.age === "number" ? m.age : Number(m.age) || 0, 0), 120);
        const alive = true;
        const intimacy = 50;
        const career = initializeFamilyCareer({
          relation,
          age,
          alive,
          worldYear: cultivator.worldYear,
          familyBackground: NEUTRAL_FAMILY_ECONOMIC_BACKGROUND,
        });
        return {
          cultivatorId: cultivator.id,
          relation,
          name,
          age,
          alive,
          intimacy,
          occupation: getCareerDisplayName(career.careerCategory, career.careerLevel, cultivator.worldYear),
          incomeLevel: career.incomeLevel,
          careerCategory: career.careerCategory,
          careerLevel: career.careerLevel,
          careerStatus: career.careerStatus,
          monthlyIncome: career.monthlyIncome,
          careerUpdatedYear: career.careerUpdatedYear,
        };
      });

      await tx.familyMember.deleteMany({ where: { cultivatorId: cultivator.id } });
      await tx.familyMember.createMany({ data: savedMembers });
    });

    return NextResponse.json({ success: true, count: members.length });
}

export const GET = withApiErrorHandling(getHandler);
export const POST = withApiErrorHandling(postHandler);
