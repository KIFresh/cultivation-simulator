// 街机厅：投币开玩，手速与运气齐飞。
// 该模块对应的 API 路由由其他流程维护；此处提供自洽的游戏逻辑。

export interface ArcadeStat {
  coinsInserted: number;
  plays: number;
  wins: number;
  bestScore: number;
}

export function parseArcadeStats(raw: string | null | undefined): ArcadeStat {
  if (!raw) return { coinsInserted: 0, plays: 0, wins: 0, bestScore: 0 };
  try {
    const p: unknown = JSON.parse(raw);
    if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      return {
        coinsInserted: numOr(o.coinsInserted, 0),
        plays: numOr(o.plays, 0),
        wins: numOr(o.wins, 0),
        bestScore: numOr(o.bestScore, 0),
      };
    }
  } catch {
    // ignore
  }
  return { coinsInserted: 0, plays: 0, wins: 0, bestScore: 0 };
}

export interface ArcadePlayResult {
  stats: ArcadeStat;
  score: number;
  won: boolean;
  narrative: string;
}

const COIN_COST = 1;

/** 投币玩一局；score 由 seed 与手感共同决定。 */
export function playArcade(
  stats: ArcadeStat,
  seedInput?: string,
): ArcadePlayResult {
  const seed = hashSeed(seedInput ?? `${Date.now()}`);
  const rng = mulberry32(seed);
  const score = Math.floor(rng() * 1000);
  const won = score >= 600;
  const next: ArcadeStat = {
    coinsInserted: stats.coinsInserted + COIN_COST,
    plays: stats.plays + 1,
    wins: stats.wins + (won ? 1 : 0),
    bestScore: Math.max(stats.bestScore, score),
  };
  const narrative = won ? "屏幕炸开礼花，你刷新了纪录！" : "这局差了点运气，再来一次？";
  return { stats: next, score, won, narrative };
}

function numOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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
