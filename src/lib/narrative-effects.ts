// ═══════════════════════════════════════════════════════════════════════════
// narrative-effects.ts — 叙事效果统一契约模块
// ═══════════════════════════════════════════════════════════════════════════
//
// 功能：
// 1. 定义所有叙事可能产生的游戏效果类型（NarrativeEffect 联合体）
// 2. 提供 Zod 运行时校验 Schema，替代 extractJson 的裸 `as T`
// 3. 提供 applyEffects() 统一持久化入口，消除各路由的手工解构
// 4. 提供 clampAndCensor() 安全钳制层，确保 AI 输出不越界
//
// 接入点（Phase 1 → Phase 2 → Phase 3 渐进式迁移）：
//   Phase 1：定义类型 + 各 generate* 函数可选返回 effects[]（本文件）
//   Phase 2：在 family-dialogue/route.ts 试点替换手工逻辑
//   Phase 3：narrative/route.ts 各 case 统一走 applyEffects()
//
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { prisma } from "./prisma";
import { clampGoldDelta } from "./gold";

// ── 1. 效果模式匹配 ──────────────────────────────────────────────────────

/** 效果种类枚举 */
export const EFFECT_KINDS = [
  "gold",
  "stamina",
  "intimacy",
  "health",
  "mindDemon",
  "attrExp",
  "storyEntry",
  "familyReplace",
  "rename",
  "mood",
  "npcMeet",
] as const;

export type EffectKind = (typeof EFFECT_KINDS)[number];

// ── 2. 各效果 Schema（Zod 运行时校验）────────────────────────────────────

export const GoldEffectSchema = z
  .object({
    kind: z.literal("gold"),
    /** 金币变动量（正=增加，负=减少） */
    delta: z.number().int(),
  })
  .strict();

export const StaminaEffectSchema = z
  .object({
    kind: z.literal("stamina"),
    /** 体力变动量 */
    delta: z.number().int(),
  })
  .strict();

export const IntimacyEffectSchema = z
  .object({
    kind: z.literal("intimacy"),
    /** 目标家庭成员的关系描述，如 "母亲" */
    targetRelation: z.string().min(1),
    /** 亲密度变动量，推荐 -8～+8 */
    delta: z.number().int().min(-20).max(20),
  })
  .strict();

export const HealthEffectSchema = z
  .object({
    kind: z.literal("health"),
    /** 气血/健康变动量 */
    delta: z.number().int(),
  })
  .strict();

export const MindDemonEffectSchema = z
  .object({
    kind: z.literal("mindDemon"),
    /** 心魔值变动量 */
    delta: z.number().int(),
  })
  .strict();

export const AttrExpEffectSchema = z
  .object({
    kind: z.literal("attrExp"),
    /** 属性经验映射，如 { root: 15, spirit: 10 } */
    values: z
      .object({
        root: z.number().int().nonnegative().optional(),
        spirit: z.number().int().nonnegative().optional(),
        insight: z.number().int().nonnegative().optional(),
        luck: z.number().int().nonnegative().optional(),
        charm: z.number().int().nonnegative().optional(),
        mind: z.number().int().nonnegative().optional(),
      })
      .strict(),
  })
  .strict();

export const StoryEntryEffectSchema = z
  .object({
    kind: z.literal("storyEntry"),
    /** 记忆标题 */
    title: z.string().min(1),
    /** 记忆正文（AI 生成的叙事摘要） */
    narrative: z.string().min(1),
    /** 可选简短摘要 */
    summary: z.string().optional(),
    /** 是否标记为重要事件（⭐） */
    important: z.boolean().default(true),
  })
  .strict();

export const FamilyReplaceEffectSchema = z
  .object({
    kind: z.literal("familyReplace"),
    /** 替换/初始化的家庭成员列表 */
    members: z
      .array(
        z.object({
          relation: z.string().min(1),
          name: z.string().min(1),
          age: z.number().int().min(0).max(150),
          alive: z.boolean(),
          occupation: z.string().nullable().optional(),
        })
      )
      .min(1),
  })
  .strict();

export const RenameEffectSchema = z
  .object({
    kind: z.literal("rename"),
    /** 新姓名（中文 2～4 字） */
    name: z.string().regex(/^[\u4e00-\u9fff]{2,4}$/),
  })
  .strict();

