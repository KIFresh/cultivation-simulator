// 灵宠洞府：孵化、培育、养护逻辑。
// 被 src/app/api/spirit-pet/route.ts 使用。

import { consumeInventoryItem, type InventoryItem } from "./inventory-utils";

export type { InventoryItem };

export type PetState = "active" | "resting" | "injured";

export interface SpiritPet {
  id: string;
  name: string;
  level: number;
  skipQuarters: number;
  state: PetState;
}

export const MAX_PET_LEVEL = 5;
export const HATCH_COST_STONE = { amount: 20 };

export function parseSpiritPets(raw: string | null | undefined): SpiritPet[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is Record<string, unknown> =>
          !!p && typeof p === "object" && typeof (p as { id?: unknown }).id === "string"
      )
      .map(normalizePet);
  } catch {
    return [];
  }
}

function normalizePet(p: Record<string, unknown>): SpiritPet {
  return {
    id: String(p.id),
    name: typeof p.name === "string" && p.name.length > 0 ? p.name : "无名灵宠",
    level: typeof p.level === "number" ? p.level : 1,
    skipQuarters: typeof p.skipQuarters === "number" ? p.skipQuarters : 0,
    state: p.state === "resting" || p.state === "injured" ? (p.state as PetState) : "active",
  };
}

function genPetId(): string {
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `pet_${Date.now().toString(36)}_${rand}`;
}

export function hatchPet(name?: string): SpiritPet {
  return {
    id: genPetId(),
    name: name && name.length > 0 ? name : "无名灵宠",
    level: 1,
    skipQuarters: 0,
    state: "active",
  };
}

/** 培育升级到下一级所需资源。 */
export function upgradeCost(level: number): { mid: number; grass: number } {
  return { mid: 10 + level * 5, grass: 3 + level * 2 };
}

/** 手动养护一次所需资源（随等级增长）。 */
export function upkeepCost(level: number): { low: number; grass: number } {
  return {
    low: Math.max(1, level),
    grass: Math.max(1, Math.floor(level / 2) + 1),
  };
}

// 供 API 路由复用（route.ts 直接从 @/lib/spirit-pet 引用）。
export { consumeInventoryItem };
