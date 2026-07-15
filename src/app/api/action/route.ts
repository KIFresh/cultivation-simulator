import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionById, calculateActionExp, canBreakthrough, MORTAL_REALM, isAwakened, calculateMaxStamina, getLocationActionBonus } from "@/lib";
import { TECHNIQUES, calculateTechniqueBonuses, addProficiency, getDefaultStudyNarrative, triggerStudyEvent } from "@/lib/technique-data";
import { generateActionNarrative, type StoryEntry, createEntry, buildSummaryFromEntries, compressStorySummary } from "@/lib/narrative";
import { sanitizeAttributes } from "@/lib/utils";
import { resolveCombat, getCombatNarrativeText, type PlayerCombatData } from "@/lib/combat-engine";
import { getEnemiesForLocation } from "@/lib/enemy-data";


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, actionId, freeInput, worldId } = body;
    if (!userId || !actionId) return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });

    const action = getActionById(actionId);
    if (!action) return NextResponse.json({ error: "无效的行动类型" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { cultivator: true } });
    if (!user?.cultivator) return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });

    const cultivator = user.cultivator;
    if (cultivator.stamina < action.actionPointCost) return NextResponse.json({ error: `行动力不足` }, { status: 400 });

    const isEarth = cultivator.worldId === "earth";
    if (isEarth && cultivator.age < action.minAgeEarth) return NextResponse.json({ error: `年龄不足` }, { status: 400 });

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
    let newExp = cultivator.cultivationExp + expGained, newTotalExp = cultivator.totalExp + expGained;
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
      actionDescription: action.description, freeInput, expGained,
      isAwakened: isAwakened(newRealm), awakenEvent: !!awakenEvent,
      storySummary: summaryText || undefined,
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
    const txOps: any[] = [];
    const updateData: Record<string, any> = { stamina: { decrement: action.actionPointCost }, cultivationExp: newExp, totalExp: newTotalExp, realm: newRealm, realmLevel: newRealmLevel, storyEntries: JSON.stringify(updatedEntries), storyEntriesUpdatedAt: new Date() };
    // 探索类行动触发战斗（updateData 已就绪）
    let combatResult = null;
    if (action.category === "explore" && !["home", "kindergarten", "school"].includes(locationId) && cultivator.realm !== "凡人") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const combatCount = await prisma.gameEvent.count({
        where: { cultivatorId: cultivator.id, type: "COMBAT", createdAt: { gte: today } },
      });
      if (combatCount < 5 && Math.random() < 0.3) {
        const enemies = getEnemiesForLocation(locationId, cultivator.realm);
        if (enemies.length > 0) {
          const player: PlayerCombatData = {
            cultivator: { id: cultivator.id, realm: cultivator.realm, realmLevel: cultivator.realmLevel, gold: cultivator.gold ?? 50, reincarnationCount: cultivator.reincarnationCount || 0, injuryDebuff: cultivator.injuryDebuff || 0 },
            attributes: safeAttrs,
            equippedItems: [],
            techniqueRecords: techniqueRecords.map((r) => ({ techniqueId: r.techniqueId, level: r.level })),
          };
          try {
            const parsed = JSON.parse(cultivator.inventory || "[]");
            for (const item of parsed) { if (item.equipped) player.equippedItems.push({ itemId: item.itemId }); }
          } catch {}
          combatResult = await resolveCombat(player, undefined, locationId);
          if (combatResult?.enemy?.id && combatResult.enemy.id !== "none") {
            const combatGold = combatResult.win ? (combatResult.loot?.gold || 0) : -(combatResult.penalty?.goldLoss || 0);
            const combatExpGain = combatResult.win ? (combatResult.loot?.exp || 0) : 0;
            newExp += combatExpGain;
            newTotalExp += combatExpGain;
            if (combatGold !== 0) updateData.gold = { increment: combatGold };
            if (!combatResult.win && combatResult.penalty?.injuryDebuff) {
              updateData.injuryDebuff = combatResult.penalty.injuryDebuff;
            }
            txOps.push(prisma.gameEvent.create({
              data: { cultivatorId: cultivator.id, type: "COMBAT", title: combatResult.win ? "战斗胜利" : "战斗失败", narrative: combatResult.narrative, reward: JSON.stringify({ win: combatResult.win, style: combatResult.style, gold: combatGold, exp: combatExpGain, enemy: combatResult.enemy.name }) },
            }));
          }
        }
      }
    }

    if ((cultivator.injuryDebuff || 0) > 0) updateData.injuryDebuff = Math.max(0, (cultivator.injuryDebuff || 0) - 1);
    txOps.push(prisma.cultivator.update({ where: { id: cultivator.id }, data: updateData }));
    txOps.push(prisma.gameEvent.create({ data: { cultivatorId: cultivator.id, type: "ACTION", title: narrativeResult.title, narrative: narrativeResult.narrative, reward: JSON.stringify({ expGained, actionName: action.name, mood: narrativeResult.mood }) } }));

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

        txOps.push(prisma.cultivatorTechnique.update({
          where: { id: record.id },
          data: { level: result.newLevel, proficiency: result.newProficiency },
        }));
      }
    }

    // 如果有觉醒事件，也持久化
    if (awakenEvent) {
      txOps.push(prisma.gameEvent.create({
        data: { cultivatorId: cultivator.id, type: "AWAKENING", title: awakenEvent.title, narrative: awakenEvent.narrative, reward: JSON.stringify({ mood: "奇" }) },
      }));
    }

    const [updatedCultivator] = await prisma.$transaction(txOps);

    const canBreak = canBreakthrough(newRealm, newRealmLevel, newExp, cultivator.spiritualRoot);

    const capped = { ...updatedCultivator, stamina: Math.min(updatedCultivator.stamina, calculateMaxStamina(updatedCultivator.age, safeAttrs)) };
    return NextResponse.json({ narrative: narrativeResult, cultivator: capped, expGained, canBreakthrough: canBreak, awakenEvent, techniqueEvents });
  } catch (error) {
    console.error("行动执行失败:", error);
    return NextResponse.json({ error: "行动执行失败" }, { status: 500 });
  }
}