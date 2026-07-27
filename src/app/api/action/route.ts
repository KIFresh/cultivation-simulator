// ═══════════════════════════════════════════════════════════════════════════
// action/route.ts — 行动执行 API
// 职责：
// 1. 接收行动请求，校验前提（年龄、境界、体力）
// 2. 调用 combat-engine 处理战斗
// 3. 效果经由 clampEffectsArray + applyEffects 统一持久化
// 4. 白名单校验：效果 kind 必须在 ACTION 白名单内
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { getActionById, calculateActionExp, canBreakthrough, MORTAL_REALM, isAwakened, calculateMaxStamina, getLocationActionBonus, REALM_ORDER } from "@/lib";
import { TECHNIQUES, calculateTechniqueBonuses, addProficiency, getDefaultStudyNarrative, triggerStudyEvent } from "@/lib/technique-data";
import { generateActionNarrative, type StoryEntry, createEntry, buildSummaryFromEntries, compressStorySummary, stateFromCultivator } from "@/lib/narrative";
import { streamNarrativeResult } from "@/lib/narrative-stream";
import { sanitizeAttributes } from "@/lib/utils";
import { resolveCombat, type PlayerCombatData } from "@/lib/combat-engine";
import { getEnemiesForLocation } from "@/lib/enemy-data";
import { applyEffects, clampEffectsArray, type NarrativeEffect, type ApplyContext } from "@/lib/narrative-effects";
import { NARRATIVE_EFFECT_WHITELISTS, checkEffectWhitelist } from "@/lib/narrative-schema";
import { getGoldMaxGainByRealm } from "@/lib/gold";


