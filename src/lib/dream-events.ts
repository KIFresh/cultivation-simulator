// 梦境预兆：纯氛围 + 命运预告，不改任何数值。
// 被 src/app/api/dream/route.ts 使用。

export interface Dream {
  title: string;
  narrative: string;
  omen?: string;
  root?: string;
}

interface DreamDef {
  root?: string;
  title: string;
  narrative: string;
  omen?: string;
}

const DREAM_POOL: DreamDef[] = [
  {
    root: "chaos",
    title: "混沌初开",
    narrative: "梦里有团无序的光，渐渐有了形状。",
    omen: "命数未定",
  },
  {
    root: "gold",
    title: "金山压顶",
    narrative: "你梦见自己被金光托起，落地生财。",
    omen: "利在财货",
  },
  {
    root: "wood",
    title: "老树盘根",
    narrative: "一棵古木在梦中舒展枝叶，生机盎然。",
    omen: "根基渐稳",
  },
  { root: "water", title: "长河入海", narrative: "你顺流而下，汇入无垠汪洋。", omen: "运势流转" },
  {
    root: "fire",
    title: "炉火纯青",
    narrative: "梦里有团火，越烧越旺，却不灼人。",
    omen: "心火炽盛",
  },
  { root: "earth", title: "厚土载物", narrative: "大地在脚下延展，沉稳如山。", omen: "根基深厚" },
];

const GENERIC_DREAMS: DreamDef[] = [
  { title: "云端漫步", narrative: "你轻盈地踩在云上，俯瞰人间灯火。" },
  { title: "旧友重逢", narrative: "梦里遇见许久未见的故人，相视一笑。" },
  { title: "远方钟声", narrative: "幽远的钟声自天边传来，心莫名安定。" },
];

/** 根据灵根与年龄挑一个梦境（确定性不必，但保持轻量）。 */
export function pickDream(spiritualRoot: string, age: number): Dream {
  const matched = DREAM_POOL.filter((d) => d.root === spiritualRoot);
  const pool = matched.length > 0 ? matched : GENERIC_DREAMS;
  const idx = Math.abs(hashCode(`${spiritualRoot}|${age}`)) % pool.length;
  const def = pool[idx];
  return { title: def.title, narrative: def.narrative, omen: def.omen, root: spiritualRoot };
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}
