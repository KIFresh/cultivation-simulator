/**
 * 统一 JSON 解析工具 — 服务端带日志，客户端保持轻量。
 */

import { logger } from "./logger";
import type { StoryEntry } from "@/lib/narrative";
import type { InventoryItem } from "@/lib/inventory-utils";

/** 通用安全 JSON.parse，解析失败时返回 fallback。 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 服务端专用：解析失败时写一条 warn 日志，便于定位脏数据。 */
export function parseJsonField<T>(
  raw: string | null | undefined,
  fallback: T,
  fieldName: string,
  context?: string
): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`[json-helper] 解析 ${fieldName} 失败`, context);
    return fallback;
  }
}

/** 常见 JSON 字段的快速解析器，减少重复代码。 */
export const json = {
  storyEntries: (raw: string | null | undefined): StoryEntry[] =>
    parseJsonField<StoryEntry[]>(raw, [], "storyEntries"),
  attributes: (raw: string | null | undefined): Record<string, number> =>
    parseJsonField<Record<string, number>>(raw, {}, "attributes"),
  inventory: (raw: string | null | undefined): InventoryItem[] =>
    parseJsonField<InventoryItem[]>(raw, [], "inventory"),
  unlockedLocations: (raw: string | null | undefined): string[] =>
    parseJsonField<string[]>(raw, [], "unlockedLocations"),
  npcRelations: (raw: string | null | undefined): Record<string, number> =>
    parseJsonField<Record<string, number>>(raw, {}, "npcRelations"),
  talents: (raw: string | null | undefined): string[] =>
    parseJsonField<string[]>(raw, [], "talents"),
  reward: <T = Record<string, unknown>>(raw: string | null | undefined): T =>
    parseJsonField<T>(raw, {} as T, "reward"),
  dialogueHistory: (raw: string | null | undefined): unknown[] =>
    parseJsonField<unknown[]>(raw, [], "dialogueHistory"),
  attributeExp: (raw: string | null | undefined): Record<string, { exp: number; level: number }> =>
    parseJsonField<Record<string, { exp: number; level: number }>>(raw, {}, "attributeExp"),
  subjectExp: (raw: string | null | undefined): Record<string, { exp: number; level: number }> => {
    // 容错：合法 JSON 但非对象（字符串/数字/数组）也回退为空对象
    const parsed = parseJsonField<unknown>(raw, {}, "subjectExp");
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, { exp: number; level: number }>)
      : {};
  },
  properties: (raw: string | null | undefined): any[] =>
    parseJsonField<any[]>(raw, [], "properties"),
};
