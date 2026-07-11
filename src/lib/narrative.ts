// ============================================================
// AI 叙事引擎 — 多供应方自动切换
// ============================================================

import { SpiritualRoot, formatRealmLevel } from "./cultivation-data";
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
  } catch { runtimeSettings = null; }
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
    providers.push({ priority: i, type: type as any, apiKey, model, baseUrl });
  }
  return providers;
}

async function callAI(params: { systemPrompt: string; userPrompt: string; maxTokens?: number; temperature?: number }): Promise<string> {
  if (runtimeSettings === null) await syncProviderConfig().catch(() => {});
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
          return (resp.content as any).filter((c: any) => c.type === "text").map((c: any) => c.text || "").join("");
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

function extractJson<T>(text: string, fallback: T): T {
  try { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
  return fallback;
}

// ============================================================
// System Prompt
// ============================================================

const SYSTEM_PROMPT_BASE = `你是一个修仙世界的叙事引擎，用你自己的语言自然地写仙侠故事。

世界观体系：
- 世界类型：玩家选择的世界决定叙事基调
- 灵根体系：五行（金木水火土）× 品级（上品1.6x/中品1.3x/下品1.0x）
- 基础属性：根骨(肉身)、灵性(法术)、悟性(领悟)、气运(机缘)、魅力(社交)、心性(道心)

写作风格：
- 仙侠文言风，自然流畅
- 叙事简洁有力，200-400字为宜
- 角色年龄要合理，年轻角色阅历有限
- 16岁前无超凡力量（地球世界）

输出JSON格式。`;

function buildSystemPrompt(worldId?: string): string {
  const worldPrompt = worldId ? getWorldAIPrompt(worldId) : "";
  if (worldPrompt) {
    return `${SYSTEM_PROMPT_BASE}

${worldPrompt}`;
  }
  return SYSTEM_PROMPT_BASE;
}

// ============================================================
// 叙事生成函数
// ============================================================

export interface NarrativeResult {
  title: string;
  narrative: string;
  mood: "燃" | "静" | "险" | "悟" | "奇";
  hint?: string;
}

/** 生成日常修炼叙事 */
export async function generateDailyCultivationNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number; taskType: string; taskDescription?: string; cultivationExp: number;
}): Promise<NarrativeResult> {
  const taskNames: Record<string, string> = { STUDY: "悟道", EXERCISE: "锻体", SLEEP: "静修", MEDITATE: "打坐", CUSTOM: "历练" };
  const prompt = `生成一段修仙小说的日常修炼叙事。

【修炼者信息】道号：${params.cultivatorName}，灵根：${params.spiritualRoot}，境界：${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}，修炼值：${params.cultivationExp}
【今日修炼】方式：${taskNames[params.taskType] || "修炼"}${params.taskDescription ? `，描述：${params.taskDescription}` : ""}

要求：150-250字，体现灵根和境界特点

返回JSON：{"title":"标题","narrative":"正文","mood":"静/悟/燃","hint":"提示"}`;
  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 500, temperature: 0.8 });
    return extractJson(text, { title: "日常修炼", narrative: `${params.cultivatorName}盘膝而坐，默默运转功法……`, mood: "静", hint: "持之以恒" });
  } catch { return { title: "日常修炼", narrative: `${params.cultivatorName}静心修炼，灵力又精纯了几分。`, mood: "静", hint: "持之以恒" }; }
}

/** 生成境界突破叙事 */
export async function generateBreakthroughNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; fromRealm: string; fromLevel: number; toRealm: string; toLevel: number; totalExp: number; breakthroughCount: number;
}): Promise<NarrativeResult> {
  const isNewRealm = params.fromRealm !== params.toRealm;
  const scene = isNewRealm ? `突破大境界：从 ${params.fromRealm} 到 ${params.toRealm}！` : `${params.fromRealm} ${formatRealmLevel(params.fromRealm, params.fromLevel)} → ${formatRealmLevel(params.fromRealm, params.toLevel)}`;
  const prompt = `生成一段修仙小说的境界突破叙事。

【修炼者】${params.cultivatorName}，灵根${params.spiritualRoot}，第${params.breakthroughCount + 1}次突破，累计修炼${params.totalExp}
【突破】${scene}

要求：${isNewRealm ? "300-500字，天地异象" : "200-300字，灵力增长"}
返回JSON：{"title":"标题","narrative":"正文","mood":"燃","hint":"建议"}`;
  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 500, temperature: 0.9 });
    return extractJson(text, { title: `${params.toRealm}突破！`, narrative: `天地灵气涌入${params.cultivatorName}体内！成功踏入${params.toRealm}！`, mood: "燃", hint: "恭喜突破" });
  } catch { return { title: `突破！${params.toRealm}`, narrative: `${params.cultivatorName}终于突破！灵力暴涨！`, mood: "燃", hint: "大道在前" }; }
}

