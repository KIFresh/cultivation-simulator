import { describe, it, expect } from "vitest";
import { generateWeather, resolveAction, WEATHER_TYPES, type WeatherResult } from "../weather";

const SEED = { id: "test-cultivator-001", age: 12, quarter: 2 };

function makeSpecialWeather(key: "thunder" | "fog"): WeatherResult {
  const wt = WEATHER_TYPES.find((w) => w.key === key)!;
  return {
    weather: wt,
    fortune: { key: "zhongping", label: "中平", desc: "平平稳稳。" },
    mood: wt.moodDelta,
    season: 2,
    seasonLabel: "第2季",
    isSpecial: true,
    specialKey: key === "thunder" ? "temper" : "lost",
  };
}

describe("generateWeather", () => {
  it("同角色同季度结果可复现（确定性）", () => {
    const a = generateWeather(SEED);
    const b = generateWeather(SEED);
    expect(a.weather.key).toBe(b.weather.key);
    expect(a.fortune.label).toBe(b.fortune.label);
    expect(a.mood).toBe(b.mood);
  });

  it("不同季度可能产生不同天气", () => {
    const s1 = generateWeather({ ...SEED, quarter: 1 });
    const s3 = generateWeather({ ...SEED, quarter: 3 });
    // 至少保证返回的是合法天气类型之一
    expect(WEATHER_TYPES.some((w) => w.key === s1.weather.key)).toBe(true);
    expect(WEATHER_TYPES.some((w) => w.key === s3.weather.key)).toBe(true);
  });

  it("心情值被限制在 [-5, 5]", () => {
    for (let q = 1; q <= 4; q++) {
      const w = generateWeather({ ...SEED, quarter: q });
      expect(w.mood).toBeGreaterThanOrEqual(-5);
      expect(w.mood).toBeLessThanOrEqual(5);
    }
  });

  it("运势落在已知三档之一", () => {
    const w = generateWeather(SEED);
    expect(["大吉", "中平", "小凶"]).toContain(w.fortune.label);
  });
});

describe("resolveAction", () => {
  it("雷阵雨外出 → 引雷淬体机缘", () => {
    const w = makeSpecialWeather("thunder");
    // 暴力穷举种子空间确保该天气能产出机缘（高基础率 0.25）
    let gotBoon = false;
    for (let age = 1; age <= 200 && !gotBoon; age++) {
      const r = resolveAction({ id: "x", age, quarter: 2 }, w, "wander");
      if (r.boon?.title === "引雷淬体") gotBoon = true;
    }
    expect(gotBoon).toBe(true);
  });

  it("雾天外出 → 迷路遇仙缘机缘", () => {
    const w = makeSpecialWeather("fog");
    let gotBoon = false;
    for (let age = 1; age <= 200 && !gotBoon; age++) {
      const r = resolveAction({ id: "x", age, quarter: 2 }, w, "wander");
      if (r.boon?.title === "迷路遇仙缘") gotBoon = true;
    }
    expect(gotBoon).toBe(true);
  });

  it("不宜外出的天气（台风）阻止外出且不给机缘", () => {
    const typhoon = WEATHER_TYPES.find((w) => w.key === "typhoon")!;
    const w: WeatherResult = {
      weather: typhoon,
      fortune: { key: "xiaoxiong", label: "小凶", desc: "略有些磕绊。" },
      mood: typhoon.moodDelta,
      season: 2,
      seasonLabel: "第2季",
      isSpecial: false,
    };
    const r = resolveAction(SEED, w, "wander");
    expect(r.boon).toBeUndefined();
    expect(r.moodEffect).toBe(-1);
  });

  it("静室打坐回复心情（不依赖外出）", () => {
    const r = resolveAction(SEED, makeSpecialWeather("thunder"), "meditate");
    expect(r.moodEffect).toBeGreaterThan(0);
    expect(r.boon).toBeUndefined();
  });

  it("观云测运返回运势文案", () => {
    const r = resolveAction(SEED, makeSpecialWeather("fog"), "readsky");
    expect(r.text).toContain("中平");
  });
});
