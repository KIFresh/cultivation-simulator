// ═══════════════════════════════════════════════════════════════════════════
// narrative/prompts/gameplay.ts — 日常修炼/突破/奇遇/行动/年志叙事
// ═══════════════════════════════════════════════════════════════════════════

import { callAI } from "@/lib/narrative/provider";
import { buildSystemPrompt, SYSTEM_PROMPT_CIVILIAN } from "./system";
import { buildStateContext, type CultivatorState } from "@/lib/narrative";
import { formatRealmLevel, type SpiritualRoot } from "@/lib/cultivation-data";
import { extractJson, type RegularNarrative, type EncounterNarrative, type NarrativeResult } from "@/lib/narrative";
import { logger } from "@/lib/logger";

// ── 1. 日常修炼 ───────────────────────────────────────────────────────────

export async function generateDailyCultivationNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number; taskType: string; taskDescription?: string; cultivationExp: number;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  const taskNames: Record<string, string> = { STUDY: "悟道", EXERCISE: "锻体", SLEEP: "静修", MEDITATE: "打坐", CUSTOM: "历练" };
  let prompt = `生成一段现代背景的修炼日常叙事。

【修炼者信息】道号：${params.cultivatorName}，灵根：${params.spiritualRoot}，境界：${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}，修炼值：${params.cultivationExp}
【今日修炼】方式：${taskNames[params.taskType] || "修炼"}${params.taskDescription ? `，描述：${params.taskDescription}` : ""}

要求：150-250字，结合当前地点氛围和附近人物，体现灵根和境界特点

返回JSON：{"type":"DAILY_CULTIVATION","title":"标题","narrative":"正文","mood":"静/悟/燃","hint":"提示","goldChange":0,"effects":[]}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 800, temperature: 0.8 });
    return extractJson(text, { type: "DAILY_CULTIVATION", title: "日常修炼", narrative: `${params.cultivatorName}找了个安静的角落，按功法试着凝神调息……`, mood: "静", hint: "持之以恒", summary: `${params.cultivatorName}潜心修炼。` });
  } catch {
    logger.error("AI生成失败");
    return { type: "DAILY_CULTIVATION", title: "日常修炼", narrative: `${params.cultivatorName}埋头苦练，感觉自己对这功法又摸到了一点门道。`, mood: "静", hint: "持之以恒", summary: `${params.cultivatorName}静心修炼。` };
  }
}

// ── 2. 境界突破 ───────────────────────────────────────────────────────────

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

要求：${isNewRealm ? "300-500字，天地异动，结合地点氛围" : "200-300字，修为精进，结合地点氛围"}
返回JSON：{"type":"BREAKTHROUGH","title":"标题","narrative":"正文","mood":"燃","hint":"建议","effects":[]}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 1000, temperature: 0.9 });
    return extractJson(text, { type: "BREAKTHROUGH", title: `${params.toRealm}突破！`, narrative: `${params.cultivatorName}只觉得体内某处被猛地冲开，浑身一震——成功踏入了${params.toRealm}！`, mood: "燃", hint: "恭喜突破", summary: `${params.cultivatorName}成功突破至${params.toRealm}。` });
  } catch {
    logger.error("AI生成失败");
    return { type: "BREAKTHROUGH", title: `突破！${params.toRealm}`, narrative: `${params.cultivatorName}终于捅破了那层窗户纸，气息为之一变！`, mood: "燃", hint: "大道在前", summary: `${params.cultivatorName}突破${params.toRealm}。` };
  }
}

// ── 3. 随机奇遇 ───────────────────────────────────────────────────────────

export async function generateEncounterNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number;
  storySummary?: string;
  state?: CultivatorState;
}): Promise<EncounterNarrative> {
  let prompt = `生成一段奇遇事件（现代背景）。

【修炼者】${params.cultivatorName}，灵根${params.spiritualRoot}，境界${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}

