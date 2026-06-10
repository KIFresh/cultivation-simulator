// ============================================================
// AI 叙事引擎 — 调用 Claude API 生成修炼叙事
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { SpiritualRoot, getCurrentRealm, getNextRealm, BREAKTHROUGH_ANIMATIONS, NPCS } from "./cultivation-data";

// 延迟初始化，避免 build 时无 key 报错
let anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });
  }
  return anthropic;
}

// ============================================================
// 通用 System Prompt
// ============================================================

const WORLD_SYSTEM_PROMPT = `你是一个修仙世界的叙事引擎，世界观参考凡人修仙传。

你的写作风格：
- 仙侠文言风，但不过分晦涩，现代读者能流畅阅读
- 注重意境描写和修炼细节
- 适当使用修仙术语（灵气、丹田、经脉、元神、天地法则等）
- 叙事简洁有力，200-400字为宜
- 偶尔加入一丝幽默或哲理

你返回的必须是合法的 JSON 格式，不要有其他内容。`;

// ============================================================
// 叙事生成函数
// ============================================================

export interface NarrativeResult {
  title: string;
  narrative: string;
  mood: "燃" | "静" | "险" | "悟" | "奇";
  hint?: string; // 修炼提示
}

/** 生成日常修炼叙事 */
export async function generateDailyCultivationNarrative(params: {
  cultivatorName: string;
  spiritualRoot: SpiritualRoot;
  realm: string;
  realmLevel: number;
  taskType: string;
  taskDescription?: string;
  cultivationExp: number;
}): Promise<NarrativeResult> {
  const taskNames: Record<string, string> = {
    STUDY: "悟道（学习）",
    EXERCISE: "锻体（运动）",
    SLEEP: "静修（早睡）",
    MEDITATE: "打坐（冥想）",
    CUSTOM: "历练",
  };

  const taskName = taskNames[params.taskType] || "修炼";

  const prompt = `生成一段修仙小说式的日常修炼叙事。

【修炼者信息】
- 道号：${params.cultivatorName}
- 灵根：${params.spiritualRoot}
- 当前境界：${params.realm} 第${params.realmLevel}层
- 当前修炼值：${params.cultivationExp}

【今日修炼】
- 修炼方式：${taskName}
${params.taskDescription ? `- 额外描述：${params.taskDescription}` : ""}

要求：
- 写一段 150-250 字的修炼场景叙事
- 体现该灵根和境界的修炼特点
- 修炼方式与现实任务巧妙对应（如学习=悟道、运动=锻体）
- 结尾给出一个简短的修炼感悟

返回 JSON：
{
  "title": "叙事标题（10字以内）",
  "narrative": "修炼叙事正文（150-250字）",
  "mood": "静/悟/燃（选择最合适的）",
  "hint": "修炼提示（10-20字，给玩家的建议）"
}`;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: WORLD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    // 尝试从 text 中提取 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      title: "日常修炼",
      narrative: `${params.cultivatorName}盘膝而坐，默默运转功法……修炼无岁月，转眼间灵力又精纯了几分。`,
      mood: "静",
      hint: "持之以恒，大道可期",
    };
  } catch (error) {
    console.error("AI 叙事生成失败:", error);
    return getFallbackNarrative(params.taskType, params.cultivatorName, params.spiritualRoot);
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
}): Promise<NarrativeResult> {
  const isNewRealm = params.fromRealm !== params.toRealm;
  const scene = isNewRealm
    ? `突破大境界：从 ${params.fromRealm} 突破到 ${params.toRealm}！`
    : `${params.fromRealm} 第${params.fromLevel}层 → 第${params.toLevel}层`;

  const prompt = `生成一段修仙小说式的境界突破叙事。

【修炼者信息】
- 道号：${params.cultivatorName}
- 灵根：${params.spiritualRoot}
- 这是 TA 第 ${params.breakthroughCount + 1} 次突破
- 累计修炼值：${params.totalExp}

【突破详情】
${scene}

要求：
- ${isNewRealm ? "大境界突破：写 300-500 字，要有天地异象、灵力暴动、心魔考验等元素" : "小境界突破：写 200-300 字，着重描写灵力增长和感悟"}
- 要有燃点和爽点
- 体现灵根特质
- 结尾给出突破后的新感悟

返回 JSON：
{
  "title": "突破叙事标题（10字以内）",
  "narrative": "突破叙事正文",
  "mood": "燃",
  "hint": "突破后的修炼建议（15字以内）"
}`;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: WORLD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      title: `${params.toRealm}突破！`,
      narrative: `天地灵气疯狂涌入${params.cultivatorName}体内！丹田之中，灵力如沸水般翻涌……轰然一声，壁障碎裂！${params.cultivatorName}成功踏入${params.toRealm}第${params.toLevel}层！`,
      mood: "燃",
      hint: `恭喜突破至${params.toRealm}！继续努力！`,
    };
  } catch (error) {
    console.error("突破叙事生成失败:", error);
    return {
      title: `突破！${params.toRealm}`,
      narrative: `历经苦修，${params.cultivatorName}终于突破！周身灵力暴涨，${params.toRealm}的玄妙在心头浮现……`,
      mood: "燃",
      hint: `大道在前，永不止步`,
    };
  }
}

