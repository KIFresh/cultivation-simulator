// ============================================================
// 修仙模拟器 — 体质维度（出身系统）
// Cultivator.physique 字段以「体质 id」字符串存储；本模块提供
// 体质定义、查询与属性加成应用。
// ============================================================

export interface PhysiqueDef {
  id: string;
  name: string;
  description: string;
  rarity: number;
  element?: string;
  /** 属性加成（叠加到根/神/悟/运/魅/心/体等维度） */
  effects: Record<string, number>;
}

/** 可选体质清单 */
export const PHYSIOUES: PhysiqueDef[] = [
  {
    id: "mortal_body",
    name: "凡胎肉体",
    description: "天生资质平平，全凭后天勤勉弥补",
    rarity: 1,
    effects: {},
  },
  {
    id: "dao_body",
    name: "天生道体",
    description: "万中无一的修行奇才，悟性超群",
    rarity: 5,
    element: "道",
    effects: { spirit: 3, insight: 3 },
  },
  {
    id: "sword_bone",
    name: "剑骨",
    description: "筋骨如剑，攻伐凌厉，参悟剑道事半功倍",
    rarity: 4,
    element: "金",
    effects: { root: 2, insight: 1 },
  },
  {
    id: "medicine_spirit",
    name: "药灵之体",
    description: "先天亲和灵药，炼丹药效更佳",
    rarity: 4,
    element: "木",
    effects: { spirit: 2, insight: 2 },
  },
  {
    id: "vajra_body",
    name: "金刚不坏之躯",
    description: "体魄强悍，寿元绵长，重伤亦能速愈",
    rarity: 3,
    element: "土",
    effects: { health: 10, mind: 1 },
  },
  {
    id: "spirit_eye",
    name: "灵瞳",
    description: "双目洞彻天地灵机，洞察先机",
    rarity: 3,
    element: "水",
    effects: { insight: 2, luck: 1 },
  },
  {
    id: "void_heart",
    name: "空明道心",
    description: "心境澄澈，心魔难侵，修炼少有滞涩",
    rarity: 4,
    element: "水",
    effects: { mind: 3, insight: 1 },
  },
];

export function getPhysiqueById(id: string | null | undefined): PhysiqueDef | null {
  if (!id) return null;
  return PHYSIOUES.find((p) => p.id === id) ?? null;
}

export function getAllPhysiques(): PhysiqueDef[] {
  return PHYSIOUES;
}

/** 解析存储字段（Cultivator.physique 为 id 字符串或 JSON） */
export function parsePhysique(raw: string | null | undefined): PhysiqueDef | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return getPhysiqueById(trimmed);
  try {
    const obj = JSON.parse(trimmed) as Partial<PhysiqueDef> & { id?: string };
    return getPhysiqueById(obj.id);
  } catch {
    return getPhysiqueById(trimmed);
  }
}

/** 将体质加成叠加到基础属性上，返回新属性表 */
export function applyPhysiqueEffects(
  base: Record<string, number>,
  physiqueId: string | null | undefined,
): Record<string, number> {
  const p = getPhysiqueById(physiqueId);
  if (!p) return { ...base };
  const out: Record<string, number> = { ...base };
  for (const [k, v] of Object.entries(p.effects)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/** 按稀有度加权随机选取一种体质（rng 可注入以便测试） */
export function getRandomPhysique(rng: () => number = Math.random): PhysiqueDef {
  const total = PHYSIOUES.reduce((s, p) => s + p.rarity, 0);
  let roll = rng() * total;
  for (const p of PHYSIOUES) {
    roll -= p.rarity;
    if (roll <= 0) return p;
  }
  return PHYSIOUES[0];
}
