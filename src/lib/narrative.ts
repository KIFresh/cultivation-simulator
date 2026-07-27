// ============================================================
// AI 叙事引擎 — 多供应方自动切换
// ============================================================

import { SpiritualRoot, formatRealmLevel, LOCATIONS } from "./cultivation-data";
import { getWorldAIPrompt } from "./worlds-data";

// ============================================================
// 供应方配置
// ============================================================

interface ProviderConfig {
  priority: number;
  type: "anthropic" | "openai" | "ollama";
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

let runtimeSettings: Record<string, string> | null = null;

export async function syncProviderConfig(): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const settings = await prisma.appSetting.findMany();
    runtimeSettings = {};
    settings.forEach((s) => { runtimeSettings![s.key] = s.value; });
  } catch (e) {
    console.error("同步 AI 供应方配置失败:", e);
    runtimeSettings = null;
  }
}

// 预热 AI 供应方连接（最佳努力，绝不 reject；由 /api/warmup 在后台调用）
export async function warmupAI(): Promise<void> {
  try {
    await syncProviderConfig().catch(() => {});
    const providers = loadProviders();
    if (providers.length === 0) return;
    // 仅做一次极轻量调用以建立连接/预热缓存
    await callAI({
      systemPrompt: "你是连接预热助手。",
      userPrompt: "ping",
      maxTokens: 1,
      temperature: 0,
    }).catch(() => {});
  } catch {
    /* 预热失败不影响主流程 */
  }
}

function loadProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  for (let i = 1; i <= 3; i++) {
    const type = runtimeSettings?.[`AI_PROVIDER_${i}`] || process.env[`AI_PROVIDER_${i}`] as string;
    if (!type) continue;
    const apiKey = runtimeSettings?.[`AI_PROVIDER_${i}_KEY`] || process.env[`AI_PROVIDER_${i}_KEY`] || undefined;
    const model = runtimeSettings?.[`AI_PROVIDER_${i}_MODEL`] || process.env[`AI_PROVIDER_${i}_MODEL`] || "";
    const baseUrl = runtimeSettings?.[`AI_PROVIDER_${i}_BASE_URL`] || process.env[`AI_PROVIDER_${i}_BASE_URL`] || undefined;
    if ((type === "anthropic" || type === "openai") && !apiKey) continue;
    if (type === "ollama" && !baseUrl) continue;
    providers.push({ priority: i, type: type as ProviderConfig["type"], apiKey, model, baseUrl });
  }
  return providers;
}

async function callAI(params: { systemPrompt: string; userPrompt: string; maxTokens?: number; temperature?: number }): Promise<string> {
  // 每次调用都同步配置，确保用户最新保存的 AI 供应方生效
  await syncProviderConfig().catch((e) => {
    console.error("callAI: syncProviderConfig 失败", e);
  });
  const providers = loadProviders();
  if (providers.length === 0) throw new Error("NO_PROVIDER_CONFIGURED");

  for (const provider of providers) {
    try {
      const model = provider.model;
      const temperature = params.temperature ?? 0.8;
      const maxTokens = params.maxTokens ?? 500;

      switch (provider.type) {
        case "anthropic": {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey: provider.apiKey });
          const resp = await client.messages.create({
            model, max_tokens: maxTokens, system: params.systemPrompt,
            messages: [{ role: "user", content: params.userPrompt }], temperature,
          });
          return (resp.content as Array<{ type: string; text?: string }>).filter((c) => c.type === "text").map((c) => c.text || "").join("");
        }
        case "openai": {
          const OpenAI = (await import("openai")).default;
          const client = new OpenAI({ apiKey: provider.apiKey, ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}) });
          const resp = await client.chat.completions.create({
            model, max_tokens: maxTokens, temperature,
            messages: [{ role: "system", content: params.systemPrompt }, { role: "user", content: params.userPrompt }],
          });
          return resp.choices[0]?.message?.content || "";
        }
        case "ollama": {
          const baseUrl = (provider.baseUrl || "http://localhost:11434").replace(/\/$/, "");
          const resp = await fetch(`${baseUrl}/api/chat`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, stream: false, options: { temperature, num_predict: maxTokens }, messages: [{ role: "system", content: params.systemPrompt }, { role: "user", content: params.userPrompt }] }),
          });
          if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
          const data = await resp.json();
          return data.message?.content || "";
        }
      }
    } catch (e) { console.warn(`Provider ${provider.type} failed:`, (e as Error).message); continue; }
  }
  throw new Error("ALL_PROVIDERS_FAILED");
}

