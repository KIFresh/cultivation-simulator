import { getAvailableActions, canBreakthrough } from "@/lib";
import type { CultivatorData } from "@/app/dashboard/types";
import type { InventoryItem } from "@/lib";
import { safeJsonParse } from "@/lib/json-helper";

/** 解析 attributes JSON 字段。 */
export function parseAttrs(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "string") return safeJsonParse<Record<string, number>>(raw, {});
  return raw as Record<string, number>;
}

/** 从任意来源的原始数据推导 store 字段。 */
export function deriveStoreFields(raw: any) {
  if (!raw) return {};
  const attributes = parseAttrs(raw.attributes);
  const inventory: InventoryItem[] = safeJsonParse<InventoryItem[]>(raw.inventory || "[]", []);
  const unlockedLocations: string[] = raw.unlockedLocations
    ? typeof raw.unlockedLocations === "string"
      ? safeJsonParse<string[]>(raw.unlockedLocations, ["home"])
      : raw.unlockedLocations
    : raw.location
      ? [raw.location]
      : ["home"];

  const worldId = raw.worldId || "earth";
  const age = Number(raw.age || 0);
  const location = raw.location || null;

  const cultivator: CultivatorData = {
    id: raw.id,
    name: raw.name,
    spiritualRoot: raw.spiritualRoot,
    realm: raw.realm,
    realmLevel: Number(raw.realmLevel || 0),
    cultivationExp: Number(raw.cultivationExp || 0),
    totalExp: Number(raw.totalExp || 0),
    stamina: Number(raw.stamina || 0),
    age,
    worldYear: Number(raw.worldYear ?? 2025),
    quarter: raw.quarter ?? undefined,
    quarterAccum: raw.quarterAccum ?? null,
    worldId: raw.worldId ?? null,
    title: raw.title ?? null,
    breakthroughCount: Number(raw.breakthroughCount || 0),
    location,
    gold: Number(raw.gold || 0),
    maxAge: raw.maxAge ?? null,
    bonusAge: Number(raw.bonusAge || 0),
    reincarnationCount: Number(raw.reincarnationCount || 0),
    talents: raw.talents ?? null,
    injuryDebuff: Number(raw.injuryDebuff || 0),
    health: Number(raw.health || 0),
    mindDemon: Number(raw.mindDemon || 0),
    attributes: raw.attributes ?? null,
    attributeExp: raw.attributeExp ?? null,
    subjectExp: raw.subjectExp ?? null,
    storyEntries: raw.storyEntries ?? null,
    inventory: raw.inventory ?? null,
    npcRelations: raw.npcRelations ?? null,
    unlockedLocations,
    occupation: raw.occupation ?? null,
    gender: raw.gender ?? null,
    schoolRank: Number(raw.schoolRank || 0),
    clique: raw.clique ?? null,
    examResults: raw.examResults ?? null,
    milestones: raw.milestones ?? null,
    pet: raw.pet ?? null,
    classEnroll: raw.classEnroll ?? null,
    savings: raw.savings ?? null,
    arcadeStats: raw.arcadeStats ?? null,
    readingLog: raw.readingLog ?? null,
    breakthroughBuff: Number(raw.breakthroughBuff || 0),
  };

  const cb = canBreakthrough(
    cultivator.realm,
    cultivator.realmLevel,
    cultivator.cultivationExp,
    cultivator.spiritualRoot,
    cultivator.breakthroughBuff || 0
  );
  const actions = getAvailableActions(worldId, age, cultivator.realm, location || undefined);

  // Sync to IndexedDB cache (fire-and-forget)
  if (typeof window !== "undefined" && raw?.id) {
    import("@/lib/cache").then(({ setCachedCultivator }) => {
      setCachedCultivator(raw.userId || raw.id, { ...raw, userId: raw.userId || raw.id });
    }).catch(() => {});
  }

  return {
    cultivator,
    gold: cultivator.gold,
    inventory,
    location,
    unlockedLocations,
    availableActions: actions,
    canBreakthrough: cb,
  };
}