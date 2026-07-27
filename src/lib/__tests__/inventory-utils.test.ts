import { describe, it, expect } from 'vitest';
import {
  parseInventory,
  hasItemById,
  getItemById,
  parseAttributes,
  consumeInventoryItem,
  type InventoryItem,
} from '../inventory-utils';

describe('parseInventory', () => {
  it('应解析合法 JSON 数组', () => {
    const raw = JSON.stringify([{ itemId: 'sword', quantity: 1, equipped: true }]);
    const result = parseInventory(raw);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('sword');
    expect(result[0].quantity).toBe(1);
    expect(result[0].equipped).toBe(true);
  });

  it('null/undefined/空字符串应返回空数组', () => {
    expect(parseInventory(null)).toEqual([]);
    expect(parseInventory(undefined)).toEqual([]);
    expect(parseInventory('')).toEqual([]);
  });

  it('非法 JSON 应返回空数组', () => {
    expect(parseInventory('not json')).toEqual([]);
  });

  it('应过滤掉缺少 itemId 的条目', () => {
    const raw = JSON.stringify([
      { itemId: 'potion', quantity: 5, equipped: false },
      { quantity: 2, equipped: true },
    ]);
    const result = parseInventory(raw);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('potion');
  });
});

describe('hasItemById / getItemById', () => {
  const inv: InventoryItem[] = [
    { itemId: 'a', quantity: 3, equipped: false },
    { itemId: 'b', quantity: 1, equipped: true },
  ];

  it('hasItemById 应正确判断存在性', () => {
    expect(hasItemById(inv, 'a')).toBe(true);
    expect(hasItemById(inv, 'c')).toBe(false);
  });

  it('getItemById 应返回匹配项或 undefined', () => {
    expect(getItemById(inv, 'b')?.quantity).toBe(1);
    expect(getItemById(inv, 'x')).toBeUndefined();
  });
});

describe('parseAttributes', () => {
  it('应解析 JSON 字符串', () => {
    expect(parseAttributes('{"str":10,"agi":5}')).toEqual({ str: 10, agi: 5 });
  });

  it('应解析已解析的对象', () => {
    expect(parseAttributes({ str: 10, agi: 5 })).toEqual({ str: 10, agi: 5 });
  });

  it('null/undefined 应返回空对象', () => {
    expect(parseAttributes(null)).toEqual({});
    expect(parseAttributes(undefined)).toEqual({});
  });

  it('应过滤非数字值', () => {
    expect(parseAttributes({ str: 10, name: 'hello' })).toEqual({ str: 10 });
  });
});

describe('consumeInventoryItem', () => {
  const inv: InventoryItem[] = [
    { itemId: 'potion', quantity: 5, equipped: false },
    { itemId: 'elixir', quantity: 1, equipped: false },
  ];

  it('数量充足时应扣除并返回新数组', () => {
    const result = consumeInventoryItem(inv, 'potion', 3);
    expect(result).not.toBeNull();
    expect(result![0].quantity).toBe(2);
  });

  it('数量不足时应返回 null', () => {
    expect(consumeInventoryItem(inv, 'potion', 99)).toBeNull();
  });

  it('扣完数量后应移除该条目', () => {
    const result = consumeInventoryItem(inv, 'elixir', 1);
    expect(result).not.toBeNull();
    expect(result!.find((i) => i.itemId === 'elixir')).toBeUndefined();
  });

  it('不存在的 itemId 应返回 null', () => {
    expect(consumeInventoryItem(inv, 'nonexistent', 1)).toBeNull();
  });
});