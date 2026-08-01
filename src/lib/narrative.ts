// ============================================================
// AI 叙事引擎 — 多供应方自动切换
// ============================================================

import { SpiritualRoot, formatRealmLevel, LOCATIONS, getNPCsAtLocation } from "./cultivation-data";
import type { NarrativeEffect } from "./narrative-effects";

import {
  syncProviderConfig,
  callAI,
  warmupAI,
  AllProvidersFailedError,
} from "./narrative/provider";
export { syncProviderConfig, callAI, warmupAI };
import { safeJsonParse } from "./json-helper";
import { logger } from "./logger";

function normalizeNarrativeKeys(o: unknown): void {
  if (!o || typeof o !== "object") return;
  const obj = o as Record<string, unknown>;
  // 正文：兼容 AI 各种拼写变体（narrative / narrary / narrable / narrrative 等）
  const narrKey = Object.keys(obj).find((k) => k.startsWith("narr"));
  const body = narrKey ? obj[narrKey] : (obj.content ?? obj.text);
  if (typeof body === "string") obj.narrative = body;
  // 如果仍未找到 narrative，尝试找第一个包含中文的长字符串字段
  if (!obj.narrative || typeof obj.narrative !== "string" || !obj.narrative.trim()) {
    const chineseKey = Object.keys(obj).find((k) => {
      const v = obj[k];
      return typeof v === "string" && v.length > 20 && /[\u4e00-\u9fff]/.test(v);
    });
    if (chineseKey) obj.narrative = obj[chineseKey] as string;
  }
  // 标题、概要、寄语、心境的简写兼容
  if (obj.title === undefined && typeof obj.t === "string") obj.title = obj.t;
  if (obj.summary === undefined) {
    if (typeof obj.sum === "string") obj.summary = obj.sum;
    else if (typeof obj.synopsis === "string") obj.summary = obj.synopsis;
  }
  if (obj.hint === undefined && typeof obj.h === "string") obj.hint = obj.h;
  if (obj.mood === undefined && typeof obj.m === "string") obj.mood = obj.m;
}

export function extractJson(text: string, fallback: any): any {
  let parsed: unknown = null;

  // 1. 直接解析（AI 返回纯净 JSON 时）
  try {
    parsed = JSON.parse(text);
  } catch {}

  // 2. 从 markdown 代码块中提取 ```json {...} ```（支持无闭合的情况）
  if (!parsed)
    try {
      const m = text.match(/```(?:json)?\s*(\{[\s\S]*?\})(?:\s*```|$)/);
      if (m) parsed = JSON.parse(m[1]);
    } catch {}

  // 3. 括号计数法：提取第一个完整 JSON 对象（跳过字符串内的 {}）
  if (!parsed)
    try {
      let depth = 0;
      let start = -1;
      let inString = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' && (i === 0 || text[i - 1] !== "\\")) {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && start >= 0) {
            parsed = JSON.parse(text.slice(start, i + 1));
            break;
          }
        }
      }
    } catch {}

  if (!parsed || typeof parsed !== "object") return fallback;
  normalizeNarrativeKeys(parsed);
  return parsed;
}

/**
 * 将一条事件追加到剧情概要中。
 * 追加格式：【标题】叙事前60字…
 * 纯字符串操作，无 AI 调用。
 */
export function appendToSummary(
  currentSummary: string | null,
  event: { title: string; narrative: string }
): string {
  const truncated = event.narrative.slice(0, 60);
  const suffix = event.narrative.length > 60 ? "…" : "";
  const summaryLine = `【${event.title}】${truncated}${suffix}`;
  if (!currentSummary) return summaryLine;
  return currentSummary + "\n" + summaryLine;
}

/**
 * 判断剧情概要是否超过压缩阈值（1000 中文字符）。
 * 纯字符串长度判断，无 AI 调用。
 */
export function shouldCompress(summary: string): boolean {
  const text = summary.replace(/\n/g, "");
  return text.length > 1000;
}

import {
  SYSTEM_PROMPT_BASE,
  SYSTEM_PROMPT_CIVILIAN,
  buildSystemPrompt,
} from "./narrative/prompts/system";
export { SYSTEM_PROMPT_BASE, SYSTEM_PROMPT_CIVILIAN, buildSystemPrompt };

// ============================================================
// 玩家状态上下文（注入叙事生成，让 AI 参考年龄/金币/体力/所在地/资质）
// ============================================================

export interface CultivatorState {
  name: string;
  age: number;
  realm?: string;
  realmLevel?: number;
  gold?: number;
  stamina?: number;
  maxStamina?: number;
  health?: number;
  maxAge?: number;
  toxicity?: number;
  quarter?: number;
  locationId?: string;
  attributes?: unknown;
  occupation?: string | null;
  schoolRank?: number;
  family?: Array<{
    relation: string;
    name: string;
    age: number;
    alive?: boolean;
    occupation?: string | null;
  }>;
}

const ATTR_LABELS: Record<string, string> = {
  root: "根骨",
  bone: "根骨",
  spirit: "灵性",
  insight: "悟性",
  comprehension: "悟性",
  luck: "气运",
  fortune: "气运",
  charm: "魅力",
  mind: "心性",
};

function safeParseAttrs(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, number>;
  const p = safeJsonParse(raw as string, {} as Record<string, unknown>);
  return typeof p === "object" && p ? (p as Record<string, number>) : {};
}