function normalizeNarrativeKeys(o: unknown): void {
  if (!o || typeof o !== "object") return;
  const obj = o as Record<string, unknown>;
  // 正文：兼容 narrative / narr / content / text 等变体
  const body =
    obj.narrative ?? obj.narr ?? obj.content ?? obj.text;
  if (typeof body === "string") obj.narrative = body;
  // 标题、概要、寄语、心境的简写兼容
  if (obj.title === undefined && typeof obj.t === "string") obj.title = obj.t;
  if (obj.summary === undefined) {
    if (typeof obj.sum === "string") obj.summary = obj.sum;
    else if (typeof obj.synopsis === "string") obj.summary = obj.synopsis;
  }
  if (obj.hint === undefined && typeof obj.h === "string") obj.hint = obj.h;
  if (obj.mood === undefined && typeof obj.m === "string") obj.mood = obj.m;
}

function extractJson<T>(text: string, fallback: T): T {
  let parsed: unknown = null;

  // 1. 直接解析（AI 返回纯净 JSON 时）
  try { parsed = JSON.parse(text); } catch {}

  // 2. 从 markdown 代码块中提取 ```json {...} ```（支持无闭合的情况）
  if (!parsed) try {
    const m = text.match(/```(?:json)?\s*(\{[\s\S]*?\})(?:\s*```|$)/);
    if (m) parsed = JSON.parse(m[1]);
  } catch {}

  // 3. 括号计数法：提取第一个完整 JSON 对象（跳过字符串内的 {}）
  if (!parsed) try {
    let depth = 0;
    let start = -1;
    let inString = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' && (i === 0 || text[i - 1] !== '\\')) { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}') { depth--; if (depth === 0 && start >= 0) { parsed = JSON.parse(text.slice(start, i + 1)); break; } }
    }
  } catch {}

  if (!parsed || typeof parsed !== "object") return fallback;
  normalizeNarrativeKeys(parsed);
  return parsed as T;
}

/**
 * 将一条事件追加到剧情概要中。
 * 追加格式：【标题】叙事前60字…
 * 纯字符串操作，无 AI 调用。
 */
export function appendToSummary(currentSummary: string | null, event: { title: string; narrative: string }): string {
  const truncated = event.narrative.slice(0, 60);
  const suffix = event.narrative.length > 60 ? '…' : '';
  const summaryLine = `【${event.title}】${truncated}${suffix}`;
  if (!currentSummary) return summaryLine;
  return currentSummary + '\n' + summaryLine;
}

/**
 * 判断剧情概要是否超过压缩阈值（1000 中文字符）。
 * 纯字符串长度判断，无 AI 调用。
 */
export function shouldCompress(summary: string): boolean {
  const text = summary.replace(/\n/g, '');
  return text.length > 1000;
}

// ============================================================
// System Prompt
// ============================================================

const SYSTEM_PROMPT_BASE = `你是一个现代背景的叙事引擎，用自然、生活化、接近当代小说的中文来讲故事。

叙事风格：
- 现代白话，口语化、有烟火气，像在讲一个发生在当下的真实故事
- 不使用文言、半文半白或"仙侠腔"句式，不要堆砌古风辞藻
- 叙事简洁有力，200-400字为宜
- 角色年龄要合理，年轻角色阅历有限

关于世界观：
- 世界的具体设定由本段之外的背景说明给出，你无需在叙事里解释或强调它
- 只讲故事本身，不要把设定当旁白向读者科普
- 哪怕涉及修炼、灵根、境界等内容，也当作故事中自然发生的事来写，不要生硬罗列名词、不要向读者讲解世界观

输出JSON格式。`;

