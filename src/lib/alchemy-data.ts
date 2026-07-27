// 炼丹数据：丹方、丹炉、成功率与品质计算。
// 被 src/app/api/alchemy/refine/route.ts 使用。

export type QualityTier = "low" | "mid" | "high" | "perfect";

export interface QualityWeights {
  low: number;
  mid: number;
  high: number;
  perfect: number;
}

export interface FormulaMaterial {
  itemId: string;
  amount: number;
  name: string;
}

export interface Formula {
  id: string;
  name: string;
  productBaseId: string;
  productName: string;
  materials: FormulaMaterial[];
  baseSuccessRate: number;
  difficultyLevel: number;
  unlockedByDefault?: boolean;
}

export interface Furnace {
  id: string;
  name: string;
  successRateBonus: number;
  qualityWeights: QualityWeights;
}

export const FORMULAS: Formula[] = [
  {
    id: "formula_recovery",
    name: "回气丹",
    productBaseId: "pill_recovery",
    productName: "回气丹",
    materials: [
      { itemId: "herb_qi", amount: 2, name: "聚气草" },
      { itemId: "water_dew", amount: 1, name: "晨露" },
    ],
    baseSuccessRate: 70,
    difficultyLevel: 1,
    unlockedByDefault: true,
  },
  {
    id: "formula_clarity",
    name: "清心丹",
    productBaseId: "pill_clarity",
    productName: "清心丹",
    materials: [
      { itemId: "herb_qi", amount: 3, name: "聚气草" },
      { itemId: "spirit_grass", amount: 2, name: "灵草" },
    ],
    baseSuccessRate: 55,
    difficultyLevel: 2,
  },
  {
    id: "formula_bodyforge",
    name: "淬体丹",
    productBaseId: "pill_bodyforge",
    productName: "淬体丹",
    materials: [
      { itemId: "ore_iron", amount: 2, name: "玄铁" },
      { itemId: "spirit_grass", amount: 3, name: "灵草" },
    ],
    baseSuccessRate: 45,
    difficultyLevel: 3,
  },
];

export const FURNACES: Furnace[] = [
  {
    id: "bronze_furnace",
    name: "青铜丹炉",
    successRateBonus: 0,
    qualityWeights: { low: 70, mid: 25, high: 5, perfect: 0 },
  },
  {
    id: "silver_furnace",
    name: "白银丹炉",
    successRateBonus: 10,
    qualityWeights: { low: 40, mid: 45, high: 13, perfect: 2 },
  },
  {
    id: "gold_furnace",
    name: "黄金丹炉",
    successRateBonus: 20,
    qualityWeights: { low: 20, mid: 50, high: 25, perfect: 5 },
  },
];

const DEFAULT_FURNACE_ID = "bronze_furnace";

export function getFormulaById(id: string): Formula | undefined {
  return FORMULAS.find((f) => f.id === id);
}

export function getFurnaceById(id: string): Furnace | undefined {
  return FURNACES.find((f) => f.id === id);
}

export function getDefaultFurnace(): Furnace {
  return FURNACES.find((f) => f.id === DEFAULT_FURNACE_ID) ?? FURNACES[0];
}

export function getAllFormulas(): Formula[] {
  return FORMULAS;
}

/** 按权重随机决定本次炼丹品质。qualityLift 提升中高品概率。 */
export function determineQuality(weights: QualityWeights, qualityLift: number): QualityTier {
  const tiers: QualityTier[] = ["low", "mid", "high", "perfect"];
  const adjusted: Record<QualityTier, number> = {
    low: Math.max(1, weights.low),
    mid: Math.max(1, weights.mid + qualityLift),
    high: Math.max(0, weights.high + qualityLift * 2),
    perfect: Math.max(0, weights.perfect + qualityLift * 3),
  };
  const total = tiers.reduce((sum, t) => sum + adjusted[t], 0);
  let roll = Math.random() * total;
  for (const t of tiers) {
    roll -= adjusted[t];
    if (roll <= 0) return t;
  }
  return "low";
}

const TALENT_SUCCESS_BONUS: Record<string, number> = {
  pill: 15,
  array: 5,
  body: 5,
  sword: 5,
  mind: 5,
};

const TALENT_QUALITY_LIFT: Record<string, number> = {
  pill: 10,
  array: 3,
};

function parseTalentIds(talents: string | null): string[] {
  if (!talents) return [];
  return talents
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 天赋对成功率的基础加成（百分点）。 */
export function getTalentBonus(talents: string | null): number {
  const ids = parseTalentIds(talents);
  return ids.reduce((sum, id) => sum + (TALENT_SUCCESS_BONUS[id] ?? 0), 0);
}

/** 天赋对品质的提升（用于 determineQuality）。 */
export function getTalentQualityLift(talents: string | null): number {
  const ids = parseTalentIds(talents);
  return ids.reduce((sum, id) => sum + (TALENT_QUALITY_LIFT[id] ?? 0), 0);
}

/** 炼制一份丹方所需的材料总消耗（供 UI 预估）。 */
export function computePillConsumption(formula: Formula): FormulaMaterial[] {
  return formula.materials.map((m) => ({ ...m }));
}