/** 生成随机奇遇叙事 */
export async function generateEncounterNarrative(params: {
  cultivatorName: string;
  spiritualRoot: SpiritualRoot;
  realm: string;
  realmLevel: number;
}): Promise<{
  title: string;
  narrative: string;
  choices: { text: string; risk: "low" | "medium" | "high"; hint: string }[];
  mood: string;
}> {
  const prompt = `生成一段修仙世界的随机奇遇事件。

【修炼者信息】
- 道号：${params.cultivatorName}
- 灵根：${params.spiritualRoot}
- 当前境界：${params.realm} 第${params.realmLevel}层

要求：
- 写一个有趣的奇遇场景（发现山洞、遇到灵兽、坊市交易、遗迹探索等）
- 给出 3 个选项，分别代表低风险/中风险/高风险的选择
- 每个选项附上简短提示
- 叙事 200-300 字

返回 JSON：
{
  "title": "奇遇标题",
  "narrative": "奇遇场景描述",
  "choices": [
    {"text": "选项1（低风险）", "risk": "low", "hint": "可能的结果提示"},
    {"text": "选项2（中风险）", "risk": "medium", "hint": "可能的结果提示"},
    {"text": "选项3（高风险）", "risk": "high", "hint": "可能的结果提示"}
  ],
  "mood": "奇/险"
}`;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: WORLD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      title: "意外发现",
      narrative: `${params.cultivatorName}在修炼途中，意外发现了一处隐蔽的洞府遗迹……`,
      choices: [
        { text: "小心探查", risk: "low", hint: "稳扎稳打" },
        { text: "深入探索", risk: "medium", hint: "风险与机遇并存" },
        { text: "全力闯入", risk: "high", hint: "富贵险中求" },
      ],
      mood: "奇",
    };
  } catch (error) {
    console.error("奇遇叙事生成失败:", error);
    return {
      title: "意外发现",
      narrative: `${params.cultivatorName}在修炼途中，意外发现了一处隐蔽的洞府遗迹……`,
      choices: [
        { text: "小心探查", risk: "low", hint: "稳扎稳打" },
        { text: "深入探索", risk: "medium", hint: "风险与机遇并存" },
        { text: "全力闯入", risk: "high", hint: "富贵险中求" },
      ],
      mood: "奇",
    };
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
}): Promise<{
  dialogue: string;
  npcMood: string;
  reward?: { type: string; description: string };
}> {
  const prompt = `生成一段修仙世界中 NPC 与玩家的对话。

【NPC】
- 名字：${params.npcName}
- 性格：${params.npcPersonality}
- 境界：${params.npcRealm}

【玩家】
- 道号：${params.cultivatorName}
- 境界：${params.cultivatorRealm}
${params.historySummary ? `- 过往交互：${params.historySummary}` : ""}

要求：
- 对话贴合 NPC 原著性格
- NPC 可能给玩家一个指点/小礼物/任务
- 对话 200-300 字

返回 JSON：
{
  "dialogue": "对话内容，用「」包裹对话，叙述用第三人称",
  "npcMood": "友善/冷淡/严厉/神秘/喜悦",
  "reward": {"type": "修炼值/丹药/功法/情报", "description": "奖励描述"} 或 null
}`;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: WORLD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      dialogue: `${params.npcName}看了${params.cultivatorName}一眼，微微点头：「道友根基扎实，日后必成大器。」`,
      npcMood: "友善",
    };
  } catch (error) {
    console.error("NPC 对话生成失败:", error);
    return {
      dialogue: `${params.npcName}正在闭关修炼，不便打扰。`,
      npcMood: "冷淡",
    };
  }
}

// ============================================================
// 降级方案（API 不可用时）
// ============================================================

function getFallbackNarrative(
  taskType: string,
  name: string,
  root: SpiritualRoot
): NarrativeResult {
  const templates: Record<string, NarrativeResult[]> = {
    STUDY: [
      {
        title: "静心悟道",
        narrative: `${name}静坐于蒲团之上，双目微阖。天地灵气如涓涓细流涌入识海，往日晦涩难懂的功法口诀此刻渐渐明朗。灵台清明之间，似有所悟。`,
        mood: "悟",
        hint: "学而不思则罔，思而不学则殆",
      },
      {
        title: "灵台顿悟",
        narrative: `一卷古籍在${name}手中缓缓展开。随着阅读的深入，${name}的眉头时而紧锁时而舒展。忽然，一股明悟涌上心头——原来如此！`,
        mood: "悟",
        hint: "温故而知新",
      },
    ],
    EXERCISE: [
      {
        title: "淬体修炼",
        narrative: `${name}摆开架势，一遍遍运转锻体功法。汗水浸透衣衫，肌肉酸痛难忍，但每一次力竭后的坚持，都让肉身更加坚韧。灵力在经脉中奔涌，冲刷着每一个穴位。`,
        mood: "燃",
        hint: "千锤百炼方成器",
      },
    ],
    SLEEP: [
      {
        title: "蕴神养元",
        narrative: `月华如水，${name}盘膝而坐，运转静心功法。白日的喧嚣渐渐远去，元神在宁静中得到滋养。一呼一吸之间，灵力如温润的泉水在体内循环往复。`,
        mood: "静",
        hint: "一张一弛，文武之道",
      },
    ],
    MEDITATE: [
      {
        title: "天人交感",
        narrative: `${name}五心朝天，神识渐渐沉入丹田。在深邃的内视中，${name}仿佛看到了天地初开的混沌，万物生灭的循环。一丝天道法则的痕迹在心中留下烙印。`,
        mood: "静",
        hint: "道法自然，清静无为",
      },
    ],
    CUSTOM: [
      {
        title: "随心修炼",
        narrative: `${name}随心而动，不拘一格。修炼之道的真谛不在于墨守成规，而在于找到最适合自己的那条路。今日的修炼虽不惊天动地，却别有一番收获。`,
        mood: "静",
        hint: "大道三千，殊途同归",
      },
    ],
  };

  const taskTemplates = templates[taskType] || templates.CUSTOM;
  return taskTemplates[Math.floor(Math.random() * taskTemplates.length)];
}