// 凡人写实系统提示词（出生叙事专用）：严禁任何修仙/灵气/世界观设定
const SYSTEM_PROMPT_CIVILIAN = `你是一个写实风格的生活叙事引擎，描写普通人在现代社会的出生与成长。

【你能写的世界】
- 家人之间的相处（父母、祖辈、兄弟姐妹的日常对话、争吵、疼爱、期待）
- 邻里与社区的烟火气（邻居串门、小区花园、街边小店、同龄玩伴）
- 城市与自然的细节（四季、天气、街道、菜场、公园、学校、医院）
- 孩童的好奇与笨拙（戳土块、看蚂蚁、追落叶、第一次穿鞋、第一次走路）
- 凡人世界的情感与困境（经济拮据、家人健康、学业压力、市井冷暖）

【绝对不能出现的内容】
- 修仙概念：修仙、修真、修炼、功法、灵气、灵根、法术、丹药、飞升、仙侠、仙人、道、天道、机缘、闭关、洞府、境界、突破、觉醒、机缘、气运（设定词用法）、悟道、参悟
- 任何超自然现象：异能、特异功能、神秘力量、不可思议的异象
- 直接点明或暗示"这是某某世界"：禁止使用"灵根觉醒前/后""灵气复苏前/后""修真界的日常""凡间俗世"等设定旁白
- 否定句式绕开：禁止用"没有灵气""尚未觉醒""不像某些故事里""与修仙无关"这类句式来暗示修仙概念的存在。写到"看似普通"时必须用具体行为（戳土、看蚂蚁）来表达，不要点破世界观

【叙事要求】
- 用自然、生活化的现代白话语言，像在讲一个真实家庭的故事
- 只写平凡生活与烟火气，不向读者科普任何"世界观"或设定
- 角色年龄合理，婴幼儿没有超出认知的行为
- 叙事 200-350 字，温暖或有烟火气
- 不要重复正文里已经出现过的细节或时间段；如果正文聚焦一个瞬间，summary 写另一个侧面（如家庭氛围、邻里趣闻、性格特征）

输出严格JSON格式。`;

function buildSystemPrompt(worldId?: string): string {
  const worldPrompt = worldId ? getWorldAIPrompt(worldId) : "";
  if (worldPrompt) {
    return `${SYSTEM_PROMPT_BASE}

${worldPrompt}`;
  }
  return SYSTEM_PROMPT_BASE;
}

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
  family?: Array<{ relation: string; name: string; age: number; alive?: boolean; occupation?: string | null }>;
}

const ATTR_LABELS: Record<string, string> = {
  root: "根骨", bone: "根骨", spirit: "灵性", insight: "悟性",
  comprehension: "悟性", luck: "气运", fortune: "气运", charm: "魅力", mind: "心性",
};

function safeParseAttrs(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, number>;
  try {
    const p = JSON.parse(raw as string);
    return typeof p === "object" && p ? (p as Record<string, number>) : {};
  } catch {
    return {};
  }
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

  // 地点
  if (s.locationId) {
    const loc = LOCATIONS.find((l) => l.id === s.locationId);
    if (loc) parts.push(`身处${loc.name}`);
    else parts.push(`身处未知之地（${s.locationId}）`);
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
    name: string; age: number; realm: string; realmLevel?: number | null;
    gold?: number | null; stamina?: number | null;
    health?: number | null; maxAge?: number | null; toxicity?: number | null;
    quarter?: number | null; location?: string | null;
    attributes?: unknown; occupation?: string | null; schoolRank?: number | null;
  },
  family?: CultivatorState["family"],
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
  if (entries.length === 0) return '';
  return entries.map(e =>
    `${e.important ? '⭐ ' : ''}【${e.title}】${e.summary}`
  ).join('\n');
}

/**
 * 创建一条新的记忆条目。
 * @param truncate - 默认 true，截断 summary 到 60 字；压缩条目传 false
 */
export function createEntry(title: string, summary: string, truncate = true, aiSummary?: string): StoryEntry {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title,
    summary: aiSummary
        ? aiSummary.slice(0, 120) + (aiSummary.length > 120 ? '\u2026' : '')
        : truncate
          ? summary.slice(0, 60) + (summary.length > 60 ? '\u2026' : '')
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
  relation: string;       // "父亲" "母亲" "祖母" "姐姐" 等家庭身份
  name: string;           // 中文姓名
  age: number;            // 合理年龄
  alive: boolean;         // 是否在世
  occupation?: string;    // 职业，如"教师" "厨师" "家庭主妇"
  livingTogether?: boolean; // 是否与主角同住
}

