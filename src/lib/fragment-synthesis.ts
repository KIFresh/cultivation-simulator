// 功法残页合成 —— 被 lib/__tests__/fragment-synthesis.test.ts 依赖。
// 重建依据：测试导入契约（checkFragmentSynthesis / getFragmentTechniqueIds / techniqueIdFromName）。

import type { InventoryItem } from "./inventory-utils";

export interface SynthesisDetail {
  techniqueId: string;
  fragmentsUsed: number;
  existingTechnique: boolean;
  profGained: number;
}

export interface SynthesisResult {
  synthesisCount: number;
  details: SynthesisDetail[];
}

export interface CheckFragmentResult {
  result: SynthesisResult;
  updatedInventory: InventoryItem[];
}

export const FRAGMENTS_PER_SYNTHESIS = 10;
export const PROF_FOR_EXISTING = 20;
export const PROF_FOR_NEW = 10;

const TECHNIQUE_NAME_TO_ID: Record<string, string> = {
  吐纳术: "basic_breathing",
  基础剑诀: "sword_foundation",
  御风诀: "wind_step",
  炼体诀: "body_refining",
  凝神术: "mind_focus",
};

function techniqueIdFromFragment(itemId: string): string | null {
  if (!itemId.startsWith("fragment_")) return null;
  return itemId.slice("fragment_".length);
}

export function getFragmentTechniqueIds(items: string[]): string[] {
  const ids = new Set<string>();
  for (const itemId of items) {
    const id = techniqueIdFromFragment(itemId);
    if (id) ids.add(id);
  }
  return [...ids];
}

export function techniqueIdFromName(name: string): string {
  return TECHNIQUE_NAME_TO_ID[name] ?? "";
}

export function checkFragmentSynthesis(
  inventory: InventoryItem[],
  ownedTechniqueIds: string[]
): CheckFragmentResult {
  const owned = new Set(ownedTechniqueIds);
  const details: SynthesisDetail[] = [];
  const updatedInventory: InventoryItem[] = [];

  for (const item of inventory) {
    const techniqueId = techniqueIdFromFragment(item.itemId);
    if (!techniqueId) {
      updatedInventory.push(item);
      continue;
    }
    const qty = item.quantity ?? 0;
    const count = Math.floor(qty / FRAGMENTS_PER_SYNTHESIS);
    if (count <= 0) {
      updatedInventory.push(item);
      continue;
    }
    const isExisting = owned.has(techniqueId);
    for (let i = 0; i < count; i++) {
      details.push({
        techniqueId,
        fragmentsUsed: FRAGMENTS_PER_SYNTHESIS,
        existingTechnique: isExisting,
        profGained: isExisting ? PROF_FOR_EXISTING : PROF_FOR_NEW,
      });
    }
    const left = qty - count * FRAGMENTS_PER_SYNTHESIS;
    if (left > 0) {
      updatedInventory.push({ ...item, quantity: left });
    }
  }

  return {
    result: { synthesisCount: details.length, details },
    updatedInventory,
  };
}
