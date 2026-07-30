import { describe, it, expect } from "vitest";
import {
  clampGoldDelta,
  getGoldMaxGainByRealm,
  clampGoldDeltaForRealm,
  GOLD_MIN,
  GOLD_MAX,
  GOLD_MAX_GAIN_PER_EVENT,
} from "../gold";

describe("clampGoldDelta", () => {
  it("应钳制超大正 delta 到 maxGain", () => {
    expect(clampGoldDelta(99999, 0)).toBe(GOLD_MAX_GAIN_PER_EVENT);
  });

  it("应钳制超大负 delta 到 -maxGain", () => {
    expect(clampGoldDelta(-99999, 500000)).toBe(-GOLD_MAX_GAIN_PER_EVENT);
  });

  it("应防止 currentGold + delta 低于 GOLD_MIN", () => {
    expect(clampGoldDelta(-100, 30)).toBe(-30);
  });

  it("应防止 currentGold + delta 超过 GOLD_MAX", () => {
    expect(clampGoldDelta(999999, GOLD_MAX - 100)).toBe(100);
  });

  it("非数字/NaN 应返回 0", () => {
    expect(clampGoldDelta("abc", 100)).toBe(0);
    expect(clampGoldDelta(NaN, 100)).toBe(0);
    expect(clampGoldDelta(undefined, 100)).toBe(0);
  });

  it("正常范围内的小额变动应保留原值", () => {
    expect(clampGoldDelta(500, 2000)).toBe(500);
  });

  it("应支持自定义 maxGain 参数", () => {
    expect(clampGoldDelta(5000, 0, 1000)).toBe(1000);
  });
});

describe("getGoldMaxGainByRealm", () => {
  it("realmLevel=0 应返回基础值", () => {
    expect(getGoldMaxGainByRealm(0)).toBe(GOLD_MAX_GAIN_PER_EVENT);
  });

  it("realmLevel=3 应放大 1.5 倍", () => {
    expect(getGoldMaxGainByRealm(3)).toBe(Math.round(GOLD_MAX_GAIN_PER_EVENT * 1.5));
  });

  it("realmLevel=12 应封顶", () => {
    const capped = getGoldMaxGainByRealm(12);
    const beyond = getGoldMaxGainByRealm(99);
    expect(beyond).toBe(capped);
  });

  it("负数 realmLevel 应视为 0", () => {
    expect(getGoldMaxGainByRealm(-5)).toBe(GOLD_MAX_GAIN_PER_EVENT);
  });
});

describe("clampGoldDeltaForRealm", () => {
  it("应结合 realm 动态 cap 钳制 delta", () => {
    const result = clampGoldDeltaForRealm(99999, 0, 3);
    expect(result).toBe(Math.round(GOLD_MAX_GAIN_PER_EVENT * 1.5));
  });
});
