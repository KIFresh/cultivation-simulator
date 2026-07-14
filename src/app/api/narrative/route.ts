import { NextRequest, NextResponse } from "next/server";
import {
  generateDailyCultivationNarrative,
  generateBreakthroughNarrative,
  generateEncounterNarrative,
  generateBirthNarrative,
  type StoryEntry,
  createEntry,
  buildSummaryFromEntries,
  compressStorySummary,
} from "@/lib/narrative";
import { prisma } from "@/lib/prisma";
import { canBreakthrough, performBreakthrough } from "@/lib";
import { TECHNIQUES, addProficiency, calculateTechniqueBonuses } from "@/lib/technique-data";

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

    // 读取当前 entries
    const currentEntries: StoryEntry[] = JSON.parse(cultivator.storyEntries || '[]');
    const summaryText = buildSummaryFromEntries(currentEntries);

    // 保存 entries 的通用操作
    const saveEntries = async (newEntries: StoryEntry[]) => {
      let finalEntries = newEntries;
      const newSummaryText = buildSummaryFromEntries(newEntries);

      // 超过阈值则压缩
      if (newEntries.length > 50 || newSummaryText.length > 1000) {
        const compressedText = await compressStorySummary(newEntries, cultivator.name);
        const compressedEntry = createEntry("📜 记忆凝练", compressedText, false);
        const importantEntries = newEntries.filter(e => e.important);
        finalEntries = [...importantEntries, compressedEntry];
      }

      await prisma.cultivator.update({
        where: { id: cultivator.id },
        data: {
          storyEntries: JSON.stringify(finalEntries),
          storyEntriesUpdatedAt: new Date(),
        },
      });
    };

    switch (type) {
      case "BIRTH": {
        const narrative = await generateBirthNarrative({
          cultivatorName: cultivator.name,
          spiritualRoot: cultivator.spiritualRoot,
          worldName: body.worldName || "修仙世界",
          identityName: body.identityName || "修士",
          birthTier: body.birthTier,
          age: body.age || 1,
          worldId: body.worldId,
          family: body.family || [],
          storySummary: summaryText || undefined,
        });

        let event;
        try {
          event = await prisma.gameEvent.create({
            data: { cultivatorId: cultivator.id, type: "BIRTH", title: narrative.title, narrative: narrative.narrative, reward: JSON.stringify({ mood: narrative.mood }) },
          });
        } catch (e) {
          console.error("BIRTH: GameEvent 写入失败", e);
          return NextResponse.json({ error: `GameEvent写入失败: ${(e as Error).message}` }, { status: 500 });
        }

        try {
          const newEntry = createEntry(narrative.title, narrative.narrative, false);
          await saveEntries([...currentEntries, newEntry]);
        } catch (e) {
          console.error("BIRTH: storyEntries 更新失败", e);
          return NextResponse.json({ error: `storyEntries更新失败: ${(e as Error).message}` }, { status: 500 });
        }

        return NextResponse.json({ event, narrative });
      }

      case "DAILY_CULTIVATION": {
        const narrative = await generateDailyCultivationNarrative({
          cultivatorName: cultivator.name,
          spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
          realm: cultivator.realm,
          realmLevel: cultivator.realmLevel,
          taskType: taskType || "CUSTOM",
          taskDescription,
          cultivationExp: cultivator.cultivationExp,
          storySummary: summaryText || undefined,
        });

        const event = await prisma.gameEvent.create({
          data: {
            cultivatorId: cultivator.id,
            type: "DAILY_CULTIVATION",
            title: narrative.title,
            narrative: narrative.narrative,
            reward: JSON.stringify({ mood: narrative.mood, hint: narrative.hint }),
          },
        });

        const newEntry = createEntry(narrative.title, narrative.narrative, true, narrative.summary);
        await saveEntries([...currentEntries, newEntry]);

        // 增加功法熟练度
        const techniqueRecords = await prisma.cultivatorTechnique.findMany({
          where: { cultivatorId: cultivator.id, equipSlot: { not: null } },
        });
        let levelUpMessages: string[] = [];
        const techniqueUpdates: any[] = [];
        for (const r of techniqueRecords) {
          const t = TECHNIQUES[r.techniqueId];
          if (!t) continue;
          const result = addProficiency(r.level, r.proficiency, t.upgradeProficiency, Math.floor(Math.random() * 6) + 5);
          if (result.leveledUp) {
            levelUpMessages.push(`${t.name} 升级至 Lv.${result.newLevel}！`);
          }
          techniqueUpdates.push(prisma.cultivatorTechnique.update({
            where: { id: r.id },
            data: { level: result.newLevel, proficiency: result.newProficiency },
          }));
        }
        if (techniqueUpdates.length > 0) {
          await prisma.$transaction(techniqueUpdates);
        }
        const finalHint = narrative.hint || "";
        const narrativeHint = levelUpMessages.length > 0
          ? finalHint + (finalHint ? " " : "") + levelUpMessages.join(" ")
          : finalHint;

        const canBreak = canBreakthrough(
          cultivator.realm,
          cultivator.realmLevel,
          cultivator.cultivationExp,
          cultivator.spiritualRoot as import("@/lib").SpiritualRoot
        );

        return NextResponse.json({ event, narrative: { ...narrative, hint: narrativeHint }, canBreakthrough: canBreak });
      }

      case "BREAKTHROUGH": {
        // 计算功法突破加成
        const techRecords = await prisma.cultivatorTechnique.findMany({
          where: { cultivatorId: cultivator.id, equipSlot: { not: null } },
        });
        const techBonuses = calculateTechniqueBonuses(
          techRecords.map((r) => ({ technique: TECHNIQUES[r.techniqueId], level: r.level }))
        );
        const breakthroughRateBonus = techBonuses.breakthroughRate || 0;
        // 加上破境丹 buff
        const totalBuff = Math.min(100, breakthroughRateBonus + (cultivator.breakthroughBuff || 0));

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
          storySummary: summaryText || undefined,
        });

        const [updatedCultivator, event] = await prisma.$transaction([
          prisma.cultivator.update({
            where: { id: cultivator.id },
            data: {
              realm: result.newRealm,
              realmLevel: result.newLevel,
              cultivationExp: result.newExp,
              breakthroughCount: { increment: 1 },
              breakthroughBuff: 0, // 消耗破境丹 buff
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

        const newEntry = createEntry(narrative.title, narrative.narrative, true, narrative.summary);
        await saveEntries([...currentEntries, newEntry]);

        // 重新读取以获取最新的 storyEntries
        const freshCultivator = await prisma.cultivator.findUnique({ where: { id: cultivator.id } });

        return NextResponse.json({
          event,
          narrative,
          cultivator: freshCultivator,
          isNewRealm: result.newRealm !== cultivator.realm,
        });
      }

      case "ENCOUNTER": {
        const narrative = await generateEncounterNarrative({
          cultivatorName: cultivator.name,
          spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
          realm: cultivator.realm,
          realmLevel: cultivator.realmLevel,
          storySummary: summaryText || undefined,
        });

        // 追加概要，超长则压缩
        const newEntry = createEntry(narrative.title, narrative.narrative, true, narrative.summary);

        // 如果用户做了选择
        if (choiceIndex !== undefined && narrative.choices[choiceIndex]) {
          const choice = narrative.choices[choiceIndex];
          const expBonus =
            choice.risk === "high" ? 50 : choice.risk === "medium" ? 30 : 15;

          const [event] = await prisma.$transaction([
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

          await saveEntries([...currentEntries, newEntry]);

          return NextResponse.json({
            event,
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

        await saveEntries([...currentEntries, newEntry]);

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