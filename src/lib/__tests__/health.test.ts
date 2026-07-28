import { describe, it, expect } from "vitest";
import {
  MAX_HEALTH,
  QUARTERLY_HEALTH_RECOVERY,
  HEALTH_CRITICAL_THRESHOLD,
  HEALTH_ZERO_DEBUFF_DURATION,
  calcQuarterlyHealthRecovery,
  checkHealthZero,
  applyDamage,
} from "../health";

describe("calcQuarterlyHealthRecovery", () => {
  it("健康满时不变", () => {
    const r = calcQuarterlyHealthRecovery(MAX_HEALTH);
    expect(r.newHealth).toBe(MAX_HEALTH);
    expect(r.delta).toBe(0);
    expect(r.critical).toBe(false);
  });

  it("健康未满时恢复 1 点", () => {
    const r = calcQuarterlyHealthRecovery(50);
    expect(r.newHealth).toBe(51);
    expect(r.delta).toBe(1);
    expect(r.critical).toBe(false);
  });

  it("健康 99 时恢复 1 点到上限", () => {
    const r = calcQuarterlyHealthRecovery(99);
    expect(r.newHealth).toBe(MAX_HEALTH);
    expect(r.delta).toBe(1);
  });

  it("健康 0 时不再恢复", () => {
    const r = calcQuarterlyHealthRecovery(0);
    expect(r.newHealth).toBe(0);
    expect(r.delta).toBe(0);
    expect(r.critical).toBe(true);
  });

  it("健康低于 0 时也不恢复", () => {
    const r = calcQuarterlyHealthRecovery(-5);
    expect(r.newHealth).toBe(-5);
    expect(r.delta).toBe(0);
    expect(r.critical).toBe(true);
  });

  it("警戒线以下标记 critical", () => {
    const r = calcQuarterlyHealthRecovery(HEALTH_CRITICAL_THRESHOLD - 2);
    expect(r.newHealth).toBe(HEALTH_CRITICAL_THRESHOLD - 1);
    expect(r.critical).toBe(true);
  });

  it("警戒线以上不标记 critical", () => {
    const r = calcQuarterlyHealthRecovery(HEALTH_CRITICAL_THRESHOLD);
    expect(r.newHealth).toBe(HEALTH_CRITICAL_THRESHOLD + 1);
    expect(r.critical).toBe(false);
  });
});

describe("checkHealthZero", () => {
  it("健康 > 0 返回 0", () => {
    expect(checkHealthZero(1)).toBe(0);
    expect(checkHealthZero(50)).toBe(0);
    expect(checkHealthZero(100)).toBe(0);
  });

  it("健康 == 0 返回 debuff 轮数", () => {
    expect(checkHealthZero(0)).toBe(HEALTH_ZERO_DEBUFF_DURATION);
  });

  it("健康 < 0 也返回 debuff 轮数", () => {
    expect(checkHealthZero(-10)).toBe(HEALTH_ZERO_DEBUFF_DURATION);
  });
});

describe("applyDamage", () => {
  it("正常扣减", () => {
    expect(applyDamage(50, -10)).toBe(40);
  });

  it("下界为 0", () => {
    expect(applyDamage(5, -10)).toBe(0);
  });

  it("治疗不设上界", () => {
    expect(applyDamage(50, 10)).toBe(60);
  });

  it("零 delta", () => {
    expect(applyDamage(50, 0)).toBe(50);
  });
});