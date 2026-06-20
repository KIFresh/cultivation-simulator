// ============================================================
// AI 叙事引擎 — 调用 Claude API 生成修炼叙事
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { SpiritualRoot, getCurrentRealm, getNextRealm, BREAKTHROUGH_ANIMATIONS, NPCS, formatRealmLevel } from "./cultivation-data";

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
- 当前境界：${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}
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
    : `${params.fromRealm} ${formatRealmLevel(params.fromRealm, params.fromLevel)} → ${formatRealmLevel(params.fromRealm, params.toLevel)}`;

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
      narrative: `天地灵气疯狂涌入${params.cultivatorName}体内！丹田之中，灵力如沸水般翻涌……轰然一声，壁障碎裂！${params.cultivatorName}成功踏入${params.toRealm}${formatRealmLevel(params.toRealm, params.toLevel)}！`,
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
- 当前境界：${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}

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
// 25 套模板，5 种修炼方式 × 5 套变体，灵根决定风格，带防重复
// ============================================================

// 灵根→风格分类
type RootFlavor = "烈" | "柔" | "锐" | "韧" | "稳";

function getRootFlavor(root: SpiritualRoot): RootFlavor {
  const map: Record<SpiritualRoot, RootFlavor> = {
    "天灵根": "锐",
    "异灵根": "烈",
    "双灵根": "锐",
    "三灵根": "柔",
    "四灵根": "韧",
    "杂灵根": "稳",
  };
  return map[root] || "稳";
}

// 风格→叙事修饰词
const FLAVOR_MODIFIERS: Record<RootFlavor, { aura: string; style: string; feeling: string }> = {
  "烈": { aura: "灼热的灵力如烈焰翻涌", style: "以雷霆之势", feeling: "浑身经脉如被烈火淬过，畅快淋漓" },
  "柔": { aura: "灵力如春水般温润流转", style: "以柔劲化开", feeling: "四肢百骸暖意融融，如沐春风" },
  "锐": { aura: "精纯的灵力凝而不散", style: "以精准之势", feeling: "每一分灵力都落在最该去的地方" },
  "韧": { aura: "灵力如藤蔓般绵延不绝", style: "以持久之劲", feeling: "根基又扎实了一分，厚积薄发" },
  "稳": { aura: "灵力如山岳般沉稳厚重", style: "以沉稳之姿", feeling: "不急不躁，稳扎稳打，道心愈发坚定" },
};

// 防重复：记录每种修炼方式上一次使用的模板索引
const lastUsedIndex: Record<string, number> = {};

function pickTemplate(taskType: string, templates: NarrativeResult[]): NarrativeResult {
  const last = lastUsedIndex[taskType];
  // 如果只有 1 套模板，直接用
  if (templates.length === 1) return templates[0];

  // 排除上一次使用的索引，从剩余中随机选
  const available = templates
    .map((t, i) => i)
    .filter((i) => i !== last);
  const idx = available[Math.floor(Math.random() * available.length)];
  lastUsedIndex[taskType] = idx;
  return templates[idx];
}

