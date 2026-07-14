// ============================================================
// 功法系统 — 数据类型、常量数据、核心逻辑
// ============================================================

/** 功法品级 */
export type TechniqueGrade = "凡" | "黄" | "玄" | "地" | "天";

/** 可装备的最低境界 */
export type TechniqueRealm = "凡人" | "炼气期" | "筑基期" | "金丹期" | "元婴期" | "化神期" | "炼虚期" | "合体期" | "大乘期" | "渡劫期";

/** 效果类型 */
export type EffectType = "cultivationSpeed" | "breakthroughRate" | "combat" | "daily";

/** 单个效果 */
export interface TechniqueEffect {
  type: EffectType;
  value: number;
  perLevel: number;
  description: string; // 显示文本，如 "修炼速度 +{value}%"
}

/** 功法定义 */
export interface Technique {
  id: string;
  name: string;
  icon: string;
  description: string;
  grade: TechniqueGrade;
  realm: TechniqueRealm;
  maxLevel: number;
  upgradeProficiency: number[]; // [100, 300] 表示2级需100熟练度，3级需300
  effects: TechniqueEffect[];
}

// ============================================================
// 功法数据
// ============================================================

export const TECHNIQUES: Record<string, Technique> = {
  basic_breathing: {
    id: "basic_breathing",
    name: "吐纳术",
    icon: "🌬️",
    description: "最基础的呼吸吐纳之法，引灵气入体",
    grade: "凡",
    realm: "凡人",
    maxLevel: 3,
    upgradeProficiency: [100, 300],
    effects: [
      { type: "cultivationSpeed", value: 5, perLevel: 3, description: "修炼速度 +{value}%" },
    ],
  },
  sword_foundation: {
    id: "sword_foundation",
    name: "基础剑诀",
    icon: "⚔️",
    description: "剑修入门功法，奠定剑道根基",
    grade: "黄",
    realm: "炼气期",
    maxLevel: 3,
    upgradeProficiency: [150, 400],
    effects: [
      { type: "cultivationSpeed", value: 10, perLevel: 5, description: "修炼速度 +{value}%" },
      { type: "breakthroughRate", value: 3, perLevel: 2, description: "突破概率 +{value}%" },
    ],
  },
  heart_protecting: {
    id: "heart_protecting",
    name: "护心诀",
    icon: "🛡️",
    description: "以灵力护持心脉，增强体魄",
    grade: "黄",
    realm: "炼气期",
    maxLevel: 3,
    upgradeProficiency: [120, 350],
    effects: [
      { type: "combat", value: 5, perLevel: 3, description: "防御 +{value}" },
      { type: "daily", value: 2, perLevel: 1, description: "体力上限 +{value}" },
    ],
  },
  spirit_gathering: {
    id: "spirit_gathering",
    name: "聚灵诀",
    icon: "✨",
    description: "加快灵气汇聚速度",
    grade: "玄",
    realm: "筑基期",
    maxLevel: 3,
    upgradeProficiency: [200, 500],
    effects: [
      { type: "cultivationSpeed", value: 20, perLevel: 10, description: "修炼速度 +{value}%" },
      { type: "breakthroughRate", value: 5, perLevel: 3, description: "突破概率 +{value}%" },
    ],
  },
  seven_star_sword: {
    id: "seven_star_sword",
    name: "七星剑诀",
    icon: "⭐",
    description: "引北斗七星之力，剑势凌厉",
    grade: "地",
    realm: "金丹期",
    maxLevel: 3,
    upgradeProficiency: [400, 1000],
    effects: [
      { type: "cultivationSpeed", value: 30, perLevel: 15, description: "修炼速度 +{value}%" },
      { type: "combat", value: 20, perLevel: 10, description: "攻击 +{value}" },
    ],
  },
  heavenly_dao: {
    id: "heavenly_dao",
    name: "天道诀",
    icon: "☯️",
    description: "传说中直指大道的无上功法",
    grade: "天",
    realm: "化神期",
    maxLevel: 3,
    upgradeProficiency: [1000, 3000],
    effects: [
      { type: "cultivationSpeed", value: 50, perLevel: 25, description: "修炼速度 +{value}%" },
      { type: "breakthroughRate", value: 10, perLevel: 5, description: "突破概率 +{value}%" },
      { type: "combat", value: 30, perLevel: 15, description: "全属性 +{value}" },
    ],
  },
};

// ============================================================
// 核心函数
// ============================================================

/**
 * 增加功法熟练度，处理多级跳跃和满级清零。
 * - 满级后丢弃多余熟练度
 * - while 循环处理单次大额跳多级
 * - 升到满级时 proficiency 清 0
 */
export function addProficiency(
  currentLevel: number,
  currentProf: number,
  upgradeProficiency: number[],
  amount: number
): { newLevel: number; newProficiency: number; leveledUp: boolean } {
  const maxLevel = upgradeProficiency.length + 1;

  if (currentLevel >= maxLevel) {
    return { newLevel: currentLevel, newProficiency: 0, leveledUp: false };
  }

  let level = currentLevel;
  let prof = currentProf + amount;
  let leveledUp = false;

  while (level < maxLevel) {
    const required = upgradeProficiency[level - 1];
    if (prof < required) break;
    prof -= required;
    level += 1;
    leveledUp = true;
    if (level >= maxLevel) {
      prof = 0;
      break;
    }
  }

  return { newLevel: level, newProficiency: prof, leveledUp };
}

/**
 * 计算装备功法的总加成。
 * 输入：功法列表 (technique + level)
 * 输出：按 type 聚合的加成值
 */
export function calculateTechniqueBonuses(
  techniques: { technique: Technique; level: number }[]
): Record<EffectType, number> {
  const result: Record<string, number> = {
    cultivationSpeed: 0,
    breakthroughRate: 0,
    combat: 0,
    daily: 0,
  };
  for (const t of techniques) {
    for (const e of t.technique.effects) {
      result[e.type] = (result[e.type] || 0) + e.value + e.perLevel * (t.level - 1);
    }
  }
  return result as Record<EffectType, number>;
}

/** 根据 techniqueId 获取功法定义 */
export function getTechniqueById(id: string): Technique | undefined {
  return TECHNIQUES[id];
}