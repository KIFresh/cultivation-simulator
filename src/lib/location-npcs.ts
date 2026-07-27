// 地点专属 NPC 系统（Phase 2 地点生态扩展）
// 复用 cultivator.npcRelations（type:"location_npc"，与邻里 type:"neighbor" 区分），零新增 schema。
// 与邻里系统零冲突；Phase 1 事件 npcMeet 写入的同类型桩也能在此被识别互动。
// 灵根仅作叙事风味传入，绝不修改 spiritualRoot。

import { getFateFirstMeetOffset } from "@/lib/encounter-data";

export type AttrKey = "root" | "spirit" | "insight" | "luck" | "charm" | "mind";

export interface LocationNpc {
  name: string;
  type: "location_npc";
  avatar: string;
  realm: string; // 该地点的身份/职业描述
  intimacy: number; // 0-100
  location: string;
  metAt: number; // 遇见年龄
  intro?: string;
}

export type LocationNpcAction = "gossip" | "gift" | "help";

export interface LocationNpcInteractionResult {
  action: LocationNpcAction;
  npcName: string;
  flavor: string;
  intimacyDelta: number;
  goldDelta: number; // 负值=花费
  attr?: AttrKey;
  attrDelta?: number;
}

interface LocationNpcSeed {
  name: string;
  avatar: string;
  realm: string;
  intro?: string;
}

// 13 个地点的常驻 NPC（每地 1-2 位）
export const LOCATION_NPC_POOL: Record<string, LocationNpcSeed[]> = {
  park: [
    { name: "遛鸟老爷子", avatar: "🧓", realm: "每天来公园遛画眉的老爷子", intro: "鸟笼一挂，能跟你聊半部江湖。" },
    { name: "滑板少年", avatar: "🛹", realm: "常来刷板的叛逆少年", intro: "摔了无数次，笑起来却灿烂。" },
  ],
  kindergarten: [
    { name: "带班老师小鹿", avatar: "👩‍🏫", realm: "温柔的幼儿园老师", intro: "最会哄哭鼻子的小孩。" },
    { name: "同桌豆豆", avatar: "🧒", realm: "总黏人的同桌", intro: "分享零食的第一人选。" },
  ],
  library: [
    { name: "图书管理员", avatar: "📚", realm: "戴眼镜的图书馆管理员", intro: "闭眼都能找出任意一本书。" },
    { name: "考研学长", avatar: "🧑‍🎓", realm: "占座复习的考研党", intro: "笔记厚得能当砖头。" },
  ],
  clinic: [
    { name: "护士长", avatar: "👩‍⚕️", realm: "爱叮嘱人的护士长", intro: "量个体温也要念叨三遍。" },
    { name: "老中医", avatar: "👴", realm: "捻须问诊的老中医", intro: "搭脉便知你熬了几个夜。" },
  ],
  store_furniture: [
    { name: "家具店老板", avatar: "🧑‍🔧", realm: "热情的家具店店主", intro: "恨不得把整间店搬给你。" },
    { name: "陈列师阿木", avatar: "🪑", realm: "挑剔的陈列设计师", intro: "偏要和你争论什么叫美感。" },
  ],
  mall: [
    { name: "柜姐小美", avatar: "💁", realm: "甜美的化妆品柜姐", intro: "试妆镜前最懂捧场。" },
    { name: "美食主播", avatar: "🍰", realm: "在美食区直播的博主", intro: "举着手机边吃边解说。" },
  ],
  downtown: [
    { name: "街头艺人", avatar: "🎻", realm: "广场拉琴的艺人", intro: "琴声里藏着故事。" },
    { name: "算命半仙", avatar: "🔮", realm: "摆摊的江湖半仙", intro: "眯眼一笑：'你印堂发亮啊。'" },
  ],
  store_snack: [
    { name: "小卖部老板娘", avatar: "🍬", realm: "记忆力超好的老板娘", intro: "谁欠一包辣条都记得。" },
  ],
  home: [
    { name: "对门小伙伴", avatar: "🧒", realm: "住对门同龄的孩子", intro: "放学就扒着门框喊你玩。" },
  ],
  school: [
    { name: "班主任", avatar: "👨‍🏫", realm: "严厉的班主任", intro: "后脑勺都长着眼睛。" },
    { name: "损友同桌", avatar: "🧑", realm: "爱搞怪的同桌", intro: "上课递纸条的专业户。" },
  ],
  wild: [
    { name: "采药山民", avatar: "🌿", realm: "背篓采药的山民", intro: "认得满山的草草木木。" },
    { name: "巡山猎户", avatar: "🏹", realm: "巡山的老猎户", intro: "耳尖，林子里风吹草动都听得到。" },
  ],
  cave: [
    { name: "引路童子", avatar: "🧚", realm: "洞府前的引路童子", intro: "踮脚给你指石门的方向。" },
    { name: "闭关师兄", avatar: "🧘", realm: "正在闭关的炼气师兄", intro: "偶尔出定，点你一句。" },
  ],
  market: [
    { name: "符箓摊主", avatar: "🪬", realm: "话密的卖符老者", intro: "一张符能讲出三段典故。" },
    { name: "鉴宝师傅", avatar: "🔍", realm: "眯眼鉴宝的师傅", intro: "一眼便知真伪。" },
  ],
};

