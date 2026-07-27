import { NextRequest, NextResponse } from "next/server";
// ═══════════════════════════════════════════════════════════════════════════
// narrative/route.ts — 叙事生成 API
// 职责：
// 1. 接收叙事请求（DAILY/ENCOUNTER/BREAKTHROUGH/BIRTH），调用 generate* 函数
// 2. 效果白名单校验（每种叙事类型有独立的 whitelist）
// 3. 效果经由 clampEffectsArray + applyEffects 统一持久化
// 4. 支持流式与非流式响应
// ═══════════════════════════════════════════════════════════════════════════

import {
  generateDailyCultivationNarrative,
  generateBreakthroughNarrative,
  generateEncounterNarrative,
  generateBirthNarrative,
  type StoryEntry,
  type BirthFamilyMember,
  createEntry,
  buildSummaryFromEntries,
  compressStorySummary,
  stateFromCultivator,
} from "@/lib/narrative";
import { prisma } from "@/lib/prisma";
import { getGoldMaxGainByRealm } from "@/lib/gold";
import { canBreakthrough, performBreakthrough } from "@/lib";
import { TECHNIQUES, addProficiency, calculateTechniqueBonuses } from "@/lib/technique-data";
import { streamNarrativeResult } from "@/lib/narrative-stream";
import { applyEffects, clampEffectsArray, type NarrativeEffect, type ApplyContext } from "@/lib/narrative-effects";
import { NARRATIVE_EFFECT_WHITELISTS, checkEffectWhitelist } from "@/lib/narrative-schema";
import { sanitizeAttributes } from "@/lib/utils";
import { calculateMaxStamina } from "@/lib/cultivation-data";
import { requireCultivator } from "@/lib/auth-helpers";