export const MoodEffectSchema = z
  .object({
    kind: z.literal("mood"),
    /** 心境标签 */
    mood: z.enum(["燃", "静", "险", "悟", "奇"]),
  })
  .strict();

export const NpcMeetEffectSchema = z
  .object({
    kind: z.literal("npcMeet"),
    /** 遇到的 NPC 标识 */
    npcId: z.string().min(1),
  })
  .strict();

// ── 3. 联合体 Schema & 类型 ──────────────────────────────────────────────

/** NarrativeEffect 联合 Schema（按 kind 区分） */
export const NarrativeEffectSchema = z.discriminatedUnion("kind", [
  GoldEffectSchema,
  StaminaEffectSchema,
  IntimacyEffectSchema,
  HealthEffectSchema,
  MindDemonEffectSchema,
  AttrExpEffectSchema,
  StoryEntryEffectSchema,
  FamilyReplaceEffectSchema,
  RenameEffectSchema,
  MoodEffectSchema,
  NpcMeetEffectSchema,
]);

/** 叙事效果 TypeScript 类型（由 Schema 推断） */
export type NarrativeEffect = z.infer<typeof NarrativeEffectSchema>;

/** NarrativeEffect 数组 Schema */
export const NarrativeEffectsArraySchema = z.array(NarrativeEffectSchema);

// ── 4. AI 叙事响应统一结构 ───────────────────────────────────────────────
//
// 各 generate* 函数最终应返回此结构，其中 effects[] 承载所有游戏效果。
// 前端渲染只需 narrative/title/mood/hint/summary；路由层处理 effects[]。

export interface AIStoryResponse {
  type: string;
  title: string;
  narrative: string;
  mood: string;
  hint?: string;
  summary: string;
  /** AI 在此声明想产生的效果列表 */
  effects: NarrativeEffect[];
}

// ── 5. 安全钳制层（clamp and censor）─────────────────────────────────────
//
// 在 AI 返回的 effects 落入 DB 前，统一过一遍钳制逻辑。
// 由 applyEffects 内部调用，也可单独导出供测试。

export interface ClampConfig {
  /** 单次金币变动上限（绝对），默认 10_000 */
  maxGoldAbsDelta?: number;
  /** 当前金币余额（影响最终钳制） */
  currentGold: number;
  /** 最大金币上限 */
  maxGold?: number;
  /** 单次亲密度变动上限（绝对），默认 8 */
  maxIntimacyAbsDelta?: number;
  /** 当前亲密度 */
  currentIntimacy?: number;
  /** 最大亲密度，默认 100 */
  maxIntimacy?: number;
  /** 单次体力变动上限（绝对），默认 50 */
  maxStaminaAbsDelta?: number;
  /** 当前体力值 */
  currentStamina?: number;
  /** 最大体力值 */
  maxStamina?: number;
  /** 当前健康值 */
  currentHealth?: number;
  /** 最大健康值 */
  maxHealth?: number;
  /** 当前心魔值 */
  currentMindDemon?: number;
}

/**
 * 对单条效果进行安全钳制。
 * - 金币 → 委托 clampGoldDelta
 * - 亲密度 → 限幅 ±maxIntimacyAbsDelta
 * - 体力 → 限幅 ±maxStaminaAbsDelta + [0, maxStamina]
 * - 健康/心魔 → 限幅 ±100
 * - 其他效果 → 原样返回
 */
