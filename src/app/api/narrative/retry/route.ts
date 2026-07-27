import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { generateBirthNarrative } from "@/lib/narrative";

// POST — 重新生成某段叙事（如出生时生成失败或需要重写）
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
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
      storySummary: params?.storySummary,
      birthTier: params?.birthTier,
    });

    const safeName = (narrative.suggestedName || "").trim();
    const validName = /^[\u4e00-\u9fff]{2,4}$/.test(safeName)
      ? safeName
      : (params?.cultivatorName?.trim() || cultivator.name || ["小石头","小宝","阿福"][Math.floor(Math.random()*3)]);

    // 事务：更新姓名 + 对已存在 GameEvent 更新 + 更新家庭成员
    await prisma.$transaction(async (tx) => {
      await tx.cultivator.update({
        where: { id: cultivator.id },
        data: { name: validName },
      });

      if (gameEventId) {
        await tx.gameEvent.update({
          where: { id: String(gameEventId) },
          data: {
            title: narrative.title,
            narrative: narrative.narrative,
            reward: JSON.stringify({ retried: true, type }),
          },
        }).catch(() => {});
      }

      // 更新家庭成员（先删除旧家庭成员，再写入新的，保证与叙事一致）
      if (narrative.family && narrative.family.length > 0) {
        await tx.familyMember.deleteMany({
          where: { cultivatorId: cultivator.id },
        }).catch(() => {});
        const members = narrative.family
          .filter((m: any) => m.relation?.trim() && m.name?.trim())
          .map((m: any) => ({
            cultivatorId: cultivator.id,
            relation: m.relation.trim(),
            name: m.name.trim(),
            age: m.age,
            alive: m.alive,
            occupation: m.occupation || null,
            intimacy: 50,
          }));
        if (members.length > 0) {
          await tx.familyMember.createMany({ data: members })
            .catch((e: Error) => console.warn("BIRTH retry: 家庭成员写入失败", e.message));
        }
      }
    });

    return NextResponse.json({
      ...narrative,
      suggestedName: validName,
      cultivator: { id: cultivator.id, name: validName },
      gameEventId: gameEventId ?? null,
    });
  } catch (error) {
    console.error("叙事重试失败:", error);
    return NextResponse.json({ error: "叙事生成失败" }, { status: 500 });
  }
}
