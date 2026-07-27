// 邻里系统：复用 cultivator.npcRelations（type:"neighbor"），零新增 schema，不碰 rogue 地点系统的 localNPCs。
// 邻居首访按「角色 id + 年龄」种子生成；互动（唠家常/送心意/搭把手）影响亲密度与金币/属性。
// 灵根仅作叙事风味传入，绝不修改 spiritualRoot。

import { getFateFirstMeetOffset } from "@/lib/encounter-data";

export type AttrKey = "root" | "spirit" | "insight" | "luck" | "charm" | "mind";

export interface NeighborNpc {
  name: string;
  avatar: string;
  realm: string; // 凡人世界的身份描述
  intimacy: number; // 0-100
  category: string; // 固定 "邻里"
  metAt: number; // 遇见年龄
  type: "neighbor";
}

export type NeighborAction = "gossip" | "gift" | "help";

export interface NeighborInteractionResult {
  action: NeighborAction;
  neighborName: string;
  flavor: string;
  intimacyDelta: number;
  goldDelta: number; // 负值=花费
  attr?: AttrKey;
  attrDelta?: number;
}

interface NeighborSeed {
  name: string;
  avatar: string;
  realm: string;
}

const NEIGHBOR_POOL: NeighborSeed[] = [
  { name: "王大妈", avatar: "👵", realm: "热心肠的居委会大妈" },
  { name: "李叔", avatar: "👨", realm: "会修自行车的邻居大叔" },
  { name: "小张", avatar: "🧑", realm: "同龄的小区玩伴" },
  { name: "陈奶奶", avatar: "👵", realm: "慈祥的独居老人" },
  { name: "赵哥", avatar: "🧑", realm: "爱运动的体育生" },
  { name: "刘阿姨", avatar: "👩", realm: "手艺好的面点摊主" },
];

// ——— 种子随机（与 short-video / weather 同实现）———
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (s >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFrom(id: string, salt: string): () => number {
  return mulberry32(hashSeed(`${id}:${salt}:neighbors`));
}

const clampIntimacy = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

// 首访生成 2-4 个邻居（基于角色 id + 年龄，可复现）
export function rollInitialNeighbors(cultivatorId: string, age: number, fate?: string | null): NeighborNpc[] {
  const rng = rngFrom(cultivatorId, `init:${age}`);
  const count = 2 + Math.floor(rng() * 3); // 2-4
  const pool = [...NEIGHBOR_POOL];
  const picked: NeighborNpc[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const s = pool.splice(idx, 1)[0];
    picked.push({
      name: s.name,
      avatar: s.avatar,
      realm: s.realm,
      intimacy: clampIntimacy(10 + getFateFirstMeetOffset(fate)),
      category: "邻里",
      metAt: age,
      type: "neighbor",
    });
  }
  return picked;
}

// 互动效果（确定性，便于测试与复现）
export function interactNeighbor(neighbor: NeighborNpc, action: NeighborAction): NeighborInteractionResult {
  switch (action) {
    case "gossip":
      return {
        action,
        neighborName: neighbor.name,
        flavor: `你和${neighbor.name}唠了会儿家常，邻里间的话题总是热乎乎的。`,
        intimacyDelta: 3,
        goldDelta: 0,
        attr: "charm",
        attrDelta: 1,
      };
    case "gift":
      return {
        action,
        neighborName: neighbor.name,
        flavor: `你给${neighbor.name}送了点小心意，她（他）乐得合不拢嘴。`,
        intimacyDelta: 8,
        goldDelta: -5,
        attr: "charm",
        attrDelta: 1,
      };
    case "help":
      return {
        action,
        neighborName: neighbor.name,
        flavor: `你帮${neighbor.name}搭了把手，邻里情分又深了一层，临走还塞给你点零钱。`,
        intimacyDelta: 5,
        goldDelta: 10,
        attr: "mind",
        attrDelta: 1,
      };
  }
}

export const NEIGHBOR_ACTION_DEFS: Record<
  NeighborAction,
  { label: string; icon: string; desc: string; cost: number }
> = {
  gossip: { label: "唠家常", icon: "💬", desc: "免费，聊聊天拉近距离", cost: 0 },
  gift: { label: "送心意", icon: "🎁", desc: "花费 5 金币，亲密度大涨", cost: 5 },
  help: { label: "搭把手", icon: "🤝", desc: "免费，偶尔得点回报", cost: 0 },
};

export function isNeighbor(v: unknown): v is NeighborNpc {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { type?: string }).type === "neighbor"
  );
}

export { clampIntimacy };