export function clampEffect(effect: NarrativeEffect, config: ClampConfig): NarrativeEffect {
  switch (effect.kind) {
    case "gold": {
      let clamped = clampGoldDelta(effect.delta, config.currentGold, config.maxGoldAbsDelta);
      // 再按 maxGold 上限钳制
      if (config.maxGold !== undefined && clamped > 0) {
        const newVal = config.currentGold + clamped;
        if (newVal > config.maxGold) {
          clamped = config.maxGold - config.currentGold;
        }
      }
      return { kind: "gold", delta: clamped };
    }
    case "intimacy": {
      const cap = config.maxIntimacyAbsDelta ?? 8;
      let delta = Math.max(-cap, Math.min(cap, effect.delta));
      // 按 [0, maxIntimacy] 边界钳制
      if (config.currentIntimacy !== undefined) {
        const maxInt = config.maxIntimacy ?? 100;
        if (delta > 0) {
          const room = maxInt - config.currentIntimacy;
          delta = Math.min(delta, room);
        } else {
          const floor = -config.currentIntimacy;
          delta = Math.max(delta, floor);
        }
      }
      return { ...effect, delta };
    }
    case "stamina": {
      const cap = config.maxStaminaAbsDelta ?? 50;
      let delta = Math.max(-cap, Math.min(cap, effect.delta));
      if (config.currentStamina !== undefined && config.maxStamina !== undefined) {
        const newVal = config.currentStamina + delta;
        delta =
          newVal < 0
            ? -config.currentStamina
            : newVal > config.maxStamina
              ? config.maxStamina - config.currentStamina
              : delta;
      }
      return { kind: "stamina", delta };
    }
    case "health": {
      let delta = Math.max(-100, Math.min(100, effect.delta));
      if (config.currentHealth !== undefined && config.maxHealth !== undefined) {
        if (delta > 0) {
          const room = config.maxHealth - config.currentHealth;
          delta = Math.min(delta, room);
        } else {
          const floor = -config.currentHealth;
          delta = Math.max(delta, floor);
        }
      }
      return { ...effect, delta };
    }
    case "mindDemon": {
      let delta = Math.max(-100, Math.min(100, effect.delta));
      if (config.currentMindDemon !== undefined) {
        if (delta < 0) {
          const floor = -config.currentMindDemon;
          delta = Math.max(delta, floor);
        }
      }
      return { ...effect, delta };
    }
    default:
      return effect;
  }
}

/**
 * 聚合同类效果，避免多条同种效果分别钳制后累计越界。
 * 例如：两条 gold +10 分别钳制后各 +10（通过），但合计 +20 可能越界。
 * 聚合后按一条效果钳制，确保总量安全。
 *
 * 注意：clampEffectsArray 已调用此函数进行聚合，确保多条同类效果不会累计越界。
 */
export function aggregateEffects(effects: NarrativeEffect[]): NarrativeEffect[] {
  const aggregated: NarrativeEffect[] = [];
  const goldAccum: number[] = [];
  const staminaAccum: number[] = [];
  const healthAccum: number[] = [];
  const mindDemonAccum: number[] = [];
  const attrExpAccum: Record<string, number> = {};
  const others: NarrativeEffect[] = [];

  for (const e of effects) {
    switch (e.kind) {
      case "gold":
        goldAccum.push(e.delta);
        break;
      case "stamina":
        staminaAccum.push(e.delta);
        break;
      case "health":
        healthAccum.push(e.delta);
        break;
      case "mindDemon":
        mindDemonAccum.push(e.delta);
        break;
      case "attrExp":
        for (const [k, v] of Object.entries(e.values)) {
          attrExpAccum[k] = (attrExpAccum[k] || 0) + v;
        }
        break;
      default:
        others.push(e);
    }
  }

  if (goldAccum.length > 0) {
    const total = goldAccum.reduce((a, b) => a + b, 0);
    if (total !== 0) aggregated.push({ kind: "gold", delta: total });
  }
  if (staminaAccum.length > 0) {
    const total = staminaAccum.reduce((a, b) => a + b, 0);
    if (total !== 0) aggregated.push({ kind: "stamina", delta: total });
  }
  if (healthAccum.length > 0) {
    const total = healthAccum.reduce((a, b) => a + b, 0);
    if (total !== 0) aggregated.push({ kind: "health", delta: total });
  }
  if (mindDemonAccum.length > 0) {
    const total = mindDemonAccum.reduce((a, b) => a + b, 0);
    if (total !== 0) aggregated.push({ kind: "mindDemon", delta: total });
  }
  if (Object.keys(attrExpAccum).length > 0) {
    aggregated.push({ kind: "attrExp", values: attrExpAccum });
  }

  return [...aggregated, ...others];
}

/**
 * 批量钳制效果数组。先聚合同类效果，再逐条钳制，确保总量安全。
 * 这是推荐的生产入口——聚合后钳制，避免多条同类效果累计越界。
 */
export function clampEffectsArray(
  effects: NarrativeEffect[],
  config: ClampConfig
): NarrativeEffect[] {
  const aggregated = aggregateEffects(effects);
  return aggregated.map((e) => clampEffect(e, config));
}