function getFallbackNarrative(
  taskType: string,
  name: string,
  root: SpiritualRoot
): NarrativeResult {
  const flavor = getRootFlavor(root);
  const mod = FLAVOR_MODIFIERS[flavor];

  // 25 套模板：5 种修炼方式 × 5 套
  const templates: Record<string, NarrativeResult[]> = {
    STUDY: [
      {
        title: "静心悟道",
        narrative: `${name}静坐于蒲团之上，双目微阖。${mod.aura}涌入识海。往日晦涩难懂的功法口诀此刻渐渐明朗——${mod.style}突破了一道心障。`,
        mood: "悟",
        hint: "学而不思则罔，思而不学则殆",
      },
      {
        title: "灵台顿悟",
        narrative: `一卷古籍在${name}手中缓缓展开。字里行间的奥义如抽丝剥茧般浮现，${name}的眉头从紧锁到舒展。忽然间——一道灵光划过识海。原来如此！`,
        mood: "悟",
        hint: "温故而知新，可以为师矣",
      },
      {
        title: "道法参研",
        narrative: `${name}以指为笔，在虚空中勾勒道纹。${mod.style}拆解其中真意。参悟过半，${name}忽然意识到——不是功法难懂，是之前的自己太浮躁了。`,
        mood: "静",
        hint: "静下心来，道就在眼前",
      },
      {
        title: "心魔试炼",
        narrative: `悟道中途，一道心魔骤然浮现——"你修来修去，到底为了什么？"${name}闭目凝神，${mod.aura}守住灵台。片刻之后，心魔消散。${mod.feeling}。`,
        mood: "悟",
        hint: "最大的敌人，从来都是自己",
      },
      {
        title: "古籍解谜",
        narrative: `一本残破的古籍，字迹模糊难辨。${name}逐字推敲，${mod.style}填补断裂的上下文。三炷香后，一段失传的修炼心得终于完整复原。`,
        mood: "悟",
        hint: "知识就是力量，古人诚不我欺",
      },
    ],
    EXERCISE: [
      {
        title: "淬体苦修",
        narrative: `${name}摆开架势，一遍遍运转锻体功法。${mod.aura}在经脉中奔涌，汗水浸透衣衫，肌肉酸痛难忍。但每一次力竭后的坚持，都让肉身更坚韧一分。`,
        mood: "燃",
        hint: "千锤百炼，方成大器",
      },
      {
        title: "极限突破",
        narrative: `${name}已经做到第九组了。双臂在颤抖，呼吸如风箱——但${name}没有停。${mod.style}，又完成了一组。灵力在酸痛的肌纤维间穿梭修补，肉身在极限中重生。`,
        mood: "燃",
        hint: "昨天的极限，是今天的起点",
      },
      {
        title: "气血奔腾",
        narrative: `${name}站定桩功，周身气血如江河奔涌。${mod.aura}随之激荡，冲刷着每一条经脉。一炷香过去，${name}全身微汗，${mod.feeling}。`,
        mood: "燃",
        hint: "动则不衰，流水不腐",
      },
      {
        title: "筋骨打磨",
        narrative: `${name}以最慢的速度做每一个动作——慢到肌肉在尖叫。${mod.style}控制着每一寸筋骨的收缩与伸展。这不是普通的锻体，这是在雕刻肉身。`,
        mood: "静",
        hint: "慢，才是真正的快",
      },
      {
        title: "汗水炼心",
        narrative: `锻体到了一半，${name}想放弃了。太累了。但${name}深吸一口气——${mod.aura}重新燃起——又坚持了一组。真正的修炼，从"想放弃但没放弃"开始。`,
        mood: "燃",
        hint: "每一次坚持，都在重塑自己",
      },
    ],
    SLEEP: [
      {
        title: "蕴神养元",
        narrative: `月华如水，${name}盘膝而坐，运转静心功法。白日喧嚣渐渐远去，${mod.aura}如温润的泉水在体内循环。元神在宁静中得到最深的滋养。`,
        mood: "静",
        hint: "一张一弛，文武之道",
      },
      {
        title: "安神入定",
        narrative: `${name}熄了灯火，放下手机。这个世界终于安静了。${mod.aura}自然流转，不做引导，不做干预——让身体自己去修复、去平衡。真正的修炼，有时是"不修之为"。`,
        mood: "静",
        hint: "好好休息，就是对身体最大的尊重",
      },
      {
        title: "月下静息",
        narrative: `窗外月色正好。${name}不再想白天的事——那些功法、那些任务、那些还没做完的事。今晚只做一件事：让元神回家。${mod.feeling}，沉沉睡去。`,
        mood: "静",
        hint: "今天的修炼结束了，道声晚安",
      },
      {
        title: "养精蓄锐",
        narrative: `${name}用温水泡了脚，做了几组深呼吸。${mod.aura}随着呼吸缓缓沉降。丹田之中，灵力不再奔涌，而是如潭水般沉静下来，为明日的修炼积蓄力量。`,
        mood: "静",
        hint: "积蓄，是为了更好的释放",
      },
      {
        title: "断念休憩",
        narrative: `睡前最后一件事——${name}闭上了眼。不是去想明天要修什么，而是感谢今天已经修了的。${mod.aura}在沉睡中自行运转。道法自然，不修而修。`,
        mood: "静",
        hint: "清空杂念，回归本心",
      },
    ],
    MEDITATE: [
      {
        title: "天人交感",
        narrative: `${name}五心朝天，神识沉入丹田。${mod.aura}在深邃的内视中，${name}仿佛看到了天地初开的混沌、万物生灭的循环。一道法则的痕迹在心中闪过。`,
        mood: "静",
        hint: "道法自然，清静无为",
      },
      {
        title: "内视自省",
        narrative: `${name}闭目内观。经脉如江河，丹田如湖泊，灵力在其中流转不息。${name}以${mod.style}检视每一处穴窍——今日的修炼在身体里留下了什么痕迹？`,
        mood: "静",
        hint: "看见自己，才能超越自己",
      },
      {
        title: "虚空冥想",
        narrative: `${name}什么都不想。念头来了——让它走。念头又来了——再让它走。${mod.aura}在无念之中反而更加活跃。原来"空"不是没有，是全部。`,
        mood: "静",
        hint: "放下执念，天地自宽",
      },
      {
        title: "灵气吐纳",
        narrative: `一呼——凡尘浊气尽出。一吸——天地灵气皆入。${name}以${mod.style}引导气息在体内运转一个周天。七七四十九次吐纳之后，${mod.feeling}。`,
        mood: "静",
        hint: "一呼一吸，即是一生一灭",
      },
      {
        title: "心湖倒影",
        narrative: `${name}将神识沉入心湖。湖水如镜，倒映着内心的一切——喜悦、焦虑、期待、恐惧。${name}不评判，只是看着。${mod.aura}轻轻拂过湖面，涟漪散尽，湖水澄澈。`,
        mood: "静",
        hint: "平静的心，是最强大的武器",
      },
    ],
    CUSTOM: [
      {
        title: "随心而修",
        narrative: `${name}不拘泥于形式，跟随直觉而行。${mod.aura}在体内自由游走。有时候最好的修炼不是按计划来，而是听从身体和直觉的引导。`,
        mood: "静",
        hint: "大道三千，殊途同归",
      },
      {
        title: "独辟蹊径",
        narrative: `${name}今天不按常规修炼。${mod.style}尝试了一种全新的运气路线——前人没走过，书上没写过。但灵力居然流转得异常顺畅。也许每个修炼者，最终都要找到自己的路。`,
        mood: "奇",
        hint: "走出自己的道，才是真道",
      },
      {
        title: "修行感悟",
        narrative: `${name}没有做任何具体修炼，而是坐下来回顾这段时间的成长。每一份坚持都有痕迹。${mod.aura}在反思中愈发凝练。`,
        mood: "悟",
        hint: "会反思的人，进步最快",
      },
      {
        title: "意外发现",
        narrative: `${name}在整理修炼笔记时忽然发现——两种看似无关的功法之间有隐秘的联系。${mod.style}尝试融合之后，${mod.feeling}。这就是举一反三的力量。`,
        mood: "悟",
        hint: "处处留心皆学问",
      },
      {
        title: "道法自然",
        narrative: `${name}什么也没做——只是散步。看云、听风、感受脚下大地的脉动。${mod.aura}在无所事事中悄然流转。原来修炼不一定要打坐运功，活在当下，本身就是修行。`,
        mood: "静",
        hint: "修行就在日常中",
      },
    ],
  };

  const taskTemplates = templates[taskType] || templates.CUSTOM;
  return pickTemplate(taskType, taskTemplates);
}