export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const { actionId, freeInput, worldId } = body;
    const isStream = new URL(request.url).searchParams.get("stream") === "true";
    if (!actionId) return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });

    const action = getActionById(actionId);
    if (!action) return NextResponse.json({ error: "无效的行动类型" }, { status: 400 });

    if (cultivator.stamina < action.actionPointCost) return NextResponse.json({ error: `行动力不足` }, { status: 400 });

    const isEarth = cultivator.worldId === "earth";
    if (isEarth && cultivator.age < action.minAgeEarth) return NextResponse.json({ error: `年龄不足` }, { status: 400 });

    const cultivatorRealmIndex = REALM_ORDER.indexOf(cultivator.realm);
    if (action.minRealm && REALM_ORDER.indexOf(action.minRealm) > cultivatorRealmIndex) {
      return NextResponse.json({ error: `境界不足，需要${action.minRealm}` }, { status: 400 });
    }

    // 计算功法加成
    const techniqueRecords = await prisma.cultivatorTechnique.findMany({
      where: { cultivatorId: cultivator.id, equipSlot: { not: null } },
    });
    const techniqueBonuses = calculateTechniqueBonuses(
      techniqueRecords.map((r) => ({ technique: TECHNIQUES[r.techniqueId], level: r.level }))
    );

    const safeAttrs = sanitizeAttributes(body.attributes) || {};
    const locationId = cultivator.location || "home";
    const locationBonus = getLocationActionBonus(locationId, actionId);
    const expGained = calculateActionExp(actionId, cultivator.spiritualRoot, safeAttrs, JSON.parse(cultivator.talents || '[]'), cultivator.reincarnationCount || 0, techniqueBonuses, locationBonus, cultivator.injuryDebuff || 0);
    let newRealm = cultivator.realm, newRealmLevel = cultivator.realmLevel;
    // 修炼值仅与修炼相关：常规行动不再加成
    let newExp = cultivator.cultivationExp, newTotalExp = cultivator.totalExp;
    let awakenEvent: { title: string; narrative: string } | null = null;

    if (isEarth && cultivator.realm === MORTAL_REALM && cultivator.age >= 16) {
      newRealm = "炼气期"; newRealmLevel = 1;
      awakenEvent = { title: "灵气觉醒", narrative: `${cultivator.name}终于感知到了天地间的灵气！` };
    }

    const currentEntries: StoryEntry[] = JSON.parse(cultivator.storyEntries || '[]');
    const summaryText = buildSummaryFromEntries(currentEntries);

    const narrativeResult = await generateActionNarrative({
      cultivatorName: cultivator.name, spiritualRoot: cultivator.spiritualRoot,
      realm: newRealm, realmLevel: newRealmLevel, age: cultivator.age,
      worldId: cultivator.worldId || worldId, actionName: action.name,
      actionDescription: action.description, freeInput, expGained: 0,
      isAwakened: isAwakened(newRealm), awakenEvent: !!awakenEvent,
      storySummary: summaryText || undefined,
      state: { ...stateFromCultivator(cultivator), realm: newRealm, realmLevel: newRealmLevel },
    });

    // 创建新条目 + 追加 + 压缩
    const newEntry = createEntry(narrativeResult.title, narrativeResult.narrative, true, narrativeResult.summary);
    let updatedEntries = [...currentEntries, newEntry];
    const newSummary = buildSummaryFromEntries(updatedEntries);
    if (updatedEntries.length > 50 || newSummary.length > 1000) {
      const compressed = await compressStorySummary(updatedEntries, cultivator.name);
      const ce = createEntry("📜 记忆凝练", compressed, false);
      updatedEntries = [...updatedEntries.filter(e => e.important), ce];
    }

    // 构建事务操作
    const updateData: Record<string, any> = { cultivationExp: newExp, totalExp: newTotalExp, realm: newRealm, realmLevel: newRealmLevel, storyEntries: JSON.stringify(updatedEntries), storyEntriesUpdatedAt: new Date() };
    // 探索类行动触发战斗（updateData 已就绪）
    let combatResult = null;
    let combatExpGain = 0;
    if (action.category === "explore" && !["home", "kindergarten", "school"].includes(locationId) && cultivator.realm !== "凡人") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const combatCount = await prisma.gameEvent.count({
        where: { cultivatorId: cultivator.id, type: "COMBAT", createdAt: { gte: today } },
      });
      if (combatCount < 5 && Math.random() < 0.3) {
        const enemies = getEnemiesForLocation(locationId, cultivator.realm);
        if (enemies.length > 0) {
          const player: PlayerCombatData = {
            cultivator: { id: cultivator.id, name: cultivator.name, realm: cultivator.realm, realmLevel: cultivator.realmLevel, gold: cultivator.gold ?? 50, reincarnationCount: cultivator.reincarnationCount || 0, injuryDebuff: cultivator.injuryDebuff || 0, mindDemon: cultivator.mindDemon || 0 },
            attributes: safeAttrs,
            equippedItems: [],
            inventory: [],
            techniqueRecords: techniqueRecords.map((r) => ({ techniqueId: r.techniqueId, level: r.level })),
          };
          try {
            const parsed = JSON.parse(cultivator.inventory || "[]");
            for (const item of parsed) { if (item.equipped) player.equippedItems.push({ itemId: item.itemId }); player.inventory!.push({ itemId: item.itemId, quantity: item.quantity ?? 1, equipped: !!item.equipped }); }
          } catch {}
          combatResult = await resolveCombat(player, undefined, locationId);
          if (combatResult?.enemy?.id && combatResult.enemy.id !== "none") {
            const combatGold = combatResult.win ? (combatResult.loot?.gold || 0) : -(combatResult.penalty?.goldLoss || 0);
            // 修炼值仅与修炼相关，战斗不再加成（combatExpGain 保留为 0）
            combatExpGain = 0;
            if (!combatResult.win && combatResult.penalty?.injuryDebuff) {
              updateData.injuryDebuff = Math.max(updateData.injuryDebuff ?? 0, combatResult.penalty.injuryDebuff);
            }
            // 道消处理
            if (!combatResult.win && combatResult.penalty?.daoXiao) {
              return NextResponse.json({
                daoXiao: true,
                summary: {
                  age: cultivator.age,
                  realm: cultivator.realm,
                  realmLevel: cultivator.realmLevel,
                  breakthroughCount: cultivator.breakthroughCount,
                  reincarnationCount: cultivator.reincarnationCount || 0,
                  totalExp: cultivator.totalExp,
                },
              });
            }
            // 寿元损失
            if (!combatResult.win && combatResult.penalty?.lifespanLoss) {
              const currentMax = updateData.maxAge ?? cultivator.maxAge ?? 80;
              updateData.maxAge = Math.max(1, currentMax - combatResult.penalty.lifespanLoss);
            }
            // 道心受损（档0）
            if (!combatResult.win && combatResult.penalty?.mindDemonDelta) {
              updateData.mindDemon = { increment: combatResult.penalty.mindDemonDelta };
            }
            // 扣物（档1）
            if (!combatResult.win && combatResult.penalty?.itemLoss && combatResult.penalty.itemLoss.length > 0) {
              const currentInv = JSON.parse(cultivator.inventory || "[]");
              for (const lostId of combatResult.penalty.itemLoss) {
                const idx = currentInv.findIndex((i: any) => i.itemId === lostId && !i.equipped);
                if (idx !== -1) {
                  currentInv[idx].quantity = (currentInv[idx].quantity ?? 1) - 1;
                  if (currentInv[idx].quantity <= 0) currentInv.splice(idx, 1);
                }
              }
              updateData.inventory = JSON.stringify(currentInv);
            }
            // Bug 15: 同步叙事 mood/summary 为战斗风格
            narrativeResult.mood = combatResult.win ? "燃" : "险";
            // 战斗叙事替代行动叙事
            narrativeResult.narrative = combatResult.narrative;
            narrativeResult.title = combatResult.win ? "战斗胜利" : "战斗失败";
          }
        }
      }
    }

    // 构建效果数组（体力消耗 + 战斗金币，由效果契约层统一处理）
    const effects: NarrativeEffect[] = [
      { kind: "stamina", delta: -action.actionPointCost },
    ];
    let combatGold = 0;
    if (combatResult?.enemy?.id && combatResult.enemy.id !== "none") {
      combatGold = combatResult.win ? (combatResult.loot?.gold || 0) : -(combatResult.penalty?.goldLoss || 0);
      if (combatGold !== 0) {
        effects.push({ kind: "gold", delta: combatGold });
      }
    }
    // 白名单校验：拒绝不在 ACTION 允许范围内的效果
    const deniedKinds = checkEffectWhitelist(effects, NARRATIVE_EFFECT_WHITELISTS.ACTION);
    if (deniedKinds.length > 0) {
      console.warn(`action/route: 拒绝白名单外效果 kind: ${deniedKinds.join(", ")}`);
      const filtered = effects.filter((e) => !deniedKinds.includes(e.kind));
      effects.length = 0;
      effects.push(...filtered);
    }
    const clamped = clampEffectsArray(effects, {
      currentGold: cultivator.gold ?? 0,
      currentStamina: cultivator.stamina,
      maxStamina: calculateMaxStamina(cultivator.age, safeAttrs),
      maxGoldAbsDelta: getGoldMaxGainByRealm(cultivator.realmLevel ?? 0),
    });
    const ctx: ApplyContext = {
      cultivatorId: cultivator.id,
      currentGold: cultivator.gold ?? 0,
      currentStamina: cultivator.stamina,
      maxStamina: calculateMaxStamina(cultivator.age, safeAttrs),
    };

    // 从 updateData 移除 stamina/gold（由效果契约层处理）
    const { stamina: _s, gold: _g, ...restUpdateData } = updateData;

    // 收集功法熟练度更新操作（事务内执行）
    const techniqueUpdateOps: Array<{ id: string; data: { level: number; proficiency: number } }> = [];

    // 研读功法：增加熟练度 + 随机事件
    let techniqueEvents: { techniqueName: string; icon: string; profGained: number; leveledUp: boolean; eventNarrative?: string }[] = [];
    if (actionId === "STUDY") {
      const insight = safeAttrs.insight ?? 0;
      const baseProf = 5 + Math.floor(insight / 5);

      for (const record of techniqueRecords) {
        const tech = TECHNIQUES[record.techniqueId];
        if (!tech) continue;

        let profGained = baseProf;
        let eventNarrative: string | undefined;

        const triggered = triggerStudyEvent(insight, tech.name);
        if (triggered) {
          profGained += triggered.event.extraProf;
          eventNarrative = triggered.narrative;
        }

        const result = addProficiency(record.level, record.proficiency, tech.upgradeProficiency, profGained);
        techniqueEvents.push({
          techniqueName: tech.name,
          icon: tech.icon,
          profGained,
          leveledUp: result.leveledUp,
          eventNarrative,
        });

        techniqueUpdateOps.push({
          id: record.id,
          data: { level: result.newLevel, proficiency: result.newProficiency },
        });
      }
    }

    // 事务化：效果契约 + 数据更新 + 事件 + 功法
    let actionEvent: { id: string } | null = null;
    const updatedCultivator = await prisma.$transaction(async (tx) => {
      // 1. 应用效果契约（体力消耗、金币变动）
      if (clamped.length > 0) {
        await applyEffects(clamped, tx, ctx);
      }

      // 2. 更新修炼者主数据（exp、境界、记忆等，不含 stamina/gold）
      const updated = await tx.cultivator.update({
        where: { id: cultivator.id },
        data: restUpdateData,
      });

      // 3. 创建战斗事件（有战斗时）
      if (combatResult?.enemy?.id && combatResult.enemy.id !== "none") {
        const combatEvent = await tx.gameEvent.create({
          data: { cultivatorId: cultivator.id, type: "COMBAT", title: combatResult.win ? "战斗胜利" : "战斗失败", narrative: combatResult.narrative, reward: JSON.stringify({ win: combatResult.win, style: combatResult.style, gold: combatGold, exp: combatExpGain, enemy: combatResult.enemy.name }) },
        });
        actionEvent = { id: combatEvent.id };
      } else {
        // 4. 创建行动叙事事件（无战斗时）
        const ae = await tx.gameEvent.create({
          data: { cultivatorId: cultivator.id, type: "ACTION", title: narrativeResult.title, narrative: narrativeResult.narrative, reward: JSON.stringify({ expGained, actionName: action.name, mood: narrativeResult.mood }) },
        });
        actionEvent = { id: ae.id };
      }

      // 5. 功法熟练度更新
      for (const op of techniqueUpdateOps) {
        await tx.cultivatorTechnique.update({ where: { id: op.id }, data: op.data });
      }

      // 6. 觉醒事件
      if (awakenEvent) {
        await tx.gameEvent.create({
          data: { cultivatorId: cultivator.id, type: "AWAKENING", title: awakenEvent.title, narrative: awakenEvent.narrative, reward: JSON.stringify({ mood: "奇" }) },
        });
      }

      return updated;
    });

    const canBreak = canBreakthrough(newRealm, newRealmLevel, newExp, cultivator.spiritualRoot);

    const capped = { ...updatedCultivator, stamina: Math.min(updatedCultivator.stamina, calculateMaxStamina(updatedCultivator.age, safeAttrs)) };
    const actionResult = { narrative: narrativeResult, cultivator: capped, expGained, combatExpGain, canBreakthrough: canBreak, awakenEvent, techniqueEvents };
    const evtId = (actionEvent as { id: string } | null)?.id;
    if (isStream) {
      return streamNarrativeResult(evtId ?? capped.id, narrativeResult, actionResult, capped);
    }
    return NextResponse.json(actionResult);
  } catch (error) {
    console.error("行动执行失败:", error);
    return NextResponse.json({ error: "行动执行失败" }, { status: 500 });
  }
}