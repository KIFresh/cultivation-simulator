// ═══════════════════════════════════════════════════════════════════════════
// narrative/prompts/birth.ts — 出生叙事
// ═══════════════════════════════════════════════════════════════════════════

import { callAI } from "@/lib/narrative/provider";
import { SYSTEM_PROMPT_CIVILIAN } from "./system";
import { extractJson, type BirthNarrativeResult, type BirthFamilyMember } from "@/lib/narrative";
import { logger } from "@/lib/logger";

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

    if (!narrative.includes(m.name)) {
      errors.push(`"${m.relation} ${m.name}"的姓名未出现在叙事正文中`);
    }

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

  for (const [core, cols] of Object.entries(relationSynonyms)) {
    for (const col of cols) {
      if (narrative.includes(col) && !family.some((m) => m.relation === col || m.relation === core)) {
        errors.push(`正文提到了"${col}"，但 family 中没有对应成员（期望关系"${core}"）`);
      }
    }
  }

  return errors;
}

// ── 出生叙事生成 ──────────────────────────────────────────────────────────

export async function generateBirthNarrative(params: {
  cultivatorName: string;
  worldName: string;
  identityName: string;
  birthTier: string;
  worldId?: string;
  family: BirthFamilyMember[];
  storySummary?: string;
}): Promise<BirthNarrativeResult> {
  const traitDesc = BIRTH_TRAIT_MAP[params.birthTier] || "普通的孩子";
  const familyDesc = params.family.length > 0
    ? params.family.map((m) => `${m.relation} ${m.name}（${m.age}岁${m.occupation ? `，${m.occupation}` : ""}）`).join("，")
    : "待定";

  let prompt = `你是一个写实风格的生活叙事引擎。请生成一段【出生当天】的叙事。

【背景】${params.worldName}，${params.identityName}
【天赋描述】${traitDesc}
【当前家庭成员】${familyDesc}
${params.cultivatorName ? `【备用名】${params.cultivatorName}` : ""}

【核心规则】
1. 必须是出生当天——描写分娩、产房或家中迎接新生儿、家人第一次见到孩子、取名等出生现场
2. 不可出现"1岁""满月""周岁""百天"等出生后时间点；不可出现"开始学走路""咿呀学语""吃饭"等出生后行为
3. 主角是刚出生的婴儿，叙事中只能客观描写新生儿状态（哭、睡、被抱、被取名），不可有超出新生儿的行为
4. 尽量覆盖所有家庭成员，各自写一句反应或对话
5. suggestedName 必须为 2~4 个纯中文字符，不含标点、字母、数字、空格
6. 正文与 suggestedName 一致，正文中应自然出现该姓名（如"给孩子取名叫…"或"以后就叫你…了"）
7. 注意：正文中不要出现"爸爸""妈妈""爷爷""奶奶"等作为自称，正文应使用"丈夫""妻子"等叙事视角
8. summary 聚焦一个与正文不同的侧面（如家庭氛围、某个家庭成员的趣闻、孩子的性格特征），不要复述正文已经写过的年龄段、场景或事件，不要与正文重复

输出前请自检：检查正文、suggestedName、family 三者是否一致

输出JSON：
{"type":"BIRTH","title":"标题(10字内)","narrative":"叙事正文(200-350字，纯散文，不要出现任何JSON或括号结构)","mood":"悟/奇/静/燃","hint":"寄语(10-20字)","summary":"20-30字概述。聚焦一个与正文不同的侧面","suggestedName":"孩子的姓名","family":[{"relation":"父亲","name":"姓名","age":38,"alive":true,"occupation":"职业","livingTogether":true},{"relation":"母亲","name":"姓名","age":36,"alive":true,"occupation":"职业","livingTogether":true}],"effects":[]}`;

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
      result.family = (params.family && params.family.length > 0) ? params.family : [];
    }

    // ── 三方一致性校验 ──────────────────────────────────
    const named = result.suggestedName || "";
    const errors = validateBirthConsistency(result.narrative, named, result.family);
    if (errors.length > 0) {
      console.warn("出生叙事家庭一致性校验发现不一致:", errors.join("; "));
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
          suggestedName: result.suggestedName || "",
          family: result.family || [],
        });
        if (fixResult.narrative && fixResult.narrative.trim()) {
          // 再次验证修正后的结果
          const fixErrors = validateBirthConsistency(fixResult.narrative, fixResult.suggestedName || "", fixResult.family || []);
          if (fixErrors.length === 0) {
            return fixResult;
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
    const detail = (e as Error).message || String(e);
    throw new Error(`出生叙事AI生成失败: ${detail}`);
  }
}