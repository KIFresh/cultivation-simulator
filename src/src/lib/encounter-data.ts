// ============================================================
// 修仙模拟器 — 随机奇遇系统
// ============================================================

import type { SpiritualRoot } from "./cultivation-data";
import { SPIRITUAL_ROOTS } from "./cultivation-data";

// ============================================================
// 类型定义
// ============================================================

/** 风险等级 */
export type RiskLevel = "low" | "medium" | "high";

/** 奖励/惩罚类型 */
export type RewardType =
  | "cultivationExp"    // 修炼值增减
  | "stamina"           // 体力增减
  | "breakthrough"      // 突破概率加成
  | "title"             // 称号
  | "specialItem";      // 特殊物品（功法残卷、法宝碎片等）

/** 单个奖励/惩罚条目 */
export interface RewardEffect {
  type: RewardType;
  value: number;          // 增减数值
  label: string;          // 显示文本，如 "+50 修炼值"
}

/** 一个选项 */
export interface EncounterChoice {
  riskLevel: RiskLevel;
  text: string;           // 选项文字，如 "在洞外盘坐吐纳，吸纳逸散灵气"
  hint: string;           // 风险提示，如 "安全无忧，但机缘有限"
  rewards: RewardEffect[]; // 奖励列表（惩罚用负值）
  successNarrative: string; // 选择后的结果叙事
}

/** 一个完整奇遇 */
export interface Encounter {
  id: string;
  title: string;          // 奇遇标题
  narrative: string;      // 场景描述（仙侠文风，约100字）
  choices: [EncounterChoice, EncounterChoice, EncounterChoice]; // 低/中/高 三个选项
  minRealm?: string;      // 最低境界要求（可选）
  weight: number;         // 权重，影响随机抽取概率
}

// ============================================================
// 奇遇事件池
// ============================================================

