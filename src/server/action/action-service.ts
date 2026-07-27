import { prisma } from "@/lib/prisma";
import {
  getActionById,
  calculateActionExp,
  canBreakthrough,
  MORTAL_REALM,
  isAwakened,
  calculateMaxStamina,
  getLocationActionBonus,
  REALM_ORDER,
} from "@/lib";
import {
  TECHNIQUES,
  calculateTechniqueBonuses,
  addProficiency,
  getDefaultStudyNarrative,
  triggerStudyEvent,
} from "@/lib/technique-data";
import {
  generateActionNarrative,
  type StoryEntry,
  createEntry,
  buildSummaryFromEntries,
  compressStorySummary,
  stateFromCultivator,
} from "@/lib/narrative";
import { sanitizeAttributes } from "@/lib/utils";
import { resolveCombat, type PlayerCombatData } from "@/lib/combat-engine";
import { getEnemiesForLocation } from "@/lib/enemy-data";
import {
  applyEffects,
  clampEffectsArray,
  type NarrativeEffect,
  type ApplyContext,
} from "@/lib/narrative-effects";
import { NARRATIVE_EFFECT_WHITELISTS, checkEffectWhitelist } from "@/lib/narrative-schema";
import { getGoldMaxGainByRealm } from "@/lib/gold";

export interface ActionInput {
  actionId: string;
  freeInput?: string;
  worldId?: string;
  attributes?: Record<string, number>;
}

export interface TechniqueUpdate {
  id: string;
  data: { level: number; proficiency: number };
}

export type ActionResult =
  | { status: "success"; data: ActionResultData }
  | { status: "daoXiao"; summary: DaoXiaoSummary }
  | { status: "error"; message: string; code?: number };

export interface ActionResultData {
  narrativeResult: any;
  cultivator: any;
  expGained: number;
  combatExpGain: number;
  canBreakthrough: boolean;
  awakenEvent: { title: string; narrative: string } | null;
  techniqueEvents: {
    techniqueName: string;
    icon: string;
    profGained: number;
    leveledUp: boolean;
    eventNarrative?: string;
  }[];
  actionEventId?: string;
}

export interface DaoXiaoSummary {
  age: number;
  realm: string;
  realmLevel: number;
  breakthroughCount: number;
  reincarnationCount: number;
  totalExp: number;
}

export interface CombatPenalty {
  goldLoss?: number;
  injuryDebuff?: number;
  lifespanLoss?: number;
  mindDemonDelta?: number;
  itemLoss?: string[];
  daoXiao?: boolean;
}

export interface CombatResultLike {
  win: boolean;
  loot?: { gold?: number };
  penalty?: CombatPenalty;
  narrative: string;
  style?: string;
  enemy?: { id: string; name: string };
}