/** 把玩家当前仪表盘数据拼成一段供 AI 参考的上下文。 */
export function buildStateContext(s?: CultivatorState): string {
  if (!s) return "";
  const parts: string[] = [`${s.name}，${s.age}岁`];

  // 季度
  if (typeof s.quarter === "number") parts.push(`第${s.quarter}季度`);

  // 境界
  if (s.realm && s.realm !== "凡人") {
    parts.push(`境界${s.realm} ${formatRealmLevel(s.realm, s.realmLevel ?? 0)}`);
  }

  // 体力/寿元/丹毒/金币
  if (typeof s.stamina === "number" && typeof s.maxStamina === "number") {
    parts.push(`体力${s.stamina}/${s.maxStamina}`);
  }
  if (typeof s.health === "number" && typeof s.maxAge === "number") {
    parts.push(`寿元${s.health}/${s.maxAge}`);
  }
  if (typeof s.toxicity === "number" && s.toxicity > 0) {
    parts.push(`丹毒${s.toxicity}`);
  }
  if (typeof s.gold === "number") parts.push(`金币${s.gold}`);

  // 地点氛围
  if (s.locationId) {
    const loc = LOCATIONS.find((l) => l.id === s.locationId);
    if (loc) {
      parts.push(`身处${loc.name}`);
      if (loc.description) parts.push(`氛围：${loc.description}`);
      // 添加该地点的 NPC
      const npcs = getNPCsAtLocation(s.locationId);
      if (npcs.length > 0) {
        const npcDesc = npcs
          .filter((n) => n.locationId === s.locationId)
          .map((n) => `${n.name}（${n.title}）`)
          .join("、");
        if (npcDesc) parts.push(`附近的人：${npcDesc}`);
      }
    } else parts.push(`身处未知之地（${s.locationId}）`);
  }

  // 属性
  const attrs = safeParseAttrs(s.attributes);
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => `${ATTR_LABELS[k] || k} ${v}`)
    .join("，");
  if (attrStr) parts.push(`资质（${attrStr}）`);

  // 职业/学校
  if (s.occupation) parts.push(`职业：${s.occupation}`);
  if (typeof s.schoolRank === "number" && s.schoolRank !== undefined) {
    const rankName = ["普通", "重点", "名校"][s.schoolRank] || "普通";
    parts.push(`学校：${rankName}`);
  }

  // 家庭成员
  if (s.family && s.family.length > 0) {
    const familyStr = s.family
      .filter((m) => m.alive !== false)
      .map((m) => {
        let desc = `${m.relation} ${m.name}`;
        if (m.occupation) desc += `（${m.occupation}）`;
        return desc;
      })
      .join("、");
    parts.push(`家人：${familyStr}`);
  }

  return `【玩家当前状态】${parts.join("，")}。\n注意：当前所在地点是叙事发生的场景。所有事件的环境描写、附近出现的角色、玩家可以进行的活动都必须符合当前所在地点的设定，不得无故切换地点。例如若身处"家"中则写家庭日常，在"学校"则写校园生活，在"坊市"则是交易与修仙者集会，在"野外"则有荒野探索与奇遇。`;
}

/**
 * 从 Prisma cultivator 记录快速构建 CultivatorState。
 * routes 统一使用此函数而非手写，确保所有字段一致。
 */
export function stateFromCultivator(
  c: {
    name: string;
    age: number;
    realm: string;
    realmLevel?: number | null;
    gold?: number | null;
    stamina?: number | null;
    health?: number | null;
    maxAge?: number | null;
    toxicity?: number | null;
    quarter?: number | null;
    location?: string | null;
    attributes?: unknown;
    occupation?: string | null;
    schoolRank?: number | null;
  },
  family?: CultivatorState["family"]
): CultivatorState {
  return {
    name: c.name,
    age: c.age,
    realm: c.realm,
    realmLevel: c.realmLevel ?? undefined,
    gold: c.gold ?? undefined,
    stamina: c.stamina ?? undefined,
    health: c.health ?? undefined,
    maxAge: c.maxAge ?? undefined,
    toxicity: c.toxicity ?? undefined,
    quarter: c.quarter ?? undefined,
    locationId: c.location || "home",
    attributes: c.attributes ?? undefined,
    occupation: c.occupation ?? undefined,
    schoolRank: c.schoolRank ?? undefined,
    family,
  };
}

// ============================================================
// 叙事生成函数
// ============================================================

export interface StoryEntry {
  id: string;
  title: string;
  summary: string;
  important: boolean;
  createdAt: string;
}

/**
 * 从条目数组生成组合文本，用于注入 AI prompt。
 * 纯字符串操作，无 AI 调用。
 */
export function buildSummaryFromEntries(entries: StoryEntry[]): string {
  if (entries.length === 0) return "";
  return entries.map((e) => `${e.important ? "⭐ " : ""}【${e.title}】${e.summary}`).join("\n");
}

/**
 * 创建一条新的记忆条目。
 * @param truncate - 默认 true，截断 summary 到 60 字；压缩条目传 false
 */
export function createEntry(
  title: string,
  summary: string,
  truncate = true,
  aiSummary?: string
): StoryEntry {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title,
    summary: aiSummary
      ? aiSummary.slice(0, 120) + (aiSummary.length > 120 ? "\u2026" : "")
      : truncate
        ? summary.slice(0, 60) + (summary.length > 60 ? "\u2026" : "")
        : summary,
    important: false,
    createdAt: new Date().toISOString(),
  };
}

/** 心境类型 */
export type MoodType = "燃" | "静" | "险" | "悟" | "奇";

/** 叙事类型标识 */
export type NarrativeType =
  | "DAILY_CULTIVATION"
  | "BREAKTHROUGH"
  | "ENCOUNTER"
  | "NPC_DIALOGUE"
  | "ACTION"
  | "YEAR_ADVANCE"
  | "QUARTER_ADVANCE"
  | "FAMILY_DIALOGUE"
  | "FAMILY_DEATH"
  | "BIRTH"
  | "COMBAT";

/** 所有叙事共享的基础字段 */
export interface NarrativeBase {
  type: NarrativeType;
  title: string;
  narrative: string;
  mood: MoodType;
  hint?: string;
  summary: string;
  /** AI 提议的金币变动量（正=收入，负=支出），路由层会校验并钳制后落库 */
  goldChange?: number;
  /** AI 直接输出的效果数组（替代 goldChange/intimacyDelta 等旧字段） */
  effects?: NarrativeEffect[];
  /** AI 为当前行动类型生成的下一轮候选词 */
  actionOptions?: string[];
}

/** 奇遇选项 */
export interface EncounterChoice {
  text: string;
  risk: "low" | "medium" | "high";
  hint: string;
}

/** 奇遇叙事 — 包含多选项 */
export interface EncounterNarrative extends NarrativeBase {
  type: "ENCOUNTER";
  choices: [EncounterChoice, EncounterChoice, EncounterChoice];
}