export const ENCOUNTER_POOL: Encounter[] = [
  // ==========================================
  // 奇遇一：古洞府遗迹
  // ==========================================
  {
    id: "ancient_cave",
    title: "古洞府遗迹",
    weight: 100,
    narrative:
      "行至一处荒山，忽闻山壁崩裂之声。但见碎石滚落处，露出一座古朴石门，门楣上刻着「青云居士」四字。洞内灵气如潮，隐隐有宝光流转，然门前禁制波纹未散，偶有道道电弧闪烁，显然仍有阵法守护。",
    choices: [
      {
        riskLevel: "low",
        text: "在洞外盘坐吐纳，吸纳逸散灵气",
        hint: "安全无忧，可稳定获取少量修为",
        rewards: [
          { type: "cultivationExp", value: 30, label: "+30 修炼值" },
        ],
        successNarrative:
          "你在洞府外寻了一处灵气最浓之地，盘膝坐下，闭目运功。丝丝缕缕的精纯灵气自洞中溢出，顺毛孔渗入经脉。一日一夜后，你睁开双眼，只觉体内灵力充盈，修为略有精进。虽未踏入洞府，却也小有收获。",
      },
      {
        riskLevel: "medium",
        text: "谨慎破解外围禁制，探索洞府外围",
        hint: "需要运功破解，有中等概率获得功法残卷",
        rewards: [
          { type: "cultivationExp", value: 80, label: "+80 修炼值" },
          { type: "specialItem", value: 1, label: "获得「青云心法·残卷」" },
        ],
        successNarrative:
          "你掐诀念咒，以灵力试探禁制脉络。几番周折后，终于寻得一处薄弱之处，轻轻撕开一道缝隙，闪身而入。洞府外围石室中，一方玉简静静躺在案上，正是青云居士留下的半部《青云心法》。你如获至宝，小心收入怀中。",
      },
      {
        riskLevel: "high",
        text: "催动浑身灵力，硬闯核心禁制！",
        hint: "⚠️ 有概率触发反噬损失修为，但若成功可得法宝",
        rewards: [
          { type: "cultivationExp", value: 200, label: "+200 修炼值" },
          { type: "specialItem", value: 1, label: "获得「青冥剑·下品法宝」" },
        ],
        successNarrative:
          "你深吸一口气，将浑身灵力催至巅峰，一掌拍向禁制核心！轰——石门炸裂，阵光四溅。你被震得气血翻涌，却见洞府深处，一柄碧色长剑悬于半空，剑身流转青光，正是青云居士的本命法宝「青冥剑」。虽受了些内伤，但这等机缘，值得！",
      },
    ],
  },

  // ==========================================
  // 奇遇二：灵兽渡劫
  // ==========================================
  {
    id: "spirit_beast_tribulation",
    title: "灵狐渡劫",
    weight: 100,
    narrative:
      "天空突然阴沉下来，劫云如墨汁般翻滚聚集。一只通体雪白的五尾灵狐正被天雷追逐，浑身毛发焦黑，鲜血淋漓。它已扛过七道天雷，第八道在云中酝酿，雷光刺目——灵狐哀鸣一声，眼中满是不甘，朝你的方向投来求救的目光。",
    choices: [
      {
        riskLevel: "low",
        text: "远远观望，静心感悟天劫中蕴含的大道法则",
        hint: "零风险，通过观摩天劫获得悟道感悟",
        rewards: [
          { type: "cultivationExp", value: 50, label: "+50 修炼值" },
        ],
        successNarrative:
          "你寻了一处安全的高地，盘膝坐下，凝神观望天劫——雷光电蛇的每一道弧线都暗合天道法则，毁灭之中蕴含着创生之力。数个时辰后劫云散去，你从入定中醒来，心中对天道的感悟又深了一层。",
      },
      {
        riskLevel: "medium",
        text: "掷出护身法器，远程助灵狐挡一道雷劫",
        hint: "消耗一件法器，有机会获得灵兽感恩馈赠",
        rewards: [
          { type: "cultivationExp", value: 100, label: "+100 修炼值" },
          { type: "specialItem", value: 1, label: "获得「灵狐之泪·炼丹圣品」" },
        ],
        successNarrative:
          "你取出一枚护身玉佩，以灵力激活后掷向雷云之下。玉佩化作光幕笼罩灵狐——第八道天雷轰然落下，光幕应声碎裂，却也抵消了致命一击。劫云终于消散，灵狐回头望你一眼，张口吐出一颗晶莹泪珠，落于你掌心。灵狐之泪，炼丹圣品！",
      },
      {
        riskLevel: "high",
        text: "冲入雷劫范围，以自身修为为灵狐扛劫！",
        hint: "⚠️ 高概率损失修为，但若成功灵狐可能认主",
        rewards: [
          { type: "cultivationExp", value: 300, label: "+300 修炼值" },
          { type: "specialItem", value: 1, label: "「五尾灵狐」认你为主！" },
        ],
        successNarrative:
          "你咬破舌尖，燃起精血，身形化作一道残影冲向雷云之下！天雷劈落，你以全身修为硬抗——剧痛穿心，经脉如焚，但灵狐趁机蓄力吐出一道本命寒息。人与狐合力之下，第八、第九道天雷竟被生生击散！劫云消散，灵狐缩小身形跃入你怀中，以额头蹭了蹭你的手——认主了！",
      },
    ],
  },

  // ==========================================
  // 奇遇三：邪修埋伏
  // ==========================================
  {
    id: "evil_cultivator_ambush",
    title: "黑风谷伏击",
    weight: 100,
    narrative:
      "途经一处峡谷时，半空中黑雾骤起，三道阴冷神念将你牢牢锁定。为首一名黑袍老者拄着骷髅杖从雾中走出，阴恻恻道：'等了足足三个月，总算来了个落单的。把储物袋交出来，或可留你全尸。'脚下阵纹已经悄然激活，退路被封。",
    choices: [
      {
        riskLevel: "low",
        text: "果断捏碎传送符，撤离此地",
        hint: "安全撤离，但失去此处可能的机缘",
        rewards: [
          { type: "cultivationExp", value: 20, label: "+20 修炼值" },
        ],
        successNarrative:
          "你毫不犹豫从袖中取出一枚传送符，啪地捏碎。白光闪过，身形瞬间消失在原地。邪修的禁制扑了个空，黑袍老者怒骂一声，却也无可奈何。你出现在数十里外的一处安全之地，虽有些狼狈，但总比落入圈套强。",
      },
      {
        riskLevel: "medium",
        text: "以游斗之策周旋，边战边寻找阵眼破绽",
        hint: "智取为上，有概率击败邪修获取战利品",
        rewards: [
          { type: "cultivationExp", value: 120, label: "+120 修炼值" },
          { type: "specialItem", value: 1, label: "缴获「骷髅杖·下品法器」" },
        ],
        successNarrative:
          "你佯装投降，暗中以神识探查阵纹走向。待黑袍老者放松警惕的瞬间，你猛地一掌拍向阵眼薄弱处——封阵应声而碎！三名邪修大惊失色，你趁势反击，一剑斩落为首老者的骷髅杖将其击退，余下二人见势不妙落荒而逃。打扫战场时，那根骷髅杖品相不错，勉强可做法器。",
      },
      {
        riskLevel: "high",
        text: "燃血秘术，硬撼三名邪修的合击阵法！",
        hint: "⚠️ 极大风险！可能大胜获重宝，也可能修为倒退",
        rewards: [
          { type: "cultivationExp", value: 350, label: "+350 修炼值" },
          { type: "specialItem", value: 1, label: "夺得「黑煞炼魂旗·中品法宝」" },
        ],
        successNarrative:
          "你冷笑一声，五指在胸前疾点，燃血秘术催动！修为瞬间暴涨数倍，你化作一道血光直冲黑袍老者——一拳轰碎骷髅杖，反手一掌将另外两人拍入山壁。老者惊恐万分，弃下本命法旗「黑煞炼魂旗」仓皇逃窜。秘术过后你浑身经脉剧痛，修为震荡，但这件中品法宝，足以抵偿一切！",
      },
    ],
  },
];

