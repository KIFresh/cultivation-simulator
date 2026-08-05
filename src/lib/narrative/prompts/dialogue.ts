// ═══════════════════════════════════════════════════════════════════════════
// narrative/prompts/dialogue.ts — NPC 对话与家庭对话叙事
// ═══════════════════════════════════════════════════════════════════════════

import { callAI } from "@/lib/narrative/provider";
import { buildSystemPrompt } from "./system";
import { buildStateContext, type CultivatorState } from "@/lib/narrative";
import {
  extractJson,
  type NPCDialogueNarrative,
  type FamilyDialogueNarrative,
} from "@/lib/narrative";
import { logger } from "@/lib/logger";

// 行动候选词生成指令：每个叙事响应为当前可见行动生成候选词。
// actionOptions 为可选字段（AI 可能不返回，前端已有兜底）。
const ACTION_OPTIONS_INSTRUCTION = `【行动候选词】为以下每个行动生成2-3个候选词（动词开头，6-15字/个），候选词应基于当前叙事内容给出方向性提示，且必须围绕对应行动类型生成，供玩家下一步选择。只覆盖当前角色（年龄/境界）可用的行动，填入输出JSON的actionOptions字段：{"ACTION_ID":["候选词1","候选词2","候选词3"],...}
凡人期行动：TALK 交谈、WANDER 闲逛、FREE 自由探索、LEARN 学习、ASK_TEACHER 请教老师、MAKE_FRIEND 交朋友、CHORES 做家务、HOMEWORK 做功课、PINYIN 学拼音、COUNTING 学数数、REST 休息、FAMILY_TIME 陪伴家人、READ_ALONE 独自阅读
修仙期额外行动：MEDITATE 打坐、BREATHE 吐纳、EXPLORE 历练、STUDY 悟道、ALCHEMY 炼丹、SECLUSION 闭关`;

// ── 1. NPC 对话 ───────────────────────────────────────────────────────────

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
${ACTION_OPTIONS_INSTRUCTION}
返回JSON：{"type":"NPC_DIALOGUE","title":"与${params.npcName}的对话","narrative":"对话内容","mood":"？","npcMood":"友善/冷淡/严厉","reward":{...}或null","summary":"30字内概述","effects":[],"actionOptions":{"ACTION_ID":["候选词1","候选词2","候选词3"],...}}`;

  try {
    const text = await callAI({
      systemPrompt: buildSystemPrompt(),
      userPrompt: prompt,
      maxTokens: 800,
      temperature: 0.8,
    });
    return extractJson(text, {
      type: "NPC_DIALOGUE",
      title: `与${params.npcName}的对话`,
      narrative: `${params.npcName}看了${params.cultivatorName}一眼，微微点头。`,
      mood: "奇",
      npcMood: "友善",
      summary: `与${params.npcName}交谈。`,
    });
  } catch {
    logger.error("NPC对话失败");
    return {
      type: "NPC_DIALOGUE",
      title: `与${params.npcName}的对话`,
      narrative: `${params.npcName}正忙着，没空理你。`,
      mood: "静",
      npcMood: "冷淡",
      summary: `${params.npcName}不便打扰。`,
    };
  }
}

// ── 2. 家庭对话 ───────────────────────────────────────────────────────────

export async function generateFamilyDialogue(params: {
  cultivatorName: string;
  cultivatorAge: number;
  cultivatorRealm: string;
  familyMemberName: string;
  familyMemberRelation: string;
  familyMemberAge: number;
  intimacy: number;
  playerMessage: string;
  dialogueHistory: Array<{ role: "player" | "npc"; content: string }>;
  storySummary?: string;
  worldId?: string;
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
${ACTION_OPTIONS_INSTRUCTION}
返回JSON：{"type":"FAMILY_DIALOGUE","title":"家庭对话","narrative":"对话内容","mood":"静","intimacyDelta":-5~5,"npcMood":"开心/生气/平淡/担忧","actionHint":"NPC可能行动","summary":"30字内概述","goldChange":0,"effects":[],"actionOptions":{"ACTION_ID":["候选词1","候选词2","候选词3"],...}}`;

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
    return extractJson(text, {
      type: "FAMILY_DIALOGUE",
      title: "家庭对话",
      narrative: `${params.familyMemberRelation}看了你一眼，点了点头。`,
      mood: "静",
      intimacyDelta: 0,
      npcMood: "平淡",
      summary: `与${params.familyMemberRelation}交谈。`,
    });
  } catch {
    logger.error("AI生成失败");
    return {
      type: "FAMILY_DIALOGUE",
      title: "家庭对话",
      narrative: `${params.familyMemberRelation}正在忙，没听清你说什么。`,
      mood: "静",
      intimacyDelta: 0,
      npcMood: "平淡",
      summary: `${params.familyMemberRelation}正在忙。`,
    };
  }
}
