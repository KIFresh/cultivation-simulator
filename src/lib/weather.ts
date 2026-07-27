// 天时录：天气生成（确定性）+ 外出/打坐/观云行动结算。
// 被 src/app/weather/page.tsx 与 __tests__/weather.test.ts 使用。
// short-video 模块复用本模块的 BoonEntry 类型。

export type WeatherAction = "wander" | "meditate" | "readsky";

export interface WeatherKind {
  key: string;
  label: string;
  desc: string;
  icon: string;
  moodDelta: number;
}

export interface Fortune {
  key: string;
  label: string;
  desc: string;
}

export interface BoonEntry {
  ts?: number;
  season?: number;
  title: string;
  detail: string;
}

export interface WeatherResult {
  weather: WeatherKind;
  fortune: Fortune;
  mood: number;
  season: number;
  seasonLabel: string;
  isSpecial: boolean;
  specialKey?: "temper" | "lost";
}

export interface ActionResult {
  action: WeatherAction;
  moodEffect: number;
  text: string;
  boon?: BoonEntry;
}

export const WEATHER_TYPES: WeatherKind[] = [
  { key: "sunny", label: "晴", desc: "天朗气清，惠风和畅。", icon: "☀️", moodDelta: 1 },
  { key: "cloudy", label: "多云", desc: "云卷云舒，不冷不热。", icon: "⛅", moodDelta: 0 },
  { key: "rain", label: "小雨", desc: "淅沥小雨，润物无声。", icon: "🌧️", moodDelta: -1 },
  { key: "thunder", label: "雷阵雨", desc: "电闪雷鸣，天地变色。", icon: "⛈️", moodDelta: -2 },
  { key: "fog", label: "浓雾", desc: "白雾弥漫，十步难辨。", icon: "🌫️", moodDelta: -1 },
  { key: "typhoon", label: "台风", desc: "狂风大作，不宜外出。", icon: "🌀", moodDelta: -3 },
  { key: "snow", label: "雪", desc: "瑞雪纷飞，天地素裹。", icon: "❄️", moodDelta: 0 },
];

const FORTUNES: Fortune[] = [
  { key: "daji", label: "大吉", desc: "气运昌隆，诸事顺遂。" },
  { key: "zhongping", label: "中平", desc: "平平无奇，安之若素。" },
  { key: "xiaoxiong", label: "小凶", desc: "略有磕绊，谨慎为佳。" },
];

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromSeed(seed: string): () => number {
  return mulberry32(hashSeed(seed));
}

/** 确定性生成天气：同角色同季度结果可复现。 */
export function generateWeather(seed: { id: string; age: number; quarter: number }): WeatherResult {
  const rng = rngFromSeed(`weather|${seed.id}|${seed.age}|${seed.quarter}`);
  const weather = WEATHER_TYPES[Math.floor(rng() * WEATHER_TYPES.length) % WEATHER_TYPES.length];
  const fortune = FORTUNES[Math.floor(rng() * FORTUNES.length) % FORTUNES.length];
  const mood = Math.max(-5, Math.min(5, weather.moodDelta + Math.floor(rng() * 3 - 1)));
  const isSpecial = weather.key === "thunder" || weather.key === "fog";
  const specialKey: "temper" | "lost" | undefined =
    weather.key === "thunder" ? "temper" : weather.key === "fog" ? "lost" : undefined;
  return {
    weather,
    fortune,
    mood,
    season: seed.quarter,
    seasonLabel: `第${seed.quarter}季`,
    isSpecial,
    specialKey,
  };
}

/** 结算一次天气行动。 */
export function resolveAction(
  cultivator: { id: string; age: number; quarter: number },
  weather: WeatherResult,
  action: WeatherAction,
): ActionResult {
  const rng = rngFromSeed(`act|${cultivator.id}|${cultivator.age}|${cultivator.quarter}|${weather.weather.key}|${action}`);
  let moodEffect = 0;
  let text = "";
  let boon: BoonEntry | undefined;

  if (action === "meditate") {
    moodEffect = 2;
    text = "于静室盘膝打坐，灵台渐澄，心境平和。";
  } else if (action === "readsky") {
    text = `观云测运，今日运势：${weather.fortune.label}。${weather.fortune.desc}`;
  } else {
    // wander
    if (weather.weather.key === "typhoon") {
      moodEffect = -1;
      text = "台风过境，外出不便，只得悻悻而归。";
    } else {
      moodEffect = 1;
      text = "信步闲游，市井烟火入眼，心情微悦。";
      if (weather.isSpecial && weather.specialKey === "temper" && rng() < 0.25) {
        boon = { ts: Date.now(), season: weather.season, title: "引雷淬体", detail: "雷声中，一丝雷气钻入经脉。" };
      } else if (weather.isSpecial && weather.specialKey === "lost" && rng() < 0.25) {
        boon = { ts: Date.now(), season: weather.season, title: "迷路遇仙缘", detail: "雾中迷路，误入一处洞天。" };
      }
    }
  }

  return { action, moodEffect, text, boon };
}

const BOON_STORAGE_PREFIX = "weather_boons:";

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function loadBoons(userId: string): BoonEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(BOON_STORAGE_PREFIX + userId);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is BoonEntry => !!b && typeof b === "object" && typeof (b as { title?: unknown }).title === "string",
    );
  } catch {
    return [];
  }
}

export function saveBoon(userId: string, boon: BoonEntry, _season?: number): BoonEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  const current = loadBoons(userId);
  const next = [...current, boon].slice(-50);
  try {
    storage.setItem(BOON_STORAGE_PREFIX + userId, JSON.stringify(next));
  } catch {
    // 忽略写入失败
  }
  return next;
}
