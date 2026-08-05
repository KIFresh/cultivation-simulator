// 地点事件：每个地点一组随机事件，按天稳定、按年龄门槛过滤。
// 被 src/app/api/location-event/route.ts 与 src/app/location-event/page.tsx 使用。

export interface LocationEventEffect {
  goldDelta?: number;
  healthDelta?: number;
  attrExp?: Record<string, number>;
  npcMeet?: string;
  memory?: boolean;
  charm?: number;
}

export interface LocationEvent {
  id: string;
  title: string;
  description: string;
  minAge: number;
  effects: LocationEventEffect;
}

export type AttrExpMap = Record<string, { exp: number; level: number }>;

export const LOCATION_EVENT_POOL: Record<string, LocationEvent[]> = {
  home: [
    {
      id: "home_tidy_mind",
      title: "整理旧物",
      description: "你在杂物间翻出一本蒙尘的笔记，旧物勾起思绪。",
      minAge: 1,
      effects: { attrExp: { mind: 3 }, memory: true },
    },
    {
      id: "home_tidy_luck",
      title: "整理旧物",
      description: "你在杂物间翻出一本蒙尘的笔记，竟夹着一张旧彩票。",
      minAge: 1,
      effects: { attrExp: { luck: 3 }, memory: true },
    },
    {
      id: "home_garden",
      title: "院中静坐",
      description: "你在院子里看了半天蚂蚁搬家，竟有些入定。",
      minAge: 3,
      effects: { healthDelta: 2, attrExp: { mind: 2 } },
    },
  ],
  kindergarten: [
    {
      id: "kindergarten_toy",
      title: "抢玩具",
      description: "幼儿园里，小朋友抢走了你手里的玩具车。",
      minAge: 3,
      effects: { attrExp: { charm: 3, mind: 2 } },
    },
    {
      id: "kindergarten_nap",
      title: "午睡吃饭",
      description: "午睡起来，你乖乖吃完了小碗里的饭菜。",
      minAge: 3,
      effects: { healthDelta: 2, attrExp: { root: 2 } },
    },
  ],
  downtown: [
    {
      id: "downtown_price",
      title: "认识菜价",
      description: "菜市场里，你跟着妈妈认了认今天的菜价。",
      minAge: 7,
      effects: { attrExp: { charm: 2, luck: 3 } },
    },
    {
      id: "downtown_account",
      title: "帮妈妈算账",
      description: "你帮妈妈心算找零，居然分毫不差。",
      minAge: 7,
      effects: { attrExp: { charm: 2, insight: 3 } },
    },
  ],
  school: [
    {
      id: "school_library",
      title: "藏书阁漫游",
      description: "你在图书馆角落翻到一本奇书。",
      minAge: 7,
      effects: { attrExp: { insight: 3 }, memory: true },
    },
    {
      id: "school_club",
      title: "社团招新",
      description: "你被拉进一个古怪的社团。",
      minAge: 7,
      effects: { charm: 2, npcMeet: "club_senior" },
    },
  ],
};

/** 按天稳定地摇取一个地点事件（同人同地同日可复现）。 */
export function rollLocationEvent(
  cultivatorId: string,
  locationId: string,
  age: number,
  dayKey: string
): LocationEvent | null {
  const pool = (LOCATION_EVENT_POOL[locationId] || []).filter((e) => e.minAge <= age);
  if (pool.length === 0) return null;
  let h = 1779033703 ^ cultivatorId.length;
  const seedStr = `${cultivatorId}|${locationId}|${dayKey}`;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rng = (h >>> 0) / 4294967296;
  const idx = Math.floor(rng * pool.length) % pool.length;
  return pool[idx] ?? null;
}

/**
 * 把增量经验叠加进属性经验表，等级按 100×level^1.5 曲线折算（升到 L 级需 100×L^1.5 经验）。
 * 升级时反写 attributes[attr] += 升级级数；旧存档中 attributeExp 若存的是裸数字/非对象，视为 0 经验。
 */
// ponytail: O(n) loop per call, fine for 6 attributes
function levelFromExp(exp: number): number {
  if (exp <= 0) return 0;
  let lv = 0;
  while (exp >= Math.ceil(100 * Math.pow(lv + 1, 1.5))) lv++;
  return lv;
}

export function addAttrExp(
  current: AttrExpMap,
  delta: Record<string, number>,
  attributes?: Record<string, number>
): AttrExpMap {
  const next: AttrExpMap = {};
  for (const [key, raw] of Object.entries(current)) {
    const exp =
      raw && typeof raw === "object" && typeof raw.exp === "number" && Number.isFinite(raw.exp)
        ? raw.exp
        : 0;
    next[key] = { exp, level: levelFromExp(exp) };
  }
  for (const [key, value] of Object.entries(delta)) {
    const cur = next[key] || { exp: 0, level: 0 };
    const exp = cur.exp + value;
    const level = levelFromExp(exp);
    next[key] = { exp, level };
    if (attributes && level > cur.level) {
      attributes[key] = (attributes[key] || 0) + (level - cur.level);
    }
  }
  return next;
}

/** 生成一个地点 NPC 桩（Phase 2 扩展互动用）。 */
export function makeLocationNpcStub(
  npcId: string,
  locationId: string,
  age: number
): Record<string, unknown> {
  return {
    npcId,
    locationId,
    metAtAge: age,
    metAt: new Date().toISOString(),
    affinity: 0,
  };
}