// ============================================================
// 触发逻辑
// ============================================================

/** 触发概率（30%） */
const ENCOUNTER_TRIGGER_RATE = 0.3;

/** 每日奇遇上限 */
const MAX_ENCOUNTERS_PER_DAY = 3;

/**
 * 判断是否触发奇遇
 * @param seed 可选的随机种子（用于调试或指定概率）
 * @returns 是否触发
 */
export function shouldTriggerEncounter(seed?: number): boolean {
  const roll = seed ?? Math.random();
  return roll < ENCOUNTER_TRIGGER_RATE;
}

/**
 * 从奇遇池中随机抽取一个
 * 使用加权随机，权重越高的奇遇被抽中概率越大
 * @param completedToday 今日已触发奇遇次数
 */
export function pickRandomEncounter(completedToday: number = 0): Encounter | null {
  if (completedToday >= MAX_ENCOUNTERS_PER_DAY) {
    return null; // 已达每日上限
  }

  if (ENCOUNTER_POOL.length === 0) return null;

  // 加权随机抽取
  const totalWeight = ENCOUNTER_POOL.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const encounter of ENCOUNTER_POOL) {
    roll -= encounter.weight;
    if (roll <= 0) {
      return encounter;
    }
  }

  // fallback：返回最后一个
  return ENCOUNTER_POOL[ENCOUNTER_POOL.length - 1];
}

/**
 * 根据用户选择的选项，计算最终奖励/惩罚
 *
 * 高风险选项会根据修炼者的灵根和境界进行概率判定：
 * - 基础成功率 40%
 * - 灵根稀有度每级 +5%（天灵根 +25%）
 * - 当前境界每层 +2%
 * - 最高不超过 85%
 */
export function resolveHighRiskOutcome(
  cultivator: {
    spiritualRoot: SpiritualRoot;
    realmIndex: number;   // 境界在 REALMS 中的索引
    realmLevel: number;   // 当前境界层数
  }
): boolean {
  const rootInfo = SPIRITUAL_ROOTS[cultivator.spiritualRoot];
  if (!rootInfo) return Math.random() < 0.4;

  // 基础成功率 40% + 灵根加成 + 境界加成
  const rootBonus = (rootInfo.rarity - 1) * 0.05;   // 1→0%, 5→20%
  const realmBonus = (cultivator.realmIndex * 0.03 + cultivator.realmLevel * 0.02);

  const successRate = Math.min(0.85, 0.40 + rootBonus + realmBonus);

  return Math.random() < successRate;
}

/**
 * 应用奖励效果到修炼者状态
 * 返回新的状态值（用于数据库更新）
 */
export function applyRewardEffects(
  effects: RewardEffect[],
  currentState: {
    cultivationExp: number;
    totalExp: number;
    stamina: number;
  }
): {
  cultivationExpDelta: number;
  cultivationExp: number;
  totalExp: number;
  stamina: number;
  specialItems: string[];
  message: string;
} {
  let expDelta = 0;
  let totalExp = currentState.totalExp;
  let cultivationExp = currentState.cultivationExp;
  let stamina = currentState.stamina;
  const specialItems: string[] = [];
  const messageParts: string[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case "cultivationExp":
        expDelta += effect.value;
        cultivationExp = Math.max(0, cultivationExp + effect.value);
        totalExp = Math.max(0, totalExp + effect.value);
        messageParts.push(effect.label);
        break;
      case "stamina":
        stamina = Math.max(0, Math.min(100, stamina + effect.value));
        messageParts.push(effect.label);
        break;
      case "specialItem":
        specialItems.push(effect.label);
        messageParts.push(effect.label);
        break;
      default:
        messageParts.push(effect.label);
    }
  }

  return {
    cultivationExpDelta: expDelta,
    cultivationExp,
    totalExp,
    stamina,
    specialItems,
    message: messageParts.join("，"),
  };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 将 Encounter 转换为可序列化的 JSON（用于 API 返回）
 * 去除 successNarrative，防止前端提前看到结果
 */
export function serializeEncounter(encounter: Encounter) {
  return {
    id: encounter.id,
    title: encounter.title,
    narrative: encounter.narrative,
    choices: encounter.choices.map((c) => ({
      riskLevel: c.riskLevel,
      text: c.text,
      hint: c.hint,
    })),
  };
}

/**
 * 根据奇遇 ID 查找奇遇
 */
export function getEncounterById(id: string): Encounter | undefined {
  return ENCOUNTER_POOL.find((e) => e.id === id);
}
