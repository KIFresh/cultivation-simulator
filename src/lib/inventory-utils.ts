// 背包 / 物品 / 属性 的通用解析与操作工具。
// 复用 cultivation-data 中已定义的 InventoryItem 类型，避免重复声明。

import type { InventoryItem } from "./cultivation-data";

export type { InventoryItem };

/** 安全解析背包 JSON；非法或为空时返回空数组。 */
export function parseInventory(raw: string | null | undefined): InventoryItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isInventoryItemLike)
      .map((it) => ({
        itemId: it.itemId,
        quantity: Number(it.quantity) || 0,
        equipped: Boolean(it.equipped),
      }));
  } catch {
    return [];
  }
}

function isInventoryItemLike(v: unknown): v is { itemId: string; quantity: number; equipped: boolean } {
  return typeof v === "object" && v !== null && typeof (v as { itemId?: unknown }).itemId === "string";
}

export function hasItemById(inv: InventoryItem[], itemId: string): boolean {
  return inv.some((i) => i.itemId === itemId);
}

export function getItemById(inv: InventoryItem[], itemId: string): InventoryItem | undefined {
  return inv.find((i) => i.itemId === itemId);
}

/** 解析属性对象（接受 JSON 字符串或已解析对象）。 */
export function parseAttributes(
  raw: string | null | undefined | Record<string, number>,
): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return coerceRecord(raw as Record<string, unknown>);
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return coerceRecord(parsed as Record<string, unknown>);
      }
    } catch {
      return {};
    }
  }
  return {};
}

function coerceRecord(raw: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const num = Number(v);
    if (Number.isFinite(num)) result[k] = num;
  }
  return result;
}

/**
 * 从背包扣除指定数量的物品。
 * 数量不足时返回 null（调用方据此判定失败），否则返回新的背包数组。
 */
export function consumeInventoryItem(
  inv: InventoryItem[],
  itemId: string,
  qty: number,
): InventoryItem[] | null {
  const target = inv.find((i) => i.itemId === itemId);
  if (!target || target.quantity < qty) return null;
  const next: InventoryItem[] = [];
  for (const i of inv) {
    if (i.itemId !== itemId) {
      next.push({ ...i });
      continue;
    }
    const remaining = i.quantity - qty;
    if (remaining > 0) next.push({ ...i, quantity: remaining });
  }
  return next;
}

/**
 * 将一组可能重复的 itemId 合并到背包中。
 * 同 itemId 累加 quantity，不修改原输入数组。
 */
export function mergeInventoryItems(
  inventory: InventoryItem[],
  itemIds: string[],
): InventoryItem[] {
  const result = inventory.map((i) => ({ ...i }));
  for (const itemId of itemIds) {
    const existing = result.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      result.push({ itemId, quantity: 1, equipped: false });
    }
  }
  return result;
}