// ── 6. 效果校验器（validate）─────────────────────────────────────────────
//
// 在 applyEffects 之前调用的独立校验，返回所有校验错误。
// 错误不会阻塞应用（软拒绝有害字段），但会记日志。

export interface ValidationError {
  index: number;
  kind: string;
  message: string;
}

/**
 * 校验效果数组，返回非法条目列表。
 * - 运行时类型校验（Zod）
 * - 数值边界检查
 * - 业务规则（如 familyReplace 必须至少 1 人）
 */
export function validateEffects(effects: unknown[]): {
  valid: NarrativeEffect[];
  errors: ValidationError[];
} {
  const valid: NarrativeEffect[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < effects.length; i++) {
    const raw = effects[i];
    const result = NarrativeEffectSchema.safeParse(raw);
    if (!result.success) {
      errors.push({
        index: i,
        kind: (raw as any)?.kind ?? "unknown",
        message: result.error.issues.map((iss) => iss.message).join("; "),
      });
      continue;
    }

    // 业务规则补充校验
    const effect = result.data;
    switch (effect.kind) {
      case "rename":
        // 正则已涵盖 2-4 中文字符
        break;
      case "intimacy":
        if (effect.delta === 0) {
          // delta=0 无意义，但不报错，跳过
          continue;
        }
        break;
    }
    valid.push(effect);
  }

  return { valid, errors };
}

// ── 7. 效果应用器（applyEffects）─────────────────────────────────────────
//
// 接收 Prisma TransactionClient，将效果统一落库。
// 各路由无需再手工 prisma.cultivator.update / prisma.familyMember.update。

export interface ApplyContext {
  cultivatorId: string;
  currentGold: number;
  currentStamina: number;
  maxStamina: number;
  /** 可选：当前 cultivator 的 familyMembers 快照，用于 intimacy 查找 */
  familyMembers?: Array<{ relation: string; id: string; intimacy: number }>;
}

/**
 * 统一应用效果数组到数据库。
 *
 * @param effects  已校验+钳制的效果列表
 * @param tx       Prisma 事务客户端
 * @param ctx      上下文（当前游戏状态快照）
 */