/** 生成随机奇遇叙事 */
export async function generateEncounterNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number;
}): Promise<{ title: string; narrative: string; choices: { text: string; risk: "low" | "medium" | "high"; hint: string }[]; mood: string }> {
  const prompt = `生成一段修仙世界的奇遇事件。

【修炼者】${params.cultivatorName}，灵根${params.spiritualRoot}，境界${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}

要求：200-300字，给出3个选项（低/中/高风险）
返回JSON：{"title":"标题","narrative":"场景","choices":[{"text":"选项","risk":"low/medium/high","hint":"提示"}],"mood":"奇/险"}`;
  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 500, temperature: 0.9 });
    return extractJson(text, { title: "意外发现", narrative: `${params.cultivatorName}在修炼途中发现了一处洞府遗迹……`, choices: [{ text: "小心探查", risk: "low", hint: "稳扎稳打" }, { text: "深入探索", risk: "medium", hint: "风险与机遇并存" }, { text: "全力闯入", risk: "high", hint: "富贵险中求" }], mood: "奇" });
  } catch { return { title: "意外发现", narrative: `${params.cultivatorName}发现了一处洞府遗迹……`, choices: [{ text: "小心探查", risk: "low", hint: "稳扎稳打" }, { text: "深入探索", risk: "medium", hint: "风险与机遇" }, { text: "全力闯入", risk: "high", hint: "富贵险中求" }], mood: "奇" }; }
}

/** 生成 NPC 对话 */
export async function generateNPCDialogue(params: {
  npcName: string; npcPersonality: string; npcRealm: string; cultivatorName: string; cultivatorRealm: string; historySummary?: string;
}): Promise<{ dialogue: string; npcMood: string; reward?: { type: string; description: string } }> {
  const prompt = `生成一段修仙世界NPC对话。

【NPC】${params.npcName}，性格${params.npcPersonality}，境界${params.npcRealm}
【玩家】${params.cultivatorName}，境界${params.cultivatorRealm}${params.historySummary ? `，过往：${params.historySummary}` : ""}

要求：200-300字，对话贴合NPC性格，可能给指点/礼物/任务
返回JSON：{"dialogue":"对话","npcMood":"友善/冷淡/严厉","reward":{...}或null}`;
  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 500, temperature: 0.8 });
    return extractJson(text, { dialogue: `${params.npcName}看了${params.cultivatorName}一眼，微微点头。`, npcMood: "友善" });
  } catch { return { dialogue: `${params.npcName}正在闭关，不便打扰。`, npcMood: "冷淡" }; }
}

/** 生成行动叙事 */
export async function generateActionNarrative(params: {
  cultivatorName: string; spiritualRoot: string; realm: string; realmLevel: number;
  age: number; worldId?: string; actionName: string; actionDescription: string;
  freeInput?: string; expGained: number; isAwakened: boolean; awakenEvent: boolean;
}): Promise<NarrativeResult> {
  const realmStr = params.realm === "凡人" ? "凡人" : `${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}`;
  const ageContext = params.age <= 3 ? "幼儿" : params.age <= 6 ? "孩童" : params.age <= 12 ? "少年" : params.age <= 15 ? "即将成年的少年" : "修炼者";
  const prompt = `写一段修仙小说的行动叙事。

【角色】${params.cultivatorName}，${params.age}岁${ageContext}，灵根${params.spiritualRoot}，境界${realmStr}
${params.isAwakened ? "" : "- 尚未觉醒，仍为凡人"}
${params.awakenEvent ? "- 觉醒时刻！" : ""}
【行动】${params.actionName}：${params.actionDescription}
${params.freeInput ? `玩家描述：${params.freeInput}` : ""}
获得修炼值：${params.expGained}

要求：150-300字，符合年龄认知，未觉醒角色不能出现超凡元素
返回JSON：{"title":"标题","narrative":"正文","mood":"静/悟/燃/险/奇","hint":"修炼提示"}`;
  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(params.worldId), userPrompt: prompt, maxTokens: 500, temperature: 0.8 });
    return extractJson(text, { title: params.actionName, narrative: `${params.cultivatorName}${params.actionName}。修炼值+${params.expGained}。`, mood: "静", hint: "" });
  } catch { return { title: params.actionName, narrative: `${params.cultivatorName}${params.actionName}，有所感悟。修炼值+${params.expGained}。`, mood: "静", hint: "" }; }
}