/** 出生叙事结果：在通用叙事基础上附带家庭关系与建议姓名 */
export interface BirthNarrativeResult extends RegularNarrative {
  family?: BirthFamilyMember[];
  suggestedName?: string;
}

/** 统一的叙事结果类型 */
export type UnifiedNarrative =
  | RegularNarrative
  | EncounterNarrative
  | NPCDialogueNarrative
  | FamilyDialogueNarrative;

/** @deprecated 使用 RegularNarrative 替代 */
export type NarrativeResult = RegularNarrative;


/** 生成日常修炼叙事 */
export async function generateDailyCultivationNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number; taskType: string; taskDescription?: string; cultivationExp: number;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  const taskNames: Record<string, string> = { STUDY: "悟道", EXERCISE: "锻体", SLEEP: "静修", MEDITATE: "打坐", CUSTOM: "历练" };
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
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 800, temperature: 0.8 });
    return extractJson(text, { type: "DAILY_CULTIVATION", title: "日常修炼", narrative: `${params.cultivatorName}找了个安静的角落，按功法试着凝神调息……`, mood: "静", hint: "持之以恒", summary: `${params.cultivatorName}潜心修炼。` });
  } catch { console.error("AI生成失败"); return { type: "DAILY_CULTIVATION", title: "日常修炼", narrative: `${params.cultivatorName}埋头苦练，感觉自己对这功法又摸到了一点门道。`, mood: "静", hint: "持之以恒", summary: `${params.cultivatorName}静心修炼。` }; }
}

/** 生成境界突破叙事 */
export async function generateBreakthroughNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; fromRealm: string; fromLevel: number; toRealm: string; toLevel: number; totalExp: number; breakthroughCount: number;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  const isNewRealm = params.fromRealm !== params.toRealm;
  const scene = isNewRealm ? `突破大境界：从 ${params.fromRealm} 到 ${params.toRealm}！` : `${params.fromRealm} ${formatRealmLevel(params.fromRealm, params.fromLevel)} → ${formatRealmLevel(params.fromRealm, params.toLevel)}`;
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
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 1000, temperature: 0.9 });
    return extractJson(text, { type: "BREAKTHROUGH", title: `${params.toRealm}突破！`, narrative: `${params.cultivatorName}只觉得体内某处被猛地冲开，浑身一震——成功踏入了${params.toRealm}！`, mood: "燃", hint: "恭喜突破", summary: `${params.cultivatorName}成功突破至${params.toRealm}。` });
  } catch { console.error("AI生成失败"); return { type: "BREAKTHROUGH", title: `突破！${params.toRealm}`, narrative: `${params.cultivatorName}终于捅破了那层窗户纸，气息为之一变！`, mood: "燃", hint: "大道在前", summary: `${params.cultivatorName}突破${params.toRealm}。` }; }
}

/** 生成随机奇遇叙事 */
export async function generateEncounterNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number;
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
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 800, temperature: 0.9 });
    return extractJson(text, { type: "ENCOUNTER", title: "意外发现", narrative: `${params.cultivatorName}在修炼途中，撞见了一处不对劲的地方……`, choices: [{ text: "小心探查", risk: "low", hint: "稳扎稳打" }, { text: "深入探索", risk: "medium", hint: "风险与机遇并存" }, { text: "全力闯入", risk: "high", hint: "富贵险中求" }], mood: "奇", summary: `${params.cultivatorName}发现一处不对劲的地方。` });
  } catch { console.error("奇遇生成失败"); return { type: "ENCOUNTER", title: "意外发现", narrative: `${params.cultivatorName}撞见了一处不对劲的地方……`, choices: [{ text: "小心探查", risk: "low", hint: "稳扎稳打" }, { text: "深入探索", risk: "medium", hint: "风险与机遇" }, { text: "全力闯入", risk: "high", hint: "富贵险中求" }], mood: "奇", summary: `${params.cultivatorName}发现一处不对劲的地方。` }; }
}

