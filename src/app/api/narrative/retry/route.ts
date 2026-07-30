import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { generateBirthNarrative } from "@/lib/narrative";
import {
  getCareerDisplayName,
  initializeFamilyCareer,
  NEUTRAL_FAMILY_ECONOMIC_BACKGROUND,
} from "@/lib/family-career";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

async function postHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const body = await parseJsonBody(request);
  const { type, params, gameEventId } = body ?? {};

  if (!type) {
    return NextResponse.json({ error: "缺少叙事类型" }, { status: 400 });
  }

  if (type !== "BIRTH") {
    return NextResponse.json({ error: "暂不支持该类型的重试" }, { status: 400 });
  }

  const narrative = await generateBirthNarrative({
    cultivatorName: params?.cultivatorName ?? cultivator.name,
    spiritualRoot: params?.spiritualRoot ?? cultivator.spiritualRoot,
    worldId: params?.worldId ?? cultivator.worldId ?? undefined,
    worldName: params?.worldName,
    identityName: params?.identityName,
    family: Array.isArray(params?.family) ? params.family : undefined,

    birthTier: params?.birthTier,
  });

  const safeName = (narrative.suggestedName || "").trim();
  const validName = /^[\u4e00-\u9fff]{2,4}$/.test(safeName)
    ? safeName
    : params?.cultivatorName?.trim() ||
      cultivator.name ||
      ["小石头", "小宝", "阿福"][Math.floor(Math.random() * 3)];

  // 事务：更新姓名 + 对已存在 GameEvent 更新 + 更新家庭成员
  await prisma.$transaction(async (tx) => {
    await tx.cultivator.update({
      where: { id: cultivator.id },
      data: { name: validName },
    });

    if (gameEventId) {
      await tx.gameEvent
        .update({
          where: { id: String(gameEventId) },
          data: {
            title: narrative.title,
            narrative: narrative.narrative,
            reward: JSON.stringify({ retried: true, type }),
          },
        })
        .catch(() => {});
    }

    // 更新家庭成员（先删除旧家庭成员，再写入新的，保证与叙事一致）
    if (narrative.family && narrative.family.length > 0) {
      await tx.familyMember
        .deleteMany({
          where: { cultivatorId: cultivator.id },
        })
        .catch(() => {});
      const members = narrative.family
        .filter((m: any) => m.relation?.trim() && m.name?.trim())
        .map((m: any) => {
          const career = initializeFamilyCareer({
            relation: m.relation.trim(),
            age: m.age,
            worldYear: cultivator.worldYear,
            familyBackground: NEUTRAL_FAMILY_ECONOMIC_BACKGROUND,
            alive: m.alive,
          });
          return {
            cultivatorId: cultivator.id,
            relation: m.relation.trim(),
            name: m.name.trim(),
            age: m.age,
            alive: m.alive,
            occupation: getCareerDisplayName(
              career.careerCategory,
              career.careerLevel,
              cultivator.worldYear
            ),
            incomeLevel: career.incomeLevel,
            careerCategory: career.careerCategory,
            careerLevel: career.careerLevel,
            careerStatus: career.careerStatus,
            monthlyIncome: career.monthlyIncome,
            careerUpdatedYear: career.careerUpdatedYear,
            intimacy: 50,
          };
        });
      if (members.length > 0) {
        await tx.familyMember.createMany({ data: members });
      }
    }
  });

  return NextResponse.json({
    ...narrative,
    suggestedName: validName,
    cultivator: { id: cultivator.id, name: validName },
    gameEventId: gameEventId ?? null,
  });
}

export const POST = withApiErrorHandling(postHandler);