// ——— 种子随机（与 neighbors / short-video / weather 同实现）———
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
    return ((t ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFrom(id: string, salt: string): () => number {
  return mulberry32(hashSeed(`${id}:${salt}:locnpc`));
}

export const clampIntimacy = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

// 首访生成 1-2 位该地点 NPC（基于角色 id + 地点 + 年龄，可复现）
export function rollInitialLocationNpcs(
  cultivatorId: string,
  locationId: string,
  age: number,
  fate?: string | null,
): LocationNpc[] {
  const pool = [...(LOCATION_NPC_POOL[locationId] || [])];
  if (pool.length === 0) return [];
  const rng = rngFrom(cultivatorId, `init:${locationId}:${age}`);
  const count = Math.min(pool.length, 1 + Math.floor(rng() * 2)); // 1-2
  const picked: LocationNpc[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const s = pool.splice(idx, 1)[0];
    picked.push({
      name: s.name,
      type: "location_npc",
      avatar: s.avatar,
      realm: s.realm,
      intimacy: clampIntimacy(10 + getFateFirstMeetOffset(fate)),
      location: locationId,
      metAt: age,
      intro: s.intro,
    });
  }
  return picked;
}

// 互动效果（确定性，便于测试与复现）
export function interactLocationNpc(
  npc: LocationNpc,
  action: LocationNpcAction,
): LocationNpcInteractionResult {
  switch (action) {
    case "gossip":
      return {
        action,
        npcName: npc.name,
        flavor: `你和${npc.name}唠了会儿家常，${npc.realm}的话题总是热乎乎的。`,
        intimacyDelta: 3,
        goldDelta: 0,
        attr: "charm",
        attrDelta: 1,
      };
    case "gift":
      return {
        action,
        npcName: npc.name,
        flavor: `你给${npc.name}送了点小心意，他（她）乐得合不拢嘴。`,
        intimacyDelta: 8,
        goldDelta: -5,
        attr: "charm",
        attrDelta: 1,
      };
    case "help":
      return {
        action,
        npcName: npc.name,
        flavor: `你帮${npc.name}搭了把手，情分又深了一层，临走还塞给你点零钱。`,
        intimacyDelta: 5,
        goldDelta: 10,
        attr: "mind",
        attrDelta: 1,
      };
  }
}

export const LOCATION_NPC_ACTION_DEFS: Record<
  LocationNpcAction,
  { label: string; icon: string; desc: string; cost: number }
> = {
  gossip: { label: "唠家常", icon: "💬", desc: "免费，聊聊天拉近距离", cost: 0 },
  gift: { label: "送心意", icon: "🎁", desc: "花费 5 金币，亲密度大涨", cost: 5 },
  help: { label: "搭把手", icon: "🤝", desc: "免费，偶尔得点回报", cost: 0 },
};

export function isLocationNpc(v: unknown): v is LocationNpc {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { type?: string }).type === "location_npc"
  );
}
