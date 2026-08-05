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
  maxAge?: number;
  effects: LocationEventEffect;
}

export type AttrExpMap = Record<string, { exp: number; level: number }>;

export const LOCATION_EVENT_POOL: Record<string, LocationEvent[]> = {
  home: [
    {
      id: "home_tidy_luck",
      title: "整理旧物",
      description: "你在杂物间翻出一本蒙尘的笔记，竟夹着一张旧彩票。",
      minAge: 1,
      effects: { attrExp: { luck: 3 }, memory: true },
    },
    {
      id: "home_dinner",
      title: "家庭晚餐",
      description: "一家人围坐吃晚饭，你讲了件白天的趣事，逗得大家直笑。",
      minAge: 1,
      effects: { attrExp: { charm: 2, mind: 1 } },
    },
    {
      id: "home_neighbor",
      title: "邻居串门",
      description: "邻居阿姨来串门，夸你有礼貌，还塞给你一把糖果。",
      minAge: 1,
      effects: { attrExp: { charm: 3 } },
    },
    {
      id: "home_blackout",
      title: "突然停电",
      description: "晚上突然停电，你摸黑帮家人点起蜡烛，倒也不慌。",
      minAge: 1,
      effects: { attrExp: { mind: 2, luck: 1 } },
    },
    {
      id: "home_album",
      title: "发现旧相册",
      description: "你在柜底翻出家里的旧相册，一张张看过去，心里暖融融的。",
      minAge: 1,
      effects: { attrExp: { mind: 3 } },
    },
    {
      id: "home_vase",
      title: "打碎花瓶",
      description: "你追跑打闹时碰倒了客厅的花瓶，碎了一地，挨了顿训。",
      minAge: 1,
      effects: { attrExp: { mind: -2 } },
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
    {
      id: "kg_snack",
      title: "分享零食",
      description: "你把带来的饼干分给小朋友，大家都围着你玩。",
      minAge: 3,
      effects: { attrExp: { charm: 3 } },
    },
    {
      id: "kg_drawing",
      title: "画画被表扬",
      description: "你画的太阳公公被老师贴在墙上，还当众表扬了你。",
      minAge: 3,
      effects: { attrExp: { mind: 2, charm: 1 } },
    },
    {
      id: "kg_wet",
      title: "尿裤子",
      description: "午睡起来你尿了裤子，被小朋友笑话了好一阵。",
      minAge: 3,
      maxAge: 6,
      effects: { attrExp: { charm: -2 } },
    },
  ],
  school: [
    {
      id: "school_library",
      title: "藏书阁漫游",
      description: "你在图书馆角落翻到一本奇书。",
      minAge: 6,
      maxAge: 15,
      effects: { attrExp: { insight: 3 }, memory: true },
    },
    {
      id: "school_club",
      title: "社团招新",
      description: "你被拉进一个古怪的社团。",
      minAge: 6,
      maxAge: 15,
      effects: { charm: 2, npcMeet: "club_senior" },
    },
    {
      id: "school_recess",
      title: "课间打闹",
      description: "课间你和同学追逐打闹，被老师罚站了一节课。",
      minAge: 6,
      maxAge: 12,
      effects: { attrExp: { charm: 2, mind: -1 } },
    },
    {
      id: "school_reading",
      title: "图书馆偶遇",
      description: "你在图书馆偶遇一位学长，他向你推荐了一本有意思的书。",
      minAge: 6,
      maxAge: 18,
      effects: { attrExp: { insight: 3 } },
    },
    {
      id: "school_sports",
      title: "运动会选拔",
      description: "校运动会选拔，你被老师点名代表班级参赛。",
      minAge: 6,
      maxAge: 15,
      effects: { attrExp: { root: 2, charm: 1 } },
    },
    {
      id: "school_exam_fail",
      title: "考试失利",
      description: "这次考试你没考好，卷子上的红叉格外刺眼。",
      minAge: 10,
      maxAge: 18,
      effects: { attrExp: { mind: 3 } },
    },
    {
      id: "school_countdown",
      title: "高考倒计时",
      description: "黑板上的倒计时一天天变少，你忽然觉得该拼命了。",
      minAge: 15,
      maxAge: 18,
      effects: { attrExp: { mind: 3 } },
    },
    {
      id: "school_crush",
      title: "暗恋心事",
      description: "你偷偷喜欢上了隔壁班的一个同学，上课总忍不住走神。",
      minAge: 15,
      maxAge: 18,
      effects: { attrExp: { charm: 2, mind: 1 } },
    },
    {
      id: "school_defiance",
      title: "顶撞老师",
      description: "你当众顶撞了老师一句，气氛一时僵住。",
      minAge: 15,
      maxAge: 18,
      effects: { attrExp: { mind: 2, charm: -1 } },
    },
    {
      id: "school_injury",
      title: "打闹受伤",
      description: "你和同学打闹时摔了一跤，膝盖磕破了皮。",
      minAge: 6,
      maxAge: 12,
      effects: { healthDelta: -3, attrExp: { root: -1 } },
    },
    {
      id: "school_extort",
      title: "被勒索零花钱",
      description: "校门口几个高年级学生堵住你，要走了你的零花钱。",
      minAge: 12,
      maxAge: 18,
      effects: { goldDelta: -10, attrExp: { mind: -2 } },
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
    {
      id: "dt_music",
      title: "街头表演",
      description: "广场上有人在弹唱，你驻足听了很久，心里也跟着打拍子。",
      minAge: 12,
      effects: { attrExp: { mind: 2, luck: 1 } },
    },
    {
      id: "dt_lost",
      title: "迷路问路",
      description: "你在街上迷了路，鼓起勇气向路人问路，顺利回了家。",
      minAge: 12,
      effects: { attrExp: { charm: 2, mind: 1 } },
    },
    {
      id: "dt_pickpocket",
      title: "钱包被偷",
      description: "人潮里有人撞了你一下，等回过神，口袋里的钱包已经不见了。",
      minAge: 12,
      effects: { goldDelta: -15 },
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
  const pool = (LOCATION_EVENT_POOL[locationId] || []).filter(
    (e) => e.minAge <= age && (!e.maxAge || age <= e.maxAge)
  );
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
