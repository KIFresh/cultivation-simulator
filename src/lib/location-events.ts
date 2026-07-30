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
      id: "home_tidy",
      title: "整理旧物",
      description: "你在杂物间翻出一本蒙尘的笔记。",
      minAge: 1,
      effects: { goldDelta: 0, attrExp: { insight: 5 }, memory: true },
    },
    {
      id: "home_garden",
      title: "院中静坐",
      description: "你在院子里看了半天蚂蚁搬家，竟有些入定。",
      minAge: 3,
      effects: { healthDelta: 2, attrExp: { mind: 4 } },
    },
  ],
  market: [
    {
      id: "market_pickpocket",
      title: "小偷出没",
      description: "人群里一只手伸向你的口袋。",
      minAge: 6,
      effects: { goldDelta: -10, healthDelta: -2 },
    },
    {
      id: "market_luck",
      title: "地摊捡漏",
      description: "你在地摊上淘到一件看似普通的物件。",
      minAge: 8,
      effects: { goldDelta: 15, attrExp: { luck: 3 } },
    },
  ],
  mountain: [
    {
      id: "mountain_spring",
      title: "山泉煮茶",
      description: "你掬一捧山泉，灵气隐隐。",
      minAge: 5,
      effects: { healthDelta: 5, attrExp: { spirit: 4 }, npcMeet: "hermit" },
    },
    {
      id: "mountain_fall",
      title: "失足滑落",
      description: "山路湿滑，你摔了一跤。",
      minAge: 4,
      effects: { healthDelta: -8 },
    },
  ],
  school: [
    {
      id: "school_library",
      title: "藏书阁漫游",
      description: "你在图书馆角落翻到一本奇书。",
      minAge: 7,
      effects: { attrExp: { insight: 6 }, memory: true },
    },
    {
      id: "school_club",
      title: "社团招新",
      description: "你被拉进一个古怪的社团。",
      minAge: 7,
      effects: { charm: 2, npcMeet: "club_senior" },
    },
  ],
  clinic: [
    {
      id: "clinic_herb",
      title: "药庐帮忙",
      description: "你在药庐帮老大夫分拣草药。",
      minAge: 6,
      effects: { healthDelta: 3, attrExp: { spirit: 3 } },
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

/** 把增量经验叠加进属性经验表，并按 100 经验/级折算等级。 */
export function addAttrExp(current: AttrExpMap, delta: Record<string, number>): AttrExpMap {
  const next: AttrExpMap = { ...current };
  for (const [key, value] of Object.entries(delta)) {
    const cur = next[key] || { exp: 0, level: 0 };
    const exp = cur.exp + value;
    next[key] = { exp, level: Math.floor(exp / 100) };
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