export async function executeAction(
  input: ActionInput,
  cultivator: any
): Promise<ActionResult> {
  const { actionId, freeInput, worldId, attributes } = input;

  const action = getActionById(actionId);
  if (!action) {
    return { status: "error", message: "无效的行动类型", code: 400 };
  }

  if (cultivator.stamina < action.actionPointCost) {
    return { status: "error", message: "行动力不足", code: 400 };
  }

  const isEarth = cultivator.worldId === "earth";
  if (isEarth && cultivator.age < action.minAgeEarth) {
    return { status: "error", message: "年龄不足", code: 400 };
  }

  const cultivatorRealmIndex = REALM_ORDER.indexOf(cultivator.realm);
  if (action.minRealm && REALM_ORDER.indexOf(action.minRealm) > cultivatorRealmIndex) {
    return {
      status: "error",
      message: `境界不足，需要${action.minRealm}`,
      code: 400,
    };
  }

  const techniqueRecords = await prisma.cultivatorTechnique.findMany({
    where: { cultivatorId: cultivator.id, equipSlot: { not: null } },
  });
  const techniqueBonuses = calculateTechniqueBonuses(
    techniqueRecords.map((r) => ({
      technique: TECHNIQUES[r.techniqueId],
      level: r.level,
    }))
  );

  const safeAttrs = sanitizeAttributes(attributes) || {};
  const locationId = cultivator.location || "home";
  const locationBonus = getLocationActionBonus(locationId, actionId);
  const expGained = calculateActionExp(
    actionId,
    cultivator.spiritualRoot,
    safeAttrs,
    JSON.parse(cultivator.talents || "[]"),
    cultivator.reincarnationCount || 0,
    techniqueBonuses,
    locationBonus,
    cultivator.injuryDebuff || 0
  );

  let newRealm = cultivator.realm;
  let newRealmLevel = cultivator.realmLevel;
  let awakenEvent: { title: string; narrative: string } | null = null;

  if (isEarth && cultivator.realm === MORTAL_REALM && cultivator.age >= 16) {
    newRealm = "炼气期";
    newRealmLevel = 1;
    awakenEvent = {
      title: "灵气觉醒",
      narrative: `${cultivator.name}终于感知到了天地间的灵气！`,
    };
  }

  const currentEntries: StoryEntry[] = JSON.parse(
    cultivator.storyEntries || "[]"
  );
  const summaryText = buildSummaryFromEntries(currentEntries);

  const narrativeResult = await generateActionNarrative({
    cultivatorName: cultivator.name,
    spiritualRoot: cultivator.spiritualRoot,
    realm: newRealm,
    realmLevel: newRealmLevel,
    age: cultivator.age,
    worldId: cultivator.worldId || worldId,
    actionName: action.name,
    actionDescription: action.description,
    freeInput,
    expGained: 0,
    isAwakened: isAwakened(newRealm),
    awakenEvent: !!awakenEvent,
    storySummary: summaryText || undefined,
    state: {
      ...stateFromCultivator(cultivator),
      realm: newRealm,
      realmLevel: newRealmLevel,
    },
  });

  const newEntry = createEntry(
    narrativeResult.title,
    narrativeResult.narrative,
    true,
    narrativeResult.summary
  );
  let updatedEntries = [...currentEntries, newEntry];
  const newSummary = buildSummaryFromEntries(updatedEntries);
  if (updatedEntries.length > 50 || newSummary.length > 1000) {
    const compressed = await compressStorySummary(
      updatedEntries,
      cultivator.name
    );
    const ce = createEntry("📜 记忆凝练", compressed, false);
    updatedEntries = [...updatedEntries.filter((e) => e.important), ce];
  }

  const updateData: Record<string, any> = {
    cultivationExp: cultivator.cultivationExp,
    totalExp: cultivator.totalExp,
    realm: newRealm,
    realmLevel: newRealmLevel,
    storyEntries: JSON.stringify(updatedEntries),
    storyEntriesUpdatedAt: new Date(),
  };

  let combatResult: CombatResultLike | null = null;
  let combatExpGain = 0;
  if (
    action.category === "explore" &&
    !["home", "kindergarten", "school"].includes(locationId) &&
    cultivator.realm !== "凡人"
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const combatCount = await prisma.gameEvent.count({
      where: {
        cultivatorId: cultivator.id,
        type: "COMBAT",
        createdAt: { gte: today },
      },
    });
    if (combatCount < 5 && Math.random() < 0.3) {
      const enemies = getEnemiesForLocation(locationId, cultivator.realm);
      if (enemies.length > 0) {
        const player: PlayerCombatData = {
          cultivator: {
            id: cultivator.id,
            name: cultivator.name,
            realm: cultivator.realm,
            realmLevel: cultivator.realmLevel,
            gold: cultivator.gold ?? 50,
            reincarnationCount: cultivator.reincarnationCount || 0,
            injuryDebuff: cultivator.injuryDebuff || 0,
            mindDemon: cultivator.mindDemon || 0,
          },
          attributes: safeAttrs,
          equippedItems: [],
          inventory: [],
          techniqueRecords: techniqueRecords.map((r) => ({
            techniqueId: r.techniqueId,
            level: r.level,
          })),
        };
        try {
          const parsed = JSON.parse(cultivator.inventory || "[]");
          for (const item of parsed) {
            if (item.equipped) player.equippedItems.push({ itemId: item.itemId });
            player.inventory!.push({
              itemId: item.itemId,
              quantity: item.quantity ?? 1,
              equipped: !!item.equipped,
            });
          }
        } catch {}
        combatResult = await resolveCombat(player, undefined, locationId);
        if (combatResult?.enemy?.id && combatResult.enemy.id !== "none") {
          const combatGold = combatResult.win
            ? combatResult.loot?.gold || 0
            : -(combatResult.penalty?.goldLoss || 0);
          combatExpGain = 0;
          if (!combatResult.win && combatResult.penalty?.injuryDebuff) {
            updateData.injuryDebuff = Math.max(
              updateData.injuryDebuff ?? 0,
              combatResult.penalty.injuryDebuff
            );
          }
          if (!combatResult.win && combatResult.penalty?.daoXiao) {
            return {
              status: "daoXiao",
              summary: {
                age: cultivator.age,
                realm: cultivator.realm,
                realmLevel: cultivator.realmLevel,
                breakthroughCount: cultivator.breakthroughCount,
                reincarnationCount: cultivator.reincarnationCount || 0,
                totalExp: cultivator.totalExp,
              },
            };
          }
          if (!combatResult.win && combatResult.penalty?.lifespanLoss) {
            const currentMax = updateData.maxAge ?? cultivator.maxAge ?? 80;
            updateData.maxAge = Math.max(
              1,
              currentMax - combatResult.penalty.lifespanLoss
            );
          }
          if (!combatResult.win && combatResult.penalty?.mindDemonDelta) {
            updateData.mindDemon = {
              increment: combatResult.penalty.mindDemonDelta,
            };
          }
          if (
            !combatResult.win &&
            combatResult.penalty?.itemLoss &&
            combatResult.penalty.itemLoss.length > 0
          ) {
            const currentInv = JSON.parse(cultivator.inventory || "[]");
            for (const lostId of combatResult.penalty.itemLoss) {
              const idx = currentInv.findIndex(
                (i: any) => i.itemId === lostId && !i.equipped
              );
              if (idx !== -1) {
                currentInv[idx].quantity =
                  (currentInv[idx].quantity ?? 1) - 1;
                if (currentInv[idx].quantity <= 0) currentInv.splice(idx, 1);
              }
            }
            updateData.inventory = JSON.stringify(currentInv);
          }
          narrativeResult.mood = combatResult.win ? "燃" : "险";
          narrativeResult.narrative = combatResult.narrative;
          narrativeResult.title = combatResult.win ? "战斗胜利" : "战斗失败";
        }
      }
    }
  }

  const effects: NarrativeEffect[] = [
    { kind: "stamina", delta: -action.actionPointCost },
  ];
  let combatGold = 0;
  if (combatResult?.enemy?.id && combatResult.enemy.id !== "none") {
    combatGold = combatResult.win
      ? combatResult.loot?.gold || 0
      : -(combatResult.penalty?.goldLoss || 0);
    if (combatGold !== 0) {
      effects.push({ kind: "gold", delta: combatGold });
    }
  }
  const deniedKinds = checkEffectWhitelist(
    effects,
    NARRATIVE_EFFECT_WHITELISTS.ACTION
  );
  if (deniedKinds.length > 0) {
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

  const { stamina: _s, gold: _g, ...restUpdateData } = updateData;

  const techniqueUpdateOps: TechniqueUpdate[] = [];
  let techniqueEvents: ActionResultData["techniqueEvents"] = [];
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
      const result = addProficiency(
        record.level,
        record.proficiency,
        tech.upgradeProficiency,
        profGained
      );
      techniqueEvents.push({
        techniqueName: tech.name,
        icon: tech.icon,
        profGained,
        leveledUp: result.leveledUp,
        eventNarrative,
      });
      techniqueUpdateOps.push({
        id: record.id,
        data: {
          level: result.newLevel,
          proficiency: result.newProficiency,
        },
      });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (clamped.length > 0) {
      await applyEffects(clamped, tx, ctx);
    }
    const cultivatorUpdate = await tx.cultivator.update({
      where: { id: cultivator.id },
      data: restUpdateData,
    });
    let actionEventId: string | undefined;
    if (combatResult?.enemy?.id && combatResult.enemy.id !== "none") {
      const combatEvent = await tx.gameEvent.create({
        data: {
          cultivatorId: cultivator.id,
          type: "COMBAT",
          title: combatResult.win ? "战斗胜利" : "战斗失败",
          narrative: combatResult.narrative,
          reward: JSON.stringify({
            win: combatResult.win,
            style: combatResult.style,
            gold: combatGold,
            exp: combatExpGain,
            enemy: combatResult.enemy.name,
          }),
        },
      });
      actionEventId = combatEvent.id;
    } else {
      const ae = await tx.gameEvent.create({
        data: {
          cultivatorId: cultivator.id,
          type: "ACTION",
          title: narrativeResult.title,
          narrative: narrativeResult.narrative,
          reward: JSON.stringify({
            expGained,
            actionName: action.name,
            mood: narrativeResult.mood,
          }),
        },
      });
      actionEventId = ae.id;
    }
    for (const op of techniqueUpdateOps) {
      await tx.cultivatorTechnique.update({
        where: { id: op.id },
        data: op.data,
      });
    }
    if (awakenEvent) {
      await tx.gameEvent.create({
        data: {
          cultivatorId: cultivator.id,
          type: "AWAKENING",
          title: awakenEvent.title,
          narrative: awakenEvent.narrative,
          reward: JSON.stringify({ mood: "奇" }),
        },
      });
    }
    return { cultivator: cultivatorUpdate, actionEventId };
  });

  return {
    status: "success",
    data: {
      narrativeResult,
      cultivator: updated.cultivator,
      expGained,
      combatExpGain,
      canBreakthrough: canBreakthrough(
        newRealm,
        newRealmLevel,
        cultivator.cultivationExp,
        cultivator.spiritualRoot
      ),
      awakenEvent,
      techniqueEvents,
      actionEventId: updated.actionEventId,
    },
  };
}
