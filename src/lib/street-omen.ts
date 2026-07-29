// 街头机缘：按「角色 + 年龄 + 季度 + 街区」种子生成，可复现、不改数值。
// 被 src/app/api/streets/route.ts 与 src/app/streets/page.tsx 使用。

export type DistrictKey = "oldtown" | "commercial" | "subway" | "park" | "bridge";

export interface District {
  key: DistrictKey;
  label: string;
  icon: string;
}

export const DISTRICTS: District[] = [
  { key: "oldtown", label: "老城区", icon: "🏚️" },
  { key: "commercial", label: "商业街", icon: "🏬" },
  { key: "subway", label: "地铁口", icon: "🚇" },
  { key: "park", label: "公园", icon: "🌳" },
  { key: "bridge", label: "天桥", icon: "🌉" },
];

export interface StreetOmen {
  icon: string;
  title: string;
  kind: string;
  text: string;
}

export interface BoonEntry {
  ts?: number;
  season?: number;
  title: string;
  detail: string;
}

export interface OmenResult {
  omen: StreetOmen;
  district: District;
  season: number;
  seasonLabel: string;
  boon?: BoonEntry;
}

interface OmenDef extends StreetOmen {
  minAge: number;
  boon?: { title: string; detail: string };
}

const OMEN_POOL: OmenDef[] = [
  {
    icon: "🧓",
    title: "云游道人",
    kind: "sage",
    text: "一位鹤发童颜的道人笑着看你，似有所指。",
    minAge: 16,
    boon: { title: "道人指点", detail: "道人临别留下一句口诀，萦绕心头。" },
  },
  {
    icon: "🏮",
    title: "深夜古董店老板",
    kind: "sage",
    text: "巷尾古董店亮着灯，老板邀你进去坐坐。",
    minAge: 18,
    boon: { title: "故物有灵", detail: "你在杂物里摸到一缕温润灵气。" },
  },
  {
    icon: "🐱",
    title: "蹭腿的橘猫",
    kind: "clue",
    text: "一只橘猫蹭了蹭你的腿，领你到一个墙角。",
    minAge: 0,
    boon: { title: "墙角铜钱", detail: "墙缝里嵌着一枚发亮的铜钱。" },
  },
  {
    icon: "📜",
    title: "飘落的传单",
    kind: "clue",
    text: "一张传单被风卷到你脚边，印着古怪符文。",
    minAge: 0,
  },
  {
    icon: "🍜",
    title: "街角面摊",
    kind: "clue",
    text: "面摊老板多给了你一勺浇头。",
    minAge: 0,
  },
  {
    icon: "🎻",
    title: "卖艺的少年",
    kind: "clue",
    text: "桥下有少年拉琴，曲调里竟藏着一丝韵律。",
    minAge: 0,
    boon: { title: "韵律入心", detail: "你跟着哼了两句，心境澄明。" },
  },
];

// 种子随机（与 weather / short-video 等模块同源思路）
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

export function generateStreetOmen(params: {
  id: string;
  age: number;
  quarter: number;
  district: DistrictKey;
}): OmenResult {
  const district = DISTRICTS.find((d) => d.key === params.district) ?? DISTRICTS[0];
  const rng = rngFromSeed(`${params.id}|${params.age}|${params.quarter}|${params.district}`);
  const available = OMEN_POOL.filter((o) => o.minAge <= params.age);
  const pool = available.length > 0 ? available : OMEN_POOL;
  const idx = Math.floor(rng() * pool.length) % pool.length;
  const base = pool[idx];

  let boon: BoonEntry | undefined;
  if (base.boon && rng() < 0.5) {
    // 由输入种子派生稳定时间戳，保证同一角色/年龄/季度/街区的结果可复现。
    boon = { ts: hashSeed(`${params.id}|${params.age}|${params.quarter}|${params.district}|boon`), season: params.quarter, title: base.boon.title, detail: base.boon.detail };
  }

  return {
    omen: { icon: base.icon, title: base.title, kind: base.kind, text: base.text },
    district,
    season: params.quarter,
    seasonLabel: `第${params.quarter}季`,
    boon,
  };
}

const STORAGE_PREFIX = "street_boons:";

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function loadStreetBoons(userId: string): BoonEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_PREFIX + userId);
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

export function saveStreetBoon(userId: string, boon: BoonEntry, _season?: number): BoonEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  const current = loadStreetBoons(userId);
  const next = [...current, boon].slice(-50);
  try {
    storage.setItem(STORAGE_PREFIX + userId, JSON.stringify(next));
  } catch {
    // 忽略写入失败（隐私模式等）
  }
  return next;
}
