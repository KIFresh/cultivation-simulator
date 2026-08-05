// ============================================================
// 交友/孤立系统 — 设计 13.2（属性成长系统改造方案 2026-08-04）
// 纯函数，无 IO，可单测。
// 孤立状态持久化在 cultivator.quarterAccum（预留 JSON 字段，无 schema 变更）。
// 触发接线：advance-quarter 路由跨年时调用；脱困由魅力 Lv3 或成功社交触发。
// ============================================================

/** 孤立期间学习产出折扣（设计 13.2：8 折；由日课产出侧接线方应用）。 */
export const ISOLATION_STUDY_MULTIPLIER = 0.8;

/** 孤立期负面小事件。 */
export interface IsolationEvent {
  id: string;
  title: string;
  narrative: string;
}

/** 孤立期负面小事件池（被嘲笑/被排挤/一个人吃饭等）。 */
export const ISOLATION_EVENTS: IsolationEvent[] = [
  {
    id: "mocked",
    title: "被同学嘲笑",
    narrative: "课间有人故意学说话的样子，周围笑声一片，只能低着头假装没听见。",
  },
  {
    id: "excluded",
    title: "被小团体排挤",
    narrative: "分组活动时没人愿意同组，最后老师只好单独安排座位。",
  },
  {
    id: "lunch_alone",
    title: "一个人吃饭",
    narrative: "食堂里端着餐盘找了半天位置，最后还是独自坐在角落吃完了午饭。",
  },
  {
    id: "recess_alone",
    title: "课间独处",
    narrative: "课间十分钟，同学们三三两两聚在一起说笑，只有自己一个人望着窗外发呆。",
  },
  {
    id: "prank",
    title: "被恶作剧",
    narrative: "书本被藏到了讲台下面，找了半天才在哄笑声中找到。",
  },
];

/** 随机抽取一个孤立事件。 */
export function pickIsolationEvent(): IsolationEvent {
  return ISOLATION_EVENTS[Math.floor(Math.random() * ISOLATION_EVENTS.length)];
}

/** 孤立状态（持久化在 cultivator.quarterAccum 的 JSON）。 */
export interface IsolationState {
  /** 孤立到期年份：当前年龄 ≥ 该值时孤立自然解除；解除后冷却 1 年（isolatedUntil + 1 前不再触发）。 */
  isolatedUntil?: number;
}

/** 解析 quarterAccum 中的孤立状态，非法/缺失回退为空状态。 */
export function parseIsolationState(raw: string | null | undefined): IsolationState {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as IsolationState;
    }
  } catch {
    /* 解析失败保持空状态 */
  }
  return {};
}

/** 当前年龄是否处于孤立期。 */
export function isIsolated(state: IsolationState, age: number): boolean {
  return (state.isolatedUntil ?? 0) > age;
}

/** 脱困：成功社交 1 次或魅力升到 Lv3 后调用，立即解除孤立（冷却从解除当年起算）。 */
export function releaseIsolation(state: IsolationState, age: number): IsolationState {
  return { ...state, isolatedUntil: age };
}

/**
 * 判定是否触发孤立（设计 13.2 修订）：
 * - 12 岁起（小学无孤立）
 * - 有朋友 → 免疫
 * - 孤立中或解除后 1 年冷却期内不触发
 * - 魅力 Lv0 → 100%；Lv1 → 40%；Lv2 → 15%；Lv3+ 免疫
 */
export function checkIsolationTrigger(
  charmLevel: number,
  age: number,
  isolatedUntil?: number | null,
  hasFriend = false
): boolean {
  if (age < 12) return false;
  if (hasFriend) return false;
  if (isolatedUntil && age < isolatedUntil + 1) return false;
  if (charmLevel <= 0) return true;
  if (charmLevel === 1) return Math.random() < 0.4;
  if (charmLevel === 2) return Math.random() < 0.15;
  return false;
}

/**
 * 交友成败判定（MAKE_FRIEND 行动）：
 * 魅力 Lv0-1 → 20%；Lv2 → 40%；Lv3+ → 60%；孤立中概率减半。
 */
export function rollFriendSuccess(charmLevel: number, isolated = false): boolean {
  let p: number;
  if (charmLevel <= 1) p = 0.2;
  else if (charmLevel === 2) p = 0.4;
  else p = 0.6;
  if (isolated) p /= 2;
  return Math.random() < p;
}
