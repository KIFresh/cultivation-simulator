// ═══════════════════════════════════════════════════════════════════════════
// narrative-schema.ts — 叙事响应 Schema 与效果白名单
// ═══════════════════════════════════════════════════════════════════════════
// 功能：
// 1. 定义各叙事分支的完整 Zod Schema（含 effects[] 替代旧字段）
// 2. 定义效果白名单（每个叙事分支允许哪些效果 kind）
// 3. 提供严格校验函数，解析失败返回结构化错误而非静默 fallback
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import {
  NarrativeEffectSchema,
  type EffectKind,
  EFFECT_KINDS,
  type NarrativeEffect,
} from "./narrative-effects";

// ── 1. 基础叙事字段（所有分支共享）────────────────────────────────────────

const BaseNarrativeSchema = z.object({
  title: z.string().min(1).max(30),
  narrative: z.string().min(1),
  mood: z.string().min(1).max(10),
  hint: z.string().optional(),
  summary: z.string().min(1).max(80),
});

// ── 2. 效果白名单 ─────────────────────────────────────────────────────────

export type EffectWhitelist = readonly EffectKind[];

/** 各叙事分支允许的效果 kind 白名单 */
export const NARRATIVE_EFFECT_WHITELISTS: Record<string, EffectWhitelist> = {
  /** 日常修炼：金币、体力、属性经验、记忆 */
  DAILY_CULTIVATION: ["gold", "stamina", "attrExp", "storyEntry", "mood"] as const,
  /** 突破：属性经验、记忆 */
  BREAKTHROUGH: ["attrExp", "storyEntry", "mood"] as const,
  /** 奇遇：金币、体力、健康、属性经验、记忆 */
  ENCOUNTER: ["gold", "stamina", "health", "attrExp", "storyEntry", "mood"] as const,
  /** NPC 对话：金币、亲密度、记忆（NPC 不给经验） */
  NPC_DIALOGUE: ["gold", "intimacy", "storyEntry", "mood"] as const,
  /** 家庭对话：金币、亲密度、记忆 */
  FAMILY_DIALOGUE: ["gold", "intimacy", "storyEntry", "mood"] as const,
  /** 行动叙事：金币、健康、属性经验、记忆（体力由 actionPointCost  deterministic 扣除，不走 AI effects） */
  ACTION: ["gold", "health", "attrExp", "storyEntry", "mood"] as const,
  /** 出生叙事：不允许任何游戏效果（姓名/家庭由服务端专项处理） */
  BIRTH: [] as const,
  /** 年志叙事：属性经验、记忆 */
  YEAR_ADVANCE: ["attrExp", "storyEntry", "mood"] as const,
};

/**
 * 检查效果数组是否全部在白名单内。
 * 返回不在白名单中的效果 kind 列表（空数组 = 全部通过）。
 */
export function checkEffectWhitelist(
  effects: NarrativeEffect[],
  whitelist: EffectWhitelist
): string[] {
  const denied: string[] = [];
  for (const e of effects) {
    if (!whitelist.includes(e.kind)) {
      denied.push(e.kind);
    }
  }
  return denied;
}

// ── 3. 各分支 Schema（含 effects[] 替代旧字段）────────────────────────────

/** 日常修炼（含 effects） */
export const DailyCultivationSchema = BaseNarrativeSchema.extend({
  type: z.literal("DAILY_CULTIVATION"),
  effects: z.array(NarrativeEffectSchema).default([]),
}).strict();

/** 突破叙事 */
export const BreakthroughSchema = BaseNarrativeSchema.extend({
  type: z.literal("BREAKTHROUGH"),
  effects: z.array(NarrativeEffectSchema).default([]),
}).strict();

/** 奇遇叙事（含选项） */
export const EncounterSchema = BaseNarrativeSchema.extend({
  type: z.literal("ENCOUNTER"),
  choices: z
    .array(
      z.object({
        text: z.string().min(1),
        risk: z.enum(["low", "medium", "high"]),
        hint: z.string().optional(),
      })
    )
    .min(1)
    .max(5),
  effects: z.array(NarrativeEffectSchema).default([]),
}).strict();

