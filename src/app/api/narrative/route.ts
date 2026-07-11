import { NextRequest, NextResponse } from "next/server";
import {
  generateDailyCultivationNarrative,
  generateBreakthroughNarrative,
  generateEncounterNarrative,
  generateBirthNarrative,
} from "@/lib/narrative";
import { prisma } from "@/lib/prisma";
import { canBreakthrough, performBreakthrough } from "@/lib";

// POST — 生成叙事 + 处理突破
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, taskType, taskDescription, choiceIndex } = body;

    if (!userId || !type) {
      return NextResponse.json(
        { error: "缺少必填参数" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { cultivator: true },
    });

    if (!user?.cultivator) {
      return NextResponse.json(
        { error: "请先创建修炼者" },
        { status: 400 }
      );
    }

    const cultivator = user.cultivator;

    switch (type) {
      case "BIRTH": {
        const narrative = await generateBirthNarrative({
          cultivatorName: cultivator.name,
          spiritualRoot: cultivator.spiritualRoot,
          worldName: body.worldName || "修仙世界",
          identityName: body.identityName || "修士",
          age: body.age || 1,
          worldId: body.worldId,
          family: body.family || [],
        });
        const event = await prisma.gameEvent.create({
          data: { cultivatorId: cultivator.id, type: "BIRTH", title: narrative.title, narrative: narrative.narrative, reward: JSON.stringify({ mood: narrative.mood }) },
        });
        return NextResponse.json({ event, narrative });
      }

      case "DAILY_CULTIVATION": {
        // 日常修炼叙事
        const narrative = await generateDailyCultivationNarrative({
          cultivatorName: cultivator.name,
          spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
          realm: cultivator.realm,
          realmLevel: cultivator.realmLevel,
          taskType: taskType || "CUSTOM",
          taskDescription,
          cultivationExp: cultivator.cultivationExp,
        });

        // 保存事件
        const event = await prisma.gameEvent.create({
          data: {
            cultivatorId: cultivator.id,
            type: "DAILY_CULTIVATION",
            title: narrative.title,
            narrative: narrative.narrative,
            reward: JSON.stringify({ mood: narrative.mood, hint: narrative.hint }),
          },
        });

        // 检查是否可以突破
        const canBreak = canBreakthrough(
          cultivator.realm,
          cultivator.realmLevel,
          cultivator.cultivationExp,
          cultivator.spiritualRoot as import("@/lib").SpiritualRoot
        );

        return NextResponse.json({
          event,
          narrative,
          canBreakthrough: canBreak,
        });
      }

      case "BREAKTHROUGH": {
        // 境界突破
        const result = performBreakthrough(
          cultivator.realm,
          cultivator.realmLevel,
          cultivator.cultivationExp
        );

        if (!result) {
          return NextResponse.json(
            { error: "无法突破" },
            { status: 400 }
          );
        }

        const narrative = await generateBreakthroughNarrative({
          cultivatorName: cultivator.name,
          spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
          fromRealm: cultivator.realm,
          fromLevel: cultivator.realmLevel,
          toRealm: result.newRealm,
          toLevel: result.newLevel,
          totalExp: cultivator.totalExp,
          breakthroughCount: cultivator.breakthroughCount,
        });

        // 更新修炼者 + 保存事件
        const [updatedCultivator, event] = await prisma.$transaction([
          prisma.cultivator.update({
            where: { id: cultivator.id },
            data: {
              realm: result.newRealm,
              realmLevel: result.newLevel,
              cultivationExp: result.newExp,
              breakthroughCount: { increment: 1 },
            },
          }),
          prisma.gameEvent.create({
            data: {
              cultivatorId: cultivator.id,
              type: "BREAKTHROUGH",
              title: narrative.title,
              narrative: narrative.narrative,
              reward: JSON.stringify({
                newRealm: result.newRealm,
                newLevel: result.newLevel,
                mood: narrative.mood,
              }),
            },
          }),
        ]);

        return NextResponse.json({
          event,
          narrative,
          cultivator: updatedCultivator,
          isNewRealm: result.newRealm !== cultivator.realm,
        });
      }

      case "ENCOUNTER": {
        // 随机奇遇
        const narrative = await generateEncounterNarrative({
          cultivatorName: cultivator.name,
          spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
          realm: cultivator.realm,
          realmLevel: cultivator.realmLevel,
        });

        // 如果用户做了选择
        if (choiceIndex !== undefined && narrative.choices[choiceIndex]) {
          const choice = narrative.choices[choiceIndex];
          const expBonus =
            choice.risk === "high" ? 50 : choice.risk === "medium" ? 30 : 15;

          await prisma.$transaction([
            prisma.cultivator.update({
              where: { id: cultivator.id },
              data: {
                cultivationExp: { increment: expBonus },
                totalExp: { increment: expBonus },
              },
            }),
            prisma.gameEvent.create({
              data: {
                cultivatorId: cultivator.id,
                type: "RANDOM_ENCOUNTER",
                title: narrative.title,
                narrative: narrative.narrative,
                choices: JSON.stringify(narrative.choices),
                chosenOption: choiceIndex,
                reward: JSON.stringify({ expBonus }),
              },
            }),
          ]);

          return NextResponse.json({
            narrative,
            chosenOption: choiceIndex,
            expBonus,
          });
        }

        // 保存事件（选项待选）
        const event = await prisma.gameEvent.create({
          data: {
            cultivatorId: cultivator.id,
            type: "RANDOM_ENCOUNTER",
            title: narrative.title,
            narrative: narrative.narrative,
            choices: JSON.stringify(narrative.choices),
          },
        });

        return NextResponse.json({ event, narrative });
      }

      default:
        return NextResponse.json(
          { error: "未知叙事类型" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("叙事生成失败:", error);
    return NextResponse.json(
      { error: "生成失败，请重试" },
      { status: 500 }
    );
  }
}