// POST — 生成叙事 + 处理突破
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const { type, taskType, taskDescription, choiceIndex } = body;
    const isStream = new URL(request.url).searchParams.get("stream") === "true";

    if (!type) {
      return NextResponse.json(
        { error: "缺少必填参数" },
        { status: 400 }
      );
    }

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

    // 记忆压缩辅助函数（事务内使用，只计算不写库）
    const buildFinalEntries = async (newEntries: StoryEntry[], cultivatorName: string): Promise<StoryEntry[]> => {
      const summaryText = buildSummaryFromEntries(newEntries);
      if (newEntries.length > 50 || summaryText.length > 1000) {
        const compressedText = await compressStorySummary(newEntries, cultivatorName);
        const compressedEntry = createEntry("📜 记忆凝练", compressedText, false);
        const importantEntries = newEntries.filter(e => e.important);
        return [...importantEntries, compressedEntry];
      }
      return newEntries;
    };

    switch (type) {
      case "BIRTH": {
        const narrative = await generateBirthNarrative({
          cultivatorName: cultivator.name,
          worldName: body.worldName || "现代都市",
          identityName: body.identityName || "寻常人家",
          birthTier: body.birthTier,
          worldId: body.worldId,
          family: body.family || [],
          storySummary: summaryText || undefined,
        });

        // ── suggestedName 验证 ────────────────────────────
        // generateBirthNarrative 内部已验证，此处再次确保
        const finalName = (narrative.suggestedName || "").trim();
        const safeName = /^[\u4e00-\u9fff]{2,4}$/.test(finalName)
          ? finalName
          : (cultivator.name || ["小石头","小宝","阿福"][Math.floor(Math.random()*3)]);

        let event;
        let updatedCultivator;
        let savedFamily: { relation: string; name: string; age: number; alive: boolean; occupation: string | null; intimacy: number }[] = [];

        try {
          // 单事务：姓名 + GameEvent + storyEntries + 家庭成员一起写入
          const result = await prisma.$transaction(async (tx) => {
            // 1) 更新修炼者姓名
            const updated = await tx.cultivator.update({
              where: { id: cultivator.id },
              data: { name: safeName },
            });

            // 2) 创建 GameEvent
            const evt = await tx.gameEvent.create({
              data: {
                cultivatorId: cultivator.id,
                type: "BIRTH",
                title: narrative.title,
                narrative: narrative.narrative,
                reward: JSON.stringify({ mood: narrative.mood }),
              },
            });

            // 3) 写入 storyEntries
            const newEntry = createEntry(narrative.title, narrative.narrative, true, narrative.summary);
            let finalEntries = [...currentEntries, newEntry];
            const newSummaryText = buildSummaryFromEntries(finalEntries);
            if (finalEntries.length > 50 || newSummaryText.length > 1000) {
              const compressedText = await compressStorySummary(finalEntries, safeName);
              const compressedEntry = createEntry("📜 记忆凝练", compressedText, false);
              const importantEntries = finalEntries.filter(e => e.important);
              finalEntries = [...importantEntries, compressedEntry];
            }
            await tx.cultivator.update({
              where: { id: cultivator.id },
              data: {
                storyEntries: JSON.stringify(finalEntries),
                storyEntriesUpdatedAt: new Date(),
              },
            });

            // 4) 替换家庭成员：先删旧成员，再写入叙事中的新成员
            await tx.familyMember.deleteMany({ where: { cultivatorId: cultivator.id } });
            const members = (narrative.family || [])
              .filter((m: BirthFamilyMember) => m.relation?.trim() && m.name?.trim())
              .map((m: BirthFamilyMember) => ({
                cultivatorId: cultivator.id,
                relation: m.relation.trim(),
                name: m.name.trim(),
                age: m.age,
                alive: m.alive,
                occupation: m.occupation || null,
                intimacy: 50,
              }));
            if (members.length > 0) {
              await tx.familyMember.createMany({ data: members });
            }

            return { event: evt, updated, family: members };
          });

          event = result.event;
          updatedCultivator = result.updated;
          savedFamily = result.family || [];
        } catch (e) {
          console.error("BIRTH: 事务写入失败", e);
          return NextResponse.json({ error: `BIRTH写入失败: ${(e as Error).message}` }, { status: 500 });
        }

        const birthPayload = {
          event,
          narrative,
          family: savedFamily,  // 来自实际落库的数据
          suggestedName: safeName,
          cultivator: updatedCultivator,
        };

        if (isStream) {
          return streamNarrativeResult(event.id, narrative, birthPayload, updatedCultivator);
        }
        return NextResponse.json(birthPayload);
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
          state: stateFromCultivator(cultivator),
        });

        // 1) 优先使用 AI 直接输出的 effects，否则从 goldChange 转换
        const effects: NarrativeEffect[] = [];
        if (narrative.effects && narrative.effects.length > 0) {
          effects.push(...narrative.effects);
        } else if (narrative.goldChange) {
          effects.push({ kind: "gold", delta: narrative.goldChange });
        }

        // 效果白名单校验（DAILY: gold/stamina/attrExp/storyEntry/mood）
        const deniedKinds = checkEffectWhitelist(effects, NARRATIVE_EFFECT_WHITELISTS.DAILY_CULTIVATION);
        if (deniedKinds.length > 0) {
          console.warn(`DAILY_CULTIVATION: 拒绝白名单外效果 kind: ${deniedKinds.join(", ")}`);
          const allowed = effects.filter((e) => !deniedKinds.includes(e.kind));
          effects.length = 0;
          effects.push(...allowed);
        }

        const clamped = clampEffectsArray(effects, {
          currentGold: cultivator.gold ?? 0,
          currentStamina: cultivator.stamina,
          maxStamina: calculateMaxStamina(cultivator.age, sanitizeAttributes(cultivator.attributes) ?? undefined),
          maxGoldAbsDelta: getGoldMaxGainByRealm(cultivator.realmLevel ?? 0),
        });
        const ctx: ApplyContext = {
          cultivatorId: cultivator.id,
          currentGold: cultivator.gold ?? 0,
          currentStamina: cultivator.stamina,
          maxStamina: calculateMaxStamina(cultivator.age, sanitizeAttributes(cultivator.attributes) ?? undefined),
        };
        const goldEffect = clamped.find((e) => e.kind === "gold") as { kind: "gold"; delta: number } | undefined;
        const actualGoldDelta = goldEffect?.delta ?? 0;

        // 事务化：游戏事件 + 记忆 + 效果契约
        const newEntry = createEntry(narrative.title, narrative.narrative, true, narrative.summary);
        const finalEntries = await buildFinalEntries([...currentEntries, newEntry], cultivator.name);

        // 增加功法熟练度
        const techniqueRecords = await prisma.cultivatorTechnique.findMany({
          where: { cultivatorId: cultivator.id, equipSlot: { not: null } },
        });
        let levelUpMessages: string[] = [];
        const techniqueDataList: Array<{ id: string; data: { level: number; proficiency: number } }> = [];
        for (const r of techniqueRecords) {
          const t = TECHNIQUES[r.techniqueId];
          if (!t) continue;
          const result = addProficiency(r.level, r.proficiency, t.upgradeProficiency, Math.floor(Math.random() * 6) + 5);
          if (result.leveledUp) {
            levelUpMessages.push(`${t.name} 升级至 Lv.${result.newLevel}！`);
          }
          techniqueDataList.push({ id: r.id, data: { level: result.newLevel, proficiency: result.newProficiency } });
        }

        // 事务化：游戏事件 + 效果契约 + 记忆 + 功法熟练度
        const event = await prisma.$transaction(async (tx) => {
          const evt = await tx.gameEvent.create({
            data: {
              cultivatorId: cultivator.id,
              type: "DAILY_CULTIVATION",
              title: narrative.title,
              narrative: narrative.narrative,
              reward: JSON.stringify({ mood: narrative.mood, hint: narrative.hint, goldChange: actualGoldDelta }),
            },
          });
          if (clamped.length > 0) {
            await applyEffects(clamped, tx, ctx);
          }
          // 记忆持久化
          await tx.cultivator.update({
            where: { id: cultivator.id },
            data: { storyEntries: JSON.stringify(finalEntries), storyEntriesUpdatedAt: new Date() },
          });
          // 功法熟练度
          for (const td of techniqueDataList) {
            await tx.cultivatorTechnique.update({ where: { id: td.id }, data: td.data });
          }
          return evt;
        });
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

        const dailyResult = { event, narrative: { ...narrative, hint: narrativeHint, goldChange: actualGoldDelta }, canBreakthrough: canBreak };
        if (isStream) {
          return streamNarrativeResult(event.id, narrative, dailyResult, cultivator);
        }
        return NextResponse.json(dailyResult);
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
          cultivator.cultivationExp,
          totalBuff
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
          state: { ...stateFromCultivator(cultivator), realm: result.newRealm, realmLevel: result.newLevel },
        });

        const newEntry = createEntry(narrative.title, narrative.narrative, true, narrative.summary);
        const finalEntries = await buildFinalEntries([...currentEntries, newEntry], cultivator.name);

        const [updatedCultivator, event] = await prisma.$transaction([
          prisma.cultivator.update({
            where: { id: cultivator.id },
            data: {
              realm: result.newRealm,
              realmLevel: result.newLevel,
              cultivationExp: result.newExp,
              breakthroughCount: { increment: 1 },
              breakthroughBuff: 0,
              storyEntries: JSON.stringify(finalEntries),
              storyEntriesUpdatedAt: new Date(),
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

        // 重新读取以获取最新的 storyEntries
        const freshCultivator = await prisma.cultivator.findUnique({ where: { id: cultivator.id } });

        const breakthroughResult = {
          event,
          narrative,
          cultivator: freshCultivator,
          isNewRealm: result.newRealm !== cultivator.realm,
        };
        if (isStream) {
          return streamNarrativeResult(event.id, narrative, breakthroughResult, freshCultivator);
        }
        return NextResponse.json(breakthroughResult);
      }

      case "ENCOUNTER": {
        const narrative = await generateEncounterNarrative({
          cultivatorName: cultivator.name,
          spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
          realm: cultivator.realm,
          realmLevel: cultivator.realmLevel,
          storySummary: summaryText || undefined,
          state: {
            name: cultivator.name, age: cultivator.age, realm: cultivator.realm, realmLevel: cultivator.realmLevel,
            gold: cultivator.gold, stamina: cultivator.stamina, locationId: cultivator.location || "home",
            attributes: cultivator.attributes,
          },
        });

        // 追加概要，超长则压缩
        const newEntry = createEntry(narrative.title, narrative.narrative, true, narrative.summary);

        // 如果用户做了选择
        if (choiceIndex !== undefined && narrative.choices[choiceIndex]) {
          const choice = narrative.choices[choiceIndex];
          // 修炼值仅与修炼相关，常规行动/奇遇不再加成
          const expBonus = 0;

          // 构建效果数组（优先使用 AI effects，否则从 goldChange 转换）
          const effects: NarrativeEffect[] = [];
          if (narrative.effects && narrative.effects.length > 0) {
            effects.push(...narrative.effects);
          } else if (narrative.goldChange) {
            effects.push({ kind: "gold", delta: narrative.goldChange });
          }

          // 效果白名单校验（ENCOUNTER: gold/stamina/health/attrExp/storyEntry/mood）
          const deniedKinds = checkEffectWhitelist(effects, NARRATIVE_EFFECT_WHITELISTS.ENCOUNTER);
          if (deniedKinds.length > 0) {
            console.warn(`ENCOUNTER(有选择): 拒绝白名单外效果 kind: ${deniedKinds.join(", ")}`);
            const allowed = effects.filter((e) => !deniedKinds.includes(e.kind));
            effects.length = 0;
            effects.push(...allowed);
          }
          const clamped = clampEffectsArray(effects, {
            currentGold: cultivator.gold ?? 0,
            currentStamina: cultivator.stamina,
            maxStamina: calculateMaxStamina(cultivator.age, sanitizeAttributes(cultivator.attributes) ?? undefined),
            maxGoldAbsDelta: getGoldMaxGainByRealm(cultivator.realmLevel ?? 0),
          });
          const ctx: ApplyContext = {
            cultivatorId: cultivator.id,
            currentGold: cultivator.gold ?? 0,
            currentStamina: cultivator.stamina,
            maxStamina: calculateMaxStamina(cultivator.age, sanitizeAttributes(cultivator.attributes) ?? undefined),
          };
          const goldEffect = clamped.find((e) => e.kind === "gold") as { kind: "gold"; delta: number } | undefined;
          const actualGoldDelta = goldEffect?.delta ?? 0;

          const finalEntries = await buildFinalEntries([...currentEntries, newEntry], cultivator.name);

          const event = await prisma.$transaction(async (tx) => {
            const evt = await tx.gameEvent.create({
              data: {
                cultivatorId: cultivator.id,
                type: "RANDOM_ENCOUNTER",
                title: narrative.title,
                narrative: narrative.narrative,
                choices: JSON.stringify(narrative.choices),
                chosenOption: choiceIndex,
                reward: JSON.stringify({ expBonus, goldChange: actualGoldDelta }),
              },
            });
            if (clamped.length > 0) {
              await applyEffects(clamped, tx, ctx);
            }
            // 记忆持久化
            await tx.cultivator.update({
              where: { id: cultivator.id },
              data: { storyEntries: JSON.stringify(finalEntries), storyEntriesUpdatedAt: new Date() },
            });
            return evt;
          });

          const encounterResult = { event, narrative, chosenOption: choiceIndex, expBonus, goldChange: actualGoldDelta };
          if (isStream) {
            return streamNarrativeResult(event.id, narrative, encounterResult, cultivator);
          }
          return NextResponse.json(encounterResult);
        }

        // 无选择分支：直接应用效果
        const effects: NarrativeEffect[] = [];
        if (narrative.effects && narrative.effects.length > 0) {
          effects.push(...narrative.effects);
        } else if (narrative.goldChange) {
          effects.push({ kind: "gold", delta: narrative.goldChange });
        }

        // 效果白名单校验（ENCOUNTER: gold/stamina/health/attrExp/storyEntry/mood）
        const deniedKinds = checkEffectWhitelist(effects, NARRATIVE_EFFECT_WHITELISTS.ENCOUNTER);
        if (deniedKinds.length > 0) {
          console.warn(`ENCOUNTER(无选择): 拒绝白名单外效果 kind: ${deniedKinds.join(", ")}`);
          const allowed = effects.filter((e) => !deniedKinds.includes(e.kind));
          effects.length = 0;
          effects.push(...allowed);
        }
        const clamped = clampEffectsArray(effects, {
          currentGold: cultivator.gold ?? 0,
          currentStamina: cultivator.stamina,
          maxStamina: calculateMaxStamina(cultivator.age, sanitizeAttributes(cultivator.attributes) ?? undefined),
          maxGoldAbsDelta: getGoldMaxGainByRealm(cultivator.realmLevel ?? 0),
        });
        const ctx: ApplyContext = {
          cultivatorId: cultivator.id,
          currentGold: cultivator.gold ?? 0,
          currentStamina: cultivator.stamina,
          maxStamina: calculateMaxStamina(cultivator.age, sanitizeAttributes(cultivator.attributes) ?? undefined),
        };
        const goldEffect = clamped.find((e) => e.kind === "gold") as { kind: "gold"; delta: number } | undefined;
        const actualGoldDelta = goldEffect?.delta ?? 0;

        const finalEntries = await buildFinalEntries([...currentEntries, newEntry], cultivator.name);

        // 事务化：事件 + 效果契约 + 记忆
        const event = await prisma.$transaction(async (tx) => {
          const evt = await tx.gameEvent.create({
            data: {
              cultivatorId: cultivator.id,
              type: "RANDOM_ENCOUNTER",
              title: narrative.title,
              narrative: narrative.narrative,
              choices: JSON.stringify(narrative.choices),
            },
          });
          if (clamped.length > 0) {
            await applyEffects(clamped, tx, ctx);
          }
          // 记忆持久化
          await tx.cultivator.update({
            where: { id: cultivator.id },
            data: { storyEntries: JSON.stringify(finalEntries), storyEntriesUpdatedAt: new Date() },
          });
          return evt;
        });

        const encounterResult = { event, narrative, goldChange: actualGoldDelta };
        if (isStream) {
          return streamNarrativeResult(event.id, narrative, encounterResult, cultivator);
        }
        return NextResponse.json(encounterResult);
      }

      default:
        return NextResponse.json(
          { error: "未知叙事类型" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("叙事生成失败:", error);
    const msg = process.env.NODE_ENV === "development"
      ? (error as Error).message || "生成失败，请重试"
      : "生成失败，请重试";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}