/** NPC 对话叙事 */
export interface NPCDialogueNarrative extends NarrativeBase {
  type: "NPC_DIALOGUE";
  npcMood: string;
  reward?: { itemId?: string; type?: string; description?: string } | null;
}

/** 家庭对话叙事 */
export interface FamilyDialogueNarrative extends NarrativeBase {
  type: "FAMILY_DIALOGUE";
  intimacyDelta: number;
  npcMood: string;
  actionHint?: string;
}

/** 通用叙事（日常/突破/行动/年志/出生） */
export interface RegularNarrative extends NarrativeBase {
  type: Exclude<NarrativeType, "ENCOUNTER" | "NPC_DIALOGUE" | "FAMILY_DIALOGUE">;
}

/** 出生叙事的家庭成员（由出生叙事 AI 生成） */
export interface BirthFamilyMember {
  relation: string; // "父亲" "母亲" "祖母" "姐姐" 等家庭身份
  name: string; // 中文姓名
  age: number; // 合理年龄
  alive: boolean; // 是否在世
  occupation?: string; // 职业，如"教师" "厨师" "家庭主妇"
  livingTogether?: boolean; // 是否与主角同住
}

/** 出生叙事结果：在通用叙事基础上附带家庭关系与建议姓名 */
export interface BirthNarrativeResult extends RegularNarrative {
  family?: BirthFamilyMember[];
  suggestedName?: string;
}

/** 统一的叙事结果类型 */
export type UnifiedNarrative =
  RegularNarrative | EncounterNarrative | NPCDialogueNarrative | FamilyDialogueNarrative;

/** @deprecated 使用 RegularNarrative 替代 */
export type NarrativeResult = RegularNarrative;