/** NPC 对话 */
export const NPCDialogueSchema = BaseNarrativeSchema.extend({
  type: z.literal("NPC_DIALOGUE"),
  npcMood: z.string().optional(),
  reward: z
    .object({
      itemId: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
    })
    .nullable()
    .optional(),
  effects: z.array(NarrativeEffectSchema).default([]),
}).strict();

/** 家庭对话 */
export const FamilyDialogueSchema = BaseNarrativeSchema.extend({
  type: z.literal("FAMILY_DIALOGUE"),
  npcMood: z.string().optional(),
  actionHint: z.string().optional(),
  effects: z.array(NarrativeEffectSchema).default([]),
}).strict();

/** 行动叙事 */
export const ActionSchema = BaseNarrativeSchema.extend({
  type: z.literal("ACTION"),
  effects: z.array(NarrativeEffectSchema).default([]),
}).strict();

/** 出生叙事（含姓名/家庭，效果由服务端处理） */
export const BirthNarrativeSchema = BaseNarrativeSchema.extend({
  type: z.literal("BIRTH"),
  suggestedName: z.string().optional(),
  family: z
    .array(
      z.object({
        relation: z.string().min(1),
        name: z.string().min(1),
        age: z.number().int().min(0).max(150),
        alive: z.boolean(),
        occupation: z.string().nullable().optional(),
        livingTogether: z.boolean().optional(),
      })
    )
    .optional(),
  effects: z.array(NarrativeEffectSchema).default([]),
}).strict();

/** 年志叙事 */
export const YearAdvanceSchema = BaseNarrativeSchema.extend({
  type: z.literal("YEAR_ADVANCE"),
  effects: z.array(NarrativeEffectSchema).default([]),
}).strict();

// ── 4. 联合 Schema ───────────────────────────────────────────────────────

export const NarrativeResponseSchema = z.discriminatedUnion("type", [
  DailyCultivationSchema,
  BreakthroughSchema,
  EncounterSchema,
  NPCDialogueSchema,
  FamilyDialogueSchema,
  ActionSchema,
  BirthNarrativeSchema,
  YearAdvanceSchema,
]);

export type NarrativeResponse = z.infer<typeof NarrativeResponseSchema>;

// ── 5. 严格校验函数 ───────────────────────────────────────────────────────

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

/**
 * 严格解析 AI 叙事响应。
 * 解析或 Schema 校验失败时返回结构化错误（不会静默 fallback）。
 */
export function parseNarrativeResponse(raw: unknown): ParseResult<NarrativeResponse> {
  if (!raw || typeof raw !== "object") {
    return { success: false, errors: ["响应不是有效的 JSON 对象"] };
  }

  const result = NarrativeResponseSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `[${issue.path.join(".")}] ${issue.message}`);
    return { success: false, errors };
  }

  return { success: true, data: result.data, errors: [] };
}

/**
 * 严格解析并校验效果白名单。
 * 返回解析结果 + 白名单拒绝列表。
 */
export function parseAndValidateEffects(
  raw: unknown,
  narrativeType: string
): {
  parseResult: ParseResult<NarrativeResponse>;
  whitelistErrors: string[];
} {
  const parseResult = parseNarrativeResponse(raw);
  const whitelistErrors: string[] = [];

  if (parseResult.success && parseResult.data) {
    const whitelist = NARRATIVE_EFFECT_WHITELISTS[narrativeType];
    if (whitelist) {
      const denied = checkEffectWhitelist(parseResult.data.effects ?? [], whitelist);
      for (const kind of denied) {
        whitelistErrors.push(`效果 kind "${kind}" 不在 ${narrativeType} 白名单中`);
      }
    }
  }

  return { parseResult, whitelistErrors };
}
