import { describe, expect, it } from "vitest";
import {
  MAX_HEALTH,
  QUARTERLY_HEALTH_RECOVERY,
  HEALTH_CRITICAL_THRESHOLD,
  HEALTH_ZERO_DEBUFF_DURATION,
  calcQuarterlyHealthRecovery,
  checkHealthZero,
  decayToxicity,
} from "@/lib/health";

describe("health constants", () => {
  it("常量值正确", () => {
    expect(MAX_HEALTH).toBe(100);
    expect(QUARTERLY_HEALTH_RECOVERY).toBe(1);
    expect(HEALTH_CRITICAL_THRESHOLD).toBe(20);
    expect(HEALTH_ZERO_DEBUFF_DURATION).toBe(2);
  });
});

describe("calcQuarterlyHealthRecovery", () => {
  it("恢复 1 点且不超过上限", () => {
    expect(calcQuarterlyHealthRecovery(99)).toEqual({ newHealth: 100, delta: 1, critical: false });
  });

  it("已满时不恢复", () => {
    expect(calcQuarterlyHealthRecovery(100)).toEqual({ newHealth: 100, delta: 0, critical: false });
  });

  it("低于警戒线标记 critical", () => {
    expect(calcQuarterlyHealthRecovery(15).critical).toBe(true);
  });

  it("健康为 0 时不恢复", () => {
    expect(calcQuarterlyHealthRecovery(0)).toEqual({ newHealth: 0, delta: 0, critical: true });
  });

  it("负值健康不恢复", () => {
    expect(calcQuarterlyHealthRecovery(-5)).toEqual({ newHealth: -5, delta: 0, critical: true });
  });

  it("小值正确恢复", () => {
    expect(calcQuarterlyHealthRecovery(1)).toEqual({ newHealth: 2, delta: 1, critical: true });
  });

  it("精确边界", () => {
    expect(calcQuarterlyHealthRecovery(20 - QUARTERLY_HEALTH_RECOVERY)).toEqual({
      newHealth: 20,
      delta: 1,
      critical: false,
    });
  });
});

describe("checkHealthZero", () => {
  it("健康 <= 0 返回 debuff 轮数", () => {
    expect(checkHealthZero(0)).toBe(HEALTH_ZERO_DEBUFF_DURATION);
    expect(checkHealthZero(-1)).toBe(HEALTH_ZERO_DEBUFF_DURATION);
  });

  it("健康 > 0 返回 0", () => {
    expect(checkHealthZero(1)).toBe(0);
    expect(checkHealthZero(20)).toBe(0);
  });
});

describe("decayToxicity", () => {
  it("高丹毒正确衰减", () => {
    expect(decayToxicity(10)).toBe(7);
  });

  it("低丹毒不跌破 0", () => {
    expect(decayToxicity(2)).toBe(0);
  });

  it("零丹毒保持 0", () => {
    expect(decayToxicity(0)).toBe(0);
  });
});