export async function applyEffects(
  effects: NarrativeEffect[],
  tx: any,
  ctx: ApplyContext
): Promise<void> {
  for (const effect of effects) {
    switch (effect.kind) {
      case "gold": {
        if (effect.delta !== 0) {
          await tx.cultivator.update({
            where: { id: ctx.cultivatorId },
            data: { gold: { increment: effect.delta } },
          });
        }
        break;
      }

      case "stamina": {
        if (effect.delta !== 0) {
          await tx.cultivator.update({
            where: { id: ctx.cultivatorId },
            data: { stamina: { increment: effect.delta } },
          });
        }
        break;
      }

      case "intimacy": {
        const member = ctx.familyMembers?.find((m) => m.relation === effect.targetRelation);
        if (member && effect.delta !== 0) {
          // 原子增量，避免并发丢失
          await tx.familyMember.update({
            where: { id: member.id },
            data: { intimacy: { increment: effect.delta } },
          });
          // 钳制到 [0, 100] 边界
          await tx.familyMember.update({
            where: { id: member.id, intimacy: { gt: 100 } },
            data: { intimacy: 100 },
          });
          await tx.familyMember.update({
            where: { id: member.id, intimacy: { lt: 0 } },
            data: { intimacy: 0 },
          });
        }
        break;
      }

      case "health": {
        if (effect.delta !== 0) {
          await tx.cultivator.update({
            where: { id: ctx.cultivatorId },
            data: { health: { increment: effect.delta } },
          });
        }
        break;
      }

      case "mindDemon": {
        if (effect.delta !== 0) {
          await tx.cultivator.update({
            where: { id: ctx.cultivatorId },
            data: { mindDemon: { increment: effect.delta } },
          });
        }
        break;
      }

      case "attrExp": {
        // attributeExp 是 JSON 字段，如 {"root": 15, "spirit": 10}
        // 先读取当前值，合并后写回
        const current = await tx.cultivator.findUnique({
          where: { id: ctx.cultivatorId },
          select: { attributeExp: true },
        });
        const currentExp: Record<string, number> = current?.attributeExp
          ? typeof current.attributeExp === "string"
            ? JSON.parse(current.attributeExp)
            : current.attributeExp
          : {};
        const merged = { ...currentExp };
        for (const [attr, val] of Object.entries(effect.values)) {
          if (val !== undefined) {
            merged[attr] = (merged[attr] || 0) + val;
          }
        }
        await tx.cultivator.update({
          where: { id: ctx.cultivatorId },
          data: { attributeExp: JSON.stringify(merged) },
        });
        break;
      }

      case "storyEntry": {
        // 追加到 storyEntries JSON 数组
        const current = await tx.cultivator.findUnique({
          where: { id: ctx.cultivatorId },
          select: { storyEntries: true },
        });
        const entries: any[] = current?.storyEntries
          ? typeof current.storyEntries === "string"
            ? JSON.parse(current.storyEntries)
            : current.storyEntries
          : [];
        entries.push({
          title: effect.title,
          narrative: effect.narrative,
          summary: effect.summary ?? effect.title,
          important: effect.important,
          createdAt: new Date().toISOString(),
        });
        // 超过 50 条时压缩旧条目
        if (entries.length > 50) {
          const important = entries.filter((e: any) => e.important).slice(-40);
          const recent = entries
            .slice(-10)
            .filter((e: any) => !important.some((imp: any) => imp.createdAt === e.createdAt));
          entries.splice(0, entries.length);
          entries.push(...important, ...recent);
        }
        await tx.cultivator.update({
          where: { id: ctx.cultivatorId },
          data: { storyEntries: JSON.stringify(entries), storyEntriesUpdatedAt: new Date() },
        });
        break;
      }

      case "familyReplace": {
        await tx.familyMember.deleteMany({
          where: { cultivatorId: ctx.cultivatorId },
        });
        if (effect.members.length > 0) {
          await tx.familyMember.createMany({
            data: effect.members.map((m) => ({
              cultivatorId: ctx.cultivatorId,
              relation: m.relation,
              name: m.name,
              age: m.age,
              alive: m.alive,
              intimacy: 50,
              occupation: m.occupation ?? null,
            })),
          });
        }
        break;
      }

      case "rename": {
        await tx.cultivator.update({
          where: { id: ctx.cultivatorId },
          data: { name: effect.name },
        });
        break;
      }

      case "mood":
      case "npcMeet":
        // 这些效果仅用于前端展示，不产生持久化副作用
        break;
    }
  }
}

// ── 8. 便捷工具函数 ──────────────────────────────────────────────────────

/**
 * 从 AI 叙事响应（原始 JSON）中安全提取 effects[]。
 * 返回空数组 = 无效果或解析失败（不会因此报错中断流程）。
 */
export function extractEffects(raw: unknown): NarrativeEffect[] {
  if (!raw || typeof raw !== "object") return [];
  const maybe = (raw as Record<string, unknown>).effects;
  if (!Array.isArray(maybe)) return [];
  const { valid } = validateEffects(maybe);
  return valid;
}

/**
 * 严格提取 effects[]，解析失败时返回结构化错误而非静默空数组。
 * 适用于生产路由——非法效果应该被拒绝，而非静默忽略。
 */
export interface StrictExtractResult {
  effects: NarrativeEffect[];
  errors: ValidationError[];
  /** 是否完全解析成功（无任何错误） */
  ok: boolean;
}

export function extractEffectsStrict(raw: unknown): StrictExtractResult {
  if (!raw || typeof raw !== "object") {
    return {
      effects: [],
      errors: [{ index: -1, kind: "unknown", message: "响应不是对象" }],
      ok: false,
    };
  }
  const maybe = (raw as Record<string, unknown>).effects;
  if (!Array.isArray(maybe)) {
    return {
      effects: [],
      errors: [{ index: -1, kind: "unknown", message: "effects 字段不是数组" }],
      ok: false,
    };
  }
  const { valid, errors } = validateEffects(maybe);
  return { effects: valid, errors, ok: errors.length === 0 };
}

/**
 * 从 AI 叙事响应中安全提取指定 kind 的效果。
 * 适用于路由只需特定效果（如 goldChange）的场景。
 */
export function extractEffectsByKind<T extends EffectKind>(
  raw: unknown,
  kind: T
): Extract<NarrativeEffect, { kind: T }>[] {
  return extractEffects(raw).filter(
    (e): e is Extract<NarrativeEffect, { kind: T }> => e.kind === kind
  );
}