/** 生成年志叙事 */
export async function generateYearAdvanceNarrative(params: {
  cultivatorName: string; spiritualRoot: string; realm: string; realmLevel: number;
  oldAge: number; newAge: number; totalExp: number; worldId?: string; extraContext?: string;
}): Promise<NarrativeResult> {
  const realmStr = params.realm === "凡人" ? "凡人" : `${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}`;
  const prompt = `写一段修仙小说的时间推进叙事。

【角色】${params.cultivatorName}，${params.oldAge}岁→${params.newAge}岁，灵根${params.spiritualRoot}，境界${realmStr}，累计修炼${params.totalExp}
${params.extraContext ? `\n【背景】${params.extraContext}` : ""}

要求：100-200字，总结一年成长，未觉醒角色不能出现超凡元素
返回JSON：{"title":"标题","narrative":"正文","mood":"静/悟/燃/奇","hint":"展望"}`;
  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(params.worldId), userPrompt: prompt, maxTokens: 500, temperature: 0.8 });
    return extractJson(text, { title: `${params.cultivatorName}的第${params.newAge}年`, narrative: `时光荏苒，${params.cultivatorName}又长大了一岁。`, mood: "静", hint: "岁月不居" });
  } catch { return { title: `${params.cultivatorName}的第${params.newAge}年`, narrative: `时光荏苒，${params.cultivatorName}又长大了一岁。`, mood: "静", hint: "岁月不居" }; }
}

/** 生成家庭对话 */
export async function generateFamilyDialogue(params: {
  familyMemberName: string; familyMemberRelation: string; familyMemberAge: number;
  intimacy: number; cultivatorName: string; cultivatorAge: number; cultivatorRealm: string; cultivatorRealmLevel: number;
  playerMessage: string; dialogueHistory: { role: "player" | "npc"; content: string }[];
  worldId?: string;
}): Promise<{ npcDialogue: string; intimacyDelta: number; npcMood: string; actionHint?: string }> {
  const recentHistory = params.dialogueHistory.slice(-5).map((d) => `${d.role === "player" ? "主角" : params.familyMemberRelation}：${d.content}`).join("\n");
  const prompt = `生成一段家庭日常对话。

【NPC】${params.familyMemberName}（${params.familyMemberRelation}），${params.familyMemberAge}岁，亲密度${params.intimacy}/100
【主角】${params.cultivatorName}，${params.cultivatorAge}岁，境界${params.cultivatorRealm}
【玩家说】${params.playerMessage}
${recentHistory ? `【最近对话】\n${recentHistory}` : ""}

要求：50-120字，口语化，亲密度高时亲切低时冷淡
返回JSON：{"npcDialogue":"对话","intimacyDelta":-5~5,"npcMood":"开心/生气/平淡/担忧","actionHint":"NPC可能行动"}`;
  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(params.worldId), userPrompt: prompt, maxTokens: 500, temperature: 0.85 });
    return extractJson(text, { npcDialogue: `${params.familyMemberRelation}看了你一眼，点了点头。`, intimacyDelta: 0, npcMood: "平淡" });
  } catch { return { npcDialogue: `${params.familyMemberRelation}正在忙，没听清你说什么。`, intimacyDelta: 0, npcMood: "平淡" }; }
}

/** 生成出生叙事 */
export async function generateBirthNarrative(params: {
  cultivatorName: string; spiritualRoot: string; worldName?: string; identityName?: string;
  age?: number; worldId?: string; family?: { relation: string; name: string; age: number; alive: boolean }[];
}): Promise<NarrativeResult> {
  const familyStr = params.family && params.family.length > 0
    ? `\n\n【家庭成员】\n${params.family.map((m) => `- ${m.relation}：${m.name}，${m.age}岁，${m.alive ? "健在" : "已故"}`).join("\n")}`
    : "";
  const prompt = `写一段修仙小说风格的出生叙事，自然地描写主角的诞生。

${params.cultivatorName}，${params.age || 1}岁，${params.spiritualRoot}，${params.identityName || "未知"}，${params.worldName || "修仙世界"}${familyStr}

注意：家庭成员姓名已列出，叙事时直接称呼即可。不要复述或解释世界设定，直接讲故事。

输出JSON格式：
{"title":"标题(10字内)","narrative":"叙事正文(200-350字)","mood":"悟/奇/静/燃","hint":"寄语(10-20字)"}`;
  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(params.worldId), userPrompt: prompt, maxTokens: 500, temperature: 0.85 });
    return extractJson(text, { title: `${params.cultivatorName}出世`, narrative: `${params.cultivatorName}来到了这个世界。`, mood: "奇", hint: "仙途漫漫" });
  } catch { return { title: `${params.cultivatorName}出世`, narrative: `${params.cultivatorName}在一个平凡的冬日清晨出生了。`, mood: "奇", hint: "仙途漫漫" }; }
}