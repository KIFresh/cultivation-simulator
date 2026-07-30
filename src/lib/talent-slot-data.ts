import { safeJsonParse } from "./json-helper";

// ============================================================
// 修仙模拟器 — 轮回天赋槽（#6 高阶 sink）共享定义
// ============================================================
// 设计：轮回印记（reincarnationMark，跨世豁免资源）在轮回祭坛 mint；
// 玩家花费印记 解锁/升级 天赋槽（talentSlots JSON），天赋效果于下一世（转世 create）生效。
// 道消时 reincarnationMark / talentSlots 显式跳过清零（与 reincarnationCount 同处理），兼容 🅴-3。
// 本轮（#6 core）仅本地应用 根骨(初始 root) + 长生(基础寿元)；道体/通明/战魂/灵慧 的跨系统效果为后续子步。

export type TalentType = "daoti" | "gengu" | "tongming" | "zhanhun" | "linghui" | "changsheng";

export interface TalentDef {
  name: string;
  effect: string;
  perLevel: number; // 每级增益
  cap: number; // 总增益上限（用于算等级上限）
}

export const TALENT_DEFS: Record<TalentType, TalentDef> = {
  daoti: { name: "道体", effect: "修炼速度", perLevel: 3, cap: 15 }, // +3%/级，总 cap +15%
  gengu: { name: "根骨", effect: "初始根骨", perLevel: 2, cap: 10 }, // +2/级，总 cap +10
  tongming: { name: "通明", effect: "突破率", perLevel: 2, cap: 10 }, // +2%/级，总 cap +10%
  zhanhun: { name: "战魂", effect: "战力", perLevel: 3, cap: 15 }, // +3/级，总 cap +15
  linghui: { name: "灵慧", effect: "采集产出", perLevel: 4, cap: 20 }, // +4%/级，总 cap +20%
  changsheng: { name: "长生", effect: "基础寿元", perLevel: 20, cap: 100 }, // +20年/级，总 cap +100年
};

export const MAX_SLOTS = 3;
export const UNLOCK_COSTS = [2, 5, 12]; // 槽1/槽2/槽3 解锁所需印记

export function maxLevelFor(t: TalentType): number {
  return Math.max(1, Math.floor(TALENT_DEFS[t].cap / TALENT_DEFS[t].perLevel));
}

// 升级花费：约解锁成本的 60% × 当前等级（递增，草案）
export function upgradeCost(slotIndex: number, currentLevel: number): number {
  const base = UNLOCK_COSTS[slotIndex] ?? 12;
  return Math.max(1, Math.round(base * 0.6 * currentLevel));
}

export interface TalentSlot {
  type: TalentType;
  level: number;
}

export function parseTalentSlots(raw?: string | null): TalentSlot[] {
  try {
    const a = safeJsonParse(raw, [] as any[]);
    return Array.isArray(a) ? (a as TalentSlot[]) : [];
  } catch {
    return [];
  }
}

// ============================================================
// 跨系统效果聚合（Task #29 — 让 #6 轮回天赋槽真正生效）
// ============================================================
// 道体/通明/战魂/灵慧 在运行时各系统读取 talentSlots 后叠加对应增益（含 per-level cap）。
// 根骨(gengu)/长生(changsheng) 已在转世 create 时本地应用，不在此跨系统生效。

export interface TalentBonuses {
  cultivationSpeed: number; // 道体：修炼速度 % 加成，封顶 15
  breakthroughRate: number; // 通明：突破率 % 加成，封顶 10
  combatPower: number; // 战魂：战力 平加，封顶 15
  gatherYield: number; // 灵慧：采集产出 % 加成，封顶 20
}

export function computeTalentBonuses(raw?: string | null): TalentBonuses {
  const slots = parseTalentSlots(raw);
  const acc: TalentBonuses = {
    cultivationSpeed: 0,
    breakthroughRate: 0,
    combatPower: 0,
    gatherYield: 0,
  };
  for (const s of slots) {
    const def = TALENT_DEFS[s.type];
    if (!def) continue;
    const bonus = Math.min(def.perLevel * s.level, def.cap);
    switch (s.type) {
      case "daoti":
        acc.cultivationSpeed = bonus;
        break;
      case "tongming":
        acc.breakthroughRate = bonus;
        break;
      case "zhanhun":
        acc.combatPower = bonus;
        break;
      case "linghui":
        acc.gatherYield = bonus;
        break;
      // gengu / changsheng 在转世 create 本地应用，此处不叠加
    }
  }
  return acc;
}
