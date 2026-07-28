// ============================================================
// 修仙模拟器 — 金币变动钳制（R2 红线）
// ============================================================
// 所有「AI 返回的金币变动」在入库前必须先经 clampGoldDelta 收口：
//   1) 单事件收益上限 GOLD_MAX_GAIN_PER_EVENT（防止 AI 灌爆 / 一次给百万）
//   2) 绝对值区间 [GOLD_MIN, GOLD_MAX]（防止金币变负或越上限）

export const GOLD_MIN = 0;
export const GOLD_MAX = 10_000_000;
export const GOLD_MAX_GAIN_PER_EVENT = 10_000;

/**
 * 将 AI 返回的金币变动 delta 钳制为安全值。
 * @param delta AI 返回的原始变动（可能为非数字 / NaN / 超大值）
 * @param currentGold 钳制时修炼者的当前金币余额
 * @returns 收口后的 delta：保证 currentGold + 返回值 ∈ [GOLD_MIN, GOLD_MAX]，且单事件增益 ≤ GOLD_MAX_GAIN_PER_EVENT
 */
export function clampGoldDelta(
  delta: unknown,
  currentGold: number,
  maxGain: number = GOLD_MAX_GAIN_PER_EVENT
): number {
  const n = typeof delta === "number" ? delta : Number(delta);
  if (!Number.isFinite(n)) return 0;
  let d = Math.trunc(n);
  if (d > maxGain) d = maxGain;
  if (d < -maxGain) d = -maxGain;
  if (currentGold + d < GOLD_MIN) d = GOLD_MIN - currentGold;
  if (currentGold + d > GOLD_MAX) d = GOLD_MAX - currentGold;
  return d;
}

/**
 * 按 realm 动态单事件收益上限：baseCap × 平滑放大。
 * 每 3 个 realmLevel 放大 1.5×，封顶 12 级（避免高阶 cap 失控）。
 * 对应设计急救清单 T1-2·1：cap 按 realm 动态（baseCap × realmMult）。
 */
export function getGoldMaxGainByRealm(realmLevel: number): number {
  const level = Math.max(0, Math.floor(Number(realmLevel) || 0));
  return Math.round(GOLD_MAX_GAIN_PER_EVENT * Math.pow(1.5, Math.min(level, 12) / 3));
}

/**
 * 按 realm 动态钳制金币变动（封装 clampGoldDelta + 动态 cap）。
 */
export function clampGoldDeltaForRealm(
  delta: unknown,
  currentGold: number,
  realmLevel: number
): number {
  return clampGoldDelta(delta, currentGold, getGoldMaxGainByRealm(realmLevel));
}