/** 生成 NPC 对话 */
export async function generateNPCDialogue(params: {
  npcName: string; npcPersonality: string; npcRealm: string; cultivatorName: string; cultivatorRealm: string; historySummary?: string;
}): Promise<NPCDialogueNarrative> {
  const prompt = `生成一段NPC对话（现代背景）。

【NPC】${params.npcName}，性格${params.npcPersonality}，境界${params.npcRealm}
【玩家】${params.cultivatorName}，境界${params.cultivatorRealm}${params.historySummary ? `，过往：${params.historySummary}` : ""}

要求：200-300字，对话贴合NPC性格，可能给指点/礼物/任务
返回JSON：{"type":"NPC_DIALOGUE","title":"与${params.npcName}的对话","narrative":"对话内容","mood":"？","npcMood":"友善/冷淡/严厉","reward":{...}或null","summary":"30字内概述"}`;

  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 800, temperature: 0.8 });
    return extractJson(text, { type: "NPC_DIALOGUE", title: `与${params.npcName}的对话`, narrative: `${params.npcName}看了${params.cultivatorName}一眼，微微点头。`, mood: "奇", npcMood: "友善", summary: `与${params.npcName}交谈。` });
  } catch { console.error("NPC对话失败"); return { type: "NPC_DIALOGUE", title: `与${params.npcName}的对话`, narrative: `${params.npcName}正忙着，没空理你。`, mood: "静", npcMood: "冷淡", summary: `${params.npcName}不便打扰。` }; }
}

