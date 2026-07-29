// ============================================================
// 修仙模拟器 — 健康系统
// 自然恢复、伤害边界检查、季度结算
// ============================================================

export const MAX_HEALTH = 100;

/** 每季度自然恢复量（基础值，不与任何属性挂钩） */
export const QUARTERLY_HEALTH_RECOVERY = 1;

/** 每季度自然消退的丹毒量（GDD: decayToxicity -3/季） */
export const DETOX_PER_QUARTER = 3;

/** 健康警戒线：低于此值触发负面包袱 */
export const HEALTH_CRITICAL_THRESHOLD = 20;

/** 健康为 0 时施加的 injuryDebuff 轮数 */
export const HEALTH_ZERO_DEBUFF_DURATION = 2;

export interface HealthRecoveryResult {
  /** 恢复后的健康值（已上限截断） */
  newHealth: number;
  /** 实际恢复量 */
  delta: number;
  /** 是否触发了警戒线 */
  critical: boolean;
}

/**
 * 季度自然恢复。
 * 每季度恢复 QUARTERLY_HEALTH_RECOVERY 点，上限 MAX_HEALTH。
 * 若当前健康 ≤ 0，则不恢复（需要主动治疗）。
 */
export function calcQuarterlyHealthRecovery(
  currentHealth: number,
): HealthRecoveryResult {
  if (currentHealth <= 0) {
    return { newHealth: currentHealth, delta: 0, critical: true };
  }
  const newHealth = Math.min(MAX_HEALTH, currentHealth + QUARTERLY_HEALTH_RECOVERY);
  return {
    newHealth,
    delta: newHealth - currentHealth,
    critical: newHealth < HEALTH_CRITICAL_THRESHOLD,
  };
}

/**
 * 健康边界检查。
 * 若 health ≤ 0，返回 injuryDebuff 的持续时间；否则返回 0。
 */
export function checkHealthZero(health: number): number {
  if (health <= 0) return HEALTH_ZERO_DEBUFF_DURATION;
  return 0;
}

/**
 * 季度自然消退丹毒（GDD: -3/季）。
 */
export function decayToxicity(current: number): number {
  return Math.max(0, current - DETOX_PER_QUARTER);
}