/** 生成日常修炼叙事 */
export async function generateDailyCultivationNarrative(params: {
  cultivatorName: string;
  spiritualRoot: SpiritualRoot;
  realm: string;
  realmLevel: number;
  taskType: string;
  taskDescription?: string;
  cultivationExp: number;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  const taskNames: Record<string, string> = {
    STUDY: "悟道",
    EXERCISE: "锻体",
    SLEEP: "静修",
    MEDITATE: "打坐",
    CUSTOM: "历练",
  };
  let prompt = `生成一段现代背景的修炼日常叙事。

【修炼者信息】道号：${params.cultivatorName}，灵根：${params.spiritualRoot}，境界：${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}，修炼值：${params.cultivationExp}
【今日修炼】方式：${taskNames[params.taskType] || "修炼"}${params.taskDescription ? `，描述：${params.taskDescription}` : ""}

要求：150-250字，体现灵根和境界特点

返回JSON：{"type":"DAILY_CULTIVATION","title":"标题","narrative":"正文","mood":"静/悟/燃","hint":"提示","goldChange":0}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(),
      userPrompt: prompt,
      maxTokens: 800,
      temperature: 0.8,
    });
    const result = extractJson(text, {
      type: "DAILY_CULTIVATION" as const,
      title: "日常修炼",
      narrative: "",
      mood: "静",
      hint: "持之以恒",
      summary: `${params.cultivatorName}潜心修炼。`,
    });
    if (!result.narrative) throw new Error("AI返回内容为空");
    return result;
  } catch (e) {
    logger.error("日常叙事AI生成失败:", e);
    if (e instanceof AllProvidersFailedError) throw e;
    throw new Error(`叙事生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
}

/** 生成境界突破叙事 */
export async function generateBreakthroughNarrative(params: {
  cultivatorName: string;
  spiritualRoot: SpiritualRoot;
  fromRealm: string;
  fromLevel: number;
  toRealm: string;
  toLevel: number;
  totalExp: number;
  breakthroughCount: number;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  const isNewRealm = params.fromRealm !== params.toRealm;
  const scene = isNewRealm
    ? `突破大境界：从 ${params.fromRealm} 到 ${params.toRealm}！`
    : `${params.fromRealm} ${formatRealmLevel(params.fromRealm, params.fromLevel)} → ${formatRealmLevel(params.fromRealm, params.toLevel)}`;
  let prompt = `生成一段境界突破的叙事（现代背景）。

【修炼者】${params.cultivatorName}，灵根${params.spiritualRoot}，第${params.breakthroughCount + 1}次突破，累计修炼${params.totalExp}
【突破】${scene}

要求：${isNewRealm ? "300-500字，天地异动" : "200-300字，修为精进"}
返回JSON：{"type":"BREAKTHROUGH","title":"标题","narrative":"正文","mood":"燃","hint":"建议"}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(),
      userPrompt: prompt,
      maxTokens: 1000,
      temperature: 0.9,
    });
    const result = extractJson(text, {
      type: "BREAKTHROUGH" as const,
      title: `${params.toRealm}突破！`,
      narrative: "",
      mood: "燃",
      hint: "恭喜突破",
      summary: `${params.cultivatorName}成功突破至${params.toRealm}。`,
    });
    if (!result.narrative) throw new Error("AI返回内容为空");
    return result;
  } catch (e) {
    logger.error("突破叙事AI生成失败:", e);
    if (e instanceof AllProvidersFailedError) throw e;
    throw new Error(`叙事生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
}

/** 生成随机奇遇叙事 */
export async function generateEncounterNarrative(params: {
  cultivatorName: string;
  spiritualRoot: SpiritualRoot;
  realm: string;
  realmLevel: number;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<EncounterNarrative> {
  let prompt = `生成一段奇遇事件（现代背景）。

【修炼者】${params.cultivatorName}，灵根${params.spiritualRoot}，境界${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}

要求：200-300字，给出3个选项（低/中/高风险）
返回JSON：{"type":"ENCOUNTER","title":"标题","narrative":"场景","choices":[{"text":"选项","risk":"low/medium/high","hint":"提示"}],"mood":"奇/险","summary":"30字内概述","goldChange":0}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(),
      userPrompt: prompt,
      maxTokens: 800,
      temperature: 0.9,
    });
    const result = extractJson(text, {
      type: "ENCOUNTER" as const,
      title: "意外发现",
      narrative: "",
      choices: [
        { text: "小心探查", risk: "low", hint: "稳扎稳打" },
        { text: "深入探索", risk: "medium", hint: "风险与机遇并存" },
        { text: "全力闯入", risk: "high", hint: "富贵险中求" },
      ],
      mood: "奇",
      summary: `${params.cultivatorName}发现一处不对劲的地方。`,
    });
    if (!result.narrative) throw new Error("AI返回内容为空");
    return result;
  } catch (e) {
    logger.error("奇遇AI生成失败:", e);
    if (e instanceof AllProvidersFailedError) throw e;
    throw new Error(`叙事生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
}

/** 生成 NPC 对话 */
export async function generateNPCDialogue(params: {
  npcName: string;
  npcPersonality: string;
  npcRealm: string;
  cultivatorName: string;
  cultivatorRealm: string;
  historySummary?: string;
}): Promise<NPCDialogueNarrative> {
  const prompt = `生成一段NPC对话（现代背景）。

【NPC】${params.npcName}，性格${params.npcPersonality}，境界${params.npcRealm}
【玩家】${params.cultivatorName}，境界${params.cultivatorRealm}${params.historySummary ? `，过往：${params.historySummary}` : ""}

要求：200-300字，对话贴合NPC性格，可能给指点/礼物/任务
返回JSON：{"type":"NPC_DIALOGUE","title":"与${params.npcName}的对话","narrative":"对话内容","mood":"？","npcMood":"友善/冷淡/严厉","reward":{...}或null","summary":"30字内概述"}`;

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(),
      userPrompt: prompt,
      maxTokens: 800,
      temperature: 0.8,
    });
    const result = extractJson(text, {
      type: "NPC_DIALOGUE" as const,
      title: `与${params.npcName}的对话`,
      narrative: "",
      mood: "奇",
      npcMood: "友善",
      summary: `与${params.npcName}交谈。`,
    });
    if (!result.narrative) throw new Error("AI返回内容为空");
    return result;
  } catch (e) {
    logger.error("NPC对话AI生成失败:", e);
    if (e instanceof AllProvidersFailedError) throw e;
    throw new Error(`叙事生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
}

/** 生成行动叙事 */
export async function generateActionNarrative(params: {
  cultivatorName: string;
  spiritualRoot: string;
  realm: string;
  realmLevel: number;
  age: number;
  worldId?: string;
  actionName: string;
  actionDescription: string;
  freeInput?: string;
  npcIds?: string[];
  npcNames?: string[];
  expGained: number;
  isAwakened: boolean;
  awakenEvent: boolean;
  storySummary?: string;
  state?: CultivatorState;
  giftDecision?: { givesGold: number; reason: string };
}): Promise<NarrativeResult> {
  const realmStr =
    params.realm === "凡人"
      ? "凡人"
      : `${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}`;
  const ageContext =
    params.age <= 3
      ? "幼儿"
      : params.age <= 6
        ? "孩童"
        : params.age <= 12
          ? "少年"
          : params.age <= 15
            ? "即将成年的少年"
            : "修炼者";
  const selectedNpcNames = (params.npcNames ?? [])
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .map((name) => name.trim());
  const selectedTargetText = selectedNpcNames.join("、");
  let prompt = `写一段行动叙事，现代背景、现代白话。

【角色】${params.cultivatorName}，${params.age}岁${ageContext}，灵根${params.spiritualRoot}，境界${realmStr}
${params.isAwakened ? "" : "- 尚未觉醒，仍为凡人"}
${params.awakenEvent ? "- 觉醒时刻！" : ""}
【行动】${params.actionName}：${params.actionDescription}
${params.freeInput ? `玩家描述：${params.freeInput}` : ""}
${selectedTargetText ? `【本次行动目标】${selectedTargetText}。玩家已明确选中该角色；即使玩家描述未出现其姓名或称谓，也必须理解为主角主动对该目标执行本次行动。` : "【本次行动目标】无。请围绕主角独自行动或现场随机对象展开，不要凭空添加未指定的NPC。"}
获得修炼值：${params.expGained}
${params.giftDecision ? `【服务端结算】本次行动馈赠：获得金币 ${params.giftDecision.givesGold}；原因：${params.giftDecision.reason}` : ""}

【叙事规则】
- 若【服务端结算】中本次行动馈赠金币为 0，不得描写主角收到现金、零花钱、红包、转账或具体金额；可写 NPC 安抚、拒绝、承诺以后再说、给了口头鼓励等。
- 若【服务端结算】中本次行动馈赠金币大于 0，可描写主角获得零花钱/资助，但金额必须以服务端结算值为准，不得擅自写成其他数额或额外财物。
- 输入框内容是主角当前主动要做的事，不是别人要求主角做。
- 叙事必须保持主语一致：主角是动作发出者。若玩家输入是“叫妈妈”，必须写成主角主动叫，不能写成“母亲让我叫妈妈”“被人叫着叫妈妈”。
- 【本次行动目标】存在时，该目标是主角本次行动的明确对象而非普通背景人物；即使玩家描述未出现其姓名或称谓，也必须围绕主角主动对该目标的行为来写，不能改写为对其他角色的互动。
- 若通过 npcNames 传入了选中角色（如"赵母"、"母亲"），该角色必须出现在正文中作为主要互动对象或明确参与者，不得无依据将其替换为其他未选中角色（如父亲、陌生人等）。其他角色可作为背景出现，但不能抢占玩家指定对象的互动主线。
- 若玩家输入明确指向"妈妈/母亲/爸爸/父亲"等具体关系，其优先级高于 AI 自行补充的其他家庭成员。
- 只在玩家输入基础上做合理补全，不要改写基本意图，不要擅自增加角色间的命令关系。
- 合理性约束：NPC 是否会答应/给予，要结合年龄、关系、情境与常理判断，不能无条件满足。例如：1岁幼儿向父亲要钱，父亲更可能摇头/哄孩子/给少量零花钱或直接拒绝；成年人/学生要钱可能给，但也要符合人物性格与经济状况。
- 叙事结果必须与合理性一致：若请求不合理，可写“父亲皱了皱眉，摸了摸他的头说等他再大一点再说”；若合理，可写“父亲犹豫了一下，掏出10块钱递给他”。不要为了剧情爽点强行改写人物反应。
- 年龄行为约束：不同年龄的行为要符合现实。1-3 岁以被动照料为主，4-6 岁可做简单互动，7-12 岁可自主表达，13-18 岁可表达复杂意愿但仍有监护人约束。不要写低龄角色主动大额索要现金、独自复杂交易。
- 关系行为约束：亲属、师生、朋友、陌生人应对方式不同。对陌生人不要轻易信任、不要随意接受大量馈赠；对亲人可撒娇但也要符合家庭情境。
- 语气对应：玩家若用礼貌请求，NPC 更可能答应；若用命令/威胁式语气，NPC 更可能拒绝或仅小幅让步。

【叙事尺度——必须做到】
- 只写这一次具体行动：主角做了什么、当场发生了什么、和哪些人（邻居/家人/同事/陌生人）或事物（一盆花、一件旧物、一只猫、一道墙）产生了怎样的关系或互动
- 聚焦当下这一件事，不要升华到命运、时代、天地、大道、因果等宏大主题，不要拔高成"传奇的一刻""改变一生的抉择""时代的尘埃"等史诗腔
- 用具体细节代替抽象感慨（如写"他擦了擦额头的汗，把桶里的水浇在番茄苗上"而非"他感悟了劳作的真谛"）
- 未觉醒角色不能出现超凡元素；已觉醒角色按其境界自然写即可，不要刻意宏大

要求：120-220字，符合年龄认知，有烟火气，不要宏大叙事
返回JSON：{"type":"ACTION","title":"标题(10字内)","narrative":"正文(120-220字)","mood":"静/悟/燃/险/奇","hint":"一句接地气的下一步建议(10-20字)","summary":"20-30字概述，聚焦这次行动本身，不要拔高"}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  const trimmedFreeInput = (params.freeInput ?? "").trim();
  const hasSpecificIntent = /[\u4e00-\u9fff]/.test(trimmedFreeInput);

  let postHint = "继续探索";
  if (params.actionName === "与人交谈") postHint = "找人多聊聊";
  if (params.actionName === "四处闲逛") postHint = "走走看看";
  if (params.actionName === "自由探索") postHint = "随心行动";

  try {
    let text = await callAI({
      systemPrompt: buildSystemPrompt(params.worldId),
      userPrompt: prompt,
      maxTokens: 2000,
      temperature: 0.85,
    });
    if (!text || !text.trim()) {
      text = await callAI({
        systemPrompt: buildSystemPrompt(params.worldId),
        userPrompt: prompt,
        maxTokens: 2000,
        temperature: 0.85,
      });
    }
    const result = extractJson(text, {
      type: "ACTION" as const,
      title: params.actionName,
      narrative: "",
      mood: "悟",
      hint: postHint,
      summary: `${params.cultivatorName}${params.actionName}。`,
    });
    if (!result.narrative || !result.narrative.trim()) {
      throw new Error("AI返回内容为空");
    }
    return result;
  } catch (e) {
    logger.error("行动叙事AI生成失败:", e);
    if (e instanceof AllProvidersFailedError) throw e;
    throw new Error(`叙事生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
}

/** 生成年志叙事 */
export async function generateYearAdvanceNarrative(params: {
  cultivatorName: string;
  spiritualRoot: string;
  realm: string;
  realmLevel: number;
  oldAge: number;
  newAge: number;
  totalExp: number;
  worldId?: string;
  extraContext?: string;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  const realmStr =
    params.realm === "凡人"
      ? "凡人"
      : `${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}`;
  let prompt = `写一段现代背景下的时间推进叙事。

【角色】${params.cultivatorName}，${params.oldAge}岁→${params.newAge}岁（这是仅有的一个年龄变化！必须聚焦这一年发生的事，不要跨越多年、不要写"X至Y岁期间"这种多年跨度），灵根${params.spiritualRoot}，境界${realmStr}，累计修炼${params.totalExp}
${params.extraContext ? `\n【背景】${params.extraContext}` : ""}

要求：
- 100-200 字，只写 ${params.oldAge} 岁到 ${params.newAge} 岁这一年发生的事
- 凡人/未觉醒角色严禁出现任何修仙、灵气、灵根、修真、修炼、仙侠、境界、法术、觉醒等字眼
- 已觉醒角色按其境界自然描写即可，不要刻意强调世界观
- summary 与 narrative 写不同侧面，避免重复
- 严禁使用"X至Y岁期间""几年间""这些年来"等多年跨度表达

返回JSON：{"type":"YEAR_ADVANCE","title":"标题(10字内)","narrative":"正文(100-200字)","mood":"静/悟/燃/奇","hint":"展望(10-20字)","summary":"20-30字概述，须聚焦这一年里与正文不同的侧面"}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(params.worldId),
      userPrompt: prompt,
      maxTokens: 600,
      temperature: 0.8,
    });
    const result = extractJson(text, {
      type: "YEAR_ADVANCE" as const,
      title: `${params.cultivatorName}的第${params.newAge}年`,
      narrative: "",
      mood: "静",
      hint: "岁月不居",
      summary: `${params.cultivatorName}又长大了一岁。`,
    });
    if (!result.narrative) throw new Error("AI返回内容为空");
    return result;
  } catch (e) {
    logger.error("年度叙事AI生成失败:", e);
    if (e instanceof AllProvidersFailedError) throw e;
    throw new Error(`叙事生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
}

/** 生成家庭对话 */
export async function generateFamilyDialogue(params: {
  familyMemberName: string;
  familyMemberRelation: string;
  familyMemberAge: number;
  intimacy: number;
  cultivatorName: string;
  cultivatorAge: number;
  cultivatorRealm: string;
  cultivatorRealmLevel: number;
  playerMessage: string;
  dialogueHistory: { role: "player" | "npc"; content: string }[];
  worldId?: string;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<FamilyDialogueNarrative> {
  const recentHistory = params.dialogueHistory
    .slice(-5)
    .map((d) => `${d.role === "player" ? "主角" : params.familyMemberRelation}：${d.content}`)
    .join("\n");
  let prompt = `生成一段家庭日常对话。

【NPC】${params.familyMemberName}（${params.familyMemberRelation}），${params.familyMemberAge}岁，亲密度${params.intimacy}/100
【主角】${params.cultivatorName}，${params.cultivatorAge}岁，境界${params.cultivatorRealm}
【玩家说】${params.playerMessage}
${recentHistory ? `【最近对话】\n${recentHistory}` : ""}

要求：50-120字，口语化，亲密度高时亲切低时冷淡
返回JSON：{"type":"FAMILY_DIALOGUE","title":"家庭对话","narrative":"对话内容","mood":"静","intimacyDelta":-5~5,"npcMood":"开心/生气/平淡/担忧","actionHint":"NPC可能行动","summary":"30字内概述","goldChange":0}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(params.worldId),
      userPrompt: prompt,
      maxTokens: 500,
      temperature: 0.85,
    });
    const result = extractJson(text, {
      type: "FAMILY_DIALOGUE" as const,
      title: "家庭对话",
      narrative: "",
      mood: "静",
      intimacyDelta: 0,
      npcMood: "平淡",
      summary: `与${params.familyMemberRelation}交谈。`,
    });
    if (!result.narrative) throw new Error("AI返回内容为空");
    return result;
  } catch (e) {
    logger.error("家庭对话AI生成失败:", e);
    throw new Error(`叙事生成失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
}

/** 先天禀赋 → 中性（非修仙）描述，避免叙事中出现世界观字眼 */
const BIRTH_TRAIT_MAP: Record<string, string> = {
  废柴: "先天体弱，需要更多呵护",
  凡人: "资质寻常，和大多数孩子一样",
  俊杰: "天资聪颖，显得格外机灵",
  天骄: "天赋卓绝，从小便引人注目",
  妖孽: "百年难遇的异禀之才",
  谪仙转世: "带着一分说不清的神秘气韵",
  大道之子: "仿佛自出生便被命运眷顾",
};

/** 出生叙事备用名 — 当 AI 返回无效姓名时使用 */
const BIRTH_FALLBACK_NAMES = ["小石头", "小宝", "阿福", "小安"];
export function fallbackBirthName(): string {
  return BIRTH_FALLBACK_NAMES[Math.floor(Math.random() * BIRTH_FALLBACK_NAMES.length)];
}

/**
 * 检查叙事正文、suggestedName 与 family 三者一致。
 * 返回错误列表，数组为空表示完全一致。
 */
export function validateBirthConsistency(
  narrative: string,
  suggestedName: string,
  family: BirthFamilyMember[]
): string[] {
  const errors: string[] = [];

  if (!narrative) {
    errors.push("叙事正文为空");
    return errors;
  }

  // 1) 主角姓名必须在正文中出现
  if (suggestedName && !narrative.includes(suggestedName)) {
    errors.push(`建议姓名"${suggestedName}"未出现在叙事正文中`);
  }

  // 2) 每个家庭成员的姓名和关系应在正文中体现
  const seenRelations = new Set<string>();
  for (const m of family) {
    // 关系基本校验
    if (!m.relation || !m.relation.trim()) {
      errors.push(`家庭成员"${m.name}"的关系为空`);
      continue;
    }
    if (!m.name || !m.name.trim()) {
      errors.push(`关系"${m.relation}"的姓名为空`);
      continue;
    }
    if (typeof m.age !== "number" || m.age < 0 || m.age > 150) {
      errors.push(`"${m.relation} ${m.name}"的年龄不合理(${m.age})`);
    }
    if (typeof m.alive !== "boolean") {
      errors.push(`"${m.relation} ${m.name}"的alive不是布尔值`);
    }

    // 姓名必须在正文中出现（粗略检查）
    if (!narrative.includes(m.name)) {
      errors.push(`"${m.relation} ${m.name}"的姓名未出现在叙事正文中`);
    }

    // 关系去重（仅对核心直系关系做精确匹配）
    const coreRel = (() => {
      for (const [core, syns] of Object.entries({
        父亲: ["父亲", "爸爸", "爹"],
        母亲: ["母亲", "妈妈", "娘"],
        祖父: ["祖父", "爷爷"],
        祖母: ["祖母", "奶奶"],
        哥哥: ["哥哥", "兄"],
        姐姐: ["姐姐", "姐", "姊"],
        弟弟: ["弟弟", "弟"],
        妹妹: ["妹妹", "妹"],
      })) {
        if (syns.includes(m.relation) || m.relation === core) return core;
      }
      return m.relation;
    })();
    if (coreRel === "父亲" || coreRel === "母亲" || coreRel === "祖父" || coreRel === "祖母") {
      if (seenRelations.has(coreRel)) {
        errors.push(`关系"${m.relation}"出现重复（已有同名关系成员）`);
      } else {
        seenRelations.add(coreRel);
      }
    }
  }

  // 3) 如果正文提到了核心家庭成员关系词，检查是否在 family 中有对应
  // 口语与书面语映射
  const relationSynonyms: Record<string, string[]> = {
    父亲: ["父亲", "爸爸", "爹"],
    母亲: ["母亲", "妈妈", "娘"],
    祖父: ["祖父", "爷爷", "阿公"],
    祖母: ["祖母", "奶奶", "阿婆"],
    外公: ["外公", "外祖父"],
    外婆: ["外婆", "外祖母"],
    哥哥: ["哥哥", "兄"],
    姐姐: ["姐姐", "姐", "姊"],
    弟弟: ["弟弟", "弟"],
    妹妹: ["妹妹", "妹"],
  };
  // 扁平化：口语词 → 核心关系
  const colToCore: Record<string, string> = {};
  for (const [core, cols] of Object.entries(relationSynonyms)) {
    for (const c of cols) colToCore[c] = core;
  }

  // 正文中提到的所有关系词
  const mentionedCoreRelations = new Set<string>();
  for (const [core, cols] of Object.entries(relationSynonyms)) {
    for (const col of cols) {
      if (narrative.includes(col)) {
        mentionedCoreRelations.add(core);
        break;
      }
    }
  }

  // family 中的核心关系（直接使用 synonym 映射判断）
  const familyCoreRelations = new Set<string>();
  for (const m of family) {
    const rel = m.relation;
    // 从 synonym 反查核心关系
    let core = rel;
    for (const [ckey, vals] of Object.entries(relationSynonyms)) {
      if (vals.includes(rel) || rel === ckey) {
        core = ckey;
        break;
      }
    }
    familyCoreRelations.add(core);
  }

  for (const core of mentionedCoreRelations) {
    if (!familyCoreRelations.has(core)) {
      // 特殊处理："弟弟"/"妹妹" 可能指代主角本人，如果 suggestedName 出现在附近则跳过
      if (
        (core === "弟弟" || core === "妹妹") &&
        suggestedName &&
        narrative.includes(suggestedName)
      ) {
        continue;
      }
      const example = relationSynonyms[core]?.[0] || core;
      errors.push(`正文提及"${example}"，但 family 中无对应成员`);
    }
  }

  return errors;
}

/** 生成出生叙事（凡人写实风格，不出现任何修仙/世界观设定） */
export async function generateBirthNarrative(params: {
  cultivatorName?: string;
  spiritualRoot?: string;
  worldName?: string;
  identityName?: string;
  age?: number;
  worldId?: string;
  family?: BirthFamilyMember[];
  storySummary?: string;
  birthTier?: string;
  state?: CultivatorState;
}): Promise<BirthNarrativeResult> {
  const trait = params.birthTier ? BIRTH_TRAIT_MAP[params.birthTier] || params.birthTier : "寻常";
  const identityStr = params.identityName ? `家庭背景：${params.identityName}。` : "";
  // 出生叙事始终聚焦出生现场，无论 params.age 为何值
  const ageHint =
    "请聚焦在主角出生当天或刚出生不久的场景（分娩、产房或家中迎接新生儿、家人第一次见到孩子、取名等出生现场），不要写周岁日常、学步、吃饭、玩耍等一岁生活片段，也不要跨越多个年龄阶段。";
  let prompt = `写一个普通人在现代社会的故事片段，温暖而有烟火气。

${identityStr}这孩子的先天禀赋：${trait}。

${ageHint}

要求与注意事项：
- 只描写平凡生活：家人的期盼、家中的场景、邻里街坊的闲谈
- 严禁出现任何修仙、灵气、灵根、修真、修炼、仙侠、境界、法术、超自然、觉醒、天道、机缘、悟道、闭关等字眼
- 严禁使用否定句式绕开禁令（如"没有灵气""不像某些故事里""与修仙无关""觉醒前最普通的日常"等）。把这些概念当作完全不存在来写
- 严禁向读者点明或暗示"这是某种世界观"。你写的就是真实的现代生活，不要加旁白解释

【家庭构成要求】
- 叙事正文必须自然说明家庭的基本构成：有哪些家庭成员（仅限于父母、兄弟姐妹等直系亲属，不包括祖辈、叔伯、姑舅、堂表等旁系亲属），他们的身份、姓名、大致年龄，以及是否同住
- 不能只列姓名而不交代关系。例如不要写"李建国走了过来"却不说明他是父亲还是邻居
- family数组只收录直系亲属（父亲、母亲、兄弟姐妹），不得包含祖辈（祖父/祖母/外公/外婆）、叔伯、姑舅、堂表等旁系亲属
- 每位成员的 relation、name、age、alive 必须与正文一致
- suggestedName 必须与正文中给主角取的名字完全一致
- 禁止出现关系与姓名矛盾：正文写"父亲李建国"，但 family 中"李建国"的 relation 却是"舅舅"
- 输出前请自检：检查正文、suggestedName、family 三者是否一致

输出JSON：
{"type":"BIRTH","title":"标题(10字内)","narrative":"叙事正文(200-350字，纯散文，不要出现任何JSON或括号结构)","mood":"悟/奇/静/燃","hint":"寄语(10-20字)","summary":"20-30字概述。聚焦一个与正文不同的侧面（如家庭氛围、某个家庭成员的趣闻、邻里印象、孩子的性格特征），不要复述正文已经写过的年龄段、场景或事件，不要与正文重复","suggestedName":"孩子的姓名","family":[{"relation":"父亲","name":"姓名","age":38,"alive":true,"occupation":"职业","livingTogether":true},{"relation":"母亲","name":"姓名","age":36,"alive":true,"occupation":"职业","livingTogether":true}]}`;

  // 出生叙事不使用 buildStateContext（含年龄信息会误导 AI 写一岁日常）
  // 只传递家庭背景这一适用信息
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({
      systemPrompt: SYSTEM_PROMPT_CIVILIAN,
      userPrompt: prompt,
      // Reasoning 型 provider 会在小预算内耗尽输出配额，导致 content 为空。
      maxTokens: 2000,
      temperature: 0.85,
    });
    const result = extractJson(text, {
      type: "BIRTH",
      title: "新生命降临",
      narrative: "",
      mood: "奇",
      hint: "",
      summary: "",
      suggestedName: params.cultivatorName || "",
      family: [],
    });
    if (!result.narrative || !result.narrative.trim()) {
      const snippet = text.length > 400 ? text.slice(0, 400) + "..." : text;
      throw new Error(
        `出生叙事AI返回内容为空。AI原始响应(前400字): ${snippet.replace(/\n/g, " ")}`
      );
    }
    // ── suggestedName 验证 ──────────────────────────────
    const raw = (result.suggestedName || "").trim();
    const isValidName = /^[\u4e00-\u9fff]{2,4}$/.test(raw);
    if (isValidName) {
      result.suggestedName = raw;
    } else {
      result.suggestedName = params.cultivatorName?.trim() || fallbackBirthName();
    }
    // 确保 family 非空
    if (!result.family || result.family.length === 0) {
      result.family = params.family && params.family.length > 0 ? params.family : [];
    }

    // 过滤：只保留直系亲属（父母、兄弟姐妹）
    const IMMEDIATE_RELATIONS = new Set([
      "父亲",
      "母亲",
      "爸爸",
      "妈妈",
      "爹",
      "娘",
      "哥哥",
      "姐姐",
      "弟弟",
      "妹妹",
      "兄长",
      "长兄",
      "大哥",
      "二哥",
      "小弟",
      "大姐",
      "二姐",
      "小妹",
      "兄弟",
      "姐妹",
    ]);
    result.family = result.family.filter((m: BirthFamilyMember) =>
      IMMEDIATE_RELATIONS.has(m.relation)
    );

    // ── 三方一致性校验 ──────────────────────────────────
    const named = result.suggestedName || "";
    const errors = validateBirthConsistency(result.narrative, named, result.family);
    if (errors.length > 0) {
      console.warn("出生叙事家庭一致性校验发现不一致:", errors.join("; "));
      // 尝试一次 AI 修正：将错误列表发给 AI 重新生成
      try {
        const fixPrompt = `${prompt}\n\n【以上输出存在不一致，请修正后重新输出完整JSON】\n不一致问题：\n${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\n请重新生成JSON，确保正文、suggestedName、family 三者完全一致。`;
        const fixText = await callAI({
          systemPrompt: SYSTEM_PROMPT_CIVILIAN,
          userPrompt: fixPrompt,
          maxTokens: 2000,
          temperature: 0.7,
        });
        const fixResult: BirthNarrativeResult = extractJson(fixText, {
          type: "BIRTH",
          title: result.title || "新生命降临",
          narrative: result.narrative,
          mood: result.mood || "奇",
          hint: result.hint || "",
          summary: result.summary || "",
          suggestedName: named,
          family: [...(result.family || [])],
        });
        // 仅当修正结果有意义且通过校验时才使用
        if (fixResult.narrative?.trim() && fixResult.suggestedName) {
          const fixName = fixResult.suggestedName.trim();
          const fixNameOk = /^[\u4e00-\u9fff]{2,4}$/.test(fixName);
          const fixedName = fixNameOk ? fixName : named;
          const fixErrors = validateBirthConsistency(
            fixResult.narrative,
            fixedName,
            fixResult.family || []
          );
          if (fixErrors.length === 0) {
            // 修正通过
            result.narrative = fixResult.narrative;
            result.title = fixResult.title;
            result.mood = fixResult.mood;
            result.hint = fixResult.hint || "";
            result.summary = fixResult.summary || "";
            result.suggestedName = fixedName;
            result.family = fixResult.family || [];
            console.log("出生叙事AI修正成功");
          } else {
            console.warn("出生叙事AI修正仍未通过一致性校验:", fixErrors.join("; "));
          }
        }
      } catch (e) {
        console.warn("出生叙事AI修正请求失败，使用原始结果:", e);
      }
    }
    return result;
  } catch (e) {
    logger.error("出生叙事AI生成失败:", e);
    // 保留 provider 的结构化错误，让 API 层继续分类为可展示的脱敏错误。
    if (e instanceof AllProvidersFailedError) throw e;
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`出生叙事AI生成失败: ${detail}`);
  }
}

/**
 * 调用 AI 将剧情概要压缩到 500 字以内。
 * 接收 StoryEntry[]，区分重要/普通条目。
 * 压缩失败返回普通条目的文本拼接。
 */
export async function compressStorySummary(
  entries: StoryEntry[],
  cultivatorName: string
): Promise<string> {
  const importantEntries = entries.filter((e) => e.important);
  const normalEntries = entries.filter((e) => !e.important);

  let prompt = `你是一个小说编辑。将以下剧情概要压缩到500字以内。

【修炼者】${cultivatorName}

`;

  if (importantEntries.length > 0) {
    prompt += `重要事件（必须保留）：\n${importantEntries.map((e) => `⭐ 【${e.title}】${e.summary}`).join("\n")}\n\n`;
  }
  if (normalEntries.length > 0) {
    prompt += `其他事件（可精简合并）：\n${normalEntries.map((e) => `【${e.title}】${e.summary}`).join("\n")}\n\n`;
  }

  prompt += `要求：重要事件必须完整保留，其他事件可合并或精简。直接输出压缩后的纯文本，不要 JSON 格式。`;

  try {
    const text = await callAI({
      systemPrompt: "你是一个熟练的文本编辑。",
      userPrompt: prompt,
      maxTokens: 1024,
      temperature: 0.3,
    });
    return text.slice(0, 500);
  } catch {
    return [
      ...importantEntries.map((e) => `⭐ 【${e.title}】${e.summary}`),
      ...normalEntries.map((e) => `【${e.title}】${e.summary}`),
    ].join("\n");
  }
}

// ============================================================
// 战斗叙事
// ============================================================

/** 生成战斗叙事 */
export async function generateCombatNarrative(params: {
  cultivatorName: string;
  enemyName: string;
  result: "win" | "lose";
  style: "overwhelm" | "hard_fought" | "underdog" | "comedy" | "crushed";
  playerRealm: string;
  enemyRealm: string;
}): Promise<string> {
  const styleMap: Record<string, string> = {
    overwhelm: `${params.cultivatorName}随手一挥，劲风扫过，${params.enemyName}当场被掀飞出去。`,
    hard_fought: `缠斗良久，${params.cultivatorName}抓住破绽一击命中，${params.enemyName}轰然倒地。`,
    underdog: `绝境中${params.cultivatorName}爆发出全部潜能，一拳轰碎${params.enemyName}！`,
    comedy: `${params.cultivatorName}被一块石头绊倒，${params.enemyName}一脸困惑地看着你。`,
    crushed: `${params.cultivatorName}连${params.enemyName}的衣角都没碰到就被打飞出去。`,
  };
  const defaultText =
    styleMap[params.style] || `${params.cultivatorName}与${params.enemyName}展开了战斗。`;

  const prompt = `写一段战斗叙事（现代背景），不超过150字。

【胜者】${params.result === "win" ? params.cultivatorName : params.enemyName}
【败者】${params.result === "win" ? params.enemyName : params.cultivatorName}
【风格】${params.style}
【玩家境界】${params.playerRealm}
【敌人境界】${params.enemyRealm}

直接输出叙事文本，不要 JSON。`;

  try {
    const text = await callAI({
      systemPrompt: "你是一个现代背景小说的战斗描写作者。",
      userPrompt: prompt,
      maxTokens: 300,
      temperature: 0.8,
    });
    return text.slice(0, 300) || defaultText;
  } catch {
    return defaultText;
  }
}