/** 生成行动叙事 */
export async function generateActionNarrative(params: {
  cultivatorName: string; spiritualRoot: string; realm: string; realmLevel: number;
  age: number; worldId?: string; actionName: string; actionDescription: string;
  freeInput?: string; expGained: number; isAwakened: boolean; awakenEvent: boolean;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  const realmStr = params.realm === "凡人" ? "凡人" : `${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}`;
  const ageContext = params.age <= 3 ? "幼儿" : params.age <= 6 ? "孩童" : params.age <= 12 ? "少年" : params.age <= 15 ? "即将成年的少年" : "修炼者";
  let prompt = `写一段行动叙事，现代背景、现代白话。

【角色】${params.cultivatorName}，${params.age}岁${ageContext}，灵根${params.spiritualRoot}，境界${realmStr}
${params.isAwakened ? "" : "- 尚未觉醒，仍为凡人"}
${params.awakenEvent ? "- 觉醒时刻！" : ""}
【行动】${params.actionName}：${params.actionDescription}
${params.freeInput ? `玩家描述：${params.freeInput}` : ""}
获得修炼值：${params.expGained}

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

  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(params.worldId), userPrompt: prompt, maxTokens: 800, temperature: 0.85 });
    const result: RegularNarrative = extractJson(text, { type: "ACTION", title: params.actionName, narrative: `${params.cultivatorName}${params.actionName}。${params.actionDescription}`, mood: "悟", hint: "继续修炼", summary: `${params.cultivatorName}${params.actionName}。` });
    if (!result.narrative || !result.narrative.trim()) {
      result.narrative = `${params.cultivatorName}${params.actionName}，有所感悟。`;
    }
    return result;
  } catch (e) {
    console.error("行动叙事AI生成失败:", e);
    return { type: "ACTION", title: params.actionName, narrative: `${params.cultivatorName}${params.actionName}，顺手把事做完了。`, mood: "静", hint: "把手头的事接着做下去", summary: `${params.cultivatorName}${params.actionName}。` };
  }
}

/** 生成年志叙事 */
export async function generateYearAdvanceNarrative(params: {
  cultivatorName: string; spiritualRoot: string; realm: string; realmLevel: number;
  oldAge: number; newAge: number; totalExp: number; worldId?: string; extraContext?: string;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  const realmStr = params.realm === "凡人" ? "凡人" : `${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}`;
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
    const text = await callAI({ systemPrompt: buildSystemPrompt(params.worldId), userPrompt: prompt, maxTokens: 600, temperature: 0.8 });
    return extractJson(text, { type: "YEAR_ADVANCE", title: `${params.cultivatorName}的第${params.newAge}年`, narrative: `又是一年过去，${params.cultivatorName}又长大了一岁。`, mood: "静", hint: "岁月不居", summary: `${params.cultivatorName}又长大了一岁。` });
  } catch { console.error("AI生成失败"); return { type: "YEAR_ADVANCE", title: `${params.cultivatorName}的第${params.newAge}年`, narrative: `又是一年过去，${params.cultivatorName}又长大了一岁。`, mood: "静", hint: "岁月不居", summary: `${params.cultivatorName}又长大了一岁。` }; }
}

/** 生成家庭对话 */
export async function generateFamilyDialogue(params: {
  familyMemberName: string; familyMemberRelation: string; familyMemberAge: number;
  intimacy: number; cultivatorName: string; cultivatorAge: number; cultivatorRealm: string; cultivatorRealmLevel: number;
  playerMessage: string; dialogueHistory: { role: "player" | "npc"; content: string }[];
  worldId?: string;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<FamilyDialogueNarrative> {
  const recentHistory = params.dialogueHistory.slice(-5).map((d) => `${d.role === "player" ? "主角" : params.familyMemberRelation}：${d.content}`).join("\n");
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
    const text = await callAI({ systemPrompt: buildSystemPrompt(params.worldId), userPrompt: prompt, maxTokens: 500, temperature: 0.85 });
    return extractJson(text, { type: "FAMILY_DIALOGUE", title: "家庭对话", narrative: `${params.familyMemberRelation}看了你一眼，点了点头。`, mood: "静", intimacyDelta: 0, npcMood: "平淡", summary: `与${params.familyMemberRelation}交谈。` });
  } catch { console.error("AI生成失败"); return { type: "FAMILY_DIALOGUE", title: "家庭对话", narrative: `${params.familyMemberRelation}正在忙，没听清你说什么。`, mood: "静", intimacyDelta: 0, npcMood: "平淡", summary: `${params.familyMemberRelation}正在忙。` }; }
}

/** 先天禀赋 → 中性（非修仙）描述，避免叙事中出现世界观字眼 */
const BIRTH_TRAIT_MAP: Record<string, string> = {
  "废柴": "先天体弱，需要更多呵护",
  "凡人": "资质寻常，和大多数孩子一样",
  "俊杰": "天资聪颖，显得格外机灵",
  "天骄": "天赋卓绝，从小便引人注目",
  "妖孽": "百年难遇的异禀之才",
  "谪仙转世": "带着一分说不清的神秘气韵",
  "大道之子": "仿佛自出生便被命运眷顾",
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
  family: BirthFamilyMember[],
): string[] {
  const errors: string[] = [];

  if (!narrative) { errors.push("叙事正文为空"); return errors; }

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
        "父亲": ["父亲", "爸爸", "爹"],
        "母亲": ["母亲", "妈妈", "娘"],
        "祖父": ["祖父", "爷爷"],
        "祖母": ["祖母", "奶奶"],
        "哥哥": ["哥哥", "兄"],
        "姐姐": ["姐姐", "姐", "姊"],
        "弟弟": ["弟弟", "弟"],
        "妹妹": ["妹妹", "妹"],
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
    "父亲": ["父亲", "爸爸", "爹"],
    "母亲": ["母亲", "妈妈", "娘"],
    "祖父": ["祖父", "爷爷", "阿公"],
    "祖母": ["祖母", "奶奶", "阿婆"],
    "外公": ["外公", "外祖父"],
    "外婆": ["外婆", "外祖母"],
    "哥哥": ["哥哥", "兄"],
    "姐姐": ["姐姐", "姐", "姊"],
    "弟弟": ["弟弟", "弟"],
    "妹妹": ["妹妹", "妹"],
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
      if ((core === "弟弟" || core === "妹妹") && suggestedName && narrative.includes(suggestedName)) {
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
  cultivatorName?: string; spiritualRoot?: string; worldName?: string; identityName?: string;
  age?: number; worldId?: string; family?: BirthFamilyMember[];
  storySummary?: string;
  birthTier?: string;
  state?: CultivatorState;
}): Promise<BirthNarrativeResult> {
  const trait = params.birthTier ? (BIRTH_TRAIT_MAP[params.birthTier] || params.birthTier) : "寻常";
  const identityStr = params.identityName ? `家庭背景：${params.identityName}。` : "";
  // 出生叙事始终聚焦出生现场，无论 params.age 为何值
  const ageHint = "请聚焦在主角出生当天或刚出生不久的场景（分娩、产房或家中迎接新生儿、家人第一次见到孩子、取名等出生现场），不要写周岁日常、学步、吃饭、玩耍等一岁生活片段，也不要跨越多个年龄阶段。";
  let prompt = `写一个普通人在现代社会的故事片段，温暖而有烟火气。

${identityStr}这孩子的先天禀赋：${trait}。

${ageHint}

要求与注意事项：
- 只描写平凡生活：家人的期盼、家中的场景、邻里街坊的闲谈
- 严禁出现任何修仙、灵气、灵根、修真、修炼、仙侠、境界、法术、超自然、觉醒、天道、机缘、悟道、闭关等字眼
- 严禁使用否定句式绕开禁令（如"没有灵气""不像某些故事里""与修仙无关""觉醒前最普通的日常"等）。把这些概念当作完全不存在来写
- 严禁向读者点明或暗示"这是某种世界观"。你写的就是真实的现代生活，不要加旁白解释

【家庭构成要求】
- 叙事正文必须自然说明家庭的基本构成：有哪些家庭成员（父母、祖辈、兄弟姐妹），他们的身份、姓名、大致年龄，以及是否同住
- 不能只列姓名而不交代关系。例如不要写"李建国走了过来"却不说明他是父亲还是邻居
- family数组必须完整对应正文中出现的核心家庭成员，不得遗漏正文中明确出场的人物
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
    const text = await callAI({ systemPrompt: SYSTEM_PROMPT_CIVILIAN, userPrompt: prompt, maxTokens: 1000, temperature: 0.85 });
    const result: BirthNarrativeResult = extractJson(text, {
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
      throw new Error(`出生叙事AI返回内容为空。AI原始响应(前400字): ${snippet.replace(/\n/g, " ")}`);
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

    // ── 三方一致性校验 ──────────────────────────────────
    const named = result.suggestedName || "";
    const errors = validateBirthConsistency(result.narrative, named, result.family);
    if (errors.length > 0) {
      console.warn("出生叙事家庭一致性校验发现不一致:", errors.join("; "));
      // 尝试一次 AI 修正：将错误列表发给 AI 重新生成
      try {
        const fixPrompt = `${prompt}\n\n【以上输出存在不一致，请修正后重新输出完整JSON】\n不一致问题：\n${errors.map((e,i) => `${i+1}. ${e}`).join("\n")}\n\n请重新生成JSON，确保正文、suggestedName、family 三者完全一致。`;
        const fixText = await callAI({ systemPrompt: SYSTEM_PROMPT_CIVILIAN, userPrompt: fixPrompt, maxTokens: 1000, temperature: 0.7 });
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
          const fixErrors = validateBirthConsistency(fixResult.narrative, fixedName, fixResult.family || []);
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
    console.error("出生叙事AI生成失败:", e);
    const detail = (e as Error).message || String(e);
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
  const importantEntries = entries.filter(e => e.important);
  const normalEntries = entries.filter(e => !e.important);

  let prompt = `你是一个小说编辑。将以下剧情概要压缩到500字以内。

【修炼者】${cultivatorName}

`;

  if (importantEntries.length > 0) {
    prompt += `重要事件（必须保留）：\n${importantEntries.map(e => `⭐ 【${e.title}】${e.summary}`).join('\n')}\n\n`;
  }
  if (normalEntries.length > 0) {
    prompt += `其他事件（可精简合并）：\n${normalEntries.map(e => `【${e.title}】${e.summary}`).join('\n')}\n\n`;
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
    return [...importantEntries.map(e => `⭐ 【${e.title}】${e.summary}`), ...normalEntries.map(e => `【${e.title}】${e.summary}`)].join('\n');
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
  const defaultText = styleMap[params.style] || `${params.cultivatorName}与${params.enemyName}展开了战斗。`;

  const prompt = `写一段战斗叙事（现代背景），不超过150字。

【胜者】${params.result === "win" ? params.cultivatorName : params.enemyName}
【败者】${params.result === "win" ? params.enemyName : params.cultivatorName}
【风格】${params.style}
【玩家境界】${params.playerRealm}
【敌人境界】${params.enemyRealm}

直接输出叙事文本，不要 JSON。`;

  try {
    const text = await callAI({ systemPrompt: "你是一个现代背景小说的战斗描写作者。", userPrompt: prompt, maxTokens: 300, temperature: 0.8 });
    return text.slice(0, 300) || defaultText;
  } catch {
    return defaultText;
  }
}