要求：200-300字，结合当前地点氛围，给出3个选项（低/中/高风险）
返回JSON：{"type":"ENCOUNTER","title":"标题","narrative":"场景","choices":[{"text":"选项","risk":"low/medium/high","hint":"提示"}],"mood":"奇/险","summary":"30字内概述","goldChange":0,"effects":[]}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 800, temperature: 0.9 });
    return extractJson(text, { type: "ENCOUNTER", title: "意外发现", narrative: `${params.cultivatorName}在修炼途中，撞见了一处不对劲的地方……`, choices: [{ text: "小心探查", risk: "low", hint: "稳扎稳打" }, { text: "深入探索", risk: "medium", hint: "风险与机遇并存" }, { text: "全力闯入", risk: "high", hint: "富贵险中求" }], mood: "奇", summary: `${params.cultivatorName}发现一处不对劲的地方。` });
  } catch {
    logger.error("奇遇生成失败");
    return { type: "ENCOUNTER", title: "意外发现", narrative: `${params.cultivatorName}撞见了一处不对劲的地方……`, choices: [{ text: "小心探查", risk: "low", hint: "稳扎稳打" }, { text: "深入探索", risk: "medium", hint: "风险与机遇并存" }, { text: "全力闯入", risk: "high", hint: "富贵险中求" }], mood: "奇", summary: `${params.cultivatorName}发现一处不对劲的地方。` };
  }
}

// ── 4. 行动叙事 ───────────────────────────────────────────────────────────

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
【修为增长】${params.expGained > 0 ? `+${params.expGained}` : "无变化"}

要求：200-350字，注意角色年龄与境界相符
返回JSON：{"type":"ACTION","title":"标题","narrative":"正文","mood":"静/悟/燃","hint":"提示","goldChange":0,"effects":[]}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(params.worldId),
      userPrompt: prompt,
      maxTokens: 800,
      temperature: 0.85,
    });
    return extractJson(text, {
      type: "ACTION", title: "行动", narrative: `${params.cultivatorName}${params.actionName}了一番。`, mood: "静", hint: "", summary: `${params.cultivatorName}${params.actionName}。`,
    });
  } catch {
    logger.error("AI生成失败");
    return { type: "ACTION", title: "行动", narrative: `${params.cultivatorName}${params.actionName}了一番。`, mood: "静", hint: "", summary: `${params.cultivatorName}${params.actionName}。` };
  }
}

// ── 5. 年志叙事 ───────────────────────────────────────────────────────────

export async function generateYearAdvanceNarrative(params: {
  cultivatorName: string; age: number; realm: string; realmLevel: number;
  spiritualRoot: string; storySummary?: string;
  state?: CultivatorState;
}): Promise<NarrativeResult> {
  let prompt = `生成一段跨年叙事（现代背景）。

【${params.cultivatorName}】${params.age}岁，灵根${params.spiritualRoot}，境界${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}

要求：150-200字，回顾一年经历，展望新岁
返回JSON：{"type":"YEAR_ADVANCE","title":"一岁一礼","narrative":"正文","mood":"悟","hint":"","summary":"30字内概述","effects":[]}`;

  const stateCtx = buildStateContext(params.state);
  if (stateCtx) prompt += `\n\n${stateCtx}`;
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(),
      userPrompt: prompt,
      maxTokens: 500,
      temperature: 0.8,
    });
    return extractJson(text, { type: "YEAR_ADVANCE", title: "一岁一礼", narrative: `岁月如梭，${params.cultivatorName}又长了一岁。`, mood: "悟", hint: "", summary: `${params.cultivatorName}迎来了${params.age}岁。` });
  } catch {
    logger.error("年志生成失败");
    return { type: "YEAR_ADVANCE", title: "一岁一礼", narrative: `${params.cultivatorName}又长了一岁。`, mood: "悟", hint: "", summary: `${params.cultivatorName}迎来了${params.age}岁。` };
  }
}